let runningCount = 0;
let cardCounted = [];
let remainingCards = 312;

const hiLoMap = {
  2: 1, 3: 1, 4: 1, 5: 1, 6: 1,
  7: 0, 8: 0, 9: 0,
  10: -1, J: -1, Q: -1, K: -1, A: -1
};

const cards = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

// Build Card Buttons
const container = document.getElementById("cardsContainer");
cards.forEach(c => {
  let btn = document.createElement("button");
  btn.className = "cardBtn";
  btn.innerText = c;
  btn.onclick = () => onCardClick(c);
  container.appendChild(btn);
});

// Populate select dropdowns
["playerCard1", "playerCard2", "dealerUpCard"].forEach(id => {
  const sel = document.getElementById(id);
  cards.forEach(card => {
    const opt = document.createElement("option");
    opt.value = card;
    opt.innerText = card;
    sel.appendChild(opt);
  });
});

function onCardClick(card) {
  cardCounted.push(card);
  runningCount += hiLoMap[card] || 0;
  remainingCards--;
  updateDisplay();
}

function updateDisplay() {
  document.getElementById("runningCount").innerText = runningCount;
  let decksLeft = Math.max(1, (remainingCards / 52));
  let trueCount = (runningCount / decksLeft).toFixed(2);
  document.getElementById("trueCount").innerText = trueCount;
  document.getElementById("remainingCards").innerText = remainingCards;
}

// Hint logic with split & double down
function generateHint() {
  const card1 = document.getElementById("playerCard1").value;
  const card2 = document.getElementById("playerCard2").value;
  const dealer = document.getElementById("dealerUpCard").value;
  let hint = "";

  const isPair = (card1 === card2);
  const total = handValue([card1, card2]);
  const dealerVal = cardValue(dealer);
  const tc = parseFloat(document.getElementById("trueCount").innerText);

  if (isPair) {
    if (["A", "8"].includes(card1)) hint += "Always split Aces and 8s. ";
    else if (["10", "J", "Q", "K"].includes(card1)) hint += "Never split 10s. ";
    else if (["2", "3", "7"].includes(card1) && dealerVal <= 7) hint += "Split against weak dealer. ";
  }

  if ([9, 10, 11].includes(total) && dealerVal <= 6) {
    hint += "Consider Double Down. ";
  }

  if (total >= 17) hint += "Stand.";
  else if (total <= 11) hint += "Hit.";
  else if (dealerVal >= 7) hint += "Hit.";
  else hint += "Stand.";

  if (tc > 2) hint += " Count is high — more face cards expected.";
  if (tc < -1) hint += " Count is low — fewer face cards.";

  document.getElementById("hintText").innerText = hint;

  // Save to history
  let history = JSON.parse(localStorage.getItem("hintHistory") || "[]");
  history.push({ card1, card2, dealer, hint, timestamp: new Date().toISOString() });
  localStorage.setItem("hintHistory", JSON.stringify(history));
  renderHistory();
}

function cardValue(card) {
  if (["J", "Q", "K"].includes(card)) return 10;
  if (card === "A") return 11;
  return parseInt(card);
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("hintHistory") || "[]");
  let html = "<h3>Hint History</h3><ul>";
  history.slice(-5).reverse().forEach(h => {
    html += `<li>${h.timestamp.split("T")[0]} – Player: ${h.card1},${h.card2} vs Dealer: ${h.dealer} ➜ ${h.hint}</li>`;
  });
  html += "</ul>";
  document.getElementById("historyList").innerHTML = html;
}

// Simulate
function simulateOdds() {
  const iterations = 5000;
  let wins = 0, losses = 0, pushes = 0;

  for (let i = 0; i < iterations; i++) {
    const result = simulateHand();
    if (result === "win") wins++;
    else if (result === "loss") losses++;
    else pushes++;
  }

  document.getElementById("oddsDisplay").innerText =
    `W: ${(wins / iterations * 100).toFixed(1)}% | L: ${(losses / iterations * 100).toFixed(1)}% | P: ${(pushes / iterations * 100).toFixed(1)}%`;
}

function simulateHand() {
  let deck = buildDeck();
  shuffle(deck);

  let player = [drawCard(deck), drawCard(deck)];
  let dealer = [drawCard(deck), drawCard(deck)];

  let total = handValue(player);
  while (total < 17) {
    player.push(drawCard(deck));
    total = handValue(player);
    if (total > 21) return "loss";
  }

  let dealerTotal = handValue(dealer);
  while (dealerTotal < 17) {
    dealer.push(drawCard(deck));
    dealerTotal = handValue(dealer);
  }

  if (total > 21) return "loss";
  if (dealerTotal > 21 || total > dealerTotal) return "win";
  if (total === dealerTotal) return "push";
  return "loss";
}

function buildDeck() {
  let d = [];
  for (let i = 0; i < 6 * 4; i++) cards.forEach(c => d.push(c));
  return d;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function drawCard(deck) {
  return deck.pop();
}

function handValue(hand) {
  let total = 0, aces = 0;
  hand.forEach(c => {
    if (["J", "Q", "K", "10"].includes(c)) total += 10;
    else if (c === "A") { total += 11; aces++; }
    else total += parseInt(c);
  });
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return total;
}

// Buttons
document.getElementById("simulateBtn").onclick = simulateOdds;
document.getElementById("resetBtn").onclick = () => {
  runningCount = 0;
  remainingCards = 312;
  cardCounted = [];
  updateDisplay();
  document.getElementById("oddsDisplay").innerText = "N/A";
  document.getElementById("hintText").innerText = "Select cards to begin.";
};
window.onload = renderHistory;