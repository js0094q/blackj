// app.js
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";
import { recommendMove } from "./strategy-h17-ls.js";

const el = (id) => document.getElementById(id);

const ui = {
  cmd: el("cmd"),
  rc: el("rc"),
  dr: el("dr"),
  tc: el("tc"),
  dealerUp: el("dealerUp"),
  playerHand: el("playerHand"),
  tableCards: el("tableCards"),
  taggedCards: el("taggedCards"),
  advice: el("advice"),
  adviceTag: el("adviceTag"),
  adviceReason: el("adviceReason"),
  peekState: el("peekState"),

  btnNewRound: el("btnNewRound"),
  btnUndo: el("btnUndo"),
  btnShoe: el("btnShoe"),
  btnClear: el("btnClear"),
};

const state = {
  rules: {
    decks: 6,
    dealerHitsSoft17: true,
    lateSurrender: true,
    doubleAfterSplit: true,
    dealerPeeks: true,
    peekResolved: true
  },
  runningCount: 0,
  decksRemaining: 6.0,

  round: {
    table: [],
    player: [],
    dealerUp: null,
    log: [] // for undo, each entry includes kind and countDelta
  }
};

// ---------- Core actions ----------

function startNewRound() {
  state.round = { table: [], player: [], dealerUp: null, log: [] };
  render();
}

function startNewShoe(decks = 6) {
  state.rules.decks = decks;
  state.decksRemaining = Number(decks);
  state.runningCount = 0;
  startNewRound();
}

function clearAll() {
  startNewShoe(state.rules.decks);
  ui.cmd.value = "";
}

function undoLast() {
  const last = state.round.log.pop();
  if (!last) return;

  state.runningCount -= last.countDelta;

  if (last.kind === "TABLE") state.round.table.pop();
  if (last.kind === "P") state.round.player.pop();
  if (last.kind === "DUP") state.round.dealerUp = last.prevDealerUp ?? null;

  render();
}

function setPenetrationUsed(percentUsed) {
  const used = clamp(Number(percentUsed) / 100, 0, 0.95);
  state.decksRemaining = Math.max(0.25, state.rules.decks * (1 - used));
}

function setDecksRemaining(dr) {
  const v = Number(dr);
  if (!Number.isFinite(v) || v <= 0) return;
  state.decksRemaining = Math.max(0.25, v);
}

function setPeekResolved(on) {
  state.rules.peekResolved = !!on;
  render();
}

// ---------- Parsing ----------

function tokenize(line) {
  return line
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Mode: TABLE (default), P (player), DUP (dealer up)
function processLine(line) {
  const raw = tokenize(line);
  if (!raw.length) return;

  let mode = "TABLE";

  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];

    // Commands
    const lower = t.toLowerCase();

    if (lower === "n") { startNewRound(); continue; }
    if (lower === "undo") { undoLast(); continue; }

    if (lower === "shoe") {
      const n = Number(raw[i + 1]);
      if (Number.isFinite(n) && n > 0) { startNewShoe(n); i++; }
      continue;
    }

    if (lower === "pen") {
      const p = Number(raw[i + 1]);
      if (Number.isFinite(p)) { setPenetrationUsed(p); i++; }
      continue;
    }

    if (lower === "dr") {
      const d = Number(raw[i + 1]);
      if (Number.isFinite(d)) { setDecksRemaining(d); i++; }
      continue;
    }

    if (lower === "peek") {
      const v = (raw[i + 1] || "").toLowerCase();
      if (v === "on") { setPeekResolved(true); i++; }
      if (v === "off") { setPeekResolved(false); i++; }
      continue;
    }

    if (lower === "reveal") {
      // After "reveal", treat subsequent tokens as TABLE exposures (count-only).
      mode = "TABLE";
      continue;
    }

    // Prefix switches like "p:" or "d:"
    if (t.endsWith(":")) {
      const pref = t.slice(0, -1).toLowerCase();
      if (pref === "p") mode = "P";
      if (pref === "d") mode = "DUP";
      continue;
    }

    // Inline prefixes like "p:A" or "d:6"
    if (t.includes(":")) {
      const [prefRaw, valRaw] = t.split(":");
      const pref = (prefRaw || "").toLowerCase();
      const val = normalizeCardToken(valRaw);
      if (!val) continue;

      if (pref === "p") mode = "P";
      if (pref === "d") mode = "DUP";

      // Process the val in the selected mode
      applyCard(val, mode);
      // After dealer upcard, return to TABLE for speed
      if (mode === "DUP") mode = "TABLE";
      continue;
    }

    // Card token
    const card = normalizeCardToken(t);
    if (!card) continue;

    applyCard(card, mode);
    if (mode === "DUP") mode = "TABLE";
  }

  render();
}

