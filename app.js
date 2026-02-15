import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

const HISTORY_MAX = 220;
const SERIES_MAX = 260;
const LOG_MAX = 200;

const ACTION_KEYS = {
  h: 'HIT',
  s: 'STAND',
  d: 'DOUBLE',
  p: 'SPLIT',
  r: 'SURRENDER',
  i: 'INSURE'
};

const session = {
  hands: 0,
  correct: 0,
  streak: 0,
  accuracySeries: [],
  log: []
};

let state = {
  rc: 0,
  totalDecks: 6,
  cardsSeen: 0,
  dealer: null,
  hand: [],
  tableCards: [],   // NEW
  mode: 'dealer',   // dealer | player | table
  autoNext: true,
  answered: false,
  history: []
};

let chart = null;

const el = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  decks: document.getElementById('decks-left'),
  recAction: document.getElementById('rec-action'),
  recReason: document.getElementById('rec-reason'),
  dispDealer: document.getElementById('disp-dealer'),
  dispPlayer: document.getElementById('disp-player'),
  overlay: document.getElementById('overlay'),
  ovSnapshot: document.getElementById('ov-snapshot'),
  ovLog: document.getElementById('ov-log')
};

function decksRemaining() {
  return Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
}

function tcNow() {
  return getTrueCount(state.rc, decksRemaining());
}

function snapshot() {
  return {
    rc: state.rc,
    totalDecks: state.totalDecks,
    cardsSeen: state.cardsSeen,
    dealer: state.dealer,
    hand: state.hand.slice(),
    tableCards: state.tableCards.slice(),
    mode: state.mode,
    autoNext: state.autoNext,
    answered: state.answered
  };
}

function pushHistory() {
  state.history.push(JSON.stringify(snapshot()));
  if (state.history.length > HISTORY_MAX) state.history.shift();
}

function undo() {
  if (!state.history.length) return;
  const s = JSON.parse(state.history.pop());
  Object.assign(state, s);
  render();
}

function resetHandOnly() {
  state.dealer = null;
  state.hand = [];
  state.tableCards = [];
  state.mode = 'dealer';
  state.answered = false;
}

function nextHand() {
  if (!state.dealer && state.hand.length === 0) return;
  resetHandOnly();
  render();
}

function processCardInput(raw) {
  pushHistory();

  const rank = normalizeRank(raw);
  state.rc += (HILO_VALUES[rank] || 0);
  state.cardsSeen++;

  if (state.mode === 'dealer') {
    state.dealer = rank;
  } else if (state.mode === 'player') {
    state.hand.push(rank);
  } else if (state.mode === 'table') {
    state.tableCards.push(rank);
  }

  render();
}

function canRecommend() {
  return state.dealer && state.hand.length >= 2;
}

function recordDecision(did, move, tc, dr) {
  session.hands++;

  const ok = did === move.action;
  if (ok) {
    session.correct++;
    session.streak++;
  } else {
    session.streak = 0;
  }

  const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
  session.accuracySeries.push(pct);
  if (session.accuracySeries.length > SERIES_MAX) session.accuracySeries.shift();

  session.log.unshift({
    n: session.hands,
    up: state.dealer,
    hand: state.hand.join(' '),
    table: state.tableCards.join(' '),
    tc: tc.toFixed(1),
    rec: move.action,
    did,
    ok
  });

  if (session.log.length > LOG_MAX) session.log.pop();
}

function commitDecision(did) {
  if (!canRecommend()) return;
  if (state.answered) return;

  const tc = tcNow();
  const dr = decksRemaining();
  const move = recommendMove(state.hand, state.dealer, tc);

  state.answered = true;
  recordDecision(did, move, tc, dr);

  if (state.autoNext) resetHandOnly();
  render();
}

function renderOverlay() {
  if (!el.overlay || !el.ovSnapshot || !el.ovLog) return;

  const tc = tcNow();
  const dr = decksRemaining();

  el.ovSnapshot.innerHTML = `
    <div class="ov-line"><div class="ov-k">Dealer</div><div class="ov-v">${state.dealer || '?'}</div></div>
    <div class="ov-line"><div class="ov-k">Hand</div><div class="ov-v">${state.hand.join(' ') || '--'}</div></div>
    <div class="ov-line"><div class="ov-k">Table Cards</div><div class="ov-v">${state.tableCards.join(' ') || '--'}</div></div>
    <div class="ov-line"><div class="ov-k">RC</div><div class="ov-v">${state.rc}</div></div>
    <div class="ov-line"><div class="ov-k">TC</div><div class="ov-v">${tc.toFixed(1)}</div></div>
    <div class="ov-line"><div class="ov-k">Decks</div><div class="ov-v">${dr.toFixed(1)}</div></div>
  `;

  el.ovLog.innerHTML = session.log.slice(0, 20).map(r => `
    <tr class="${r.ok ? 'row-ok' : 'row-bad'}">
      <td>${r.n}</td>
      <td>${r.up}</td>
      <td>${r.hand}</td>
      <td>${r.table}</td>
      <td>${r.tc}</td>
      <td>${r.rec}</td>
      <td>${r.did}</td>
      <td>${r.ok ? '✓' : '✗'}</td>
    </tr>
  `).join('');
}

function render() {
  const tc = tcNow();
  const dr = decksRemaining();

  if (el.rc) el.rc.textContent = state.rc;
  if (el.tc) el.tc.textContent = tc.toFixed(1);
  if (el.decks) el.decks.textContent = dr.toFixed(1);
  if (el.dispDealer) el.dispDealer.textContent = state.dealer || '?';
  if (el.dispPlayer) el.dispPlayer.textContent = state.hand.join(' ') || '--';

  if (canRecommend()) {
    const move = recommendMove(state.hand, state.dealer, tc);
    el.recAction.textContent = move.action;
    el.recReason.textContent = move.reason;
  }

  renderOverlay();
}

function handleKey(e) {
  const k = e.key.toLowerCase();

  if (k === 'g') state.mode = 'dealer';
  if (k === 'l') state.mode = 'player';
  if (k === 't') state.mode = 'table';

  if (k >= '2' && k <= '9') processCardInput(k);
  if (k === 'a') processCardInput('A');
  if (['0','t','j','q','k'].includes(k)) processCardInput('T');

  if (ACTION_KEYS[k]) commitDecision(ACTION_KEYS[k]);

  if (k === 'u') undo();
  if (k === ' ') nextHand();
}

window.addEventListener('keydown', handleKey);
render();
