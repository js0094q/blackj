/**
 * strategy-h17-ls.js - O(1) Matrix Strategy Engine
 */

const S = 'STAND', H = 'HIT', D = 'DOUBLE', P = 'SPLIT', R = 'SURRENDER';

// Pre-compiled Strategy Matrix for H17 / 6-Deck / DAS
const MATRIX = {
  hard: {
    17: { default: S },
    16: { '2':S, '3':S, '4':S, '5':S, '6':S, '9':R, 'T':R, 'A':R, default: H },
    15: { '2':S, '3':S, '4':S, '5':S, '6':S, 'T':R, 'A':R, default: H },
    14: { '2':S, '3':S, '4':S, '5':S, '6':S, default: H },
    13: { '2':S, '3':S, '4':S, '5':S, '6':S, default: H },
    12: { '4':S, '5':S, '6':S, default: H },
    11: { default: D },
    10: { 'T':H, 'A':H, default: D },
    9:  { '3':D, '4':D, '5':D, '6':D, default: H },
    8:  { default: H }
  },
  soft: {
    20: { default: S },
    19: { '6':D, default: S },
    18: { '2':S, '3':D, '4':D, '5':D, '6':D, '7':S, '8':S, default: H },
    17: { '3':D, '4':D, '5':D, '6':D, default: H },
    16: { '4':D, '5':D, '6':D, default: H },
    15: { '4':D, '5':D, '6':D, default: H },
    14: { '5':D, '6':D, default: H },
    13: { '5':D, '6':D, default: H }
  },
  pair: {
    'A': { default: P },
    'T': { default: S },
    '9': { '7':S, 'T':S, 'A':S, default: P },
    '8': { default: P },
    '7': { '8':H, '9':H, 'T':H, 'A':H, default: P },
    '6': { '2':P, '3':P, '4':P, '5':P, '6':P, default: H },
    '5': { 'T':H, 'A':H, default: D },
    '4': { '5':P, '6':P, default: H },
    '3': { '2':P, '3':P, '4':P, '5':P, '6':P, '7':P, default: H },
    '2': { '2':P, '3':P, '4':P, '5':P, '6':P, '7':P, default: H }
  }
};

export function recommendMove(playerCards, dealerUp, tc = 0) {
  if (!dealerUp || playerCards.length < 2) return null;

  const d = dealerUp;
  const { total, isSoft, isPair, pairRank } = analyzeHandFast(playerCards);

  // 1. Insurance Deviation
  if (d === 'A' && tc >= 3.0) return { action: 'INSURE', reason: 'Deviation: TC ≥ 3' };

  // 2. Specific I-18 Deviations
  if (total === 16 && d === 'T' && tc >= 0) return { action: S, reason: 'Deviation: TC ≥ 0' };
  if (total === 15 && d === 'T' && tc >= 4) return { action: S, reason: 'Deviation: TC ≥ 4' };
  if (total === 12 && d === '2' && tc >= 3) return { action: S, reason: 'Deviation: TC ≥ 3' };
  if (total === 10 && d === 'T' && tc >= 4) return { action: D, reason: 'Deviation: TC ≥ 4' };

  // 3. Matrix Lookup
  let move = H;
  if (isPair && playerCards.length === 2) {
    move = MATRIX.pair[pairRank][d] || MATRIX.pair[pairRank].default;
  } else if (isSoft) {
    move = MATRIX.soft[total]?.[d] || MATRIX.soft[total]?.default || H;
  } else {
    if (total >= 17) move = S;
    else if (total <= 8) move = H;
    else move = MATRIX.hard[total]?.[d] || MATRIX.hard[total]?.default || H;
  }

  // Handle Double/Split after Hit restriction (simplified)
  if (playerCards.length > 2 && (move === D || move === P)) move = H;

  return { action: move, reason: 'Basic Strategy' };
}

function analyzeHandFast(cards) {
  let total = 0, aces = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (c === 'A') { total += 11; aces++; }
    else if (c === 'T') { total += 10; }
    else { total += Number(c); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return {
    total,
    isSoft: aces > 0,
    isPair: cards.length === 2 && cards[0] === cards[1],
    pairRank: cards[0]
  };
}
