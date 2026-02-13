import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

// ----------------------
// Constants
// ----------------------

const HISTORY_MAX = 300;
const SERIES_MAX = 300;
const HAND_LOG_MAX = 250;

const ACTION_KEYS = {
  h: 'HIT',
  s: 'STAND',
  d: 'DOUBLE',
  p: 'SPLIT',
  r: 'SURRENDER',
  i: 'INSURE'
};

// ----------------------
// Session Stats (not undo-able)
// ----------------------

const session = {
  hands: 0,
  correct: 0,
  accuracySeries: [],
  handLog: []
};

// ----------------------
// Core Trainer State
// ----------------------

let state = {
  rc: 0,
  totalDecks: 6,
  cardsSeen: 0,
  dealer: null,
  hand: [],
  mode: 'dealer',       // 'dealer' | 'player' | 'table'
  history: [],
  roundAnswered: false,
  autoNext: true
};

let chart = null;

const els = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  decks: document.getElementById('decks-left'),
  tag: document.getElementById('advice-tag'),
  action: document.getElementById('advice-action'),
  reason: document.getElementById('advice-reason'),
  dispDealer: document.getElementById('disp-dealer'),
  dispPlayer: document.getElementById('disp-player'),
  slotDealer: document.getElementById('slot-dealer'),
  slotPlayer: document.getElementById('slot-player'),
  overlay: document.getElementById('tableOverlay'),
  ovClose: document.getElementById('ov-close'),
  ovSummary: document.getElementById('ov-summary'),
  ovDeviations: document.getElementById('ov-deviations'),
  ovStats: document.getElementById('ov-stats'),
  ovLogBody: document.getElementById('ov-log-body')
};

// ----------------------
// Undo State Management
// ----------------------

function snapshotCore() {
  return {
    rc: state.rc,
    totalDecks: state.totalDecks,
    cardsSeen: state.cardsSeen,
    dealer: state.dealer,
    hand: state.hand.slice(),
    mode: state.mode,
    roundAnswered: state.roundAnswered,
    autoNext: state.autoNext
  };
}

function pushHistory() {
  state.history.push(JSON.stringify(snapshotCore()));
  if (state.history.length > HISTORY_MAX) state.history.shift();
}

function restoreFromSnapshot(s) {
  state.rc = s.rc;
  state.totalDecks = s.totalDecks;
  state.cardsSeen = s.cardsSeen;
  state.dealer = s.dealer;
  state.hand = s.hand;
  state.mode = s.mode;
  state.roundAnswered = s.roundAnswered;
  state.autoNext = s.autoNext;
}

function decksRemaining() {
  return Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
}

function currentTC() {
  return getTrueCount(state.rc, decksRemaining());
}

// ----------------------
// Mode Switching
// ----------------------

function setMode(m) {
  state.mode = m;

  if (els.overlay) {
    if (m === 'table') els.overlay.classList.add('show');
    else els.overlay.classList.remove('show');
  }

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.id === `mode-${m}`);
  });

  if (els.slotDealer) els.slotDealer.classList.toggle('active', m === 'dealer');
  if (els.slotPlayer) els.slotPlayer.classList.toggle('active', m === 'player');
}

function startNextHand() {
  state.dealer = null;
  state.hand = [];
  state.roundAnswered = false;
  setMode('dealer');
  render();
}

function nextHandIfAny() {
  if (state.dealer || state.hand.length) startNextHand();
}

function resetShoe() {
  if (!confirm('Reset shoe and session stats?')) return;

  state.rc = 0;
  state.cardsSeen = 0;
  state.dealer = null;
  state.hand = [];
  state.history = [];
  state.roundAnswered = false;

  session.hands = 0;
  session.correct = 0;
  session.accuracySeries = [];
  session.handLog = [];

  updateChart();
  setMode('dealer');
  render();
}

function undo() {
  if (!state.history.length) return;
  const snap = JSON.parse(state.history.pop());
  restoreFromSnapshot(snap);
  render();
}

// ----------------------
// Input Handling
// ----------------------

