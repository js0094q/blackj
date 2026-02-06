// strategy-h17-ls.js
// Complete Decision Matrix for 6 decks, H17, DAS, Late Surrender.

export function recommendMove(playerCards, dealerUp, opts = {}) {
  const rules = {
    dealerHitsSoft17: true,   // H17
    lateSurrender: true,
    doubleAfterSplit: true,   // DAS
    ...opts
  };

  if (!dealerUp || !playerCards || playerCards.length < 2) {
    return { action: null, reason: "Waiting for cards..." };
  }

  const up = normRank(dealerUp);
  const hand = analyzeHand(playerCards);

  // 1) Late surrender (First two cards only)
  const canSurrender = rules.lateSurrender && playerCards.length === 2;
  if (canSurrender && shouldLateSurrender_H17_6D(hand, up)) {
    return { action: "SUR", reason: "Late surrender (6D H17)." };
  }

  // 2) Split
  if (hand.isPair) {
    const split = splitDecision(hand.pairRank, up, rules);
    if (split === "SPLIT") return { action: "SPLIT", reason: "Pair splitting chart." };
  }

  // 3) Double
  const dbl = doubleDecision(hand, up, rules);
  if (dbl === "DOUBLE") return { action: "DOUBLE", reason: "Doubling chart." };

  // 4) Hit/Stand
  const hs = hitStandDecision(hand, up);
  return { action: hs, reason: "Basic Strategy." };
}

/* --- LOGIC HELPERS --- */

function shouldLateSurrender_H17_6D(hand, dealerUp) {
  if (hand.isSoft) return false;

  // 15 vs 10/A, 16 vs 9/10/A, 17 vs A
  if (hand.isPair && hand.pairRank === 8 && dealerUp === "A") return true;

  const t = hand.hardTotal;
  if (t === 17 && dealerUp === "A") return true;
  if (t === 16 && (dealerUp === "9" || dealerUp === "T" || dealerUp === "A")) return true;
  if (t === 15 && (dealerUp === "T" || dealerUp === "A")) return true;

  return false;
}

function splitDecision(pairRank, dealerUp, rules) {
  const up = dealerUp;

  if (pairRank === 11) return "SPLIT"; // Always split Aces
  if (pairRank === 8) return "SPLIT";  // Always split 8s

  if (pairRank === 5) return "HIT";    // Never split 5s (Double instead usually)
  if (pairRank === 10) return "HIT";   // Never split 10s

  if (pairRank === 2 || pairRank === 3) {
    // Split 2,2 and 3,3 against 2-7
    if (isUpIn(up, ["2","3","4","5","6","7"])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 4) {
    // Split 4,4 only if DAS is allowed and dealer has 5 or 6
    if (rules.doubleAfterSplit && isUpIn(up, ["5","6"])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 6) {
    // Split 6,6 against 2-6
    if (isUpIn(up, ["2","3","4","5","6"])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 7) {
    // Split 7,7 against 2-7
    if (isUpIn(up, ["2","3","4","5","6","7"])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 9) {
    // Split 9,9 against 2-9, except 7
    if (isUpIn(up, ["2","3","4","5","6","8","9"])) return "SPLIT";
    return "STAND";
  }

  return "HIT";
}

function doubleDecision(hand, dealerUp, rules) {
  const up = dealerUp;

  if (hand.isSoft) {
    const s = hand.softTotal;
    // Soft 13/14 vs 5-6
    if ((s === 13 || s === 14) && isUpIn(up, ["5","6"])) return "DOUBLE";
    // Soft 15/16 vs 4-6
    if ((s === 15 || s === 16) && isUpIn(up, ["4","5","6"])) return "DOUBLE";
    // Soft 17 vs 3-6
    if (s === 17 && isUpIn(up, ["3","4","5","6"])) return "DOUBLE";
    // Soft 18 vs 2-6
    if (s === 18 && isUpIn(up, ["2","3","4","5","6"])) return "DOUBLE";
    // Soft 19 vs 6 (H17 specific)
    if (s === 19 && up === "6") return "DOUBLE"; 
    
    return null;
  }

  const t = hand.hardTotal;
  // Hard 9 vs 3-6
  if (t === 9 && isUpIn(up, ["3","4","5","6"])) return "DOUBLE";
  // Hard 10 vs 2-9
  if (t === 10 && isUpIn(up, ["2","3","4","5","6","7","8","9"])) return "DOUBLE";
  // Hard 11 vs Anything (H17)
  if (t === 11) return "DOUBLE";

  return null;
}

function hitStandDecision(hand, dealerUp) {
  const up = dealerUp;

  if (hand.isSoft) {
    const s = hand.softTotal;
    if (s >= 19) return "STAND"; // Stand Soft 19+
    if (s === 18) {
      // Soft 18: Stand vs 2,7,8. (Hit vs 9,10,A. Dbl vs 3-6 handled above)
      if (isUpIn(up, ["2","7","8"])) return "STAND";
      return "HIT";
    }
    return "HIT"; // Soft 17 or less (if not doubled)
  }

  const t = hand.hardTotal;
  if (t >= 17) return "STAND";
  if (t >= 13 && t <= 16) {
    // Stand 13-16 vs 2-6
    return isUpIn(up, ["2","3","4","5","6"]) ? "STAND" : "HIT";
  }
  if (t === 12) {
    // Stand 12 vs 4-6
    return isUpIn(up, ["4","5","6"]) ? "STAND" : "HIT";
  }

  return "HIT";
}

/* --- UTILITIES --- */

function analyzeHand(cards) {
  const ranks = cards.map(normRank);
  const vals = ranks.map(rankValue);

  const isPair = ranks.length === 2 && ranks[0] === ranks[1];
  const pairRank = isPair ? pairRankValue(ranks[0]) : null;

  const totals = computeTotals(vals, ranks);
  // Best total <= 21, or lowest bust
  const under = totals.filter(t => t <= 21);
  const best = under.length ? Math.max(...under) : Math.min(...totals);

  const hasAce = ranks.includes("A");
  const hardTotal = vals.reduce((a, b) => a + b, 0);

  // Soft if we use an Ace as 11 without busting
  const isSoft = hasAce && totals.some(t => t <= 21 && t !== hardTotal);

  return { ranks, isPair, pairRank, hardTotal, isSoft, softTotal: best };
}

function computeTotals(vals, ranks) {
  let total = vals.reduce((a, b) => a + b, 0);
  const aceCount = ranks.filter(r => r === "A").length;
  const totals = [total];
  // Add 10 for each Ace used as 11
  for (let i = 1; i <= aceCount; i++) totals.push(total + i * 10);
  return totals;
}

function normRank(x) {
  const s = String(x).trim().toUpperCase();
  if (s === "0") return "T";
  if (["A","2","3","4","5","6","7","8","9","T"].includes(s)) return s;
  return s; // Fallback
}

function rankValue(r) {
  if (r === "A") return 1;
  if (r === "T") return 10;
  return Number(r);
}

function pairRankValue(r) {
  if (r === "A") return 11;
  if (r === "T") return 10;
  return Number(r);
}

function isUpIn(up, arr) {
  // Simple inclusion check for strings or numbers
  return arr.includes(up) || arr.includes(Number(up));
}
