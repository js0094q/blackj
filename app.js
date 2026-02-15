import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

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
  log: [] // latest first
};

const state = {
  rc: 0,
  totalDecks: 6,
  cardsSeen: 0,
  dealer: null,
  hand: [],
  tableCards: [],
  mode: 'dealer', // dealer | player | table
  answered: false
};

const el = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  decks: document.getElementById('decks-left'),
  recAction: document.getElementById('rec-action'),
  recReason: document.getElementById('rec-reason'),
  dispDealer: document.getElementById('disp-dealer'),
  dispPlayer: document.getElementById('disp-player'),
  dispTable: document.getElementById('disp-table'),
  modeIndicator: document.getElementById('mode-indicator-val'),
  stateTag: document.getElementById('state-tag'),
  devTag: document.getElementById('dev-tag'),

  mHands: document.getElementById('m-hands'),
  mCorrect: document.getElementById('m-correct'),
  mAcc: document.getElementById('m-acc'),
  mStreak: document.getElementById('m-streak'),

  overlay: document.getElementById('overlay'),
  ovSnapshot: document.getElementById('ov-snapshot'),
  ovLog: document.getElementById('ov-log'),
  openOverlay: document.getElementById('open-overlay'),
  closeOverlay: document.getElementById('close-overlay')
};

function decksRemaining() {
  return Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
}

function tcNow() {
  return getTrueCount(state.rc, decksRemaining());
}

function resetHandOnly() {
  state.dealer = null;
  state.hand = [];
  state.tableCards = [];
  state.mode = 'dealer';
  state.answered = false;
}

function resetShoe() {
  state.rc = 0;
  state.cardsSeen = 0;
  resetHandOnly();

  session.hands = 0;
  session.correct = 0;
  session.streak = 0;
  session.log = [];

  render();
  renderOverlay();
}

function canRecommend() {
  return Boolean(state.dealer) && state.hand.length >= 2;
}

function normalizeKeyToRank(kLower) {
  // Ten-value intentionally excludes 't' because T is reserved for Table mode.
  // Ten is: 0, j, q, k.
  if (kLower >= '2' && kLower <= '9') return kLower.toUpperCase();
  if (kLower === 'a') return 'A';
  if (kLower === '0' || kLower === 'j' || kLower === 'q' || kLower === 'k') return 'T';
  return null;
}

function processCard(rank) {
  const r = normalizeRank(rank);
  state.rc += (HILO_VALUES[r] || 0);
  state.cardsSeen++;

  if (state.mode === 'dealer') state.dealer = r;
  else if (state.mode === 'player') state.hand.push(r);
  else state.tableCards.push(r);

  state.answered = false;
  render();
}

function commitDecision(did) {
  if (!canRecommend() || state.answered) return;

  const tc = tcNow();
  const move = recommendMove(state.hand, state.dealer, tc);
  if (!move) return;

  const ok = did === move.action;

  session.hands++;
  if (ok) {
    session.correct++;
    session.streak++;
  } else {
    session.streak = 0;
  }

  session.log.unshift({
    n: session.hands,
    up: state.dealer,
    hand: state.hand.join(' '),
    table: state.tableCards.join(' '),
    tc: tc.toFixed(1),
    rec: move.action,
    base: move.baseAction,
    dev: move.deviation || '',
    did,
    ok
  });

  if (session.log.length > 120) session.log.pop();

  state.answered = true;
  render();
  renderOverlay();
}

function overlayOpen() {
  el.overlay.classList.add('show');
  el.overlay.setAttribute('aria-hidden', 'false');
  renderOverlay();
}

function overlayClose() {
  el.overlay.classList.remove('show');
  el.overlay.setAttribute('aria-hidden', 'true');
}

function overlayToggle() {
  if (el.overlay.classList.contains('show')) overlayClose();
  else overlayOpen();
}

