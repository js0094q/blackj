import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

// Performance guardrails
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
  bestStreak: 0,
  lastResult: null,      // string
  accuracySeries: [],    // percent over time
  log: []                // latest-first
};

let state = {
  rc: 0,
  totalDecks: 6,
  cardsSeen: 0,
  dealer: null,
  hand: [],
  mode: 'dealer',        // dealer | player
  autoNext: true,
  answered: false,
  history: []            // bounded snapshots (core only)
};

let chart = null;

const el = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  decks: document.getElementById('decks-left'),

  stateTag: document.getElementById('state-tag'),
  devTag: document.getElementById('dev-tag'),
  recAction: document.getElementById('rec-action'),
  recReason: document.getElementById('rec-reason'),

  dispDealer: document.getElementById('disp-dealer'),
  dispPlayer: document.getElementById('disp-player'),

  mHands: document.getElementById('m-hands'),
  mCorrect: document.getElementById('m-correct'),
  mAcc: document.getElementById('m-acc'),
  mStreak: document.getElementById('m-streak'),
  mLast: document.getElementById('m-last'),

  btnDealer: document.getElementById('mode-dealer'),
  btnPlayer: document.getElementById('mode-player'),
  btnAuto: document.getElementById('toggle-auto'),
  btnUndo: document.getElementById('undo'),
  btnNext: document.getElementById('next'),
  btnReset: document.getElementById('reset'),

  overlay: document.getElementById('overlay'),
  openOverlay: document.getElementById('open-overlay'),
  closeOverlay: document.getElementById('close-overlay'),
  filterMistakes: document.getElementById('filter-mistakes'),
  ovSnapshot: document.getElementById('ov-snapshot'),
  ovLast: document.getElementById('ov-last'),
  ovLog: document.getElementById('ov-log')
};

function decksRemaining() {
  return Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
}
function tcNow() {
  return getTrueCount(state.rc, decksRemaining());
}

function snap() {
  return {
    rc: state.rc,
    totalDecks: state.totalDecks,
    cardsSeen: state.cardsSeen,
    dealer: state.dealer,
    hand: state.hand.slice(),
    mode: state.mode,
    autoNext: state.autoNext,
    answered: state.answered
  };
}

function pushHistory() {
  state.history.push(JSON.stringify(snap()));
  if (state.history.length > HISTORY_MAX) state.history.shift();
}

function undo() {
  if (!state.history.length) return;
  const s = JSON.parse(state.history.pop());
  state.rc = s.rc;
  state.totalDecks = s.totalDecks;
  state.cardsSeen = s.cardsSeen;
  state.dealer = s.dealer;
  state.hand = s.hand;
  state.mode = s.mode;
  state.autoNext = s.autoNext;
  state.answered = s.answered;
  render();
}

function setMode(mode) {
  state.mode = mode;
  if (el.btnDealer) el.btnDealer.classList.toggle('active', mode === 'dealer');
  if (el.btnPlayer) el.btnPlayer.classList.toggle('active', mode === 'player');
}

function resetHandOnly() {
  state.dealer = null;
  state.hand = [];
  state.mode = 'dealer';
  state.answered = false;
}

function nextHand() {
  if (!state.dealer && state.hand.length === 0) return;
  resetHandOnly();
  render();
}

function resetShoe() {
  const ok = window.confirm('Reset shoe? This clears counts and session analytics.');
  if (!ok) return;

  state.rc = 0;
  state.cardsSeen = 0;
  state.dealer = null;
  state.hand = [];
  state.mode = 'dealer';
  state.autoNext = true;
  state.answered = false;
  state.history = [];

  session.hands = 0;
  session.correct = 0;
  session.streak = 0;
  session.bestStreak = 0;
  session.lastResult = null;
  session.accuracySeries = [];
  session.log = [];

  updateChart();
  render();
}

function processCardInput(raw) {
  pushHistory();

  const rank = normalizeRank(raw);
  const delta = HILO_VALUES[rank] || 0;

  state.rc += delta;
  state.cardsSeen++;

  if (state.mode === 'dealer') {
    state.dealer = rank;
    state.mode = 'player';
  } else {
    state.hand.push(rank);
  }

  render();
}

function canRecommend() {
  return Boolean(state.dealer) && state.hand.length >= 2;
}

function styleAction(action) {
  el.recAction.className = 'action-val';
  if (action === 'HIT') el.recAction.classList.add('action-hit');
  else if (action === 'STAND') el.recAction.classList.add('action-stand');
  else if (action === 'DOUBLE') el.recAction.classList.add('action-double');
  else if (action === 'SPLIT') el.recAction.classList.add('action-split');
  else if (action === 'SURRENDER') el.recAction.classList.add('action-surrender');
  else if (action === 'INSURE') el.recAction.classList.add('action-insure');
}

