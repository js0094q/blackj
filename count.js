export function normalizeCardToken(raw) {
  const s = String(raw).trim().toUpperCase();
  if (s === "0") return "T";
  if (["A","2","3","4","5","6","7","8","9","T"].includes(s)) return s;
  return null;
}
export function hiloValue(tok) {
  if (tok === "A" || tok === "T") return -1;
  const n = Number(tok);
  if (n >= 2 && n <= 6) return +1;
  return 0;
}
export function computeTrueCount(rc, dr) {
  return Math.round((rc / Math.max(0.25, dr)) * 2) / 2;
}
export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