function renderOverlay() {
  if (!el.ovSnapshot || !el.ovLog) return;

  const tc = tcNow();
  const dr = decksRemaining();

  el.ovSnapshot.innerHTML = `
    <div class="ov-pill"><div class="k">MODE</div><div class="v">${state.mode.toUpperCase()}</div></div>
    <div class="ov-pill"><div class="k">RC</div><div class="v">${state.rc > 0 ? '+' : ''}${state.rc}</div></div>
    <div class="ov-pill"><div class="k">TC</div><div class="v">${tc.toFixed(1)}</div></div>
    <div class="ov-pill"><div class="k">DECKS</div><div class="v">${dr.toFixed(1)}</div></div>
    <div class="ov-pill"><div class="k">DEALER</div><div class="v">${state.dealer || '?'}</div></div>
    <div class="ov-pill"><div class="k">HAND</div><div class="v">${state.hand.length ? state.hand.join(' ') : '--'}</div></div>
    <div class="ov-pill"><div class="k">TABLE</div><div class="v">${state.tableCards.length ? state.tableCards.join(' ') : '--'}</div></div>
    <div class="ov-pill"><div class="k">ACCURACY</div><div class="v">${session.hands ? ((session.correct / session.hands) * 100).toFixed(1) + '%' : '0.0%'}</div></div>
    <div class="ov-pill"><div class="k">HANDS</div><div class="v">${session.hands}</div></div>
  `;

  const rows = session.log.slice(0, 30);
  if (!rows.length) {
    el.ovLog.innerHTML = `<tr><td colspan="9" style="color:rgba(255,255,255,0.55)">No hands logged yet.</td></tr>`;
    return;
  }

  el.ovLog.innerHTML = rows.map(r => `
    <tr>
      <td>${r.n}</td>
      <td>${r.up}</td>
      <td>${r.hand}</td>
      <td>${r.table || ''}</td>
      <td>${r.tc}</td>
      <td>${r.rec}</td>
      <td>${r.did}</td>
      <td class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'}</td>
      <td>${r.dev || ''}</td>
    </tr>
  `).join('');
}

function render() {
  const tc = tcNow();
  const dr = decksRemaining();

  el.rc.textContent = (state.rc > 0 ? '+' : '') + state.rc;
  el.tc.textContent = tc.toFixed(1);
  el.decks.textContent = dr.toFixed(1);

  el.dispDealer.textContent = state.dealer || '?';
  el.dispPlayer.textContent = state.hand.length ? state.hand.join(' ') : '--';
  el.dispTable.textContent = state.tableCards.length ? state.tableCards.join(' ') : '--';

  el.modeIndicator.textContent = state.mode.toUpperCase();

  // Recommendation panel
  if (!state.dealer) {
    el.stateTag.textContent = 'READY';
    el.devTag.textContent = 'NO DEVIATION';
    el.recAction.textContent = '---';
    el.recReason.textContent = 'Enter dealer (G), then table (T) or player (L) cards.';
  } else if (state.hand.length < 2) {
    el.stateTag.textContent = 'BUILD HAND';
    el.devTag.textContent = 'NO DEVIATION';
    el.recAction.textContent = '---';
    el.recReason.textContent = 'Add player cards in Player mode (L) until you have at least 2 cards.';
  } else {
    const move = recommendMove(state.hand, state.dealer, tc);
    el.stateTag.textContent = state.answered ? 'LOGGED' : 'YOUR MOVE';
    el.devTag.textContent = move?.deviation ? 'DEVIATION' : 'NO DEVIATION';
    el.recAction.textContent = move?.action || '---';
    el.recReason.textContent = state.answered
      ? `Logged. Recommended was ${move.action}${move.deviation ? ` (${move.deviation})` : ''}.`
      : (move?.reason || 'Log your move with H/S/D/P/R/I.');
  }

  // Analytics
  el.mHands.textContent = String(session.hands);
  el.mCorrect.textContent = String(session.correct);
  el.mAcc.textContent = session.hands
    ? ((session.correct / session.hands) * 100).toFixed(1) + '%'
    : '0.0%';
  el.mStreak.textContent = String(session.streak);
}

function handleKey(e) {
  const k = e.key.toLowerCase();

  // Overlay controls
  if (k === 'escape') { overlayClose(); return; }
  if (k === 'o') { overlayToggle(); return; }

  // Reset controls
  if (k === 'x') { resetShoe(); return; }
  if (k === ' ') { e.preventDefault(); resetHandOnly(); render(); renderOverlay(); return; }

  // Mode switches
  if (k === 'g') { state.mode = 'dealer'; render(); return; }
  if (k === 'l') { state.mode = 'player'; render(); return; }
  if (k === 't') { state.mode = 'table'; render(); return; }

  // Card input
  const rank = normalizeKeyToRank(k);
  if (rank) { processCard(rank); return; }

  // Decision logging
  if (ACTION_KEYS[k]) { e.preventDefault(); commitDecision(ACTION_KEYS[k]); }
}

function wireButtons() {
  el.openOverlay?.addEventListener('click', overlayOpen);
  el.closeOverlay?.addEventListener('click', overlayClose);

  // Clicking outside closes overlay
  el.overlay?.addEventListener('click', (evt) => {
    if (evt.target === el.overlay) overlayClose();
  });
}

window.addEventListener('keydown', handleKey);
wireButtons();
render();
renderOverlay();
