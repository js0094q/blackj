import { HILO_VALUES, normalizeRank, getTrueCount, getExactTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

const MYBOOKIE_RULES = Object.freeze({
  venue: 'MYBOOKIE.AG LIVE',
  decks: 6,
  dealer: 'H17',
  surrender: 'LS',
  splitAces: 'ONE_CARD_ONLY',
  wongInTc: 1
});

const STORAGE_KEY = 'blackj-mybookie-config-v1';
const BANKROLL_MIGRATION_KEY = 'blackj-bankroll-default-100-migrated-v1';
const HISTORY_LIMIT = 400;
const MIN_CARDS_FOR_BETTING = 52;
const BETTING_DECK_RESOLUTION = 0.5;
const CONFIDENCE_INPUT_TARGET_CARDS = 156;
const CONFIDENCE_PENETRATION_TARGET = 0.5;

const DEFAULT_SETTINGS = Object.freeze({
  startingBankroll: 100,
  unitPct: 1,
  spreadCap: 12,
  otherPlayers: 3,
  ramp: [
    { minTc: 5, units: 8 },
    { minTc: 4, units: 6 },
    { minTc: 3, units: 4 },
    { minTc: 2, units: 2 },
    { minTc: 1, units: 1 }
  ]
});

const state = {
  rc: 0,
  totalDecks: MYBOOKIE_RULES.decks,
  cardsSeen: 0,
  dealerCards: [],
  hand: [],
  tableCards: [],
  otherPlayerHands: [],
  nextOtherSeat: 0,
  mode: 'dealer',
  autoFlow: false,
  autoStage: 'player',
  smartInput: true,
  nextCardMode: null,
  history: [],
  inputLog: [],
  settings: loadSettings(),
  bankroll: 0,
  performance: {
    wins: 0,
    losses: 0,
    pushes: 0,
    hands: 0,
    profitUnits: 0,
    profitDollars: 0,
    byAction: {}
  },
  lastRecommendedAction: null,
  lastBetUnits: 0,
  lastResult: '--'
};

state.bankroll = state.settings.startingBankroll;
syncOtherPlayerHands();

const el = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  tcBand: document.getElementById('tc-band'),
  decks: document.getElementById('decks-left'),
  recAction: document.getElementById('rec-action'),
  recReason: document.getElementById('rec-reason'),
  dispDealer: document.getElementById('disp-dealer'),
  dispDealerTotal: document.getElementById('disp-dealer-total'),
  dispPlayer: document.getElementById('disp-player'),
  dispTable: document.getElementById('disp-table'),
  modeIndicator: document.getElementById('mode-indicator-val'),
  flowIndicator: document.getElementById('flow-indicator-val'),
  inputLog: document.getElementById('input-log'),
  edgeVal: document.getElementById('edge-val'),
  betUnits: document.getElementById('bet-units'),
  betTcVal: document.getElementById('bet-tc-val'),
  countConfVal: document.getElementById('count-conf-val'),
  wongVal: document.getElementById('wong-val'),
  bankrollVal: document.getElementById('bankroll-val'),
  unitVal: document.getElementById('unit-val'),
  handBetVal: document.getElementById('hand-bet-val'),
  recWinrate: document.getElementById('rec-winrate'),
  statsHands: document.getElementById('stats-hands'),
  statsWlp: document.getElementById('stats-wlp'),
  statsProfit: document.getElementById('stats-profit'),
  statsLast: document.getElementById('stats-last'),
  stateTag: document.getElementById('state-tag'),
  devTag: document.getElementById('dev-tag'),
  actionCard: document.getElementById('action-card'),
  cfgBankroll: document.getElementById('cfg-bankroll'),
  cfgUnitPct: document.getElementById('cfg-unit-pct'),
  cfgSpreadCap: document.getElementById('cfg-spread-cap'),
  cfgOtherPlayers: document.getElementById('cfg-other-players'),
  cfgApply: document.getElementById('cfg-apply'),
  statsReset: document.getElementById('stats-reset'),
  btnWin: document.getElementById('btn-win'),
  btnLoss: document.getElementById('btn-loss'),
  btnPush: document.getElementById('btn-push')
};

