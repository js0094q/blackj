import { HILO_VALUES, normalizeRank, getTrueCount, getRecommendedBet } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

// --- INITIAL STATE ---
let state = {
  rc: 0,
  totalDecks: 6,
  cardsSeen: 0,
  dealer: null,
  hand: [],
  mode: 'dealer', 
  history: [],
  session: { hands: 0, correct: 0, log: [] }
};

let chart = null;

// --- DOM ELEMENTS CACHE ---
const els = {
  rc: document.getElementById('rc-val'),
  tc: document.getElementById('tc-val'),
  decks: document.getElementById('decks-left'),
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

// --- CORE HANDLERS ---

function processInput(val) {
  // Capture snapshot for undo
  state.history.push(JSON.stringify(state));

  const rank = normalizeRank(val);
  state.rc += HILO_VALUES[rank] || 0;
  state.cardsSeen++;

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
  if (state.hand.length >= 2 || state.dealer) {
    state.session.hands++;
    // Future expansion: Compare user input to advice for actual accuracy score
    state.session.correct++; 
    state.session.log.push((state.session.correct / state.session.hands) * 100);
    updateChart();
  }
  state.dealer = null;
  state.hand = [];
  setMode('dealer');
  render();
}

function resetShoe() {
  if(!confirm("Reset Shoe? This will clear the Running Count and Cards Seen.")) return;
  state.rc = 0;
  state.cardsSeen = 0;
  state.dealer = null;
  state.hand = [];
  state.history = [];
  setMode('dealer');
  render();
}

function undo() {
  if (state.history.length > 0) {
    state = JSON.parse(state.history.pop());
    render();
  }
}

// --- RENDERING ENGINE ---

function render() {
  // Dynamic Shoe Math
  const decksRemaining = Math.max(0.5, state.totalDecks - (state.cardsSeen / 52));
  const tc = getTrueCount(state.rc, decksRemaining);
  const advice = recommendMove(state.hand, state.dealer, tc);

  // HUD Update
  els.rc.textContent = state.rc;
  els.tc.textContent = tc.toFixed(1);
  els.decks.textContent = decksRemaining.toFixed(1);
  els.bet.textContent = `$${getRecommendedBet(tc)}`;
  
  if (state.session.hands > 0) {
    els.acc.textContent = Math.round((state.session.correct / state.session.hands) * 100) + '%';
  }

  // Board Update
  els.dispDealer.innerHTML = state.dealer ? `<span class="fade-in">${state.dealer}</span>` : '<span class="empty-text">?</span>';
  els.dispPlayer.innerHTML = state.hand.length 
    ? state.hand.map(c => `<span class="fade-in">${c}</span>`).join('') 
    : '<span class="empty-text">--</span>';

  // Advice Hero
  if (advice) {
    els.tag.textContent = 'Strategic Move';
    els.action.textContent = advice.action;
    els.reason.textContent = advice.reason;
    
    const act = advice.action;
    els.action.className = 'advice-action ' + 
      (act === 'STAND' ? 'advice-stand' : act === 'HIT' ? 'advice-hit' : 'advice-special');
  } else {
    els.tag.textContent = 'Ready';
    els.action.textContent = '---';
    els.action.className = 'advice-action';
    els.reason.textContent = state.dealer ? 'Add player cards' : 'Add dealer up-card';
  }
}

// --- INPUT LISTENERS ---

function handleKeyboard(e) {
  const key = e.key.toLowerCase();
  
  // Card Inputs
  if (/[2-9]/.test(key)) processInput(key);
  if (key === '0' || key === 't' || key === 'j' || key === 'q' || key === 'k') processInput('T');
  if (key === 'a') processInput('A');

  // Control Inputs
  if (key === 'enter' || key === ' ') {
    e.preventDefault();
    nextRound();
  }
  if (key === 'u') undo();
  if (key === 'r') resetShoe();

  // Mode Shortcuts
  if (key === 'd') setMode('dealer');
  if (key === 'p') setMode('player');
  if (key === 'v') setMode('table');
}

function updateChart() {
  if (!chart) return;
  chart.data.labels = state.session.log.map((_, i) => i + 1);
  chart.data.datasets[0].data = state.session.log;
  chart.update('none');
}

window.onload = () => {
  // Accuracy Chart
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

  // Event Listeners
  document.querySelectorAll('.key').forEach(k => k.addEventListener('click', () => processInput(k.dataset.val)));
  document.getElementById('mode-dealer').onclick = () => setMode('dealer');
  document.getElementById('mode-player').onclick = () => setMode('player');
  document.getElementById('mode-table').onclick = () => setMode('table');
  document.getElementById('undo').onclick = undo;
  document.getElementById('next').onclick = nextRound;
  document.getElementById('reset-shoe').onclick = resetShoe;

  window.addEventListener('keydown', handleKeyboard);

  render();
};
