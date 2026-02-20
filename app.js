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
    { minTc: 4, units: 8 },
    { minTc: 3, units: 6 },
    { minTc: 2, units: 4 },
    { minTc: 1, units: 2 },
    { minTc: 0, units: 1 }
  ]
});

const state = {
  rc: 0,
  totalDecks: MYBOOKIE_RULES.decks,
  cardsSeen: 0,
  decksOverride: null,
  dealerCards: [],
  hands: [[], []],
  activeHand: 0,
  tableCards: [],
  otherPlayerHands: [],
  nextOtherSeat: 0,
  mode: 'dealer',
  history: [],
  inputLog: [],
  settings: loadSettings(),
  bankroll: 0,
  performance: {
    wins: 0,
    losses: 0,
    pushes: 0,
    hands: 0,
    settledHands: 0,
    bustsPlayer: 0,
    bustsDealer: 0,
    bustCaptures: 0,
    totalBetUnits: 0,
    actionDecisions: 0,
    bsErrors: 0,
    indexOpportunities: 0,
    indexCorrect: 0,
    profitUnits: 0,
    profitDollars: 0,
    byAction: {}
  },
  tcDist: {},
  lastRecommendedAction: null,
  lastDeviation: false,
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
  inputLog: document.getElementById('input-log'),
  actualAction: document.getElementById('actual-action'),
  handA: document.getElementById('hand-a'),
  handB: document.getElementById('hand-b'),
  handClear: document.getElementById('hand-clear'),
  edgeVal: document.getElementById('edge-val'),
  betUnits: document.getElementById('bet-units'),
  betTcVal: document.getElementById('bet-tc-val'),
  countConfVal: document.getElementById('count-conf-val'),
  avgBetVal: document.getElementById('avg-bet-val'),
  rorVal: document.getElementById('ror-val'),
  wongVal: document.getElementById('wong-val'),
  bankrollVal: document.getElementById('bankroll-val'),
  unitVal: document.getElementById('unit-val'),
  handBetVal: document.getElementById('hand-bet-val'),
  recWinrate: document.getElementById('rec-winrate'),
  statsHands: document.getElementById('stats-hands'),
  statsWlp: document.getElementById('stats-wlp'),
  statsProfit: document.getElementById('stats-profit'),
  statsLast: document.getElementById('stats-last'),
  tcDist: document.getElementById('tc-dist'),
  bustStats: document.getElementById('bust-stats'),
  rampQuick: document.getElementById('ramp-quick'),
  accuracyStats: document.getElementById('accuracy-stats'),
  stateTag: document.getElementById('state-tag'),
  devTag: document.getElementById('dev-tag'),
  actionCard: document.getElementById('action-card'),
  seatCount: document.getElementById('seat-count'),
  seatApply: document.getElementById('seat-apply'),
  decksOverride: document.getElementById('decks-override'),
  decksApply: document.getElementById('decks-apply'),
  decksClear: document.getElementById('decks-clear'),
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

  el.seatApply.addEventListener('click', () => {
    pushHistory();
    const seats = Math.max(0, Math.min(6, Math.round(sanitizeNum(el.seatCount.value, state.settings.otherPlayers))));
    state.settings.otherPlayers = seats;
    syncOtherPlayerHands(false);
    saveSettings();
    renderSettingsForm();
    render();
  });

  el.decksApply.addEventListener('click', () => {
    pushHistory();
    const val = Number(el.decksOverride.value);
    if (Number.isFinite(val) && val > 0.24 && val <= state.totalDecks) {
      state.decksOverride = val;
      state.cardsSeen = Math.max(0, Math.round((state.totalDecks - val) * 52));
    }
    render();
  });

  el.decksClear.addEventListener('click', () => {
    pushHistory();
    state.decksOverride = null;
    render();
  });

  if (el.actualAction) {
    el.actualAction.addEventListener('change', () => {
      if (el.actualAction.value === 'SPLIT') {
        pushHistory();
        maybeSplitCurrentHand();
        render();
      }
    });
  }

  if (el.handA && el.handB) {
    el.handA.addEventListener('click', () => {
      state.activeHand = 0;
      updateHandPills();
      render();
    });
    el.handB.addEventListener('click', () => {
      state.activeHand = 1;
      updateHandPills();
      render();
    });
  }

  if (el.handClear) {
    el.handClear.addEventListener('click', () => {
      pushHistory();
      state.hands = [[], []];
      state.activeHand = 0;
      updateHandPills();
      render();
    });
  }

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
  if (el.seatCount) el.seatCount.value = state.settings.otherPlayers;
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
    decksOverride: state.decksOverride,
    dealerCards: [...state.dealerCards],
    hands: state.hands.map((h) => [...h]),
    activeHand: state.activeHand,
    tableCards: [...state.tableCards],
    otherPlayerHands: state.otherPlayerHands.map((cards) => [...cards]),
    nextOtherSeat: state.nextOtherSeat,
    mode: state.mode,
    inputLog: [...state.inputLog],
    settings: cloneSettings(state.settings),
    bankroll: state.bankroll,
    performance: {
      wins: state.performance.wins,
      losses: state.performance.losses,
      pushes: state.performance.pushes,
      hands: state.performance.hands,
      settledHands: state.performance.settledHands,
      bustsPlayer: state.performance.bustsPlayer,
      bustsDealer: state.performance.bustsDealer,
      bustCaptures: state.performance.bustCaptures,
      totalBetUnits: state.performance.totalBetUnits,
      actionDecisions: state.performance.actionDecisions,
      bsErrors: state.performance.bsErrors,
      indexOpportunities: state.performance.indexOpportunities,
      indexCorrect: state.performance.indexCorrect,
      profitUnits: state.performance.profitUnits,
      profitDollars: state.performance.profitDollars,
      byAction: JSON.parse(JSON.stringify(state.performance.byAction))
    },
    tcDist: { ...state.tcDist },
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
  state.decksOverride = snap.decksOverride ?? null;
  state.dealerCards = [...snap.dealerCards];
  state.hands = Array.isArray(snap.hands) ? snap.hands.map((h) => [...h]) : [[], []];
  while (state.hands.length < 2) state.hands.push([]);
  state.activeHand = Math.max(0, Math.min(state.hands.length - 1, sanitizeNum(snap.activeHand, 0)));
  state.tableCards = [...snap.tableCards];
  state.settings = normalizeSettings(snap.settings || {});
  state.otherPlayerHands = Array.isArray(snap.otherPlayerHands)
    ? snap.otherPlayerHands.map((cards) => [...cards])
    : buildOtherPlayerHands(state.settings.otherPlayers);
  state.nextOtherSeat = Number.isInteger(snap.nextOtherSeat) ? snap.nextOtherSeat : 0;
  state.mode = snap.mode;
  state.inputLog = [...snap.inputLog];
  syncOtherPlayerHands(true);
  state.bankroll = snap.bankroll;
  state.performance = {
    wins: sanitizeNum(snap.performance.wins, 0),
    losses: sanitizeNum(snap.performance.losses, 0),
    pushes: sanitizeNum(snap.performance.pushes, 0),
    hands: sanitizeNum(snap.performance.hands, 0),
    settledHands: sanitizeNum(snap.performance.settledHands, 0),
    bustsPlayer: sanitizeNum(snap.performance.bustsPlayer, 0),
    bustsDealer: sanitizeNum(snap.performance.bustsDealer, 0),
    bustCaptures: sanitizeNum(snap.performance.bustCaptures, 0),
    totalBetUnits: sanitizeNum(snap.performance.totalBetUnits, 0),
    actionDecisions: sanitizeNum(snap.performance.actionDecisions, 0),
    bsErrors: sanitizeNum(snap.performance.bsErrors, 0),
    indexOpportunities: sanitizeNum(snap.performance.indexOpportunities, 0),
    indexCorrect: sanitizeNum(snap.performance.indexCorrect, 0),
    profitUnits: sanitizeNum(snap.performance.profitUnits, 0),
    profitDollars: sanitizeNum(snap.performance.profitDollars, 0),
    byAction: JSON.parse(JSON.stringify(snap.performance.byAction))
  };
  state.tcDist = { ...(snap.tcDist || {}) };
  state.lastRecommendedAction = snap.lastRecommendedAction;
  state.lastBetUnits = snap.lastBetUnits;
  state.lastResult = snap.lastResult;
  renderSettingsForm();
}

