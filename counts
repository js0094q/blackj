// count.js
// Hi-Lo count helpers

export function normalizeCardToken(raw) {
  const s = String(raw).trim().toUpperCase();
  if (s === "0") return "T";
  if (["A","2","3","4","5","6","7","8","9","T"].includes(s)) return s;
  return null;
}

export function hiloValue(tok) {
  // tok is "A","2"..,"9","T"
  if (tok === "A" || tok === "T") return -1;
  const n = Number(tok);
  if (n >= 2 && n <= 6) return +1;
  return 0; // 7-9
}

export function computeTrueCount(runningCount, decksRemaining) {
  const dr = Math.max(0.25, Number(decksRemaining) || 0.25);
  const tc = runningCount / dr;
  // Round to 0.5 to reduce noise
  return Math.round(tc * 2) / 2;
}

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
