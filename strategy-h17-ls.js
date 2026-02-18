// 6D, H17, LS assumed in matrix + a few explicit Hi-Lo deviations.
// This module only recommends the player's action.

const S = 'STAND', H = 'HIT', D = 'DOUBLE', P = 'SPLIT', R = 'SURRENDER', I = 'INSURE';

const MATRIX = {
  hard: {
    17: { default: S },
    16: { '2': S, '3': S, '4': S, '5': S, '6': S, '9': R, 'T': R, 'A': R, default: H },
    15: { '2': S, '3': S, '4': S, '5': S, '6': S, 'T': R, 'A': R, default: H },
    14: { '2': S, '3': S, '4': S, '5': S, '6': S, default: H },
    13: { '2': S, '3': S, '4': S, '5': S, '6': S, default: H },
    12: { '4': S, '5': S, '6': S, default: H },
    11: { default: D },
    10: { 'T': H, 'A': H, default: D },
    9:  { '3': D, '4': D, '5': D, '6': D, default: H },
    8:  { default: H }
  },
  soft: {
    20: { default: S },
    19: { '6': D, default: S },
    18: { '2': S, '3': D, '4': D, '5': D, '6': D, '7': S, '8': S, default: H },
    17: { '3': D, '4': D, '5': D, '6': D, default: H },
    16: { '4': D, '5': D, '6': D, default: H },
    15: { '4': D, '5': D, '6': D, default: H },
    14: { '5': D, '6': D, default: H },
    13: { '5': D, '6': D, default: H }
  },
  pair: {
    'A': { default: P },
    'T': { default: S },
    '9': { '7': S, 'T': S, 'A': S, default: P },
    '8': { default: P },
    '7': { '8': H, '9': H, 'T': H, 'A': H, default: P },
    '6': { '2': P, '3': P, '4': P, '5': P, '6': P, default: H },
    '5': { 'T': H, 'A': H, default: D },
    '4': { '5': P, '6': P, default: H },
    '3': { '2': P, '3': P, '4': P, '5': P, '6': P, '7': P, default: H },
    '2': { '2': P, '3': P, '4': P, '5': P, '6': P, '7': P, default: H }
  }
};

function analyze(cards) {
  let total = 0;
  let aces = 0;

  for (const c of cards) {
    if (c === 'A') { total += 11; aces++; }
    else if (c === 'T') total += 10;
    else total += Number(c);
  }

  while (total > 21 && aces > 0) { total -= 10; aces--; }

  return {
    total,
    isSoft: aces > 0,
    isPair: cards.length === 2 && cards[0] === cards[1],
    pairRank: cards[0]
  };
}

function baseMove(hand, up) {
  const a = analyze(hand);

  let action = H;
  let family = 'hard';

  if (a.isPair && hand.length === 2) {
    family = 'pair';
    action = MATRIX.pair[a.pairRank]?.[up] || MATRIX.pair[a.pairRank]?.default || H;
  } else if (a.isSoft) {
    family = 'soft';
    action = MATRIX.soft[a.total]?.[up] || MATRIX.soft[a.total]?.default || H;
  } else {
    family = 'hard';
    if (a.total >= 17) action = S;
    else if (a.total <= 8) action = H;
    else action = MATRIX.hard[a.total]?.[up] || MATRIX.hard[a.total]?.default || H;
  }

  if (hand.length > 2 && (action === D || action === P)) action = H;

  return { action, total: a.total, family, isSoft: a.isSoft, isPair: a.isPair };
}

function deviation(hand, up, tc, base) {
  const twoCard = hand.length === 2;
  const hardTotal = !base.isSoft;
  const isPairHand = base.isPair;

  // Illustrious 18
  if (up === 'A' && tc >= 3.0) return { action: I, name: 'Insurance', rule: 'TC >= +3.0' };

  if (twoCard && hardTotal && !isPairHand && base.total === 16 && up === 'T' && tc >= 0.0) {
    return { action: S, name: '16 vs T', rule: 'TC >= +0.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 15 && up === 'T' && tc >= 4.0) {
    return { action: S, name: '15 vs T', rule: 'TC >= +4.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 10 && up === 'T' && tc >= 4.0) {
    return { action: D, name: '10 vs T', rule: 'TC >= +4.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 12 && up === '3' && tc >= 2.0) {
    return { action: S, name: '12 vs 3', rule: 'TC >= +2.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 12 && up === '2' && tc >= 3.0) {
    return { action: S, name: '12 vs 2', rule: 'TC >= +3.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 11 && up === 'A' && tc >= 1.0) {
    return { action: D, name: '11 vs A', rule: 'TC >= +1.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 9 && up === '2' && tc >= 1.0) {
    return { action: D, name: '9 vs 2', rule: 'TC >= +1.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 10 && up === 'A' && tc >= 4.0) {
    return { action: D, name: '10 vs A', rule: 'TC >= +4.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 9 && up === '7' && tc >= 3.0) {
    return { action: D, name: '9 vs 7', rule: 'TC >= +3.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 16 && up === '9' && tc >= 5.0) {
    return { action: S, name: '16 vs 9', rule: 'TC >= +5.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 13 && up === '2' && tc <= -1.0) {
    return { action: H, name: '13 vs 2', rule: 'TC <= -1.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 12 && up === '4' && tc < 0.0) {
    return { action: H, name: '12 vs 4', rule: 'TC < +0.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 12 && up === '5' && tc <= -2.0) {
    return { action: H, name: '12 vs 5', rule: 'TC <= -2.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 12 && up === '6' && tc <= -1.0) {
    return { action: H, name: '12 vs 6', rule: 'TC <= -1.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 13 && up === '3' && tc <= -2.0) {
    return { action: H, name: '13 vs 3', rule: 'TC <= -2.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 15 && up === '9' && tc >= 2.0) {
    return { action: S, name: '15 vs 9', rule: 'TC >= +2.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 15 && up === 'A' && tc >= 5.0) {
    return { action: S, name: '15 vs A', rule: 'TC >= +5.0' };
  }

  // Fab 4 (Late Surrender indices)
  if (twoCard && hardTotal && !isPairHand && base.total === 14 && up === 'T' && tc >= 3.0) {
    return { action: R, name: '14 vs T Surrender', rule: 'TC >= +3.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 15 && up === '9' && tc >= 2.0) {
    return { action: R, name: '15 vs 9 Surrender', rule: 'TC >= +2.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 15 && up === 'T' && tc >= 0.0) {
    return { action: R, name: '15 vs T Surrender', rule: 'TC >= +0.0' };
  }
  if (twoCard && hardTotal && !isPairHand && base.total === 15 && up === 'A' && tc >= 1.0) {
    return { action: R, name: '15 vs A Surrender', rule: 'TC >= +1.0' };
  }

  return null;
}

export function recommendMove(hand, up, tc) {
  if (!up || hand.length < 2) return null;

  const base = baseMove(hand, up);
  const dev = deviation(hand, up, tc, base);

  if (dev) {
    return {
      action: dev.action,
      baseAction: base.action,
      deviation: `${dev.name} (${dev.rule})`,
      reason: `Deviation applied: ${dev.name}, ${dev.rule}`,
      details: { total: base.total, family: base.family }
    };
  }

  return {
    action: base.action,
    baseAction: base.action,
    deviation: null,
    reason: 'Basic Strategy',
    details: { total: base.total, family: base.family }
  };
}