function processInput(val) {
  pushHistory();

  const rank = normalizeRank(val);
  state.rc += (HILO_VALUES[rank] || 0);
  state.cardsSeen++;

  if (state.mode === 'dealer') {
    state.dealer = rank;
    setMode('player');
  } else if (state.mode === 'player') {
    state.hand.push(rank);
  }

  render();
}

// ----------------------
// Decision Logging
// ----------------------

function recordDecision(move, didAction, tc, dr) {
  session.hands++;
  const ok = (didAction === move.action);
  if (ok) session.correct++;

  const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
  session.accuracySeries.push(pct);
  if (session.accuracySeries.length > SERIES_MAX) session.accuracySeries.shift();

  session.handLog.unshift({
    n: session.hands,
    dealer: state.dealer || '?',
    hand: state.hand.join(' '),
    tc: tc.toFixed(1),
    decks: dr.toFixed(1),
    rec: move.action,
    base: move.baseAction,
    dev: move.deviation || '',
    did: didAction,
    ok: ok ? '✓' : '✗'
  });

  if (session.handLog.length > HAND_LOG_MAX) session.handLog.pop();
  updateChart();
}

function commitAction(didAction) {
  if (state.roundAnswered) return;

  const dr = decksRemaining();
  const tc = currentTC();
  const move = recommendMove(state.hand, state.dealer, tc);
  if (!move) return;

  state.roundAnswered = true;
  recordDecision(move, didAction, tc, dr);

  if (state.autoNext) startNextHand();
  else render();
}

// ----------------------
// Chart
// ----------------------

function updateChart() {
  if (!chart) return;
  chart.data.labels = session.accuracySeries.map((_, i) => i + 1);
  chart.data.datasets[0].data = session.accuracySeries;
  chart.update('none');
}

// ----------------------
// Rendering
// ----------------------

