/*********************
  GAME STATE
*********************/
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let runningCount = 0;
let deckSize = 312; // 6 decks

let playerHand = [];
let dealerHand = [];
let hasSplit = false;

/*********************
  SETUP DROPDOWNS
*********************/
function populateSelects() {
  ["p1","p2","dealer"].forEach(id => {
    const sel = document.getElementById(id);
    RANKS.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      sel.appendChild(opt);
    });
  });
}

/*********************
  UTILS
*********************/
function handValue(hand) {
  let total = 0, aces = 0;
  hand.forEach(c => {
    if (["J","Q","K","10"].includes(c)) total += 10;
    else if (c === "A") { total += 11; aces++; }
    else total += parseInt(c);
  });
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return total;
}

function renderCards(id, hand) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  hand.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";
    div.textContent = c;
    el.appendChild(div);
  });
}

function updateCount(card) {
  runningCount += hiLo[card];
  deckSize--;
}

/*********************
  START HAND (MANUAL)
*********************/
document.getElementById("startHand").onclick = () => {
  const c1 = document.getElementById("p1").value;
  const c2 = document.getElementById("p2").value;
  const dealer = document.getElementById("dealer").value;

  playerHand = [c1, c2];
  dealerHand = [dealer];
  hasSplit = false;

  updateCount(c1);
  updateCount(c2);
  updateCount(dealer);

  updateUI();
  document.getElementById("status").textContent = "Hand Started.";
};

/*********************
  ACTION BUTTONS
*********************/
document.getElementById("hitBtn").onclick = () => {
  const card = prompt("Enter next card dealt to Player:");
  if (!RANKS.includes(card)) return alert("Invalid card");
  playerHand.push(card);
  updateCount(card);
  step();
};

document.getElementById("standBtn").onclick = () => finishHand();

document.getElementById("doubleBtn").onclick = () => {
  const card = prompt("Enter card for Double:");
  if (!RANKS.includes(card)) return alert("Invalid card");
  playerHand.push(card);
  updateCount(card);
  finishHand();
};

document.getElementById("splitBtn").onclick = () => {
  if (hasSplit) return alert("Only one split allowed.");
  if (playerHand[0] !== playerHand[1]) return alert("Not a pair.");

  hasSplit = true;
  alert("Split acknowledged. Play each hand manually (future upgrade).");
};

/*********************
  HAND FLOW
*********************/
function step() {
  updateUI();
  if (handValue(playerHand) > 21) {
    document.getElementById("status").textContent = "Player Busts.";
    saveHistory("BUST");
  }
}

function finishHand() {
  const dealerDown = prompt("Enter Dealer's Hole Card:");
  if (!RANKS.includes(dealerDown)) return alert("Invalid card");

  dealerHand.push(dealerDown);
  updateCount(dealerDown);

  while (handValue(dealerHand) < 17) {
    const next = prompt("Enter Dealer Draw Card:");
    if (!RANKS.includes(next)) return alert("Invalid card");
    dealerHand.push(next);
    updateCount(next);
  }

  const p = handValue(playerHand);
  const d = handValue(dealerHand);

  let result = "";
  if (p > 21) result = "LOSE";
  else if (d > 21 || p > d) result = "WIN";
  else if (p === d) result = "PUSH";
  else result = "LOSE";

  document.getElementById("status").textContent = `Result: ${result}`;
  saveHistory(result);
  updateUI();
}

/*********************
  UI UPDATE
*********************/
function updateUI() {
  renderCards("playerCards", playerHand);
  renderCards("dealerCards", dealerHand);

  document.getElementById("playerTotal").textContent = handValue(playerHand);
  document.getElementById("dealerUp").textContent = dealerHand[0] || "-";
  document.getElementById("runningCount").textContent = runningCount;
  document.getElementById("trueCount").textContent =
    (runningCount / (deckSize / 52)).toFixed(2);
}

/*********************
  HISTORY
*********************/
function saveHistory(result) {
  const history = JSON.parse(localStorage.getItem("bjHistory") || "[]");
  history.push({
    time: new Date().toLocaleTimeString(),
    result,
    count: runningCount
  });
  localStorage.setItem("bjHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("bjHistory") || "[]");
  const ul = document.getElementById("historyList");
  ul.innerHTML = "";
  history.slice(-10).reverse().forEach(h => {
    const li = document.createElement("li");
    li.textContent = `${h.time} – ${h.result} (Count: ${h.count})`;
    ul.appendChild(li);
  });
}

/*********************
  INIT
*********************/
window.onload = () => {
  populateSelects();
  renderHistory();
};
