// app.js (ES module)
import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const $ = (id) => document.getElementById(id);

const state = {
  decks: 6,
  penUsedPct: 0,
  decksRemaining: 6,
  runningCount: 0,

  tagMode: "table",     // "table" | "player" | "dealer"
  autoTagOn: true,

  dealerPeeks: true,    // rule toggle passed to strategy module
  deviationsOn: false,  // small set implemented here

  dealerUp: null,       // "A","2"..,"9","T"
  hands: [{ cards: [] }],
  activeHand: 0,

  tableLog: [],
  history: [],

  bankroll: 1000,
  minBet: 10,
  maxBet: 200,
  riskPct: 25
};

function setPenetration(pct) {
  const p = clamp(Number(pct) || 0, 0, 90);
  state.penUsedPct = p;
  const used = p / 100;
  state.decksRemaining = Math.max(0.25, state.decks * (1 - used));
}

function tc() {
  return computeTrueCount(state.runningCount, state.decksRemaining);
}

// ---------- Small, explicit deviations (override only HIT/STAND/DOUBLE; plus insurance advisory) ----------
function deviationOverride(baseAction, playerCards, dealerUp, trueCount) {
  // Normalize ranks once
  const up = normalizeCardToken(dealerUp);
  if (!up) return null;

  // Hand analysis for hard totals only (deviations below are hard-hand driven)
  const hand = analyzeForDevs(playerCards);
  if (!hand || hand.isSoft) return null;

  // Insurance (advisory, independent)
  if (up === "A" && trueCount >= 3) return { action: "INSURE", note: "Take insurance @ TC≥+3." };

  const t = hand.hardTotal;

  if (t === 16 && up === "T" && baseAction === "HIT" && trueCount >= 0) return { action: "STAND", note: "16v10 stand @ TC≥0." };
  if (t === 15 && up === "T" && baseAction === "HIT" && trueCount >= 4) return { action: "STAND", note: "15v10 stand @ TC≥+4." };
  if (t === 12 && up === "3" && baseAction === "HIT" && trueCount >= 2) return { action: "STAND", note: "12v3 stand @ TC≥+2." };
  if (t === 12 && up === "2" && baseAction === "HIT" && trueCount >= 3) return { action: "STAND", note: "12v2 stand @ TC≥+3." };
  if (t === 10 && up === "T" && baseAction !== "DOUBLE" && trueCount >= 4) return { action: "DOUBLE", note: "10v10 double @ TC≥+4." };
  if (t === 11 && up === "A" && baseAction !== "DOUBLE" && trueCount >= 1) return { action: "DOUBLE", note: "11vA double @ TC≥+1." };

  return null;
}

function analyzeForDevs(cards) {
  if (!cards || cards.length < 2) return null;
  const ranks = cards.map(normalizeCardToken).filter(Boolean);
  if (ranks.length !== cards.length) return null;

  // Hard total with A as 1
  const hardVals = ranks.map(r => (r === "A" ? 1 : (r === "T" ? 10 : Number(r))));
  const hardTotal = hardVals.reduce((a,b)=>a+b,0);

  // Soft test
  const hasAce = ranks.includes("A");
  const canBeSoft = hasAce && (hardTotal + 10) <= 21;

  return { hardTotal, isSoft: canBeSoft };
}

// ---------- Bet sizing ----------
function estimatedEdgeFromTC(trueCount) {
  // rule-of-thumb: edge ~ (TC - 1) * 0.5%
  const edge = (trueCount - 1) * 0.005;
  return clamp(edge, -0.02, 0.05);
}

function suggestedBet(trueCount) {
  const br = Math.max(0, Number(state.bankroll) || 0);
  const minB = Math.max(0, Number(state.minBet) || 0);
  const maxB = Math.max(minB, Number(state.maxBet) || 0);
  const risk = clamp((Number(state.riskPct) || 0) / 100, 0, 1);

  const edge = estimatedEdgeFromTC(trueCount);
  const variance = 1.3;

  if (edge <= 0 || br <= 0) return { bet: minB, edge };

  const kellyFrac = edge / variance;
  const frac = kellyFrac * risk;

  let bet = br * frac;
  bet = clamp(bet, minB, maxB);
  bet = Math.round(bet);

  return { bet, edge };
}

