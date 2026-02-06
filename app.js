import { recommendMove } from "./strategy-h17-ls.js";
import { normalizeCardToken, hiloValue, computeTrueCount, clamp } from "./count.js";

const state = {
  bankroll: 1000, minBet: 10, maxBet: 200, riskPct: 25,
  runningCount: 0, decksRemaining: 6,
  dealerUp: null, hands: [{ cards: [] }],
  autoTagOn: true, history: [], tableLog: []
};

// --- VOICE CONTROL ---
function startListening() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Voice control requires Chrome, Edge, or Android Chrome.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  const btn = document.getElementById("mic-btn");
  btn.classList.add("listening");

  recognition.onresult = (event) => {
    const lastIndex = event.results.length - 1;
    const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
    processVoiceCommand(transcript);
  };
  recognition.onend = () => btn.classList.remove("listening");
  recognition.start();
}

function processVoiceCommand(phrase) {
  // Simple mapping for game night speed
  const map = {
    "ace": "A", "one": "A",
    "two": "2", "to": "2", "too": "2",
    "three": "3", "tree": "3",
    "four": "4", "for": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8", "ate": "8",
    "nine": "9",
    "ten": "T", "jack": "T", "queen": "T", "king": "T", "face": "T",
    "hit": "HIT", "stand": "STAND", // Just for fun logging if needed
    "reset": "RESET", "new": "RESET"
  };

  const words = phrase.split(" ");
  const lastWord = words[words.length - 1]; // "Dealer has a King" -> "King"
  const token = map[lastWord] || map[phrase];

  if (token === "RESET") {
    document.getElementById("reset-btn").click();
  } else if (token && token.length === 1) { // Only log cards (length 1 tokens)
    logCard(token);
  }
}

// --- BLUE QUALITY BETTING & LOGIC ---
function getBetSizing(trueCount) {
  const edge = (trueCount - 1) * 0.005; // (TC-1)*0.5%
  const variance = 1.3;
  const risk = 0.25; // 25% Kelly

  if (edge <= 0) return { bet: state.minBet, edge: edge };

  let optimal = state.bankroll * (edge / variance) * risk;
  return { 
    bet: Math.round(clamp(optimal, state.minBet, state.maxBet)), 
    edge: edge 
  };
}

function getTargetTag() {
  if (!state.dealerUp) return "dealer"; // 1. Dealer
  if (state.hands[0].cards.length < 2) return "player"; // 2. You (First 2)
  return "table"; // 3. Everyone else
}

function logCard(rank) {
  const tok = normalizeCardToken(rank);
  if (!tok) return;

  const tag = getTargetTag();
  state.runningCount += hiloValue(tok);

  if (tag === "dealer") state.dealerUp = tok;
  else if (tag === "player") state.hands[0].cards.push(tok);
  else state.tableLog.push(tok);

  render();
}

function render() {
  const trueCount = computeTrueCount(state.runningCount, state.decksRemaining);
  const sizing = getBetSizing(trueCount);

  document.getElementById("rc").textContent = state.runningCount;
  document.getElementById("tc").textContent = trueCount.toFixed(1);
  document.getElementById("bet-val").textContent = `$${sizing.bet}`;
  document.getElementById("bet-val-big").textContent = `$${sizing.bet}`;
  document.getElementById("edge-val").textContent = `${(sizing.edge * 100).toFixed(1)}%`;
  document.getElementById("dealer-card").textContent = state.dealerUp || "—";
  
  const move = recommendMove(state.hands[0].cards, state.dealerUp);
  document.getElementById("advice-text").textContent = move.action || "—";
  document.getElementById("advice-reason").textContent = move.reason;
}

// --- INIT LISTENERS ---
document.getElementById("mic-btn").addEventListener("click", startListening);

document.querySelectorAll(".cardbtn").forEach(btn => {
  btn.addEventListener("click", () => logCard(btn.dataset.card));
});

document.getElementById("reset-btn").addEventListener("click", () => {
  state.runningCount = 0; 
  state.dealerUp = null; 
  state.hands[0].cards = [];
  render();
});
