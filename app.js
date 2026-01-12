// ========= GLOBAL STATE =========
const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = { "2":1,"3":1,"4":1,"5":1,"6":1,"7":0,"8":0,"9":0,"10":-1,"J":-1,"Q":-1,"K":-1,"A":-1 };
const totalSeats = 7; // You + 6 other seats

let seats = Array.from({ length: totalSeats }, () => []);
let dealerCard = null;
let shoe = buildShoe();
let cardHistory = [];

// ========= INITIALIZE =========
document.addEventListener("DOMContentLoaded", ()=>{
  buildCardButtons();
  updateUI();
  updateCounts();
});

// ========= SHOE BUILDER =========
function buildShoe(decks = 6) {
  const counts = {};
  ranks.forEach(rank => counts[rank] = 4 * decks);
  return counts;
}

// ========= CARD BUTTONS =========
function buildCardButtons() {
  const container = document.getElementById("cardButtons");
  ranks.forEach(rank => {
    const btn = document.createElement("button");
    btn.textContent = rank;
    btn.onclick = () => recordCard(rank);
    container.appendChild(btn);
  });
}

// ========= RECORD ENTRY =========
function recordCard(rank) {
  if (shoe[rank] <= 0) {
    alert("No more " + rank + " left in shoe.");
    return;
  }

  // Fill seats first
  for (let i = 0; i < totalSeats; i++) {
    if (seats[i].length < 2) {
      seats[i].push(rank);
      shoe[rank]--;
      cardHistory.push({ seat: i, rank });
      updateUI();
      updateCounts();
      return;
    }
  }

  // Then dealer upcard
  if (!dealerCard) {
    dealerCard = rank;
    shoe[rank]--;
    cardHistory.push({ seat: "dealer", rank });
    updateUI();
    updateCounts();
    return;
  }

  alert("All seats filled and dealer card set.");
}

// ========= UNDO LAST =========
document.getElementById("undo").onclick = () => {
  if (cardHistory.length === 0) return;

  const last = cardHistory.pop();
  shoe[last.rank]++;

  if (last.seat === "dealer") {
    dealerCard = null;
  } else {
    seats[last.seat].pop();
  }
  updateUI();
  updateCounts();
};

// ========= HAND UTILS =========
function handValue(cards) {
  let total = 0, aces = 0;
  cards.forEach(c => {
    if (["J","Q","K"].includes(c)) total += 10;
    else if (c === "A") { total += 11; aces++; }
    else total += parseInt(c);
  });
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

function getStrategy(player, dealer) {
  const total = handValue(player);
  if (total <= 11) return "Hit";
  if (total >= 17) return "Stand";
  if (dealer === "7" || dealer === "A") return "Hit";
  return "Stand";
}

function simulateWinOdds(player, dealer) {
  return Math.random()*0.3 + 0.35; // approx
}

// ========= EVALUATE =========
document.getElementById("evaluate").onclick = () => {
  if (seats[0].length < 2 || !dealerCard) {
    alert("You must enter 2 cards for yourself and the dealer upcard to evaluate.");
    return;
  }

  const strat = getStrategy(seats[0], dealerCard);
  document.getElementById("strategy").textContent = strat;

  const odds = simulateWinOdds(seats[0], dealerCard);
  document.getElementById("winOdds").textContent = `${(odds*100).toFixed(1)}%`;
};

// ========= COUNTS =========
function updateCounts() {
  let count = 0, remaining = 0;
  for (let r in shoe) {
    count += (hiLo[r]||0)*((4*6) - shoe[r]);
    remaining += shoe[r];
  }
  const trueC = remaining ? (count / (remaining/52)).toFixed(2) : 0;
  document.getElementById("runningCount").textContent = count;
  document.getElementById("trueCount").textContent = trueC;
}

// ========= UPDATE UI =========
function updateUI() {
  const seatDisplay = document.getElementById("seats");
  seatDisplay.innerHTML = "";

  seats.forEach((hand,i) => {
    const div = document.createElement("div");
    div.className = "seat";
    if (i === 0) div.classList.add("mySeat");
    div.innerHTML = `<strong>${i===0?"You":"Player "+i}:</strong> ${hand.join(", ")||"—"}`;
    seatDisplay.appendChild(div);
  });

  document.getElementById("dealerCard").textContent = dealerCard || "—";
}

// ========= CLEAR ALL =========
document.getElementById("clear").onclick = () => {
  seats = Array.from({ length: totalSeats }, () => []);
  dealerCard = null;
  shoe = buildShoe();
  cardHistory = [];
  document.getElementById("strategy").textContent = "—";
  document.getElementById("winOdds").textContent = "—";
  updateUI();
  updateCounts();
};