function recordDecision(did, move, tc, dr) {
  session.hands++;

  const ok = did === move.action;
  if (ok) {
    session.correct++;
    session.streak++;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
  } else {
    session.streak = 0;
  }

  const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
  session.accuracySeries.push(pct);
  if (session.accuracySeries.length > SERIES_MAX) session.accuracySeries.shift();

  const row = {
    n: session.hands,
    up: state.dealer,
    hand: state.hand.join(' '),
    tc: tc.toFixed(1),
    decks: dr.toFixed(1),
    rec: move.action,
    base: move.baseAction,
    dev: move.deviation || '',
    did,
    ok
  };

  session.log.unshift(row);
  if (session.log.length > LOG_MAX) session.log.pop();

  session.lastResult = ok
    ? `✓ Correct: ${did}`
    : `✗ Miss: you=${did}, rec=${move.action}${move.deviation ? ` (${move.deviation})` : ''}`;

  updateChart();
}

function commitDecision(did) {
  if (!canRecommend()) return;
  if (state.answered) return;

  const dr = decksRemaining();
  const tc = tcNow();
  const move = recommendMove(state.hand, state.dealer, tc);
  if (!move) return;

  state.answered = true;
  recordDecision(did, move, tc, dr);

  if (state.autoNext) {
    resetHandOnly();
  }
  render();
}

function updateChart() {
  if (!chart) return;
  chart.data.labels = session.accuracySeries.map((_, i) => i + 1);
  chart.data.datasets[0].data = session.accuracySeries;
  chart.update('none');
}

function overlayOpen() {
  if (!el.overlay) return;
  el.overlay.classList.add('show');
  renderOverlay();
}
function overlayClose() {
  if (!el.overlay) return;
  el.overlay.classList.remove('show');
}
function overlayIsOpen() {
  return el.overlay && el.overlay.classList.contains('show');
}

function renderOverlay() {
  if (!el.overlay || !el.ovSnapshot || !el.ovLast || !el.ovLog) return;

  const dr = decksRemaining();
  const tc = tcNow();
  const move = recommendMove(state.hand, state.dealer, tc);

  const snapLines = [
    ['Dealer', state.dealer || '?'],
    ['Hand', state.hand.length ? state.hand.join(' ') : '--'],
    ['RC', (state.rc > 0 ? '+' : '') + state.rc],
    ['TC', tc.toFixed(1)],
    ['Decks', dr.toFixed(1)],
    ['Mode', state.mode],
    ['Auto-Next', state.autoNext ? 'ON' : 'OFF']
  ];

  el.ovSnapshot.innerHTML = snapLines.map(([k, v]) =>
    `<div class="ov-line"><div class="ov-k">${k}</div><div class="ov-v">${v}</div></div>`
  ).join('');

  const last = session.log[0];
  if (last) {
    el.ovLast.innerHTML = [
      ['#', String(last.n)],
      ['Up', last.up],
      ['Hand', last.hand],
      ['TC', last.tc],
      ['Rec', last.rec],
      ['You', last.did],
      ['OK', last.ok ? '✓' : '✗'],
      ['Deviation', last.dev || '—']
    ].map(([k, v]) =>
      `<div class="ov-line"><div class="ov-k">${k}</div><div class="ov-v">${v}</div></div>`
    ).join('');
  } else {
    el.ovLast.innerHTML = `<div class="ov-line"><div class="ov-k">No history</div><div class="ov-v">—</div></div>`;
  }

  const mistakesOnly = Boolean(el.filterMistakes?.checked);
  const rows = (mistakesOnly ? session.log.filter(r => !r.ok) : session.log).slice(0, 25);

  if (!rows.length) {
    el.ovLog.innerHTML = `<tr><td colspan="8" style="color:rgba(255,255,255,0.55)">No rows to show.</td></tr>`;
    return;
  }

  el.ovLog.innerHTML = rows.map(r => {
    const cls = r.ok ? 'row-ok' : 'row-bad';
    return `
      <tr class="${cls}">
        <td>${r.n}</td>
        <td>${r.up}</td>
        <td>${r.hand}</td>
        <td>${r.tc}</td>
        <td>${r.rec}</td>
        <td>${r.did}</td>
        <td>${r.ok ? '✓' : '✗'}</td>
        <td>${r.dev || ''}</td>
      </tr>
    `;
  }).join('');

  // Current move is not displayed here intentionally; overlay is review-centric.
  void move;
}