function applyCard(card, mode) {
  const delta = hiloValue(card);

  if (mode === "TABLE") {
    state.round.table.push(card);
    state.runningCount += delta;
    state.round.log.push({ kind: "TABLE", card, countDelta: delta });
    return;
  }

  if (mode === "P") {
    state.round.player.push(card);
    state.runningCount += delta;
    state.round.log.push({ kind: "P", card, countDelta: delta });
    return;
  }

  if (mode === "DUP") {
    const prev = state.round.dealerUp;
    state.round.dealerUp = card;
    state.runningCount += delta;
    state.round.log.push({ kind: "DUP", card, prevDealerUp: prev, countDelta: delta });
    return;
  }
}

// ---------- Rendering ----------

function render() {
  const tc = computeTrueCount(state.runningCount, state.decksRemaining);

  ui.rc.textContent = String(state.runningCount);
  ui.dr.textContent = state.decksRemaining.toFixed(1);
  ui.tc.textContent = tc.toFixed(1);

  ui.dealerUp.textContent = state.round.dealerUp ? String(state.round.dealerUp) : "—";
  ui.playerHand.textContent = state.round.player.length ? state.round.player.join(" ") : "—";

  ui.peekState.textContent = state.rules.peekResolved ? "ON" : "OFF";

  ui.tableCards.textContent = state.round.table.length ? state.round.table.join(" ") : "—";
  ui.taggedCards.textContent = buildTaggedText();

  const adviceObj = getAdvice();
  ui.advice.textContent = adviceObj.action ?? "—";
  ui.adviceTag.textContent = adviceObj.tag;
  ui.adviceReason.textContent = adviceObj.reasonText;
}

function buildTaggedText() {
  const parts = [];
  if (state.round.dealerUp) parts.push(`d:${state.round.dealerUp}`);
  if (state.round.player.length) parts.push(`p:${state.round.player.join(" ")}`);
  return parts.length ? parts.join("  ") : "—";
}

function getAdvice() {
  const p = state.round.player;
  const d = state.round.dealerUp;

  if (!d || p.length < 2) {
    return { action: null, tag: "BASIC", reasonText: "Enter p: and d: to get advice." };
  }

  const res = recommendMove(p, d, {
    dealerHitsSoft17: state.rules.dealerHitsSoft17,
    lateSurrender: state.rules.lateSurrender,
    doubleAfterSplit: state.rules.doubleAfterSplit,
    dealerPeeks: state.rules.dealerPeeks,
    peekResolved: state.rules.peekResolved
  });

  let action = res.action;
  if (!action) return { action: null, tag: "BASIC", reasonText: res.reason || "No advice." };

  const pretty = actionPretty(action);
  const tag = "BASIC";
  const extra = res.note ? ` ${res.note}` : "";
  return { action: pretty, tag, reasonText: `${res.reason || "Strategy."}${extra}` };
}

function actionPretty(a) {
  if (a === "SUR") return "SURRENDER";
  if (a === "SPLIT") return "SPLIT";
  if (a === "DOUBLE") return "DOUBLE";
  if (a === "HIT") return "HIT";
  if (a === "STAND") return "STAND";
  return a;
}

// ---------- Events ----------

ui.cmd.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const line = ui.cmd.value.trim();
    if (!line) return;
    processLine(line);
    ui.cmd.value = "";
  }
});

ui.btnNewRound.addEventListener("click", () => startNewRound());
ui.btnUndo.addEventListener("click", () => undoLast());
ui.btnShoe.addEventListener("click", () => startNewShoe(6));
ui.btnClear.addEventListener("click", () => clearAll());

// Autofocus command box
ui.cmd.focus();

// Initial render
render();