// ---------- UI refs ----------
const ui = {
  rc: $("rc"), dr: $("dr"), tc: $("tc"), bet: $("bet"),
  pen: $("pen"), penLabel: $("penLabel"),

  dealerUp: $("dealerUp"),
  hands: $("hands"),
  tableLog: $("tableLog"),
  tagLog: $("tagLog"),

  advice: $("advice"),
  adviceReason: $("adviceReason"),
  adviceTag: $("adviceTag"),

  tagTable: $("tagTable"),
  tagPlayer: $("tagPlayer"),
  tagDealer: $("tagDealer"),

  btnSplit: $("btnSplit"),
  btnNextHand: $("btnNextHand"),

  btnNewRound: $("btnNewRound"),
  btnNewShoe: $("btnNewShoe"),
  btnUndo: $("btnUndo"),

  devToggle: $("devToggle"),
  btnPeekRule: $("btnPeekRule"),
  btnResetTag: $("btnResetTag"),
  autoTagToggle: $("autoTagToggle"),

  bankroll: $("bankroll"),
  minBet: $("minBet"),
  maxBet: $("maxBet"),
  risk: $("risk"),
  riskLabel: $("riskLabel"),
  edgeLabel: $("edgeLabel"),
  betBig: $("betBig")
};

function setTag(mode) {
  state.tagMode = mode;
  ui.tagTable.classList.toggle("active", mode === "table");
  ui.tagPlayer.classList.toggle("active", mode === "player");
  ui.tagDealer.classList.toggle("active", mode === "dealer");
}

function newRound() {
  state.dealerUp = null;
  state.hands = [{ cards: [] }];
  state.activeHand = 0;
  state.tableLog = [];
  state.history = [];
  setTag("table");
  render();
}

function newShoe() {
  state.runningCount = 0;
  setPenetration(0);
  ui.pen.value = "0";
  state.deviationsOn = false;
  ui.devToggle.checked = false;
  state.dealerPeeks = true;
  renderPeekRuleButton();
  newRound();
}

function undo() {
  const last = state.history.pop();
  if (!last) return;

  state.runningCount -= last.delta;

  if (last.tag === "table") {
    state.tableLog.pop();
  } else if (last.tag === "dealer") {
    state.dealerUp = last.prev;
  } else if (last.tag === "player") {
    const h = state.hands[last.handIndex];
    if (h) h.cards.pop();
    state.activeHand = Math.min(state.activeHand, state.hands.length - 1);
  } else if (last.type === "SPLIT") {
    state.hands = last.prevHands.map(h => ({ cards: [...h.cards] }));
    state.activeHand = last.prevActive;
  }

  render();
}

function canSplitActiveHand() {
  const h = state.hands[state.activeHand];
  if (!h) return false;
  if (h.cards.length !== 2) return false;
  return h.cards[0] === h.cards[1];
}

function doSplit() {
  if (!canSplitActiveHand()) return;

  const h = state.hands[state.activeHand];
  const a = h.cards[0];
  const b = h.cards[1];

  state.history.push({
    type: "SPLIT",
    prevHands: state.hands.map(x => ({ cards: [...x.cards] })),
    prevActive: state.activeHand,
    delta: 0,
    tag: "split"
  });

  state.hands = [{ cards: [a] }, { cards: [b] }];
  state.activeHand = 0;
  render();
}

function nextHand() {
  if (state.hands.length <= 1) return;
  state.activeHand = (state.activeHand + 1) % state.hands.length;
  render();
}

function inferTagForTap() {
  if (!state.autoTagOn) return state.tagMode;
  if (!state.dealerUp) return "dealer";
  const h = state.hands[state.activeHand];
  if (h && h.cards.length < 2) return "player";
  return "table";
}

function logCard(rawCard, forcedTag = null) {
  const tok = normalizeCardToken(rawCard);
  if (!tok) return;

  const tag = forcedTag ?? inferTagForTap();
  const delta = hiloValue(tok);

  state.runningCount += delta;

  if (tag === "table") {
    state.tableLog.push(tok);
    state.history.push({ type: "CARD", tag: "table", card: tok, delta });
    setTag("table");
    render();
    return;
  }

  if (tag === "dealer") {
    const prev = state.dealerUp;
    state.dealerUp = tok;
    state.history.push({ type: "CARD", tag: "dealer", card: tok, delta, prev });
    setTag("table");
    render();
    return;
  }

  const hi = state.activeHand;
  const h = state.hands[hi] || state.hands[0];
  h.cards.push(tok);
  state.history.push({ type: "CARD", tag: "player", card: tok, delta, handIndex: hi });
  setTag("table");
  render();
}

