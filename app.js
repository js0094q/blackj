import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const state = {
  bankroll: 1000, minBet: 10, maxBet: 200, riskPct: 25,
  runningCount: 0, decksRemaining: 6,
  dealerUp: null, 
  hands: [{ cards: [] }], // Your hand
  tagMode: "player",      // Defaults to Player (YOU)
  history: [], tableLog: []
};

// --- VOICE CONTROL (Updated for explicit tagging) ---
function startListening() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Voice control requires Chrome/Edge.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  const btn = document.getElementById("mic-btn");
  btn.classList.add("listening");

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    processVoiceCommand(transcript);
  };
  recognition.onend = () => btn.classList.remove("listening");
  recognition.start();
}

function processVoiceCommand(phrase) {
  const map = {
    "ace": "A", "one": "A", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "T", "jack": "T",
    "queen": "T", "king": "T", "hit": "HIT", "stand": "STAND", "reset": "RESET",
    "dealer": "SET_DEALER", "me": "SET_PLAYER", "player": "SET_PLAYER", "table": "SET_TABLE"
  };

  // Check for commands like "Dealer" or "Table" to switch modes via voice
  const words = phrase.split(" ");
  const token = map[words[words.length - 1]] || map[phrase];

  if (token === "RESET") resetRound();
  else if (token === "SET_DEALER") setTag("dealer");
  else if (token === "SET_PLAYER") setTag("player");
  else if (token === "SET_TABLE") setTag("table");
  else if (token && token.length === 1) logCard(token);
}

// --- CORE LOGIC ---
function setTag(mode) {
  state.tagMode = mode;
  // Update UI buttons
  document.querySelectorAll(".tag-btn").forEach(b => b.classList.remove("active"));
  if (mode === "player") document.getElementById("tag-player").classList.add("active");
  else if (mode === "dealer") document.getElementById("tag-dealer").classList.add("active");
  else document.getElementById("tag-table").classList.add("active");
}

function logCard(rank) {
  const tok = normalizeCardToken(rank);
  if (!tok) return;

  state.runningCount += hiloValue(tok);

  if (state.tagMode === "dealer") {
    state.dealerUp = tok;
    // Automatically switch to player after logging dealer card? 
    // Uncomment next line if you want that convenience:
    // setTag("player"); 
  } 
  else if (state.tagMode === "player") {
    state.hands[0].cards.push(tok);
  } 
  else {
    state.tableLog.push(tok);
  }

  render();
}

function getBetSizing(trueCount) {
  const edge = (trueCount - 1) * 0.005;
  const optimal = state.bankroll * (edge / 1.3) * 0.25;
  if (edge <= 0) return { bet: state.minBet, edge: 0 };
  return { bet: Math.round(clamp(optimal, state.minBet, state.maxBet)), edge };
}

function render() {
  const tc = computeTrueCount(state.runningCount, state.decksRemaining);
  const sizing = getBetSizing(tc);
  
  // Update Stats
  document.getElementById("rc").textContent = state.runningCount;
  document.getElementById("tc").textContent = tc.toFixed(1);
  document.getElementById("bet-val").textContent = `$${sizing.bet}`;
  document.getElementById("bet-val-big").textContent = `$${sizing.bet}`;
  document.getElementById("edge-val").textContent = `${(sizing.edge * 100).toFixed(1)}%`;
  
  // Update Cards
  document.getElementById("dealer-card").textContent = state.dealerUp || "—";
  document.getElementById("player-hand").textContent = state.hands[0].cards.join("  ") || "—";

  // Update Advice
  const move = recommendMove(state.hands[0].cards, state.dealerUp);
  document.getElementById("advice-text").textContent = move.action || "—";
}

function resetRound() {
  state.dealerUp = null;
  state.hands[0].cards = [];
  setTag("player"); // Reset back to Player default
  render();
}

// --- INIT ---
document.getElementById("mic-btn").addEventListener("click", startListening);
document.getElementById("reset-btn").addEventListener("click", resetRound);

document.getElementById("tag-player").addEventListener("click", () => setTag("player"));
document.getElementById("tag-dealer").addEventListener("click", () => setTag("dealer"));
document.getElementById("tag-table").addEventListener("click", () => setTag("table"));

document.querySelectorAll(".cardbtn").forEach(btn => {
  btn.addEventListener("click", () => logCard(btn.dataset.card));
});

// Start in Player Mode
setTag("player");
render();
