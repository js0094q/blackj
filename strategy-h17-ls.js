// strategy-h17-ls.js
// Basic Strategy for 6 decks, H17, DAS, Late Surrender, dealer peeks.
// Output actions: "SUR" | "SPLIT" | "DOUBLE" | "HIT" | "STAND"

export function recommendMove(playerCards, dealerUp, opts = {}) {
  const rules = {
    dealerHitsSoft17: true,   // H17
    lateSurrender: true,
    doubleAfterSplit: true,   // DAS
    dealerPeeks: true,
    peekResolved: true,       // set false until BJ check completes on A/T
    ...opts
  };

  if (!dealerUp || !playerCards || playerCards.length < 2) {
    return { action: null, reason: "Need dealer upcard and at least 2 player cards." };
  }

  const up = normRank(dealerUp);
  const hand = analyzeHand(playerCards);

  // If dealer peek is pending and upcard is A or T, late surrender is not available yet.
  if (rules.dealerPeeks && !rules.peekResolved && (up === "A" || up === "T")) {
    const nonSurrender = recommendWithoutSurrender(hand, up, rules);
    return { ...nonSurrender, note: "Dealer peek pending, surrender not available yet." };
  }

  // 1) Late surrender (only on first two cards)
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
  return { action: hs, reason: "Hit/stand chart." };
}

function recommendWithoutSurrender(hand, dealerUp, rules) {
  if (hand.isPair) {
    const split = splitDecision(hand.pairRank, dealerUp, rules);
    if (split === "SPLIT") return { action: "SPLIT", reason: "Pair splitting chart." };
  }
  const dbl = doubleDecision(hand, dealerUp, rules);
  if (dbl === "DOUBLE") return { action: "DOUBLE", reason: "Doubling chart." };
  const hs = hitStandDecision(hand, dealerUp);
  return { action: hs, reason: "Hit/stand chart." };
}

/*
  Late Surrender: common for 6D H17 LS with peek
  - 16 vs 9,10,A
  - 15 vs 10,A
  - 17 vs A
  - 8,8 vs A (common in many H17 LS charts)
*/
function shouldLateSurrender_H17_6D(hand, dealerUp) {
  if (hand.isSoft) return false;

  if (hand.isPair && hand.pairRank === 8 && dealerUp === "A") return true;

  const t = hand.hardTotal;

  if (t === 17 && dealerUp === "A") return true;
  if (t === 16 && (dealerUp === 9 || dealerUp === "T" || dealerUp === "A")) return true;
  if (t === 15 && (dealerUp === "T" || dealerUp === "A")) return true;

  return false;
}

function splitDecision(pairRank, dealerUp, rules) {
  const up = dealerUp;

  if (pairRank === 11) return "SPLIT"; // A,A
  if (pairRank === 8) return "SPLIT";  // 8,8 (surrender handled earlier for vs A)

  if (pairRank === 5) return "HIT";    // treat as 10
  if (pairRank === 10) return "HIT";   // never split 10s baseline

  if (pairRank === 2 || pairRank === 3) {
    if (isUpIn(up, [2,3,4,5,6,7])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 4) {
    if (rules.doubleAfterSplit && isUpIn(up, [5,6])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 6) {
    if (isUpIn(up, [2,3,4,5,6])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 7) {
    if (isUpIn(up, [2,3,4,5,6,7])) return "SPLIT";
    return "HIT";
  }

  if (pairRank === 9) {
    if (isUpIn(up, [2,3,4,5,6,8,9])) return "SPLIT";
    return "STAND";
  }

  return "HIT";
}

function doubleDecision(hand, dealerUp, rules) {
  const up = dealerUp;

  if (hand.isSoft) {
    const s = hand.softTotal;

    if (s === 13 || s === 14) return isUpIn(up, [5,6]) ? "DOUBLE" : null;
    if (s === 15 || s === 16) return isUpIn(up, [4,5,6]) ? "DOUBLE" : null;
    if (s === 17) return isUpIn(up, [3,4,5,6]) ? "DOUBLE" : null;
    if (s === 18) return isUpIn(up, [3,4,5,6]) ? "DOUBLE" : null;

    return null;
  }

  const t = hand.hardTotal;

  if (t === 9) return isUpIn(up, [3,4,5,6]) ? "DOUBLE" : null;
  if (t === 10) return isUpIn(up, [2,3,4,5,6,7,8,9]) ? "DOUBLE" : null;

  // Conservative 11 vs A in H17, since some charts vary. You can relax later.
  if (t === 11) return up !== "A" ? "DOUBLE" : null;

  return null;
}

function hitStandDecision(hand, dealerUp) {
  const up = dealerUp;

  if (hand.isSoft) {
    const s = hand.softTotal;

    if (s >= 19) return "STAND";

    if (s === 18) {
      if (isUpIn(up, [2,7,8])) return "STAND";
      return "HIT";
    }

    return "HIT";
  }

  const t = hand.hardTotal;

  if (t >= 17) return "STAND";
  if (t >= 13 && t <= 16) return isUpIn(up, [2,3,4,5,6]) ? "STAND" : "HIT";
  if (t === 12) return isUpIn(up, [4,5,6]) ? "STAND" : "HIT";

  return "HIT";
}

/* Hand analysis */

function analyzeHand(cards) {
  const ranks = cards.map(normRank);
  const vals = ranks.map(rankValue);

  const isPair = ranks.length === 2 && ranks[0] === ranks[1];
  const pairRank = isPair ? pairRankValue(ranks[0]) : null;

  const totals = computeTotals(vals, ranks);
  const best = bestTotal(totals);

  const hasAce = ranks.includes("A");
  const hardTotal = vals.reduce((a, b) => a + b, 0);

  // Soft if there is an ace and we can count at least one ace as 11 without busting
  const bestWithAceAs11 = totals.some(t => t <= 21 && t !== hardTotal);
  const isSoft = hasAce && bestWithAceAs11;

  return {
    ranks,
    isPair,
    pairRank,
    hardTotal,
    isSoft,
    softTotal: best
  };
}

function computeTotals(vals, ranks) {
  let total = vals.reduce((a, b) => a + b, 0);
  const aceCount = ranks.filter(r => r === "A").length;

  const totals = [total];
  for (let i = 1; i <= aceCount; i++) totals.push(total + i * 10);
  return totals;
}

function bestTotal(totals) {
  const under = totals.filter(t => t <= 21);
  if (under.length) return Math.max(...under);
  return Math.min(...totals);
}

function normRank(x) {
  const s = String(x).trim().toUpperCase();
  if (s === "0") return "T";
  if (["A","2","3","4","5","6","7","8","9","T"].includes(s)) return s;
  return s;
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
  if (up === "A" || up === "T") return arr.includes(up);
  return arr.includes(Number(up));
}
