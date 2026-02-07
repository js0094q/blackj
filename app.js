import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const config = {
  decks: 6, minBet: 10, maxBet: 500, bankroll: 1000
};

// Snapshot-based history for easy Undo
let historyStack = [];

const state = {
  runningCount: 0,
  dealerUp: null,
  hands: [{ cards: [] }], // Only support 1 player hand for manual simplicity
  tagMode: "player"
};

/* --- STATE MANAGEMENT --- */
function saveState() {
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 50) historyStack.shift(); // Limit history
}

function restoreState() {
  if (historyStack.length === 0) return;
  const prev = JSON.parse(historyStack.pop());
  Object.assign(state, prev);
  render();
}

function processCard(input) {
  const tok = normalizeCardToken(input);
  if (!tok) return;

  saveState(); // Save before mutation

  // Update Count
  state.runningCount += hiloValue(tok);

  // Logic based on Tag Mode
  if (state.tagMode === "dealer") {
    state.dealerUp = tok;
    setTagMode("player"); // Auto-switch to player after dealer upcard
  } else if (state.tagMode === "player") {
    state.hands[0].cards.push(tok);
  } else {
    // Burn/Table card - just affects count
  }

  render();
}

function resetRound() {
  saveState();
  state.dealerUp = null;
  state.hands = [{ cards: [] }];
  setTagMode("player");
  render();
}

function setTagMode(mode) {
  state.tagMode = mode;
  document.querySelectorAll(".tag-btn").forEach(b => b.classList.remove("active"));
  const map = { player: "tag-player", dealer: "tag-dealer", table: "tag-table" };
  document.getElementById(map[mode]).classList.add("active");
}

/* --- UI RENDERING --- */
function render() {
  // 1. Calc Stats
  const decksRemaining = Math.max(0.5, config.decks - (historyStack.length / 52)); // Rough est or keep static
  const tc = computeTrueCount(state.runningCount, config.decks); // Use config decks for simplicity
  
  document.getElementById("rc").textContent = state.runningCount;
  document.getElementById("tc").textContent = tc.toFixed(1);
  
  // 2. Bet Sizing (Simple Kelly Criterion or linear ramp)
  const edge = (tc - 1) * 0.5; // Rough % edge
  let bet = config.minBet;
  if (edge > 0) {
    bet = Math.floor(config.minBet * (1 + (tc - 1) * 2)); // 1 Unit per TC point above 1
    if (bet > config.maxBet) bet = config.maxBet;
  }
  document.getElementById("bet-val").textContent = `$${bet}`;

  // 3. Cards
  document.getElementById("dealer-card").textContent = state.dealerUp || "—";
  document.getElementById("player-hand").textContent = state.hands[0].cards.join("  ") || "—";

  // 4. Strategy Advice
  const panel = document.getElementById("advice-panel");
  const mainTxt = document.getElementById("advice-text");
  const subTxt = document.getElementById("advice-sub");
  
  panel.className = "advice-hero"; // Reset classes

  const rec = recommendMove(state.hands[0].cards, state.dealerUp);
  
  if (!rec.action) {
    mainTxt.textContent = "WAITING";
    subTxt.textContent = "Input Dealer & Player Cards";
    panel.classList.add("waiting");
  } else {
    mainTxt.textContent = rec.action;
    subTxt.textContent = rec.reason;
    
    // Color Coding
    if (rec.action.includes("HIT")) panel.classList.add("hit");
    else if (rec.action.includes("STAND")) panel.classList.add("stand");
    else if (rec.action.includes("DOUBLE")) panel.classList.add("double");
    else if (rec.action.includes("SPLIT")) panel.classList.add("split");
    else if (rec.action.includes("SUR")) panel.classList.add("stand"); // Surrender usually warning color
  }
}

/* --- INPUT HANDLING --- */
document.addEventListener("keydown", (e) => {
  const key = e.key.toUpperCase();
  
  // Modes
  if (key === "D") setTagMode("dealer");
  if (key === "P") setTagMode("player");
  if (key === "T") setTagMode("table");
  
  // Actions
  if (key === "R") resetRound();
  if (key === "BACKSPACE") restoreState();

  // Card Inputs
  if (["1","A"].includes(key)) processCard("A");
  else if (["0","J","Q","K"].includes(key)) processCard("T");
  else if (parseInt(key) >= 2 && parseInt(key) <= 9) processCard(key);
});

// Click Handlers
document.querySelectorAll(".cardbtn").forEach(b => {
  b.addEventListener("click", () => processCard(b.dataset.card));
});
document.getElementById("tag-player").addEventListener("click", () => setTagMode("player"));
document.getElementById("tag-dealer").addEventListener("click", () => setTagMode("dealer"));
document.getElementById("tag-table").addEventListener("click", () => setTagMode("table"));
document.getElementById("reset-btn").addEventListener("click", resetRound);
document.getElementById("undo-btn").addEventListener("click", restoreState);

// Settings
const modal = document.getElementById("settings-modal");
document.getElementById("settings-toggle").addEventListener("click", () => modal.classList.remove("hidden"));
document.getElementById("save-settings").addEventListener("click", () => {
  config.decks = parseFloat(document.getElementById("cfg-decks").value);
  config.minBet = parseFloat(document.getElementById("cfg-min").value);
  modal.classList.add("hidden");
  render();
});

// Init
render();
