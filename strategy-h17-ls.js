export function recommendMove(playerCards, dealerUp, opts = {}) {
  const rules = { dealerHitsSoft17: true, lateSurrender: true, doubleAfterSplit: true, ...opts };

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
  // 15 vs 10/A, 16 vs 9/10/A, 17 vs A, 8,8 vs A
  if (hand.isPair && hand.pairRank === 8 && dealerUp === "A") return true;
  const t = hand.hardTotal;
  if (t === 17 && dealerUp === "A") return true;
  if (t === 16 && (dealerUp === "9" || dealerUp === "T" || dealerUp === "A")) return true;
  if (t === 15 && (dealerUp === "T" || dealerUp === "A")) return true;
  return false;
}

function splitDecision(pairRank, dealerUp, rules) {
  const up = dealerUp;
  if (pairRank === 11) return "SPLIT"; 
  if (pairRank === 8) return "SPLIT"; 
  if (pairRank === 5) return "HIT"; 
  if (pairRank === 10) return "HIT"; 
  if (pairRank === 2 || pairRank === 3) return isUpIn(up, ["2","3","4","5","6","7"]) ? "SPLIT" : "HIT";
  if (pairRank === 4) return (rules.doubleAfterSplit && isUpIn(up, ["5","6"])) ? "SPLIT" : "HIT";
  if (pairRank === 6) return isUpIn(up, ["2","3","4","5","6"]) ? "SPLIT" : "HIT";
  if (pairRank === 7) return isUpIn(up, ["2","3","4","5","6","7"]) ? "SPLIT" : "HIT";
  if (pairRank === 9) return isUpIn(up, ["2","3","4","5","6","8","9"]) ? "SPLIT" : "STAND";
  return "HIT";
}

function doubleDecision(hand, dealerUp, rules) {
  const up = dealerUp;
  if (hand.isSoft) {
    const s = hand.softTotal;
    if ((s === 13 || s === 14) && isUpIn(up, ["5","6"])) return "DOUBLE";
    if ((s === 15 || s === 16) && isUpIn(up, ["4","5","6"])) return "DOUBLE";
    if (s === 17 && isUpIn(up, ["3","4","5","6"])) return "DOUBLE";
    if (s === 18 && isUpIn(up, ["2","3","4","5","6"])) return "DOUBLE";
    if (s === 19 && up === "6") return "DOUBLE"; 
    return null;
  }
  const t = hand.hardTotal;
  if (t === 9 && isUpIn(up, ["3","4","5","6"])) return "DOUBLE";
  if (t === 10 && isUpIn(up, ["2","3","4","5","6","7","8","9"])) return "DOUBLE";
  if (t === 11) return "DOUBLE";
  return null;
}

function hitStandDecision(hand, dealerUp) {
  const up = dealerUp;
  if (hand.isSoft) {
    const s = hand.softTotal;
    if (s >= 19) return "STAND";
    if (s === 18) return isUpIn(up, ["2","7","8"]) ? "STAND" : "HIT";
    return "HIT";
  }
  const t = hand.hardTotal;
  if (t >= 17) return "STAND";
  if (t >= 13 && t <= 16) return isUpIn(up, ["2","3","4","5","6"]) ? "STAND" : "HIT";
  if (t === 12) return isUpIn(up, ["4","5","6"]) ? "STAND" : "HIT";
  return "HIT";
}

function analyzeHand(cards) {
  const ranks = cards.map(normRank);
  const vals = ranks.map(rankValue);
  const isPair = ranks.length === 2 && ranks[0] === ranks[1];
  const pairRank = isPair ? pairRankValue(ranks[0]) : null;
  const totals = computeTotals(vals, ranks);
  const under = totals.filter(t => t <= 21);
  const best = under.length ? Math.max(...under) : Math.min(...totals);
  const hardTotal = vals.reduce((a, b) => a + b, 0);
  const hasAce = ranks.includes("A");
  const isSoft = hasAce && totals.some(t => t <= 21 && t !== hardTotal);
  return { ranks, isPair, pairRank, hardTotal, isSoft, softTotal: best };
}

function computeTotals(vals, ranks) {
  let total = vals.reduce((a, b) => a + b, 0);
  const aceCount = ranks.filter(r => r === "A").length;
  const totals = [total];
  for (let i = 1; i <= aceCount; i++) totals.push(total + i * 10);
  return totals;
}

function normRank(x) {
  const s = String(x).trim().toUpperCase();
  if (s === "0") return "T";
  if (["A","2","3","4","5","6","7","8","9","T"].includes(s)) return s;
  return s;
}
function rankValue(r) { return r === "A" ? 1 : (r === "T" ? 10 : Number(r)); }
function pairRankValue(r) { return r === "A" ? 11 : (r === "T" ? 10 : Number(r)); }
function isUpIn(up, arr) { return arr.includes(up) || arr.includes(Number(up)); }
