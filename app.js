import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const config = {
  decks: 6, minBet: 10, maxBet: 500, bankroll: 1000
};

let historyStack = [];

const state = {
  runningCount: 0,
  dealerUp: null,
  hands: [{ cards: [] }],
  tagMode: "player"
};

/* --- LOGIC: DEVIATIONS & ADVICE --- */

function getHandDetails(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === "A") { aces++; total += 11; }
    else if (c === "T") { total += 10; }
    else { total += Number(c); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, isSoft: aces > 0 };
}

function checkDeviations(basicAction, hand, dealerUp, trueCount) {
  const { total, isSoft } = hand;

  // Insurance
  if (dealerUp === "A" && trueCount >= 3) {
    return { action: "INSURANCE", reason: "True Count ≥ +3 (Insurance is +EV)" };
  }
  
  if (isSoft) return null; // Few soft deviations in this tier

  // Fab 4 Surrender
  if (total === 15 && dealerUp === "T" && trueCount >= 0 && basicAction !== "SUR") 
    return { action: "SUR", reason: "Deviation: TC ≥ 0 (Surrender 15 vs 10)" };
  if (total === 15 && dealerUp === "9" && trueCount >= 2 && basicAction !== "SUR") 
    return { action: "SUR", reason: "Deviation: TC ≥ +2 (Surrender 15 vs 9)" };
  if (total === 14 && dealerUp === "T" && trueCount >= 3 && basicAction !== "SUR") 
    return { action: "SUR", reason: "Deviation: TC ≥ +3 (Surrender 14 vs 10)" };

  // Illustrious 18 (Hit/Stand)
  if (total === 16 && dealerUp === "T" && trueCount > 0) 
    return { action: "STAND", reason: "Deviation: TC > 0 (Stand 16 vs 10)" };
  if (total === 15 && dealerUp === "T" && trueCount >= 4) 
    return { action: "STAND", reason: "Deviation: TC ≥ +4 (Stand 15 vs 10)" };
  if (total === 12 && dealerUp === "2" && trueCount >= 3) 
    return { action: "STAND", reason: "Deviation: TC ≥ +3 (Stand 12 vs 2)" };
  if (total === 12 && dealerUp === "3" && trueCount >= 2) 
    return { action: "STAND", reason: "Deviation: TC ≥ +2 (Stand 12 vs 3)" };

  return null;
}

function analyzeCount(tc) {
  if (tc >= 3) return "<b>High Edge (+).</b> Deck rich in 10s/Aces. Expect Dealer busts.";
  if (tc >= 1) return "<b>Favorable.</b> Slight player edge.";
  if (tc <= -2) return "<b>Unfavorable.</b> Deck rich in small cards. Min bet.";
  return "<b>Neutral.</b>";
}

function generateCommentary(move, tc) {
  let strat = "";
  if (move.isDeviation) strat = "Expert Deviation based on Count.";
  else if (move.action === "SUR") strat = "Hand is statistically too weak to play.";
  else if (move.action === "SPLIT") strat = "Turn bad total into two better starts.";
  else if (move.action === "DOUBLE") strat = "Capitalize on dealer weakness.";
  else if (move.action === "HIT") strat = "Defensive Hit to improve total.";
  else if (move.action === "STAND") strat = "Let the dealer risk busting.";
  
  return `${strat} (${move.reason}) <br><br> ${analyzeCount(tc)}`;
}

/* --- STATE & LOGGING --- */

function addToLog(msg, type="info") {
  const logEl = document.getElementById("activity-log");
  const row = document.createElement("div");
  row.className = `log-entry ${type}`;
  
  // Format: [RC: +X] Message
  const rcVal = state.runningCount > 0 ? `+${state.runningCount}` : state.runningCount;
  row.innerHTML = `<span class="log-tag">[${rcVal}]</span> ${msg}`;
  
  logEl.insertBefore(row, logEl.firstChild);
}

function saveState() {
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 50) historyStack.shift();
}

function restoreState() {
  if (historyStack.length === 0) return;
  const prev = JSON.parse(historyStack.pop());
  Object.assign(state, prev);
  addToLog("Undo Action", "info");
  render();
}

function processCard(input) {
  const tok = normalizeCardToken(input);
  if (!tok) return;

  saveState();
  const val = hiloValue(tok);
  state.runningCount += val;

  let logMsg = "";
  if (state.tagMode === "dealer") {
    state.dealerUp = tok;
    logMsg = `Dealer shows <strong>${tok}</strong>`;
    setTagMode("player");
  } else if (state.tagMode === "player") {
    state.hands[0].cards.push(tok);
    logMsg = `Player draws <strong>${tok}</strong>`;
  } else {
    logMsg = `Burn/Table: <strong>${tok}</strong>`;
  }

  addToLog(logMsg);
  render();
}