// ---------- Render ----------
function renderPeekRuleButton() {
  ui.btnPeekRule.textContent = state.dealerPeeks ? "Dealer Peek: YES" : "Dealer Peek: NO";
}

function renderCounts() {
  const tcount = tc();
  ui.rc.textContent = String(state.runningCount);
  ui.dr.textContent = state.decksRemaining.toFixed(1);
  ui.tc.textContent = tcount.toFixed(1);

  const out = suggestedBet(tcount);
  ui.bet.textContent = `$${out.bet}`;
}

function renderBankrollPanel() {
  ui.riskLabel.textContent = `${state.riskPct}%`;

  const tcount = tc();
  const out = suggestedBet(tcount);

  ui.edgeLabel.textContent = `${(out.edge * 100).toFixed(1)}%`;
  ui.betBig.textContent = `$${out.bet}`;
}

function renderHands() {
  ui.hands.innerHTML = "";
  state.hands.forEach((h, idx) => {
    const div = document.createElement("div");
    div.className = "hand" + (idx === state.activeHand ? " active" : "");
    div.addEventListener("click", () => { state.activeHand = idx; render(); });

    const top = document.createElement("div");
    top.className = "handtop";

    const name = document.createElement("div");
    name.className = "handname";
    name.textContent = state.hands.length > 1 ? `Hand ${idx + 1}` : "Hand";

    const right = document.createElement("div");
    right.className = "pill";
    right.textContent = (idx === state.activeHand) ? "ACTIVE" : "TAP";

    top.appendChild(name);
    top.appendChild(right);

    const cards = document.createElement("div");
    cards.className = "handcards";
    cards.textContent = h.cards.length ? h.cards.join(" ") : "—";

    const meta = document.createElement("div");
    meta.className = "handmeta";
    meta.textContent = h.cards.length ? `${h.cards.join(" ")} (${h.cards.length} cards)` : "No cards";

    div.appendChild(top);
    div.appendChild(cards);
    div.appendChild(meta);

    ui.hands.appendChild(div);
  });

  ui.btnNextHand.disabled = state.hands.length <= 1;
  ui.btnSplit.disabled = !canSplitActiveHand();
}

function renderLogs() {
  ui.tableLog.textContent = state.tableLog.length ? state.tableLog.join(" ") : "—";

  const parts = [];
  if (state.dealerUp) parts.push(`d:${state.dealerUp}`);

  state.hands.forEach((h, i) => {
    if (!h.cards.length) return;
    if (state.hands.length === 1) parts.push(`p:${h.cards.join(" ")}`);
    else parts.push(`p${i + 1}:${h.cards.join(" ")}`);
  });

  ui.tagLog.textContent = parts.length ? parts.join("  ") : "—";
}

function renderAdvice() {
  ui.dealerUp.textContent = state.dealerUp ?? "—";

  const h = state.hands[state.activeHand];
  const up = state.dealerUp;
  const tcount = tc();

  if (!up || !h || h.cards.length < 2) {
    ui.advice.textContent = "—";
    ui.adviceTag.textContent = state.deviationsOn ? "I18" : "BASIC";
    ui.adviceReason.textContent = "Set Dealer Up and at least two cards in your active hand.";
    return;
  }

  const base = recommendMove(h.cards, up, {
    dealerPeeks: state.dealerPeeks,
    dealerHitsSoft17: true,
    lateSurrender: true,
    doubleAfterSplit: true
  });

  let action = base.action || "—";
  let reason = base.reason || "";

  let tag = state.deviationsOn ? "I18" : "BASIC";

  if (state.deviationsOn) {
    const dev = deviationOverride(actionMap(action), h.cards, up, tcount);

    if (dev) {
      if (dev.action === "INSURE") {
        ui.advice.textContent = `${actionLabel(action)} + INSURANCE`;
        ui.adviceTag.textContent = "I18";
        ui.adviceReason.textContent = `${reason} ${dev.note}`;
        return;
      }
      if (dev.action && dev.action !== actionMap(action)) {
        ui.advice.textContent = dev.action;
        ui.adviceTag.textContent = "I18";
        ui.adviceReason.textContent = `${reason} ${dev.note}`;
        return;
      }
    }
  }

  ui.advice.textContent = actionLabel(action);
  ui.adviceTag.textContent = tag;
  ui.adviceReason.textContent = reason;
}

