export const HILO_VALUES = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  'T': -1, 'A': -1
};

export const RANK_MAP = { '0': 'T', '10': 'T', 'J': 'T', 'Q': 'T', 'K': 'T' };

export function normalizeRank(raw) {
  const s = String(raw).trim().toUpperCase();
  return RANK_MAP[s] || s;
}

export function getExactTrueCount(rc, decksRemaining) {
  return rc / Math.max(0.25, decksRemaining);
}

// True count rounded to nearest 0.5
export function getTrueCount(rc, decksRemaining) {
  return Math.round(getExactTrueCount(rc, decksRemaining) * 2) / 2;
}