for (let i = 1; i <= 5; i++) {
  el[`cfgTc${i}`] = document.getElementById(`cfg-tc-${i}`);
  el[`cfgUnits${i}`] = document.getElementById(`cfg-units-${i}`);
}

bindUiEvents();
renderSettingsForm();
render();
window.addEventListener('keydown', handleKey);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSettings(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    const normalized = normalizeSettings(parsed);

    if (!localStorage.getItem(BANKROLL_MIGRATION_KEY) && normalized.startingBankroll === 10000) {
      normalized.startingBankroll = DEFAULT_SETTINGS.startingBankroll;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }

    localStorage.setItem(BANKROLL_MIGRATION_KEY, '1');
    return normalized;
  } catch {
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function cloneSettings(settings) {
  return {
    startingBankroll: settings.startingBankroll,
    unitPct: settings.unitPct,
    spreadCap: settings.spreadCap,
    otherPlayers: settings.otherPlayers,
    ramp: settings.ramp.map((row) => ({ minTc: row.minTc, units: row.units }))
  };
}

function sanitizeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildOtherPlayerHands(count) {
  return Array.from({ length: count }, () => []);
}

function syncOtherPlayerHands(preserveExisting = true) {
  const count = Math.max(0, Math.round(sanitizeNum(state.settings?.otherPlayers, DEFAULT_SETTINGS.otherPlayers)));
  const existing = state.otherPlayerHands || [];
  const hands = buildOtherPlayerHands(count);

  if (preserveExisting) {
    for (let i = 0; i < Math.min(existing.length, hands.length); i++) {
      hands[i] = [...existing[i]];
    }
  }

  state.otherPlayerHands = hands;
  state.nextOtherSeat = count > 0 ? state.nextOtherSeat % count : 0;
}

function normalizeSettings(input) {
  const merged = {
    startingBankroll: sanitizeNum(input?.startingBankroll, DEFAULT_SETTINGS.startingBankroll),
    unitPct: sanitizeNum(input?.unitPct, DEFAULT_SETTINGS.unitPct),
    spreadCap: sanitizeNum(input?.spreadCap, DEFAULT_SETTINGS.spreadCap),
    otherPlayers: sanitizeNum(input?.otherPlayers, DEFAULT_SETTINGS.otherPlayers),
    ramp: Array.isArray(input?.ramp) ? input.ramp : DEFAULT_SETTINGS.ramp
  };

  merged.startingBankroll = Math.max(100, merged.startingBankroll);
  merged.unitPct = Math.max(0.1, Math.min(10, merged.unitPct));
  merged.spreadCap = Math.max(1, Math.round(merged.spreadCap));
  merged.otherPlayers = Math.max(0, Math.min(6, Math.round(merged.otherPlayers)));

  const cleanRamp = merged.ramp
    .slice(0, 5)
    .map((row, idx) => ({
      minTc: sanitizeNum(row?.minTc, DEFAULT_SETTINGS.ramp[idx]?.minTc ?? 1),
      units: Math.max(0, Math.round(sanitizeNum(row?.units, DEFAULT_SETTINGS.ramp[idx]?.units ?? 0)))
    }));

  while (cleanRamp.length < 5) {
    const idx = cleanRamp.length;
    cleanRamp.push({ ...DEFAULT_SETTINGS.ramp[idx] });
  }

  cleanRamp.sort((a, b) => b.minTc - a.minTc);
  for (let i = 1; i < cleanRamp.length; i++) {
    cleanRamp[i].units = Math.min(cleanRamp[i - 1].units, cleanRamp[i].units);
  }
  merged.ramp = cleanRamp;
  return merged;
}

function bindUiEvents() {
  el.btnWin.addEventListener('click', () => {
    pushHistory();
    recordOutcome('W');
    render();
  });

  el.btnLoss.addEventListener('click', () => {
    pushHistory();
    recordOutcome('L');
    render();
  });

  el.btnPush.addEventListener('click', () => {
    pushHistory();
    recordOutcome('P');
    render();
  });

  el.cfgApply.addEventListener('click', () => {
    pushHistory();
    const updated = normalizeSettings(readSettingsForm());
    state.settings = updated;
    syncOtherPlayerHands(true);
    state.bankroll = updated.startingBankroll;
    saveSettings();
    renderSettingsForm();
    render();
  });

  el.statsReset.addEventListener('click', () => {
    pushHistory();
    resetPerformance();
    state.bankroll = state.settings.startingBankroll;
    render();
  });
}

function readSettingsForm() {
  const ramp = [];
  for (let i = 1; i <= 5; i++) {
    ramp.push({
      minTc: sanitizeNum(el[`cfgTc${i}`].value, DEFAULT_SETTINGS.ramp[i - 1].minTc),
      units: sanitizeNum(el[`cfgUnits${i}`].value, DEFAULT_SETTINGS.ramp[i - 1].units)
    });
  }

  return {
    startingBankroll: sanitizeNum(el.cfgBankroll.value, DEFAULT_SETTINGS.startingBankroll),
    unitPct: sanitizeNum(el.cfgUnitPct.value, DEFAULT_SETTINGS.unitPct),
    spreadCap: sanitizeNum(el.cfgSpreadCap.value, DEFAULT_SETTINGS.spreadCap),
    otherPlayers: sanitizeNum(el.cfgOtherPlayers.value, DEFAULT_SETTINGS.otherPlayers),
    ramp
  };
}

function renderSettingsForm() {
  el.cfgBankroll.value = state.settings.startingBankroll;
  el.cfgUnitPct.value = state.settings.unitPct;
  el.cfgSpreadCap.value = state.settings.spreadCap;
  el.cfgOtherPlayers.value = state.settings.otherPlayers;
  for (let i = 1; i <= 5; i++) {
    const row = state.settings.ramp[i - 1];
    el[`cfgTc${i}`].value = row.minTc;
    el[`cfgUnits${i}`].value = row.units;
  }
}

function captureSnapshot() {
  return {
    rc: state.rc,
    cardsSeen: state.cardsSeen,
    dealerCards: [...state.dealerCards],
    hand: [...state.hand],
    tableCards: [...state.tableCards],
    otherPlayerHands: state.otherPlayerHands.map((cards) => [...cards]),
    nextOtherSeat: state.nextOtherSeat,
    mode: state.mode,
    autoFlow: state.autoFlow,
    autoStage: state.autoStage,
    smartInput: state.smartInput,
    nextCardMode: state.nextCardMode,
    inputLog: [...state.inputLog],
    settings: cloneSettings(state.settings),
    bankroll: state.bankroll,
    performance: {
      wins: state.performance.wins,
      losses: state.performance.losses,
      pushes: state.performance.pushes,
      hands: state.performance.hands,
      profitUnits: state.performance.profitUnits,
      profitDollars: state.performance.profitDollars,
      byAction: JSON.parse(JSON.stringify(state.performance.byAction))
    },
    lastRecommendedAction: state.lastRecommendedAction,
    lastBetUnits: state.lastBetUnits,
    lastResult: state.lastResult
  };
}

function pushHistory() {
  state.history.push(captureSnapshot());
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function restoreSnapshot(snap) {
  state.rc = snap.rc;
  state.cardsSeen = snap.cardsSeen;
  state.dealerCards = [...snap.dealerCards];
  state.hand = [...snap.hand];
  state.tableCards = [...snap.tableCards];
  state.settings = normalizeSettings(snap.settings || {});
  state.otherPlayerHands = Array.isArray(snap.otherPlayerHands)
    ? snap.otherPlayerHands.map((cards) => [...cards])
    : buildOtherPlayerHands(state.settings.otherPlayers);
  state.nextOtherSeat = Number.isInteger(snap.nextOtherSeat) ? snap.nextOtherSeat : 0;
  state.mode = snap.mode;
  state.autoFlow = snap.autoFlow;
  state.autoStage = snap.autoStage;
  state.smartInput = typeof snap.smartInput === 'boolean' ? snap.smartInput : state.smartInput;
  state.nextCardMode = snap.nextCardMode || null;
  state.inputLog = [...snap.inputLog];
  syncOtherPlayerHands(true);
  state.bankroll = snap.bankroll;
  state.performance = {
    wins: snap.performance.wins,
    losses: snap.performance.losses,
    pushes: snap.performance.pushes,
    hands: snap.performance.hands,
    profitUnits: snap.performance.profitUnits,
    profitDollars: snap.performance.profitDollars,
    byAction: JSON.parse(JSON.stringify(snap.performance.byAction))
  };
  state.lastRecommendedAction = snap.lastRecommendedAction;
  state.lastBetUnits = snap.lastBetUnits;
  state.lastResult = snap.lastResult;
  renderSettingsForm();
}

function decksRemaining() {
  return Math.max(0.25, state.totalDecks - (state.cardsSeen / 52));
}

function dealerUpCard() {
  return state.dealerCards[0] || null;
}

function exactTCNow() {
  return getExactTrueCount(state.rc, decksRemaining());
}

function displayTCNow() {
  return getTrueCount(state.rc, decksRemaining());
}

function decksRemainingForBetting() {
  const remaining = decksRemaining();
  return Math.max(0.5, Math.ceil(remaining / BETTING_DECK_RESOLUTION) * BETTING_DECK_RESOLUTION);
}

function bettingTCNow() {
  return Math.trunc(getExactTrueCount(state.rc, decksRemainingForBetting()));
}

function bettingCountReady() {
  return state.cardsSeen >= MIN_CARDS_FOR_BETTING;
}

function penetrationNow() {
  return Math.min(1, state.cardsSeen / (state.totalDecks * 52));
}

function countConfidenceNow() {
  const inputFactor = Math.min(1, state.cardsSeen / CONFIDENCE_INPUT_TARGET_CARDS);
  const penetrationFactor = Math.min(1, penetrationNow() / CONFIDENCE_PENETRATION_TARGET);
  return Math.max(0, Math.min(1, (0.7 * inputFactor) + (0.3 * penetrationFactor)));
}

function countConfidenceLabel(confidence) {
  if (confidence >= 0.8) return 'HIGH';
  if (confidence >= 0.55) return 'MED';
  return 'LOW';
}

function scaleBetByConfidence(rawUnits, confidence) {
  if (rawUnits <= 0) return 0;
  return Math.min(rawUnits, Math.max(0, Math.round(rawUnits * confidence)));
}

function estimatePlayerEdgePct(tc) {
  return Math.max(-4, Math.min(4, -0.6 + (0.5 * tc)));
}

function unitSize() {
  return Math.max(1, state.bankroll * (state.settings.unitPct / 100));
}

function recommendedBetUnits(tc) {
  for (const entry of state.settings.ramp) {
    if (tc >= entry.minTc) {
      return Math.min(state.settings.spreadCap, entry.units);
    }
  }
  return 0;
}

function getTCBand(tc) {
  if (tc <= -2) return { label: 'NEGATIVE', cls: 'band-neg' };
  if (tc < 1) return { label: 'NEUTRAL', cls: 'band-neutral' };
  if (tc < 3) return { label: 'POSITIVE', cls: 'band-pos' };
  return { label: 'HIGH', cls: 'band-high' };
}

function normalizeKeyToRank(k) {
  if (k >= '2' && k <= '9') return k;
  if (k === 'a') return 'A';
  if (['0', 'j', 'q', 'k'].includes(k)) return 'T';
  return null;
}

function modePrefix(mode) {
  if (mode === 'player') return 'P';
  if (mode === 'dealer') return 'D';
  return 'O';
}

function addInputLog(mode, rank) {
  state.inputLog.unshift(`${modePrefix(mode)}:${rank}`);
  if (state.inputLog.length > 8) state.inputLog.pop();
}

function modeFromAutoStage(stage) {
  if (stage === 'table') return 'table';
  if (stage === 'dealer') return 'dealer';
  return 'player';
}

function prettyMode(mode) {
  if (mode === 'dealer') return 'DEALER';
  if (mode === 'player') return 'PLAYER';
  return 'OTHERS';
}

function nextOtherSeatLabel() {
  if (state.settings.otherPlayers <= 0) return 'TABLE';
  return `SEAT ${state.nextOtherSeat + 1}`;
}

function modeLabel(mode) {
  if (mode !== 'table') return prettyMode(mode);
  return nextOtherSeatLabel();
}

function addOtherPlayersCard(rank) {
  state.tableCards.push(rank);
  if (state.settings.otherPlayers <= 0) return;

  const seat = state.nextOtherSeat % state.settings.otherPlayers;
  state.otherPlayerHands[seat].push(rank);
  state.nextOtherSeat = (seat + 1) % state.settings.otherPlayers;
}

function cycleOtherSeat(step) {
  if (state.settings.otherPlayers <= 0) return;
  state.nextOtherSeat = (state.nextOtherSeat + step + state.settings.otherPlayers) % state.settings.otherPlayers;
  state.nextCardMode = 'table';
}

function formatOtherPlayersDisplay() {
  if (state.settings.otherPlayers <= 0) return state.tableCards.join(' ') || '--';
  if (!state.tableCards.length) return '--';

  return state.otherPlayerHands
    .map((cards, idx) => {
      const marker = idx === state.nextOtherSeat ? '*' : '';
      return `S${idx + 1}${marker}:${cards.join(' ') || '--'}`;
    })
    .join(' | ');
}

function smartModeForNextCard() {
  if (state.nextCardMode) {
    const mode = state.nextCardMode;
    state.nextCardMode = null;
    return mode;
  }

  // Typical first-round deal order for one player seat: player, dealer upcard, player.
  if (state.hand.length === 0 && state.dealerCards.length === 0) return 'player';
  if (state.hand.length === 1 && state.dealerCards.length === 0) return 'dealer';
  if (state.hand.length === 1 && state.dealerCards.length === 1) return 'player';

  // After opening cards are set, unseen cards are usually other players/table by default.
  return 'table';
}

function smartModePreview() {
  if (state.nextCardMode) return state.nextCardMode;

  if (state.hand.length === 0 && state.dealerCards.length === 0) return 'player';
  if (state.hand.length === 1 && state.dealerCards.length === 0) return 'dealer';
  if (state.hand.length === 1 && state.dealerCards.length === 1) return 'player';

  return 'table';
}

function syncAutoMode() {
  if (!state.autoFlow) return;
  state.mode = modeFromAutoStage(state.autoStage);
}

function setMode(mode, isManual = false) {
  state.mode = mode;
  if (!state.autoFlow || !isManual) return;

  if (mode === 'table') state.autoStage = 'table';
  else if (mode === 'dealer') state.autoStage = 'dealer';
  else state.autoStage = dealerUpCard() ? 'post' : 'player';
}

function advanceAutoFlowAfterCard() {
  if (!state.autoFlow) return;

  if (state.autoStage === 'player' && state.hand.length >= 2) {
    state.autoStage = 'table';
    state.mode = 'table';
    return;
  }

  if (state.autoStage === 'dealer' && dealerUpCard()) {
    state.autoStage = 'post';
    state.mode = 'player';
  }
}

function applyCard(rank) {
  const r = normalizeRank(rank);
  const targetMode = state.smartInput ? smartModeForNextCard() : state.mode;

  state.rc += (HILO_VALUES[r] || 0);
  state.cardsSeen++;

  if (targetMode === 'dealer') state.dealerCards.push(r);
  else if (targetMode === 'player') state.hand.push(r);
  else addOtherPlayersCard(r);

  addInputLog(targetMode, r);
  advanceAutoFlowAfterCard();
}

function handTotal(cards) {
  let total = 0;
  let aces = 0;

  for (const c of cards) {
    if (c === 'A') {
      total += 11;
      aces++;
    } else if (c === 'T') {
      total += 10;
    } else {
      total += Number(c);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function resetPerformance() {
  state.performance = {
    wins: 0,
    losses: 0,
    pushes: 0,
    hands: 0,
    profitUnits: 0,
    profitDollars: 0,
    byAction: {}
  };
  state.lastResult = '--';
}

function resetHand() {
  state.dealerCards = [];
  state.hand = [];
  state.tableCards = [];
  state.otherPlayerHands = buildOtherPlayerHands(state.settings.otherPlayers);
  state.nextOtherSeat = 0;
  state.inputLog = [];
  state.nextCardMode = null;
  state.lastRecommendedAction = null;
  state.lastBetUnits = 0;
  if (state.autoFlow) {
    state.autoStage = 'player';
    state.mode = 'player';
  }
}

function resetShoe() {
  state.rc = 0;
  state.cardsSeen = 0;
  resetHand();
}

function toggleAutoFlow() {
  state.autoFlow = !state.autoFlow;
  if (!state.autoFlow) return;

  if (dealerUpCard()) state.autoStage = 'post';
  else if (state.hand.length < 2) state.autoStage = 'player';
  else state.autoStage = 'table';
  syncAutoMode();
}

function toggleSmartInput() {
  state.smartInput = !state.smartInput;
  state.nextCardMode = null;
}

function actionWinrate(action) {
  const s = state.performance.byAction[action];
  if (!s) return null;
  const decisive = s.wins + s.losses;
  if (decisive === 0) return null;
  return (s.wins / decisive) * 100;
}

function formatMoney(v) {
  return `$${v.toFixed(2)}`;
}

function recordOutcome(resultCode) {
  const units = state.lastBetUnits;
  const baseUnit = unitSize();
  let deltaUnits = 0;

  if (resultCode === 'W') deltaUnits = units;
  if (resultCode === 'L') deltaUnits = -units;

  if (resultCode === 'W') state.performance.wins++;
  else if (resultCode === 'L') state.performance.losses++;
  else state.performance.pushes++;

  state.performance.hands++;
  state.performance.profitUnits += deltaUnits;
  state.performance.profitDollars += deltaUnits * baseUnit;
  state.bankroll += deltaUnits * baseUnit;

  const action = state.lastRecommendedAction || 'N/A';
  if (!state.performance.byAction[action]) {
    state.performance.byAction[action] = { wins: 0, losses: 0, pushes: 0 };
  }

  if (resultCode === 'W') state.performance.byAction[action].wins++;
  else if (resultCode === 'L') state.performance.byAction[action].losses++;
  else state.performance.byAction[action].pushes++;

  state.lastResult = `${resultCode} ${units}u (${formatMoney(deltaUnits * baseUnit)})`;
}

function render() {
  const exactTc = exactTCNow();
  const displayTc = displayTCNow();
  const betTc = bettingTCNow();
  const canTrustBetCount = bettingCountReady();
  const countConfidence = countConfidenceNow();
  const band = getTCBand(exactTc);
  const edgePct = estimatePlayerEdgePct(canTrustBetCount ? betTc : 0);
  const rawBetUnits = canTrustBetCount ? recommendedBetUnits(betTc) : 0;
  const betUnits = canTrustBetCount ? scaleBetByConfidence(rawBetUnits, countConfidence) : 0;
  const countConfidencePct = Math.round(countConfidence * 100);
  const unit = unitSize();
  const currentHandBet = betUnits * unit;

  el.rc.textContent = state.rc;
  el.tc.textContent = displayTc.toFixed(1);
  el.tcBand.textContent = band.label;
  el.tcBand.className = 'hud-band ' + band.cls;
  el.decks.textContent = decksRemaining().toFixed(1);

  el.dispDealer.textContent = state.dealerCards.join(' ') || '?';
  el.dispDealerTotal.textContent = state.dealerCards.length ? `${handTotal(state.dealerCards)}` : '--';
  el.dispPlayer.textContent = state.hand.join(' ') || '--';
  el.dispTable.textContent = formatOtherPlayersDisplay();
  if (state.smartInput) {
    el.modeIndicator.textContent = `SMART->${modeLabel(smartModePreview())}`;
  } else {
    el.modeIndicator.textContent = modeLabel(state.mode);
  }
  if (state.smartInput) {
    el.flowIndicator.textContent = state.nextCardMode
      ? `SMART (NEXT ${modeLabel(state.nextCardMode)})`
      : 'SMART';
  } else {
    el.flowIndicator.textContent = state.autoFlow
      ? `AUTO (${state.autoStage.toUpperCase()})`
      : 'MANUAL';
  }
  el.inputLog.textContent = state.inputLog.join('  ') || '--';

  el.edgeVal.textContent = `${edgePct >= 0 ? '+' : ''}${edgePct.toFixed(2)}%`;
  el.betTcVal.textContent = canTrustBetCount ? `${betTc}` : 'WARMUP';
  el.countConfVal.textContent = `${countConfidencePct}% ${countConfidenceLabel(countConfidence)}`;
  el.betUnits.textContent = `${betUnits}`;
  el.wongVal.textContent = canTrustBetCount && betTc >= MYBOOKIE_RULES.wongInTc && betUnits > 0 ? 'PLAY' : 'WAIT';
  el.bankrollVal.textContent = formatMoney(state.bankroll);
  el.unitVal.textContent = formatMoney(unit);
  el.handBetVal.textContent = formatMoney(currentHandBet);

  el.statsHands.textContent = `${state.performance.hands}`;
  el.statsWlp.textContent = `${state.performance.wins}-${state.performance.losses}-${state.performance.pushes}`;
  el.statsProfit.textContent = `${state.performance.profitUnits.toFixed(1)}u / ${formatMoney(state.performance.profitDollars)}`;
  el.statsLast.textContent = state.lastResult;

  el.stateTag.textContent = state.autoFlow ? 'MYBOOKIE AUTO' : 'MYBOOKIE READY';
  if (state.smartInput) {
    el.stateTag.textContent = 'MYBOOKIE SMART';
  }

  const up = dealerUpCard();
  if (up && state.hand.length >= 2) {
    const move = recommendMove(state.hand, up, exactTc);
    const wr = actionWinrate(move.action);

    state.lastRecommendedAction = move.action;
    state.lastBetUnits = betUnits;

    el.recAction.textContent = move.action;
    el.recWinrate.textContent = wr === null ? '--' : `${wr.toFixed(1)}%`;
    el.recReason.textContent = move.reason || '';

    if (move.deviation) {
      el.actionCard.classList.add('deviation-active');
      el.devTag.textContent = 'DEVIATION';
      el.devTag.classList.remove('muted');
    } else {
      el.actionCard.classList.remove('deviation-active');
      el.devTag.textContent = 'NO DEVIATION';
      el.devTag.classList.add('muted');
    }
  } else {
    el.recAction.textContent = '---';
    el.recWinrate.textContent = '--';
    el.recReason.textContent = 'MYBOOKIE ONLY · Smart input: ; dealer, H player, \' others, [/] cycle seat, V smart toggle.';
    el.actionCard.classList.remove('deviation-active');
  }
}

function handleKey(e) {
  if (e.repeat) return;
  const k = e.key.toLowerCase();

  if (k === 'g') {
    setMode('dealer', true);
    render();
    return;
  }
  if (k === 'l') {
    setMode('player', true);
    render();
    return;
  }
  if (k === 't') {
    setMode('table', true);
    render();
    return;
  }

  if (k === 'm') {
    toggleAutoFlow();
    render();
    return;
  }
  if (k === 'v') {
    toggleSmartInput();
    render();
    return;
  }
  if (k === '[') {
    cycleOtherSeat(-1);
    render();
    return;
  }
  if (k === ']') {
    cycleOtherSeat(1);
    render();
    return;
  }
  if (k === ';' && state.smartInput) {
    state.nextCardMode = 'dealer';
    render();
    return;
  }
  if (k === 'h' && state.smartInput) {
    state.nextCardMode = 'player';
    render();
    return;
  }
  if (k === "'" && state.smartInput) {
    state.nextCardMode = 'table';
    render();
    return;
  }
  if (k === ';' && state.autoFlow) {
    state.autoStage = 'dealer';
    syncAutoMode();
    render();
    return;
  }

  if (k === 'w' || k === 'p') {
    pushHistory();
    recordOutcome(k.toUpperCase());
    render();
    return;
  }
  if (k === 'y' || k === '-') {
    pushHistory();
    recordOutcome('L');
    render();
    return;
  }

  if (k === 'backspace' || k === 'u') {
    e.preventDefault();
    const snap = state.history.pop();
    if (snap) restoreSnapshot(snap);
    render();
    return;
  }

  if (k === 'x') {
    pushHistory();
    resetShoe();
    render();
    return;
  }
  if (k === ' ') {
    e.preventDefault();
    pushHistory();
    resetHand();
    render();
    return;
  }

  const rank = normalizeKeyToRank(k);
  if (rank) {
    pushHistory();
    applyCard(rank);
    render();
  }
}
