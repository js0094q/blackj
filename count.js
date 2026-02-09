/**
 * count.js - High-Performance Counting Module
 */

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

export function getTrueCount(rc, decksRemaining) {
  // Use a floor of 0.5 to prevent infinity/extreme spikes
  return Math.round((rc / Math.max(0.5, decksRemaining)) * 2) / 2;
}

export function getRecommendedBet(tc, unit = 10) {
  if (tc <= 1) return unit;
  return Math.min(unit * 50, Math.floor(tc) * unit);
}
