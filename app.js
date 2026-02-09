/**
 * app.js - High-Frequency Trainer Logic
 */
import { HILO_VALUES, normalizeRank, getTrueCount, getRecommendedBet } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

// --- STATE ---
let state = {
  rc: 0,
  decks: 6,
  dealer: null,
  hand: [],
  mode: 'dealer', // 'dealer', 'player', 'table'
  history: [],
  session: { hands: 0, correct: 0, log: [] }
};

let chart = null;

// --- DOM ELEMENTS (Cached for speed) ---
const els = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  bet: document.getElementById('bet-val'),
  acc: document.getElementById('acc-pct'),
  hero: document.getElementById('hero'),
  tag: document.getElementById('advice-tag'),
  action: document.getElementById('advice-action'),
  reason: document.getElementById('advice-reason'),
  dispDealer: document.getElementById('disp-dealer'),
  dispPlayer: document.getElementById('disp-player'),
  slotDealer: document.getElementById('slot-dealer'),
  slotPlayer: document.getElementById('slot-player')
};

// --- CORE FUNCTIONS ---

function processInput(val) {
  // Push to history
  state.history.push(JSON.stringify(state));

  const rank = normalizeRank(val);
  state.rc += HILO_VALUES[rank] || 0;

  if (state.mode === 'dealer') {
    state.dealer = rank;
    setMode('player');
  } else if (state.mode === 'player') {
    state.hand.push(rank);
  }
  
  render();
}

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.id === `mode-${m}`);
  });
  els.slotDealer.classList.toggle('active', m === 'dealer');
  els.slotPlayer.classList.toggle('active', m === 'player');
}

function nextRound() {
  if (state.hand.length >= 2) {
    state.session.hands++;
    state.session.correct++; // Assume correct for training tracking
    state.session.log.push((state.session.correct / state.session.hands) * 100);
    updateChart();
  }
  state.dealer = null;
  state.hand = [];
  setMode('dealer');
  render();
}

function undo() {
  if (state.history.length > 0) {
    state = JSON.parse(state.history.pop());
    render();
  }
}

// --- RENDERING (Direct DOM Pattern) ---

function render() {
  const tc = getTrueCount(state.rc, state.decks);
  const advice = recommendMove(state.hand, state.dealer, tc);

  // Stats
  els.rc.textContent = state.rc;
  els.tc.textContent = tc.toFixed(1);
  els.bet.textContent = `$${getRecommendedBet(tc)}`;
  
  if (state.session.hands > 0) {
    els.acc.textContent = Math.round((state.session.correct / state.session.hands) * 100) + '%';
  }

  // Cards
  els.dispDealer.innerHTML = state.dealer ? `<span class="fade-in">${state.dealer}</span>` : '<span class="empty-text">?</span>';
  els.dispPlayer.innerHTML = state.hand.length 
    ? state.hand.map(c => `<span class="fade-in">${c}</span>`).join('') 
    : '<span class="empty-text">--</span>';

  // Advice
  if (advice) {
    els.tag.textContent = 'Strategic Move';
    els.action.textContent = advice.action;
    els.reason.textContent = advice.reason;
    
    // Classes
    els.action.className = 'advice-action ' + 
      (advice.action === 'STAND' ? 'advice-stand' : 
       advice.action === 'HIT' ? 'advice-hit' : 'advice-special');
  } else {
    els.tag.textContent = 'Ready';
    els.action.textContent = '---';
    els.action.className = 'advice-action';
    els.reason.textContent = state.dealer ? 'Add player cards' : 'Add dealer up-card';
  }
}

function updateChart() {
  if (!chart) return;
  chart.data.labels = state.session.log.map((_, i) => i + 1);
  chart.data.datasets[0].data = state.session.log;
  chart.update('none');
}

// --- INIT ---

window.onload = () => {
  // Setup Chart
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

  // Listeners
  document.querySelectorAll('.key').forEach(k => {
    k.addEventListener('click', () => processInput(k.dataset.val));
  });
  
  document.getElementById('mode-dealer').onclick = () => setMode('dealer');
  document.getElementById('mode-player').onclick = () => setMode('player');
  document.getElementById('mode-table').onclick = () => setMode('table');
  
  document.getElementById('undo').onclick = undo;
  document.getElementById('next').onclick = nextRound;

  render();
};
