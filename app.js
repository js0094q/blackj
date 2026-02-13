import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

// --------------------
// Constants
// --------------------

const HISTORY_MAX = 300;
const SESSION_LOG_MAX = 300;
const HAND_LOG_MAX = 200;

const ACTION_KEYS = {
  h: 'HIT',
  s: 'STAND',
  d: 'DOUBLE',
  p: 'SPLIT',
  r: 'SURRENDER',
  i: 'INSURE'
};

// --------------------
// Session (not affected by UNDO)
// --------------------

const session = {
  hands: 0,
  correct: 0,
  accuracySeries: [],
  handLog: []
};

// --------------------
// Core state (UNDO-able)
// --------------------

let state = {
  rc: 0,
  totalDecks: 6,
  cardsSeen: 0,
  dealer: null,
  hand: [],
  mode: 'dealer',
  history: [],
  roundAnswered: false,
  autoNext: true
};

let chart = null;

const els = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  decks: document.getElementById('decks-left'),
  hero: document.getElementById('hero'),
  tag: document.getElementById('advice-tag'),
  action: document.getElementById('advice-action'),
  reason: document.getElementById('advice-reason'),
  dispDealer: document.getElementById('disp-dealer'),
  dispPlayer: document.getElementById('disp-player'),
  slotDealer: document.getElementById('slot-dealer'),
  slotPlayer: document.getElementById('slot-player'),

  // Table/overlay
  overlay: document.getElementById('tableOverlay'),
  ovClose: document.getElementById('ov-close'),
  ovSummary: document.getElementById('ov-summary'),
  ovDeviations: document.getElementById('ov-deviations'),
  ovStats: document.getElementById('ov-stats'),
  ovLogBody: document.getElementById('ov-log-body')
};

function snapshotCore() {
  return {
    rc: state.rc,
    totalDecks: state.totalDecks,
    cardsSeen: state.cardsSeen,
    dealer: state.dealer,
    hand: [...state.hand],
    mode: state.mode,
    roundAnswered: state.roundAnswered,
    autoNext: state.autoNext
  };
}

function pushHistory() {
  state.history.push(JSON.stringify(snapshotCore()));
  if (state.history.length > HISTORY_MAX) state.history.shift();
}

function restoreFromSnapshot(snap) {
  state.rc = snap.rc;
  state.totalDecks = snap.totalDecks;
  state.cardsSeen = snap.cardsSeen;
  state.dealer = snap.dealer;
  state.hand = snap.hand;
  state.mode = snap.mode;
  state.roundAnswered = snap.roundAnswered;
  state.autoNext = snap.autoNext;
}

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

  // If user continues adding cards for a new situation, allow answering again.
  // But if they've already answered, we keep it locked for this hand unless they undo.

  render();
}

function setMode(m) {
  state.mode = m;

  // Overlay behavior
  if (m === 'table') els.overlay?.classList.add('show');
  else els.overlay?.classList.remove('show');

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.id === `mode-${m}`);
  });

  els.slotDealer.classList.toggle('active', m === 'dealer');
  els.slotPlayer.classList.toggle('active', m === 'player');
}

function startNextHand() {
  state.dealer = null;
  state.hand = [];
  state.roundAnswered = false;
  setMode('dealer');
  render();
}

function nextHandIfAny() {
  // Keep a keyboard-driven "next" for when you don't want auto-next.
  if (state.hand.length >= 2 || state.dealer) startNextHand();
}

function resetShoe() {
  if (!confirm('Reset Shoe? This will clear all counts and session stats.')) return;

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
  if (state.history.length === 0) return;
  const snap = JSON.parse(state.history.pop());
  restoreFromSnapshot(snap);
  render();
}

function recordDecision(move, didAction, tc, dr) {
  session.hands++;
  const ok = move && (didAction === move.action);
  if (ok) session.correct++;

  const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
  session.accuracySeries.push(pct);
  if (session.accuracySeries.length > SESSION_LOG_MAX) session.accuracySeries.shift();

  const row = {
    n: session.hands,
    dealer: state.dealer || '?',
    hand: state.hand.join(' '),
    tc: tc.toFixed(1),
    decks: dr.toFixed(1),
    rec: move?.action || '---',
    base: move?.baseAction || '---',
    dev: move?.deviation || '',
    did: didAction,
    ok: ok ? '✓' : '✗'
  };
  session.handLog.unshift(row);
  if (session.handLog.length > HAND_LOG_MAX) session.handLog.pop();

  updateChart();
}

function commitAction(didAction) {
  if (state.roundAnswered) return;

  const dr = Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
  const tc = getTrueCount(state.rc, dr);
  const move = recommendMove(state.hand, state.dealer, tc);

  if (!move) return;

  state.roundAnswered = true;
  recordDecision(move, didAction, tc, dr);

  if (state.autoNext) startNextHand();
  else render();
}