function renderOverlay(move, tc, dr) {
  if (!els.overlay) return;

  const dealerStr = state.dealer || '?';
  const handStr = state.hand.length ? state.hand.join(' ') : '--';

  const summaryLines = [
    `<div class="ov-line"><span class="ov-k">Dealer</span><span class="ov-v">${dealerStr}</span></div>`,
    `<div class="ov-line"><span class="ov-k">Hand</span><span class="ov-v">${handStr}</span></div>`,
    `<div class="ov-line"><span class="ov-k">RC</span><span class="ov-v">${(state.rc > 0 ? '+' : '') + state.rc}</span></div>`,
    `<div class="ov-line"><span class="ov-k">TC</span><span class="ov-v">${tc.toFixed(1)}</span></div>`,
    `<div class="ov-line"><span class="ov-k">Decks</span><span class="ov-v">${dr.toFixed(1)}</span></div>`
  ];

  if (move) {
    summaryLines.push(
      `<div class="ov-line"><span class="ov-k">Rec</span><span class="ov-v"><strong>${move.action}</strong></span></div>`,
      `<div class="ov-line"><span class="ov-k">Base</span><span class="ov-v">${move.baseAction}</span></div>`
    );
  }

  if (els.ovSummary) els.ovSummary.innerHTML = summaryLines.join('');

  if (els.ovDeviations) {
    els.ovDeviations.innerHTML = move && move.deviation
      ? `<div class="pill">Applied: ${move.deviation}</div>`
      : '<div class="muted">No deviation applied.</div>';
  }

  if (els.ovStats) {
    const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
    els.ovStats.innerHTML = [
      `<div class="ov-line"><span class="ov-k">Hands</span><span class="ov-v">${session.hands}</span></div>`,
      `<div class="ov-line"><span class="ov-k">Correct</span><span class="ov-v">${session.correct}</span></div>`,
      `<div class="ov-line"><span class="ov-k">Accuracy</span><span class="ov-v">${pct.toFixed(1)}%</span></div>`,
      `<div class="ov-line"><span class="ov-k">Auto-Next</span><span class="ov-v">${state.autoNext ? 'ON' : 'OFF'}</span></div>`
    ].join('');
  }

  if (els.ovLogBody) {
    els.ovLogBody.innerHTML = session.handLog.slice(0, 25).map(r => {
      const cls = r.ok === '✓' ? 'ok' : 'bad';
      const devNote = r.dev ? `<div class="tiny muted">${r.dev}</div>` : '';
      return `<tr class="${cls}">
        <td>${r.n}</td><td>${r.dealer}</td><td>${r.hand}${devNote}</td>
        <td>${r.tc}</td><td>${r.rec}</td><td>${r.did}</td><td>${r.ok}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="muted">No hands logged yet.</td></tr>`;
  }
}

// ----------------------
// General Render
// ----------------------

function render() {
  const dr = decksRemaining();
  const tc = currentTC();
  const move = recommendMove(state.hand, state.dealer, tc);

  // HUD
  if (els.rc) els.rc.textContent = (state.rc > 0 ? '+' : '') + state.rc;
  if (els.tc) els.tc.textContent = tc.toFixed(1);
  if (els.decks) els.decks.textContent = dr.toFixed(1);

  // Card display
  if (els.dispDealer) els.dispDealer.innerHTML = state.dealer ? `<span class="fade-in">${state.dealer}</span>` : '<span class="empty-text">?</span>';
  if (els.dispPlayer) els.dispPlayer.innerHTML = state.hand.map(c => `<span class="fade-in">${c}</span>`).join('') || '<span class="empty-text">--</span>';

  // Advice display
  if (move && els.tag && els.action && els.reason) {
    els.tag.textContent = state.roundAnswered ? 'Logged' : 'Your Move';
    els.action.textContent = move.action;
    els.reason.textContent = state.roundAnswered
      ? 'Decision recorded.'
      : `Press H/S/D/P/R/I. ${move.deviation ? move.reason : 'Basic Strategy.'}`;

    // Style action
    els.action.className = 'advice-action';
    if (move.action === 'STAND') els.action.classList.add('advice-stand');
    else if (move.action === 'HIT') els.action.classList.add('advice-hit');
    else if (move.action === 'DOUBLE') els.action.classList.add('advice-double');
    else if (move.action === 'SPLIT') els.action.classList.add('advice-split');
    else if (move.action === 'INSURE') els.action.classList.add('advice-insure');
    else els.action.classList.add('advice-surrender');
  }

  renderOverlay(move, tc, dr);
}

// ----------------------
// Keyboard
// ----------------------

function handleKeyboard(e) {
  const k = e.key.toLowerCase();

  if (k === 'escape') {
    if (state.mode === 'table') setMode('player');
    return;
  }

  if (k >= '2' && k <= '9') { processInput(k); return; }
  if (['0', 't', 'j', 'q', 'k'].includes(k)) { processInput('T'); return; }
  if (k === 'a') { processInput('A'); return; }

  if (ACTION_KEYS[k]) {
    e.preventDefault();
    commitAction(ACTION_KEYS[k]);
    return;
  }

  if (k === 'm') { state.autoNext = !state.autoNext; render(); return; }
  if (k === 'u') { undo(); return; }
  if (k === 'x') { resetShoe(); return; }
  if (k === 'v') { setMode(state.mode === 'table' ? 'player' : 'table'); return; }
  if (k === 'g') { setMode('dealer'); return; }
  if (k === 'l') { setMode('player'); return; }
  if (k === 'enter' || k === ' ') { e.preventDefault(); nextHandIfAny(); return; }
}

window.addEventListener('load', () => {
  if (window.Chart) {
    const ctx = document.getElementById('accChart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });
  }

  document.querySelectorAll('.key').forEach(btn => btn.addEventListener('click', () => processInput(btn.dataset.val)));
  document.getElementById('mode-dealer').onclick = () => setMode('dealer');
  document.getElementById('mode-player').onclick = () => setMode('player');
  document.getElementById('mode-table').onclick = () => setMode(state.mode === 'table' ? 'player' : 'table');
  document.getElementById('undo').onclick = undo;
  document.getElementById('next').onclick = nextHandIfAny;
  document.getElementById('reset-shoe').onclick = resetShoe;
  if (els.ovClose) els.ovClose.addEventListener('click', () => setMode('player'));
  window.addEventListener('keydown', handleKeyboard);

  render();
});
