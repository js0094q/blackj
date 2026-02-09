/**
 * count.js - Hi-Lo Counting & Betting Utilities
 */

export const HILO_VALUES = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  'T': -1, 'A': -1
};

export const RANK_MAP = { '0': 'T', '10': 'T', 'J': 'T', 'Q': 'T', 'K': 'T' };

/**
 * Normalizes input tokens into a standard single-character rank.
 */
export function normalizeRank(raw) {
  const s = String(raw).trim().toUpperCase();
  return RANK_MAP[s] || s;
}

/**
 * Calculates True Count using remaining decks in the shoe.
 */
export function getTrueCount(rc, dr) {
  return Math.round((rc / Math.max(0.25, dr)) * 2) / 2;
}

/**
 * Suggests a bet unit based on TC (Standard spread).
 */
export function getRecommendedBet(tc, unit = 10) {
  if (tc <= 1) return unit;
  return Math.min(unit * 50, Math.floor(tc) * unit);
}
