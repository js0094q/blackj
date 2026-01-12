document.addEventListener("DOMContentLoaded", () => {
  console.log("Blackjack Trainer Pro Loaded");

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const HI_LO = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};
  const TOTAL_DECKS = 6;

  let seats = [[]]; // seat 0 is YOU
  let dealerUpcard = null;
  let shoe = buildShoe();
  let cardHistory = [];
  let history = JSON.parse(localStorage.getItem("bjHistory")) || [];

  function buildShoe() {
    const counts = {};
    RANKS.forEach(r => counts[r] = 4 * TOTAL_DECKS);
    return counts;
  }

  function buildCardButtons() {
    const wrap = document.getElementById("cardButtons");
    wrap.innerHTML = "";
    RANKS.forEach(rank => {
      const btn = document.createElement("button");
      btn.textContent = rank;
      btn.onclick = () => addCard(rank);
      wrap.appendChild(btn);
    });
  }

  function addCard(rank) {
    if (shoe[rank] <= 0) return alert("No more cards of that rank.");

    for (let i = 0; i < seats.length; i++) {
      if (seats[i].length < 2) {
        seats[i].push(rank);
        shoe[rank]--;
        cardHistory.push({seat:i,rank});
        updateUI(); updateCounts();
        return;
      }
    }

    if (!dealerUpcard) {
      dealerUpcard = rank;
      shoe[rank]--;
      cardHistory.push({seat:"dealer",rank});
      updateUI(); updateCounts();
      return;
    }

    alert("All hands filled. Reset hand.");
  }

  function undo() {
    if (!cardHistory.length) return;
    const last = cardHistory.pop();
    shoe[last.rank]++;
    if (last.seat === "dealer") dealerUpcard = null;
    else seats[last.seat].pop();
    updateUI(); updateCounts();
  }

  function resetHand() {
    seats.forEach(h => h.length = 0);
    dealerUpcard = null;
    cardHistory = [];
    updateUI();
  }

  function clearTable() {
    seats = [[]];
    dealerUpcard = null;
    shoe = buildShoe();
    cardHistory = [];
    updateUI(); updateCounts();
  }

  function addSeat() {
    seats.push([]);
    updateUI();
  }

  function removeSeat() {
    if (seats.length <= 1) return;
    const removed = seats.pop();
    removed.forEach(r => shoe[r]++);
    updateUI(); updateCounts();
  }

  function handValue(cards) {
    let total = 0, aces = 0;
    cards.forEach(c => {
      if (["J","Q","K"].includes(c)) total += 10;
      else if (c==="A") { total+=11; aces++; }
      else total += parseInt(c);
    });
    while (total>21 && aces) { total-=10; aces--; }
    return total;
  }

  function basicStrategy(hand,dealer) {
    const total = handValue(hand);
    const up = dealer==="A"?11:(["J","Q","K"].includes(dealer)?10:parseInt(dealer));
    if (total >= 17) return "Stand";
    if (total <= 11) return "Hit";
    if (total === 12 && up>=4 && up<=6) return "Stand";
    if (total >= 13 && up<=6) return "Stand";
    if (total === 11) return "Double";
    return "Hit";
  }

  function evaluate() {
    if (!seats[0].length || !dealerUpcard) return alert("Enter your hand and dealer upcard.");
    const move = basicStrategy(seats[0], dealerUpcard);
    document.getElementById("strategy").textContent = move;
  }

  function updateCounts() {
    let running = 0, remaining = 0;
    for (let r in shoe) {
      running += HI_LO[r] * ((4*TOTAL_DECKS) - shoe[r]);
      remaining += shoe[r];
    }
    document.getElementById("runningCount").textContent = running;
    document.getElementById("trueCount").textContent =
      remaining ? (running/(remaining/52)).toFixed(2) : "0.00";
  }

  function updateUI() {
    const seatBox = document.getElementById("seats");
    seatBox.innerHTML = "";
    seats.forEach((hand,i)=>{
      const d = document.createElement("div");
      d.className = "seat";
      d.textContent = `${i===0?"You":"Player "+i}: ${hand.join(", ") || "—"}`;
      seatBox.appendChild(d);
    });
    document.getElementById("dealerCard").textContent = dealerUpcard || "—";
  }

  // Bind Buttons
  document.getElementById("undo").onclick = undo;
  document.getElementById("resetHand").onclick = resetHand;
  document.getElementById("clearTable").onclick = clearTable;
  document.getElementById("newShoe").onclick = clearTable;
  document.getElementById("evaluate").onclick = evaluate;
  document.getElementById("addSeat").onclick = addSeat;
  document.getElementById("removeSeat").onclick = removeSeat;

  // Init
  buildCardButtons();
  updateUI();
  updateCounts();
});
