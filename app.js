import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const state = {
  bankroll: 1000, minBet: 10, maxBet: 200, riskPct: 25,
  runningCount: 0, decksRemaining: 6,
  dealerUp: null, hands: [{ cards: [] }],
  autoTagOn: true, history: [], tableLog: []
};

// Blue Quality Sizing: (TC-1) * 0.5% Edge
function getBetSizing(trueCount) {
  const edge = (trueCount - 1) * 0.005;
  const variance = 1.3;
  const risk = (state.riskPct / 100);

  if (edge <= 0) return { bet: state.minBet, edge: edge };

  let optimal = state.bankroll * (edge / variance) * risk;
  return { 
    bet: Math.round(clamp(optimal, state.minBet, state.maxBet)), 
    edge: edge 
  };
}

// Auto-Sequence: Dealer -> Me -> Table
function getTargetTag() {
  if (!state.dealerUp) return "dealer"; 
  if (state.hands[0].cards.length < 2) return "player";
  return "table"; 
}

function logCard(rank) {
  const tok = normalizeCardToken(rank);
  if (!tok) return;

  const tag = getTargetTag();
  state.runningCount += hiloValue(tok);

  if (tag === "dealer") state.dealerUp = tok;
  else if (tag === "player") state.hands[0].cards.push(tok);
  else state.tableLog.push(tok);

  state.history.push({ tok, tag });
  render();
}

function render() {
  const trueCount = computeTrueCount(state.runningCount, state.decksRemaining);
  const sizing = getBetSizing(trueCount);

  document.getElementById("rc").textContent = state.runningCount;
  document.getElementById("tc").textContent = trueCount.toFixed(1);
  document.getElementById("bet-val").textContent = `$${sizing.bet}`;
  document.getElementById("edge-val").textContent = `${(sizing.edge * 100).toFixed(1)}%`;
  document.getElementById("dealer-card").textContent = state.dealerUp || "—";
  
  const move = recommendMove(state.hands[0].cards, state.dealerUp);
  document.getElementById("advice-text").textContent = move.action || "WAITING...";
  document.getElementById("advice-reason").textContent = move.reason;
}

// Event Listeners for Buttons
document.querySelectorAll(".cardbtn").forEach(btn => {
  btn.addEventListener("click", () => logCard(btn.dataset.card));
});

document.getElementById("reset-btn").addEventListener("click", () => {
  state.runningCount = 0; state.dealerUp = null; state.hands[0].cards = [];
  render();
});
