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
const HISTORY_LIMIT = 400;

const DEFAULT_SETTINGS = Object.freeze({
  startingBankroll: 10000,
  unitPct: 1,
  spreadCap: 12,
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
  mode: 'dealer',
  autoFlow: false,
  autoStage: 'player',
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
    return normalizeSettings(parsed);
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
    ramp: settings.ramp.map((row) => ({ minTc: row.minTc, units: row.units }))
  };
}

function sanitizeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSettings(input) {
  const merged = {
    startingBankroll: sanitizeNum(input?.startingBankroll, DEFAULT_SETTINGS.startingBankroll),
    unitPct: sanitizeNum(input?.unitPct, DEFAULT_SETTINGS.unitPct),
    spreadCap: sanitizeNum(input?.spreadCap, DEFAULT_SETTINGS.spreadCap),
    ramp: Array.isArray(input?.ramp) ? input.ramp : DEFAULT_SETTINGS.ramp
  };

  merged.startingBankroll = Math.max(100, merged.startingBankroll);
  merged.unitPct = Math.max(0.1, Math.min(10, merged.unitPct));
  merged.spreadCap = Math.max(1, Math.round(merged.spreadCap));

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
    ramp
  };
}

function renderSettingsForm() {
  el.cfgBankroll.value = state.settings.startingBankroll;
  el.cfgUnitPct.value = state.settings.unitPct;
  el.cfgSpreadCap.value = state.settings.spreadCap;
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
    mode: state.mode,
    autoFlow: state.autoFlow,
    autoStage: state.autoStage,
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
  state.mode = snap.mode;
  state.autoFlow = snap.autoFlow;
  state.autoStage = snap.autoStage;
  state.inputLog = [...snap.inputLog];
  state.settings = cloneSettings(snap.settings);
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
  return 'T';
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
  const targetMode = state.mode;

  state.rc += (HILO_VALUES[r] || 0);
  state.cardsSeen++;

  if (targetMode === 'dealer') state.dealerCards.push(r);
  else if (targetMode === 'player') state.hand.push(r);
  else state.tableCards.push(r);

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
  state.inputLog = [];
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
  const band = getTCBand(exactTc);
  const edgePct = estimatePlayerEdgePct(exactTc);
  const betUnits = recommendedBetUnits(exactTc);
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
  el.dispTable.textContent = state.tableCards.join(' ') || '--';
  el.modeIndicator.textContent = state.mode.toUpperCase();
  el.flowIndicator.textContent = state.autoFlow
    ? `AUTO (${state.autoStage.toUpperCase()})`
    : 'MANUAL';
  el.inputLog.textContent = state.inputLog.join('  ') || '--';

  el.edgeVal.textContent = `${edgePct >= 0 ? '+' : ''}${edgePct.toFixed(2)}%`;
  el.betUnits.textContent = `${betUnits}`;
  el.wongVal.textContent = exactTc >= MYBOOKIE_RULES.wongInTc ? 'PLAY' : 'WAIT';
  el.bankrollVal.textContent = formatMoney(state.bankroll);
  el.unitVal.textContent = formatMoney(unit);
  el.handBetVal.textContent = formatMoney(currentHandBet);

  el.statsHands.textContent = `${state.performance.hands}`;
  el.statsWlp.textContent = `${state.performance.wins}-${state.performance.losses}-${state.performance.pushes}`;
  el.statsProfit.textContent = `${state.performance.profitUnits.toFixed(1)}u / ${formatMoney(state.performance.profitDollars)}`;
  el.statsLast.textContent = state.lastResult;

  el.stateTag.textContent = state.autoFlow ? 'MYBOOKIE AUTO' : 'MYBOOKIE READY';

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
    el.recReason.textContent = 'MYBOOKIE ONLY · Keys: G/L/T mode, M auto-flow, ; dealer-next, W/-/P result, U undo.';
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
