// Basic strategy (6D, H17, LS assumed in matrix) + a few Hi-Lo deviations.
// This module recommends an action; it does not simulate table rules (splits, dealer draws, etc.).

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
    9: { '3': D, '4': D, '5': D, '6': D, default: H },
    8: { default: H }
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

function baseStrategyAction(hand, up) {
  const { total, isSoft, isPair, pairRank } = analyze(hand);

  let action = H;
  let family = 'hard';

  if (isPair && hand.length === 2) {
    family = 'pair';
    action = MATRIX.pair[pairRank]?.[up] || MATRIX.pair[pairRank]?.default || H;
  } else if (isSoft) {
    family = 'soft';
    action = MATRIX.soft[total]?.[up] || MATRIX.soft[total]?.default || H;
  } else {
    family = 'hard';
    if (total >= 17) action = S;
    else if (total <= 8) action = H;
    else action = MATRIX.hard[total]?.[up] || MATRIX.hard[total]?.default || H;
  }

  // Simplification: if user has more than 2 cards, we disallow DOUBLE/SPLIT suggestions.
  if (hand.length > 2 && (action === D || action === P)) action = H;

  return { action, family, total, isSoft, isPair, pairRank };
}

function deviation(hand, up, tc, base) {
  // Keep deviations minimal and explicit.
  // Return {action, name, rule} or null.

  // Insurance vs Ace at TC >= +3
  if (up === 'A' && tc >= 3.0) {
    return { action: I, name: 'Insurance', rule: 'TC ≥ +3.0' };
  }

  // 16 vs T: stand at TC >= 0
  if (base.total === 16 && up === 'T' && tc >= 0) {
    return { action: S, name: '16 vs T', rule: 'TC ≥ 0.0' };
  }

  // 15 vs T: stand at TC >= +4
  if (base.total === 15 && up === 'T' && tc >= 4) {
    return { action: S, name: '15 vs T', rule: 'TC ≥ +4.0' };
  }

  return null;
}

export function recommendMove(hand, up, tc) {
  if (!up || hand.length < 2) return null;

  const base = baseStrategyAction(hand, up);
  const dev = deviation(hand, up, tc, base);

  if (dev) {
    return {
      action: dev.action,
      baseAction: base.action,
      deviation: `${dev.name} (${dev.rule})`,
      reason: `Deviation: ${dev.name}, ${dev.rule}`,
      details: { total: base.total, isSoft: base.isSoft, isPair: base.isPair, family: base.family }
    };
  }

  return {
    action: base.action,
    baseAction: base.action,
    deviation: null,
    reason: 'Basic Strategy',
    details: { total: base.total, isSoft: base.isSoft, isPair: base.isPair, family: base.family }
  };
}

function analyze(cards) {
  let total = 0, aces = 0;
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
