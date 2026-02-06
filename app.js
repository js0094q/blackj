import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const state = {
  bankroll: 1000, 
  minBet: 10, 
  maxBet: 200, 
  riskPct: 25,
  runningCount: 0, 
  decksRemaining: 6, 
  dealerUp: null, 
  hands: [{ cards: [] }],
  activeHand: 0,
  autoTagOn: true
};

// --- BLUE QUALITY BETTING MATH ---
// Calculates edge as (TC - 1) * 0.5% and sizes using 25% Kelly
function getSuggestedBet(trueCount) {
  const br = Math.max(0, Number(state.bankroll) || 0);
  const minB = Number(state.minBet) || 10;
  const maxB = Number(state.maxBet) || 200;
  const risk = (Number(state.riskPct) || 25) / 100;

  const edge = (trueCount - 1) * 0.005; //
  const variance = 1.3; //

  if (edge <= 0 || br <= 0) return { bet: minB, edge };

  // Fractional Kelly Formula: Bankroll * (Edge / Variance) * Risk
  let bet = br * (edge / variance) * risk; //
  
  // Round to nearest whole number for "Table Quality" stealth
  return { bet: Math.round(clamp(bet, minB, maxB)), edge }; //
}

// --- "DEALER LAST" AUTO-TAG WORKFLOW ---
// Cycles: Dealer Upcard -> Player (first 2) -> Table (all others)
function inferTagForTap() {
  if (!state.autoTagOn) return state.tagMode;
  if (!state.dealerUp) return "dealer"; // Step 1: Dealer Upcard
  
  const myHand = state.hands[state.activeHand];
  if (myHand && myHand.cards.length < 2) return "player"; // Step 2: Me
  
  return "table"; // Step 3: Others and Dealer Hole Card
}

// --- CORE LOGGING FUNCTION ---
function logCard(raw) {
  const tok = normalizeCardToken(raw);
  if (!tok) return;

  const tag = inferTagForTap();
  state.runningCount += hiloValue(tok); //

  if (tag === "dealer") {
    state.dealerUp = tok;
  } else if (tag === "player") {
    state.hands[state.activeHand].cards.push(tok);
  } else {
    state.tableLog.push(tok);
  }

  render(); // Updates UI including TC and Suggested Bet
}
