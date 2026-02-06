// Integrated Betting and Fast-Log Logic
function suggestedBet(trueCount) {
  const br = Math.max(0, Number(state.bankroll));
  const minB = Number(state.minBet);
  const maxB = Number(state.maxBet);
  const riskFrac = 0.25; // 25% Fractional Kelly for safety

  // Edge Calculation
  const edge = (trueCount - 1) * 0.005; 
  const variance = 1.3;

  if (edge <= 0) return { bet: minB, edge };

  // Fractional Kelly Formula
  let bet = br * (edge / variance) * riskFrac;
  
  // Clamp and Round for 'Table Quality' feel
  bet = Math.round(clamp(bet, minB, maxB));
  return { bet, edge };
}

// Auto-Cycling Tag Logic for Real-Life Speed
function inferTagForTap() {
  if (!state.dealerUp) return "dealer"; // Step 1: Dealer Upcard
  
  const myHand = state.hands[state.activeHand];
  if (myHand && myHand.cards.length < 2) return "player"; // Step 2: My first 2 cards
  
  return "table"; // Step 3: Other players' cards
}
