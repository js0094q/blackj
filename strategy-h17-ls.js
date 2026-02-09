const S='STAND', H='HIT', D='DOUBLE', P='SPLIT', R='SURRENDER';

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

export function recommendMove(hand, up, tc) {
  if (!up || hand.length < 2) return null;
  const { total, isSoft, isPair, pairRank } = analyze(hand);
  
  if (up === 'A' && tc >= 3.0) return { action: 'INSURE', reason: 'Deviation: TC ≥ +3' };
  if (total === 16 && up === 'T' && tc >= 0) return { action: S, reason: 'Deviation: TC ≥ 0' };
  if (total === 15 && up === 'T' && tc >= 4) return { action: S, reason: 'Deviation: TC ≥ 4' };

  let move = H;
  if (isPair && hand.length === 2) move = MATRIX.pair[pairRank]?.[up] || MATRIX.pair[pairRank]?.default;
  else if (isSoft) move = MATRIX.soft[total]?.[up] || MATRIX.soft[total]?.default || H;
  else {
    if (total >= 17) move = S;
    else if (total <= 8) move = H;
    else move = MATRIX.hard[total]?.[up] || MATRIX.hard[total]?.default || H;
  }
  if (hand.length > 2 && (move === D || move === P)) move = H;
  return { action: move, reason: 'Basic Strategy' };
}

function analyze(cards) {
  let total=0, aces=0;
  for(const c of cards) { if(c==='A'){total+=11;aces++}else if(c==='T'){total+=10}else{total+=Number(c)} }
  while(total>21 && aces>0){total-=10;aces--}
  return { total, isSoft:aces>0, isPair:cards.length===2&&cards[0]===cards[1], pairRank:cards[0] };
}