function render() {
  const dr = decksRemaining();
  const tc = tcNow();

  if (el.rc) el.rc.textContent = (state.rc > 0 ? '+' : '') + state.rc;
  if (el.tc) el.tc.textContent = tc.toFixed(1);
  if (el.decks) el.decks.textContent = dr.toFixed(1);

  if (el.dispDealer) el.dispDealer.textContent = state.dealer || '?';
  if (el.dispPlayer) el.dispPlayer.textContent = state.hand.length ? state.hand.join(' ') : '--';

  // Recommendation card
  if (!state.dealer) {
    if (el.stateTag) el.stateTag.textContent = 'READY';
    if (el.devTag) { el.devTag.textContent = 'NO DEVIATION'; el.devTag.classList.remove('tag-dev'); }
    if (el.recAction) { el.recAction.textContent = '---'; el.recAction.className = 'action-val'; }
    if (el.recReason) el.recReason.textContent = 'Enter dealer up-card (G), then player cards (L).';
  } else if (state.hand.length < 2) {
    if (el.stateTag) el.stateTag.textContent = 'BUILD HAND';
    if (el.devTag) { el.devTag.textContent = 'NO DEVIATION'; el.devTag.classList.remove('tag-dev'); }
    if (el.recAction) { el.recAction.textContent = '---'; el.recAction.className = 'action-val'; }
    if (el.recReason) el.recReason.textContent = 'Add player cards until you have at least 2 cards.';
  } else {
    const move = recommendMove(state.hand, state.dealer, tc);

    if (el.stateTag) el.stateTag.textContent = state.answered ? 'LOGGED' : 'YOUR MOVE';

    if (move?.deviation) {
      if (el.devTag) {
        el.devTag.textContent = 'DEVIATION';
        el.devTag.classList.add('tag-dev');
      }
    } else {
      if (el.devTag) {
        el.devTag.textContent = 'NO DEVIATION';
        el.devTag.classList.remove('tag-dev');
      }
    }

    if (el.recAction) {
      el.recAction.textContent = move?.action || '---';
      styleAction(move?.action);
    }

    if (el.recReason) {
      if (state.answered) el.recReason.textContent = session.lastResult || 'Decision recorded.';
      else el.recReason.textContent = move?.reason || 'Log decision with H/S/D/P/R/I.';
    }
  }

  // Analytics panel
  if (el.mHands) el.mHands.textContent = String(session.hands);
  if (el.mCorrect) el.mCorrect.textContent = String(session.correct);
  if (el.mAcc) {
    const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
    el.mAcc.textContent = `${pct.toFixed(1)}%`;
  }
  if (el.mStreak) el.mStreak.textContent = String(session.streak);
  if (el.mLast) el.mLast.textContent = session.lastResult || '—';

  if (overlayIsOpen()) renderOverlay();
}

function handleKey(e) {
  const k = e.key.toLowerCase();

  if (k === 'escape') {
    if (overlayIsOpen()) overlayClose();
    return;
  }

  // Overlay toggle
  if (k === 'o') {
    if (overlayIsOpen()) overlayClose();
    else overlayOpen();
    return;
  }

  // Modes
  if (k === 'g') { setMode('dealer'); render(); return; }
  if (k === 'l') { setMode('player'); render(); return; }

  // Toggles / nav
  if (k === 'm') { state.autoNext = !state.autoNext; render(); return; }
  if (k === 'u') { undo(); return; }
  if (k === 'x') { resetShoe(); return; }
  if (k === ' ' || k === 'enter') { e.preventDefault(); nextHand(); return; }

  // Card input
  if (k >= '2' && k <= '9') { processCardInput(k); return; }
  if (k === 'a') { processCardInput('A'); return; }
  if (k === '0' || k === 't' || k === 'j' || k === 'q' || k === 'k') { processCardInput('T'); return; }

  // Decision logging
  if (ACTION_KEYS[k]) {
    e.preventDefault();
    commitDecision(ACTION_KEYS[k]);
  }
}

window.addEventListener('load', () => {
  // Buttons
  el.btnDealer?.addEventListener('click', () => { setMode('dealer'); render(); });
  el.btnPlayer?.addEventListener('click', () => { setMode('player'); render(); });
  el.btnAuto?.addEventListener('click', () => { state.autoNext = !state.autoNext; render(); });
  el.btnUndo?.addEventListener('click', () => undo());
  el.btnNext?.addEventListener('click', () => nextHand());
  el.btnReset?.addEventListener('click', () => resetShoe());

  el.openOverlay?.addEventListener('click', () => overlayOpen());
  el.closeOverlay?.addEventListener('click', () => overlayClose());
  el.filterMistakes?.addEventListener('change', () => renderOverlay());

  // Chart
  const canvas = document.getElementById('accChart');
  if (canvas && window.Chart) {
    const ctx = canvas.getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        plugins: { legend: { display: false } },
        animation: false
      }
    });
  }

  window.addEventListener('keydown', handleKey);
  render();
});