function actionMap(act) {
  // strategy module returns: "SUR"|"SPLIT"|"DOUBLE"|"HIT"|"STAND"
  if (act === "SUR") return "SURRENDER";
  if (act === "SPLIT") return "SPLIT";
  if (act === "DOUBLE") return "DOUBLE";
  if (act === "HIT") return "HIT";
  if (act === "STAND") return "STAND";
  return act;
}

function actionLabel(act) {
  if (act === "SUR") return "SURRENDER";
  return act;
}

function render() {
  ui.penLabel.textContent = `${state.penUsedPct}%`;
  renderPeekRuleButton();
  renderCounts();
  renderBankrollPanel();
  renderHands();
  renderLogs();
  renderAdvice();
}

// ---------- Wire events ----------
ui.pen.addEventListener("input", () => { setPenetration(ui.pen.value); render(); });

ui.devToggle.addEventListener("change", () => {
  state.deviationsOn = ui.devToggle.checked;
  render();
});

ui.btnPeekRule.addEventListener("click", () => {
  state.dealerPeeks = !state.dealerPeeks;
  render();
});

ui.btnResetTag.addEventListener("click", () => setTag("table"));

ui.autoTagToggle.addEventListener("change", () => {
  state.autoTagOn = ui.autoTagToggle.checked;
  render();
});

ui.tagTable.addEventListener("click", () => setTag("table"));
ui.tagPlayer.addEventListener("click", () => setTag("player"));
ui.tagDealer.addEventListener("click", () => setTag("dealer"));

ui.btnNewRound.addEventListener("click", newRound);
ui.btnNewShoe.addEventListener("click", newShoe);
ui.btnUndo.addEventListener("click", undo);

ui.btnSplit.addEventListener("click", doSplit);
ui.btnNextHand.addEventListener("click", nextHand);

// Bankroll inputs
function syncBankrollInputs() {
  state.bankroll = Number(ui.bankroll.value) || 0;
  state.minBet = Number(ui.minBet.value) || 0;
  state.maxBet = Number(ui.maxBet.value) || state.minBet;
  state.riskPct = Number(ui.risk.value) || 0;
  if (state.maxBet < state.minBet) state.maxBet = state.minBet;
  render();
}
ui.bankroll.addEventListener("input", syncBankrollInputs);
ui.minBet.addEventListener("input", syncBankrollInputs);
ui.maxBet.addEventListener("input", syncBankrollInputs);
ui.risk.addEventListener("input", syncBankrollInputs);

// Tap cards with long-press (table) + double-tap (undo)
let pressTimer = null;
let lastTapAt = 0;

function attachPressHandlers(btn) {
  const card = btn.dataset.card;

  const startPress = () => {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      logCard(card, "table");
      pressTimer = null;
    }, 420);
  };

  const endPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  btn.addEventListener("touchstart", startPress, { passive: true });
  btn.addEventListener("touchend", endPress, { passive: true });
  btn.addEventListener("touchcancel", endPress, { passive: true });

  btn.addEventListener("mousedown", startPress);
  btn.addEventListener("mouseup", endPress);
  btn.addEventListener("mouseleave", endPress);

  btn.addEventListener("click", () => {
    const now = Date.now();
    if (now - lastTapAt < 260) {
      undo();
      lastTapAt = 0;
      return;
    }
    lastTapAt = now;
    logCard(card);
  });
}

document.querySelectorAll(".cardbtn").forEach(attachPressHandlers);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const k = String(e.key).toUpperCase();

  if (k === "U") { undo(); return; }
  if (k === "N") { newRound(); return; }
  if (k === "S") { newShoe(); return; }

  if (["A","2","3","4","5","6","7","8","9","T","0"].includes(k)) logCard(k);
});

// ---------- Init ----------
(function init() {
  setPenetration(0);
  setTag("table");
  ui.devToggle.checked = state.deviationsOn;
  ui.autoTagToggle.checked = state.autoTagOn;
  render();
})();
