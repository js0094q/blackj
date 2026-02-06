import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

// Blue Quality Betting Math
function suggestedBet(trueCount) {
  const br = Math.max(0, Number(state.bankroll) || 0);
  const minB = Number(state.minBet) || 10;
  const maxB = Number(state.maxBet) || 200;
  const risk = (Number(state.riskPct) || 25) / 100;

  const edge = (trueCount - 1) * 0.005; // Rule of thumb edge
  const variance = 1.3;

  if (edge <= 0 || br <= 0) return { bet: minB, edge };

  let bet = br * (edge / variance) * risk;
  return { bet: Math.round(clamp(bet, minB, maxB)), edge };
}

// Secret Fast-Log Logic
function inferTagForTap() {
  if (!state.dealerUp) return "dealer"; 
  if (state.hands[0].cards.length < 2) return "player";
  return "table"; // Logs others and dealer hole card secretly
}
