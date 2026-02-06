// count.js
export function normalizeCardToken(raw) {
  const s = String(raw).trim().toUpperCase();
  return ["A","2","3","4","5","6","7","8","9","T"].includes(s) ? s : (s === "0" ? "T" : null);
}

export function hiloValue(tok) {
  if (tok === "A" || tok === "T") return -1; // High cards
  const n = Number(tok);
  return (n >= 2 && n <= 6) ? 1 : 0; // Low cards +1, 7-9 neutral
}

export function computeTrueCount(rc, dr) {
  return Math.round((rc / Math.max(0.25, dr)) * 2) / 2; //
}

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