function decksRemaining() {
  if (Number.isFinite(state.decksOverride)) return Math.max(0.25, state.decksOverride);
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

function tcBucketLabel(tcExact) {
  const b = Math.trunc(tcExact);
  if (b <= -5) return '≤-5';
  if (b >= 5) return '≥5';
  return `${b}`;
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

function formatTcDist() {
  const entries = Object.entries(state.tcDist || {});
  if (!entries.length) return '--';
  entries.sort((a, b) => b[1] - a[1]);
  return entries
    .slice(0, 6)
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join('  ');
}

function formatBustStats() {
  const h = state.performance.settledHands || 0;
  if (h === 0) return '--';
  const pBust = (state.performance.bustsPlayer / h) * 100;
  const dBust = (state.performance.bustsDealer / h) * 100;
  const capture = state.performance.bustsDealer > 0
    ? (state.performance.bustCaptures / state.performance.bustsDealer) * 100
    : 0;
  return `P ${pBust.toFixed(1)}% | D ${dBust.toFixed(1)}% | Capture ${capture.toFixed(1)}%`;
}

function formatRampQuick() {
  if (!Array.isArray(state.settings.ramp)) return '--';
  return state.settings.ramp
    .slice()
    .sort((a, b) => b.minTc - a.minTc)
    .map((r) => `TC≥${r.minTc}: ${r.units}u`)
    .join('  ');
}

function formatAccuracyStats(bsErrRate, indexAcc) {
  const bsTxt = bsErrRate === null ? 'BS err --' : `BS err ${(bsErrRate * 100).toFixed(1)}%`;
  const idxTxt = indexAcc === null ? 'Index --' : `Index ${(indexAcc * 100).toFixed(1)}%`;
  return `${bsTxt} | ${idxTxt}`;
}

function setMode(mode) {
  state.mode = mode;
}

function updateHandPills() {
  if (!el.handA || !el.handB) return;
  el.handA.classList.toggle('pill-active', state.activeHand === 0);
  el.handB.classList.toggle('pill-active', state.activeHand === 1);
}

function currentHand() {
  return state.hands[state.activeHand] || state.hands[0];
}

function applyCard(rank) {
  const r = normalizeRank(rank);
  const targetMode = state.mode;

  state.rc += (HILO_VALUES[r] || 0);
  state.cardsSeen++;
  const tcBucket = tcBucketLabel(getExactTrueCount(state.rc, decksRemaining()));
  state.tcDist[tcBucket] = (state.tcDist[tcBucket] || 0) + 1;

  if (targetMode === 'dealer') state.dealerCards.push(r);
  else if (targetMode === 'player') currentHand().push(r);
  else addOtherPlayersCard(r);

  addInputLog(targetMode, r);
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

function finalizeHandStats() {
  const handAll = state.hands.flat();
  if (!handAll.length && !state.dealerCards.length && !state.tableCards.length) return;
  const dealerTotal = state.dealerCards.length ? handTotal(state.dealerCards) : null;
  const dealerBust = dealerTotal !== null ? dealerTotal > 21 : false;
  for (const h of state.hands) {
    if (!h.length) continue;
    const playerTotal = handTotal(h);
    const playerBust = playerTotal > 21;
    state.performance.settledHands++;
    if (playerBust) state.performance.bustsPlayer++;
    if (dealerBust) state.performance.bustsDealer++;
    if (dealerBust && !playerBust) state.performance.bustCaptures++;
  }
}

function resetPerformance() {
  state.performance = {
    wins: 0,
    losses: 0,
    pushes: 0,
    hands: 0,
    settledHands: 0,
    bustsPlayer: 0,
    bustsDealer: 0,
    bustCaptures: 0,
    totalBetUnits: 0,
    profitUnits: 0,
    profitDollars: 0,
    byAction: {}
  };
  state.tcDist = {};
  state.lastResult = '--';
}

function resetHand() {
  finalizeHandStats();
  state.dealerCards = [];
  state.hands = [[], []];
  state.activeHand = 0;
  state.tableCards = [];
  state.otherPlayerHands = buildOtherPlayerHands(state.settings.otherPlayers);
  state.nextOtherSeat = 0;
  state.inputLog = [];
  state.lastRecommendedAction = null;
  state.lastBetUnits = 0;
  state.mode = 'player';
}

function resetShoe() {
  state.rc = 0;
  state.cardsSeen = 0;
  state.decksOverride = null;
  state.tcDist = {};
  resetHand();
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

function actualActionChoice() {
  if (!el.actualAction) return 'AUTO';
  return el.actualAction.value || 'AUTO';
}

function maybeSplitCurrentHand() {
  const h = currentHand();
  if (h.length >= 2 && state.hands[1].length === 0) {
    const second = h.pop();
    state.hands[1].push(second);
    state.activeHand = 0;
    updateHandPills();
  }
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
  state.performance.totalBetUnits += units;
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

  const chosen = actualActionChoice();
  const actual = chosen === 'AUTO' ? state.lastRecommendedAction : chosen;
  if (state.lastRecommendedAction) {
    state.performance.actionDecisions++;
    if (actual && actual !== state.lastRecommendedAction) state.performance.bsErrors++;
    if (state.lastDeviation) {
      state.performance.indexOpportunities++;
      if (actual === state.lastRecommendedAction) state.performance.indexCorrect++;
    }
  }
  if (chosen === 'SPLIT') maybeSplitCurrentHand();
  if (el.actualAction) el.actualAction.value = 'AUTO';
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
  const avgBetUnits = state.performance.hands > 0 ? (state.performance.totalBetUnits / state.performance.hands) : 0;
  const riskOfRuin = edgePct <= 0
    ? 1
    : Math.exp(-2 * (state.bankroll / unit) * (edgePct / 100));
  const bsErrorRate = state.performance.actionDecisions > 0
    ? (state.performance.bsErrors / state.performance.actionDecisions)
    : null;
  const indexAcc = state.performance.indexOpportunities > 0
    ? (state.performance.indexCorrect / state.performance.indexOpportunities)
    : null;

  updateHandPills();
  el.rc.textContent = state.rc;
  el.tc.textContent = displayTc.toFixed(1);
  el.tcBand.textContent = band.label;
  el.tcBand.className = 'hud-band ' + band.cls;
  el.decks.textContent = decksRemaining().toFixed(1);
  if (el.decksOverride) {
    el.decksOverride.value = state.decksOverride ?? '';
  }

  el.dispDealer.textContent = state.dealerCards.join(' ') || '?';
  el.dispDealerTotal.textContent = state.dealerCards.length ? `${handTotal(state.dealerCards)}` : '--';
  const activeHandCards = currentHand();
  const handsLabel = state.hands.some((h) => h.length)
    ? state.hands
        .map((h, idx) => `${idx === state.activeHand ? '*' : ''}${h.join(' ') || '--'}`)
        .join('  |  ')
    : '--';
  el.dispPlayer.textContent = handsLabel;
  el.dispTable.textContent = formatOtherPlayersDisplay();
  el.modeIndicator.textContent = modeLabel(state.mode);
  el.inputLog.textContent = state.inputLog.join('  ') || '--';

  el.edgeVal.textContent = `${edgePct >= 0 ? '+' : ''}${edgePct.toFixed(2)}%`;
  el.betTcVal.textContent = canTrustBetCount ? `${betTc}` : 'WARMUP';
  el.countConfVal.textContent = `${countConfidencePct}% ${countConfidenceLabel(countConfidence)}`;
  el.betUnits.textContent = `${betUnits}`;
  el.avgBetVal.textContent = `${avgBetUnits.toFixed(2)}`;
  el.rorVal.textContent = `${Math.round(Math.min(1, Math.max(0, riskOfRuin)) * 100)}%`;
  el.wongVal.textContent = canTrustBetCount && betTc >= MYBOOKIE_RULES.wongInTc && betUnits > 0 ? 'PLAY' : 'WAIT';
  el.bankrollVal.textContent = formatMoney(state.bankroll);
  el.unitVal.textContent = formatMoney(unit);
  el.handBetVal.textContent = formatMoney(currentHandBet);

  el.statsHands.textContent = `${state.performance.hands}`;
  el.statsWlp.textContent = `${state.performance.wins}-${state.performance.losses}-${state.performance.pushes}`;
  el.statsProfit.textContent = `${state.performance.profitUnits.toFixed(1)}u / ${formatMoney(state.performance.profitDollars)}`;
  el.statsLast.textContent = state.lastResult;

  el.stateTag.textContent = 'MYBOOKIE READY';

  el.tcDist.textContent = formatTcDist();
  el.bustStats.textContent = formatBustStats();
  el.rampQuick.textContent = formatRampQuick();
  el.accuracyStats.textContent = formatAccuracyStats(bsErrorRate, indexAcc);

  const up = dealerUpCard();
  if (up && activeHandCards.length >= 2) {
    const move = recommendMove(activeHandCards, up, exactTc);
    const wr = actionWinrate(move.action);

    state.lastRecommendedAction = move.action;
    state.lastDeviation = !!move.deviation;
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
    el.recReason.textContent = 'Enter cards. D/L/T sets target, B toggles hand, X new shoe, N new hand.';
    el.actionCard.classList.remove('deviation-active');
    state.lastRecommendedAction = null;
    state.lastDeviation = false;
  }
}

function handleKey(e) {
  if (isEditingField(e)) return;
  if (e.repeat) return;
  const k = e.key.toLowerCase();

  if (k === 'd') {
    setMode('dealer');
    render();
    return;
  }
  if (k === 'l') {
    setMode('player');
    render();
    return;
  }
  if (k === 't') {
    setMode('table');
    render();
    return;
  }
  if (k === 'b') {
    state.activeHand = state.activeHand === 0 ? 1 : 0;
    updateHandPills();
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
  if (k === 'n') {
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

function isEditingField(e) {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
