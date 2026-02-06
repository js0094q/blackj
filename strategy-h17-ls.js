// strategy-h17-ls.js
export function recommendMove(playerCards, dealerUp, opts = {}) {
  const rules = {
    dealerHitsSoft17: true,
    lateSurrender: true,
    doubleAfterSplit: true,
    dealerPeeks: true,
    peekResolved: true,
    ...opts
  };

  if (!dealerUp || !playerCards || playerCards.length < 2) {
    return { action: null, reason: "Need dealer upcard and 2 player cards." };
  }

  const up = normRank(dealerUp);
  const hand = analyzeHand(playerCards);

  // Late surrender on first two cards
  const canSurrender = rules.lateSurrender && playerCards.length === 2;
  if (canSurrender && shouldLateSurrender_H17_6D(hand, up)) {
    return { action: "SUR", reason: "Late surrender (6D H17)." };
  }

  // Split logic
  if (hand.isPair) {
    const split = splitDecision(hand.pairRank, up, rules);
    if (split === "SPLIT") return { action: "SPLIT", reason: "Pair splitting." };
  }

  // Double logic
  const dbl = doubleDecision(hand, up, rules);
  if (dbl === "DOUBLE") return { action: "DOUBLE", reason: "Doubling." };

  // Hit/Stand logic
  const hs = hitStandDecision(hand, up);
  return { action: hs, reason: "Basic Strategy." };
}

function shouldLateSurrender_H17_6D(hand, dealerUp) {
  if (hand.isSoft) return false;
  if (hand.isPair && hand.pairRank === 8 && dealerUp === "A") return true;
  const t = hand.hardTotal;
  if (t === 17 && dealerUp === "A") return true;
  if (t === 16 && (dealerUp === 9 || dealerUp === "T" || dealerUp === "A")) return true;
  if (t === 15 && (dealerUp === "T" || dealerUp === "A")) return true;
  return false;
}

function splitDecision(pairRank, up, rules) {
  if (pairRank === 11 || pairRank === 8) return "SPLIT";
  if (pairRank === 5 || pairRank === 10) return "HIT";
  if ((pairRank === 2 || pairRank === 3) && isUpIn(up, [2,3,4,5,6,7])) return "SPLIT";
  if (pairRank === 4 && rules.doubleAfterSplit && isUpIn(up, [5,6])) return "SPLIT";
  if (pairRank === 6 && isUpIn(up, [2,3,4,5,6])) return "SPLIT";
  if (pairRank === 7 && isUpIn(up, [2,3,4,5,6,7])) return "SPLIT";
  if (pairRank === 9 && isUpIn(up, [2,3,4,5,6,8,9])) return "SPLIT";
  return pairRank === 9 ? "STAND" : "HIT";
}

function doubleDecision(hand, up, rules) {
  if (hand.isSoft) {
    const s = hand.softTotal;
    if ((s === 13 || s === 14) && isUpIn(up, [5,6])) return "DOUBLE";
    if ((s === 15 || s === 16) && isUpIn(up, [4,5,6])) return "DOUBLE";
    if ((s === 17 || s === 18) && isUpIn(up, [3,4,5,6])) return "DOUBLE";
    return null;
  }
  const t = hand.hardTotal;
  if (t === 9 && isUpIn(up, [3,4,5,6])) return "DOUBLE";
  if (t === 10 && isUpIn(up, [2,3,4,5,6,7,8,9])) return "DOUBLE";
  if (t === 11 && up !== "A") return "DOUBLE";
  return null;
}

function hitStandDecision(hand, up) {
  if (hand.isSoft) return hand.softTotal >= 19 || (hand.softTotal === 18 && isUpIn(up, [2,7,8])) ? "STAND" : "HIT";
  const t = hand.hardTotal;
  if (t >= 17) return "STAND";
  if (t >= 13 && t <= 16) return isUpIn(up, [2,3,4,5,6]) ? "STAND" : "HIT";
  if (t === 12) return isUpIn(up, [4,5,6]) ? "STAND" : "HIT";
  return "HIT";
}

function analyzeHand(cards) {
  const ranks = cards.map(normRank);
  const vals = ranks.map(rankValue);
  const isPair = ranks.length === 2 && ranks[0] === ranks[1];
  const pairRank = isPair ? pairRankValue(ranks[0]) : null;
  const hardTotal = vals.reduce((a, b) => a + b, 0);
  const hasAce = ranks.includes("A");
  const totals = [hardTotal];
  const aceCount = ranks.filter(r => r === "A").length;
  for (let i = 1; i <= aceCount; i++) totals.push(hardTotal + i * 10);
  const best = totals.filter(t => t <= 21).length ? Math.max(...totals.filter(t => t <= 21)) : Math.min(...totals);
  const isSoft = hasAce && totals.some(t => t <= 21 && t !== hardTotal);
  return { ranks, isPair, pairRank, hardTotal, isSoft, softTotal: best };
}

function normRank(x) {
  const s = String(x).trim().toUpperCase();
  return s === "0" ? "T" : (["A","2","3","4","5","6","7","8","9","T"].includes(s) ? s : s);
}
function rankValue(r) { return r === "A" ? 1 : (r === "T" ? 10 : Number(r)); }
function pairRankValue(r) { return r === "A" ? 11 : (r === "T" ? 10 : Number(r)); }
function isUpIn(up, arr) { return up === "A" || up === "T" ? arr.includes(up) : arr.includes(Number(up)); }
