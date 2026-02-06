// --- Integrated Betting and Fast-Log Logic ---
function suggestedBet(trueCount) {
  const br = Math.max(0, Number(state.bankroll) || 0);
  const minB = Number(state.minBet) || 0;
  const maxB = Number(state.maxBet) || 200;
  const riskFrac = 0.25; // 25% Fractional Kelly for safety

  // Edge Calculation: (TC - 1) * 0.5%
  const edge = (trueCount - 1) * 0.005; 
  const variance = 1.3;

  if (edge <= 0) return { bet: minB, edge };

  // Fractional Kelly Formula
  let bet = br * (edge / variance) * riskFrac;
  
  // Round and Clamp for "Blue Quality"
  bet = Math.round(clamp(bet, minB, maxB));
  return { bet, edge };
}

// "Dealer Last" Auto-Cycling Logic
function inferTagForTap() {
  if (!state.dealerUp) return "dealer"; // Step 1: Dealer Upcard
  const myHand = state.hands[state.activeHand];
  if (myHand && myHand.cards.length < 2) return "player"; // Step 2: Me (first 2)
  return "table"; // Step 3: All others and Dealer Hole Card
}
