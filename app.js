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

/* --- 1. STRATEGIC ANALYSIS ENGINE --- */

/**
 * Accurately calculates hand totals (Soft/Hard) to ensure deviations
 * are only applied to the correct hand types.
 */
function getHandDetails(cards) {
  let total = 0;
  let aces = 0;
  
  for (const c of cards) {
    if (c === "A") { aces++; total += 11; }
    else if (c === "T") { total += 10; }
    else { total += Number(c); }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  // A hand is "Soft" if we have an Ace counted as 11 (aces > 0 after reduction)
  // But for Deviation purposes, we usually care about the "Hard" equivalent if we were to stand.
  // Actually, deviations like "16 vs 10" strictly apply to HARD 16 (e.g. 10,6 or 8,8), not Soft 16 (A,5).
  const isSoft = aces > 0;
  
  return { total, isSoft };
}

/**
 * Checks for "Index Plays" (Deviations) based on the Illustrious 18 & Fab 4.
 * These override Basic Strategy when the count justifies it.
 */
function checkDeviations(basicAction, hand, dealerUp, trueCount) {
  const { total, isSoft } = hand;

  // INSURANCE (The most important deviation)
  if (dealerUp === "A" && trueCount >= 3) {
    return { action: "INSURANCE", reason: "TC ≥ +3. Insurance is +EV." };
  }

  // If hand is Soft, very few deviations apply (mostly doubling high softs), 
  // so we skip the standard hard total checks to be safe.
  if (isSoft) return null;

  /* --- SURRENDER DEVIATIONS (Fab 4) --- */
  if (total === 15 && dealerUp === "T" && trueCount >= 0) {
     // Note: Some charts use 0, some use 3. We use 0 for 15v10 surrender in H17 
     // *However, standard Fab 4 is 15v10 at TC >= 0 if not previously surrendered*
     // Assuming recommendMove didn't already say SUR.
     if (basicAction !== "SUR") return { action: "SUR", reason: "Deviation: TC ≥ 0. Surrender 15 vs 10." };
  }
  if (total === 15 && dealerUp === "9" && trueCount >= 2) {
     if (basicAction !== "SUR") return { action: "SUR", reason: "Deviation: TC ≥ +2. Surrender 15 vs 9." };
  }
  if (total === 14 && dealerUp === "T" && trueCount >= 3) {
     if (basicAction !== "SUR") return { action: "SUR", reason: "Deviation: TC ≥ +3. Surrender 14 vs 10." };
  }

  /* --- HIT/STAND DEVIATIONS (Illustrious 18) --- */
  // 16 vs 10
  if (total === 16 && dealerUp === "T") {
    if (trueCount > 0) return { action: "STAND", reason: "The 'Illustrious' Deviation: TC > 0. Stand on 16." };
  }
  
  // 15 vs 10 (If surrender not avail/taken)
  if (total === 15 && dealerUp === "T") {
    if (trueCount >= 4) return { action: "STAND", reason: "Deviation: TC ≥ +4. Too risky to hit." };
  }

  // 12 vs 2, 3
  if (total === 12 && dealerUp === "2" && trueCount >= 3) return { action: "STAND", reason: "Deviation: TC ≥ +3. Stand 12 vs 2." };
  if (total === 12 && dealerUp === "3" && trueCount >= 2) return { action: "STAND", reason: "Deviation: TC ≥ +2. Stand 12 vs 3." };

  return null;
}

function analyzeCount(tc) {
  if (tc >= 3) return "<b>Extremely Favorable (+).</b><br>Deck is rich in Tens/Aces. Expect Dealer busts and Blackjacks.";
  if (tc >= 1) return "<b>Favorable (+).</b><br>Slight edge. Increase bets and look for aggressive doubles.";
  if (tc <= -2) return "<b>Unfavorable (-).</b><br>Deck rich in small cards. Defensive play. Min bet.";
  return "<b>Neutral.</b><br>Standard Basic Strategy applies.";
}

function generateCommentary(move, hand, dealerUp, tc) {
  const baseReason = move.reason;
  const countNote = analyzeCount(tc);
  
  let tacticalAdvice = "";

  if (move.isDeviation) {
    tacticalAdvice = `<span style="color:var(--accent)">★ EXPERT PLAY:</span> Validated by Count.`;
  } else if (move.action === "SUR") {
    tacticalAdvice = "Your expected return is worse than -50%. Folding saves money.";
  } else if (move.action === "SPLIT") {
    tacticalAdvice = "Offensive Split. We turn a bad total into two superior starting positions.";
  } else if (move.action === "DOUBLE") {
    tacticalAdvice = "Capitalize on weakness. You have a mathematical advantage here.";
  } else if (move.action === "HIT" && hand.total >= 12) {
    tacticalAdvice = "Defensive Hit. Breaking is possible, but staying is statistically worse.";
  } else if (move.action === "STAND") {
    tacticalAdvice = "The Dealer has a high probability of busting. Don't interfere.";
  }

  return `${tacticalAdvice} <span style="opacity:0.7">(${baseReason})</span><br><br><div style="border-top:1px solid #333; padding-top:8px; font-size:11px">${countNote}</div>`;
}

/* --- 2. STATE MANAGEMENT --- */

function saveState() {
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 50) historyStack.shift();
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

  saveState();
  state.runningCount += hiloValue(tok);

  if (state.tagMode === "dealer") {
    state.dealerUp = tok;
    setTagMode("player");
  } else if (state.tagMode === "player") {
    state.hands[0].cards.push(tok);
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

/* --- 3. RENDERING & EVENTS --- */

function render() {
  // A. Calculations
  const tc = computeTrueCount(state.runningCount, config.decks);
  const handDetails = getHandDetails(state.hands[0].cards);

  // B. Strategy Engine
  // 1. Basic Strategy
  let rec = recommendMove(state.hands[0].cards, state.dealerUp);
  
  // 2. Deviation Check (Only if we have a valid active hand)
  if (state.hands[0].cards.length >= 2 && state.dealerUp) {
    const dev = checkDeviations(rec.action, handDetails, state.dealerUp, tc);
    if (dev) {
      rec = dev;
      rec.isDeviation = true;
    }
  }

  // C. UI Updates
  document.getElementById("rc").textContent = state.runningCount;
  document.getElementById("tc").textContent = tc.toFixed(1);

  // Bet Sizing (Kelly Criterion Approximation)
  // Edge ~= (TC - 1) * 0.5%. 
  let bet = config.minBet;
  if (tc >= 1) {
    // Aggressive ramp: 1 unit for every 0.5 increase in TC above 1
    const units = (tc - 1) * 2; 
    bet = Math.floor(config.minBet * (1 + units)); 
  }
  if (bet > config.maxBet) bet = config.maxBet;
  
  // Visual Bet Alerts
  const betEl = document.getElementById("bet-val");
  betEl.textContent = `$${bet}`;
  betEl.style.color = tc >= 2 ? "var(--green)" : "var(--text)";

  document.getElementById("dealer-card").textContent = state.dealerUp || "—";
  document.getElementById("player-hand").textContent = state.hands[0].cards.join("  ") || "—";

  // D. Advice Panel Logic
  const panel = document.getElementById("advice-panel");
  const mainTxt = document.getElementById("advice-text");
  const subTxt = document.getElementById("advice-sub");
  const devMark = document.querySelector(".advice-deviation-mark");
  
  // Reset classes
  panel.className = "advice-hero"; 
  if(devMark) devMark.style.display = "none";

  if (!state.dealerUp || state.hands[0].cards.length < 2) {
    mainTxt.textContent = "WAITING";
    subTxt.textContent = "Deal cards to generate analysis...";
    panel.classList.add("waiting");
  } else {
    mainTxt.textContent = rec.action;
    
    // Show Deviation Marker
    if (rec.isDeviation && devMark) devMark.style.display = "block";
    
    // Generate Rich Commentary
    subTxt.innerHTML = generateCommentary(rec, handDetails, state.dealerUp, tc);

    // Dynamic Color Coding
    if (rec.action.includes("HIT")) panel.classList.add("hit");
    else if (rec.action.includes("STAND")) panel.classList.add("stand");
    else if (rec.action.includes("DOUBLE")) panel.classList.add("double");
    else if (rec.action.includes("SPLIT")) panel.classList.add("split");
    else if (rec.action.includes("SUR")) panel.classList.add("surrender");
    else if (rec.action.includes("INSURANCE")) panel.classList.add("warning");
  }
}

// --- EVENTS ---
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

document.querySelectorAll(".cardbtn").forEach(b => b.addEventListener("click", () => processCard(b.dataset.card)));
document.getElementById("tag-player").addEventListener("click", () => setTagMode("player"));
document.getElementById("tag-dealer").addEventListener("click", () => setTagMode("dealer"));
document.getElementById("tag-table").addEventListener("click", () => setTagMode("table"));
document.getElementById("reset-btn").addEventListener("click", resetRound);
document.getElementById("undo-btn").addEventListener("click", restoreState);

// Initial Render
render();
