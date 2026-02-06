// app.js
import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const $ = (id) => document.getElementById(id);
const state = {
  decks: 6, runningCount: 0, decksRemaining: 6,
  autoTagOn: true, tagMode: "table",
  bankroll: 1000, minBet: 10, maxBet: 200, riskPct: 25,
  dealerUp: null, hands: [{ cards: [] }], activeHand: 0,
  history: [], tableLog: []
};

// Blue Quality Math: (TC-1) * 0.5% Edge
function suggestedBet(trueCount) {
  const edge = (trueCount - 1) * 0.005;
  const risk = (Number(state.riskPct) || 25) / 100;
  if (edge <= 0) return { bet: state.minBet, edge };

  let bet = state.bankroll * (edge / 1.3) * risk;
  return { bet: Math.round(clamp(bet, state.minBet, state.maxBet)), edge };
}

// Dealer Last Sequence
function inferTagForTap() {
  if (!state.autoTagOn) return state.tagMode;
  if (!state.dealerUp) return "dealer"; // Step 1
  if (state.hands[state.activeHand].cards.length < 2) return "player"; // Step 2
  return "table"; // Step 3
}

function logCard(raw) {
  const tok = normalizeCardToken(raw);
  if (!tok) return;
  const tag = inferTagForTap();
  const delta = hiloValue(tok);
  state.runningCount += delta;

  if (tag === "dealer") {
    state.dealerUp = tok;
    state.history.push({ tag: "dealer", delta, prev: null });
  } else if (tag === "player") {
    state.hands[state.activeHand].cards.push(tok);
    state.history.push({ tag: "player", delta, handIndex: state.activeHand });
  } else {
    state.tableLog.push(tok);
    state.history.push({ tag: "table", delta });
  }
  render();
}

function render() {
  const tc = computeTrueCount(state.runningCount, state.decksRemaining);
  const betData = suggestedBet(tc);
  
  $("rc").textContent = state.runningCount;
  $("tc").textContent = tc.toFixed(1);
  $("betBig").textContent = `$${betData.bet}`;
  $("edgeLabel").textContent = `${(betData.edge * 100).toFixed(1)}%`;
  $("dealerUp").textContent = state.dealerUp || "—";
  $("tableLog").textContent = state.tableLog.join(" ") || "—";
  
  const advice = recommendMove(state.hands[state.activeHand].cards, state.dealerUp);
  $("advice").textContent = advice.action || "—";
  $("adviceReason").textContent = advice.reason;
}

document.querySelectorAll(".cardbtn").forEach(btn => {
  btn.addEventListener("click", () => logCard(btn.dataset.card));
});