function resetRound() {
  if (state.hands[0].cards.length > 0) {
    saveState();
    addToLog("--- Round Ended ---");
  }
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

/* --- RENDER --- */

function render() {
  const tc = computeTrueCount(state.runningCount, config.decks);
  const handDetails = getHandDetails(state.hands[0].cards);

  // Strategy Calculation
  let rec = recommendMove(state.hands[0].cards, state.dealerUp);
  if (state.hands[0].cards.length >= 2 && state.dealerUp) {
    const dev = checkDeviations(rec.action, handDetails, state.dealerUp, tc);
    if (dev) { rec = dev; rec.isDeviation = true; }
  }

  // Update UI Stats
  document.getElementById("rc").textContent = state.runningCount;
  document.getElementById("tc").textContent = tc.toFixed(1);

  // Bet Sizing
  let bet = config.minBet;
  if (tc >= 1) bet = Math.floor(config.minBet * (1 + (tc - 0.5) * 2));
  if (bet > config.maxBet) bet = config.maxBet;
  
  const betEl = document.getElementById("bet-val");
  betEl.textContent = `$${bet}`;
  betEl.style.color = tc >= 2 ? "var(--green)" : "var(--text)";

  // Cards
  document.getElementById("dealer-card").textContent = state.dealerUp || "—";
  document.getElementById("player-hand").textContent = state.hands[0].cards.join("  ") || "—";

  // Advice Panel
  const panel = document.getElementById("advice-panel");
  const mainTxt = document.getElementById("advice-text");
  const subTxt = document.getElementById("advice-sub");
  const devMark = document.querySelector(".advice-deviation-mark");
  
  panel.className = "advice-hero"; 
  if(devMark) devMark.style.display = "none";

  if (!state.dealerUp || state.hands[0].cards.length < 2) {
    mainTxt.textContent = "WAITING";
    subTxt.textContent = "Deal cards to generate analysis...";
    panel.classList.add("waiting");
  } else {
    // Check if advice changed to log it? (Optional, skipping for noise reduction)
    mainTxt.textContent = rec.action;
    if (rec.isDeviation && devMark) devMark.style.display = "block";
    subTxt.innerHTML = generateCommentary(rec, tc);

    if (rec.action.includes("HIT")) panel.classList.add("hit");
    else if (rec.action.includes("STAND")) panel.classList.add("stand");
    else if (rec.action.includes("DOUBLE")) panel.classList.add("double");
    else if (rec.action.includes("SPLIT")) panel.classList.add("split");
    else if (rec.action.includes("SUR")) panel.classList.add("surrender");
    else if (rec.action.includes("INSURANCE")) panel.classList.add("warning");
  }
}

/* --- EVENTS --- */

document.addEventListener("keydown", (e) => {
  if(e.target.tagName === 'INPUT') return; 
  const key = e.key.toUpperCase();
  if (key === "D") setTagMode("dealer");
  if (key === "P") setTagMode("player");
  if (key === "T") setTagMode("table");
  if (key === "R") resetRound();
  if (key === "BACKSPACE") restoreState();
  if (["1","A"].includes(key)) processCard("A");
  else if (["0","J","Q","K"].includes(key)) processCard("T");
  else if (parseInt(key) >= 2 && parseInt(key) <= 9) processCard(key);
});

// Pad & Controls
document.querySelectorAll(".cardbtn").forEach(b => b.addEventListener("click", () => processCard(b.dataset.card)));
document.getElementById("tag-player").addEventListener("click", () => setTagMode("player"));
document.getElementById("tag-dealer").addEventListener("click", () => setTagMode("dealer"));
document.getElementById("tag-table").addEventListener("click", () => setTagMode("table"));
document.getElementById("reset-btn").addEventListener("click", resetRound);
document.getElementById("undo-btn").addEventListener("click", restoreState);

// Modals
const sModal = document.getElementById("settings-modal");
const iModal = document.getElementById("info-modal");

document.getElementById("settings-toggle").addEventListener("click", () => sModal.classList.remove("hidden"));
document.getElementById("close-settings").addEventListener("click", () => sModal.classList.add("hidden"));
document.getElementById("save-settings").addEventListener("click", () => {
  config.decks = parseFloat(document.getElementById("cfg-decks").value);
  config.minBet = parseFloat(document.getElementById("cfg-min").value);
  sModal.classList.add("hidden");
  render();
});

// Info Modal
const openInfo = () => iModal.classList.remove("hidden");
document.getElementById("info-btn").addEventListener("click", openInfo);
document.getElementById("rc-box").addEventListener("click", openInfo);
document.getElementById("tc-box").addEventListener("click", openInfo);
document.getElementById("close-info").addEventListener("click", () => iModal.classList.add("hidden"));

// Init
render();