function renderOverlay(move, tc, dr) {
  if (!els.overlay) return;

  const handStr = state.hand.length ? state.hand.join(' ') : '--';
  const dealerStr = state.dealer || '?';

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
  els.ovSummary.innerHTML = summaryLines.join('');

  // Deviations (display the one applied, if any)
  if (move?.deviation) {
    els.ovDeviations.innerHTML = `<div class="pill">Applied: ${move.deviation}</div>`;
  } else {
    els.ovDeviations.innerHTML = '<div class="muted">No deviation applied.</div>';
  }

  // Stats
  const pct = session.hands ? (session.correct / session.hands) * 100 : 0;
  els.ovStats.innerHTML = [
    `<div class="ov-line"><span class="ov-k">Hands</span><span class="ov-v">${session.hands}</span></div>`,
    `<div class="ov-line"><span class="ov-k">Correct</span><span class="ov-v">${session.correct}</span></div>`,
    `<div class="ov-line"><span class="ov-k">Accuracy</span><span class="ov-v">${pct.toFixed(1)}%</span></div>`,
    `<div class="ov-line"><span class="ov-k">Auto-next</span><span class="ov-v">${state.autoNext ? 'ON' : 'OFF'} (toggle: [M])</span></div>`
  ].join('');

  // Log (last 25)
  const rows = session.handLog.slice(0, 25).map(r => {
    const cls = r.ok === '✓' ? 'ok' : 'bad';
    const dev = r.dev ? `<div class="tiny muted">${r.dev}</div>` : '';
    return `
      <tr class="${cls}">
        <td>${r.n}</td>
        <td>${r.dealer}</td>
        <td>${r.hand}${dev}</td>
        <td>${r.tc}</td>
        <td>${r.rec}</td>
        <td>${r.did}</td>
        <td>${r.ok}</td>
      </tr>
    `;
  }).join('');
  els.ovLogBody.innerHTML = rows || `<tr><td colspan="7" class="muted">No hands logged yet. Enter cards, then press H/S/D/P/R/I.</td></tr>`;
}

function render() {
  const dr = Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
  const tc = getTrueCount(state.rc, dr);
  const move = recommendMove(state.hand, state.dealer, tc);

  // HUD
  els.rc.textContent = (state.rc > 0 ? '+' : '') + state.rc;
  els.tc.textContent = tc.toFixed(1);
  els.decks.textContent = dr.toFixed(1);

  // Cards display
  els.dispDealer.innerHTML = state.dealer ? `<span class="fade-in">${state.dealer}</span>` : '<span class="empty-text">?</span>';
  els.dispPlayer.innerHTML = state.hand.length
    ? state.hand.map(c => `<span class="fade-in">${c}</span>`).join('')
    : '<span class="empty-text">--</span>';

  // Advice
  if (move) {
    els.tag.textContent = state.roundAnswered ? 'Logged' : 'Your Move';
    els.action.textContent = move.action;
    els.reason.textContent = state.roundAnswered
      ? 'Decision recorded.'
      : `Press H/S/D/P/R/I. ${move.deviation ? move.reason : 'Basic Strategy.'}`;

    els.action.className = 'advice-action';
    if (move.action === 'STAND') els.action.classList.add('advice-stand');
    else if (move.action === 'HIT') els.action.classList.add('advice-hit');
    else if (move.action === 'DOUBLE') els.action.classList.add('advice-double');
    else if (move.action === 'SPLIT') els.action.classList.add('advice-split');
    else if (move.action === 'INSURE') els.action.classList.add('advice-insure');
    else els.action.classList.add('advice-surrender');
  } else {
    els.tag.textContent = 'Ready';
    els.action.textContent = '---';
    els.action.className = 'advice-action';
    els.reason.textContent = state.dealer ? 'Add player cards' : 'Add dealer up-card';
  }

  // Overlay
  renderOverlay(move, tc, dr);
}

function updateChart() {
  if (!chart) return;
  chart.data.labels = session.accuracySeries.map((_, i) => i + 1);
  chart.data.datasets[0].data = session.accuracySeries;
  chart.update('none');
}

function handleKeyboard(e) {
  const k = e.key.toLowerCase();

  // Close overlay
  if (k === 'escape') {
    if (state.mode === 'table') setMode('player');
    return;
  }

  // Card input
  if (/[2-9]/.test(k)) return processInput(k);
  if (['0', 't', 'j', 'q', 'k'].includes(k)) return processInput('T');
  if (k === 'a') return processInput('A');

  // Toggle auto-next
  if (k === 'm') {
    state.autoNext = !state.autoNext;
    render();
    return;
  }

  // Action input (log training decision)
  if (ACTION_KEYS[k]) {
    e.preventDefault();
    commitAction(ACTION_KEYS[k]);
    return;
  }

  // Controls
  if (k === 'enter' || k === ' ') { e.preventDefault(); return nextHandIfAny(); }
  if (k === 'u') return undo();
  if (k === 'x') return resetShoe();
  if (k === 'd') return setMode('dealer');
  if (k === 'p') return setMode('player');
  if (k === 'v') return setMode(state.mode === 'table' ? 'player' : 'table');
}

window.onload = () => {
  const ctx = document.getElementById('accChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 100 }
      },
      plugins: { legend: { display: false } }
    }
  });

  document.querySelectorAll('.key').forEach(btn => btn.addEventListener('click', () => processInput(btn.dataset.val)));
  document.getElementById('mode-dealer').onclick = () => setMode('dealer');
  document.getElementById('mode-player').onclick = () => setMode('player');
  document.getElementById('mode-table').onclick = () => setMode(state.mode === 'table' ? 'player' : 'table');

  document.getElementById('undo').onclick = undo;
  document.getElementById('next').onclick = nextHandIfAny;
  document.getElementById('reset-shoe').onclick = resetShoe;

  els.ovClose?.addEventListener('click', () => setMode('player'));

  window.addEventListener('keydown', handleKeyboard);
  render();
};
