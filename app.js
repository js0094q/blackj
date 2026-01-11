/*************************
 GLOBAL STATE
*************************/
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let runningCount = 0;
let remainingCards = 312;
let dealerHand = [];
let playerHands = [];
let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

let winRateChart = null;
let trueCountChart = null;

/*************************
 INIT
*************************/
window.onload = () => {
  populateSelects();
  renderHistory();
  updateCharts();
};

/*************************
 DROPDOWN POPULATION
*************************/
function populateSelects() {
  ["p1","p2","dealerUp","dealerHole"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = "";
    RANKS.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      sel.appendChild(opt);
    });
  });
}

/*************************
 COUNT & HAND UTILS
*************************/
function cardValue(c) {
  if (["J","Q","K"].includes(c)) return 10;
  if (c === "A") return 11;
  return parseInt(c);
}

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

function trueCount() {
  return (runningCount / (remainingCards / 52)).toFixed(2);
}

/*************************
 BASIC STRATEGY + DEVIATION
*************************/
function basicStrategy(player, dealerUp) {
  const total = handValue(player);
  const up = cardValue(dealerUp);
  const isPair = player[0] === player[1];
  const isSoft = player.includes("A") && total <= 21 && !["10","J","Q","K"].includes(player[0]);

  if (isPair) {
    if (player[0] === "A" || player[0] === "8") return "Split";
    if (["10","J","Q","K"].includes(player[0])) return "Stand";
  }
  if (isSoft) {
    if (total >= 19) return "Stand";
    if (total === 18) {
      if (up >= 3 && up <= 6) return "Double";
      if (up >= 9) return "Hit";
      return "Stand";
    }
    return "Hit";
  }
  if (total >= 17) return "Stand";
  if (total >= 13 && up <= 6) return "Stand";
  if (total === 12 && up >= 4 && up <= 6) return "Stand";
  if (total === 11) return "Double";
  if (total === 10 && up <= 9) return "Double";
  if (total === 9 && up >= 3 && up <= 6) return "Double";
  return "Hit";
}

function applyDeviation(advice, tc) {
  if (advice === "Stand" && tc >= 3) return "Stand (High Count)";
  if (advice === "Hit" && tc <= -1) return "Hit (Low Count)";
  return advice;
}

/*************************
 STRATEGY OVERLAY
*************************/
function buildStrategyTables() {
  const container = document.getElementById("strategyTables");
  if (!container) return;
  container.innerHTML = ""; // Clear

  // Build Hard, Soft, Pair tables
  const sections = ["hard","soft","pairs"];
  sections.forEach(type => {
    const table = document.createElement("table");
    table.className = "basicTable";

    let header = `<tr><th>${type.toUpperCase()}</th>`;
    RANKS.forEach(d => header += `<th>${d}</th>`);
    header += "</tr>";
    table.innerHTML = header;

    Object.keys(basicTable[type]).forEach(rowKey => {
      let row = `<tr data-type="${type}" data-value="${rowKey}"><td>${rowKey}</td>`;
      RANKS.forEach(d => {
        const cell = basicTable[type][rowKey][d] || "-";
        row += `<td data-dealer="${d}" data-type="${type}" data-row="${rowKey}">${cell}</td>`;
      });
      row += "</tr>";
      table.innerHTML += row;
    });

    container.appendChild(table);
  });
}

function highlightStrategy(player, dealerUp) {
  document.querySelectorAll(".basicTable td.highlight")
    .forEach(c => c.classList.remove("highlight"));

  const total = handValue(player);
  const up = dealerUp;
  const isPair = player[0] === player[1];
  const isSoft = player.includes("A") && total <= 21 && !["10","J","Q","K"].includes(player[0]);

  let type, key;
  if (isPair) { type = "pairs"; key = player[0]; }
  else if (isSoft) { type = "soft"; key = total.toString(); }
  else { type = "hard"; key = (total < 8 ? "8" : total.toString()); }

  document.querySelectorAll(`td[data-type="${type}"][data-row="${key}"][data-dealer="${up}"]`)
    .forEach(cell => cell.classList.add("highlight"));
}

document.getElementById("showStrategyBtn").onclick = () => {
  document.getElementById("strategyOverlay").classList.remove("hidden");
  buildStrategyTables();
};

document.getElementById("closeStrategyBtn").onclick = () => {
  document.getElementById("strategyOverlay").classList.add("hidden");
};

/*************************
 HAND EVALUATION (IMMEDIATE HINT)
*************************/
document.getElementById("evaluate").onclick = () => {
  const p1 = document.getElementById("p1").value;
  const p2 = document.getElementById("p2").value;
  const up = document.getElementById("dealerUp").value;
  const hole = document.getElementById("dealerHole").value;
  const otherText = document.getElementById("others").value.trim();

  const others = otherText
    ? otherText.split(",").map(x => x.trim()).filter(x => RANKS.includes(x))
    : [];

  // reset counts per shoe
  runningCount = 0;
  remainingCards = 312;

  [p1, p2, up, hole, ...others].forEach(c => {
    runningCount += hiLo[c] || 0;
    remainingCards--;
  });

  dealerHand = [up, hole];
  playerHands = [[p1, p2]];

  // display cards
  document.getElementById("yourCards").textContent = `${p1}, ${p2}`;
  document.getElementById("dealerCards").textContent = `${up}, ${hole}`;

  // compute advice
  const base = basicStrategy([p1, p2], up);
  const tcVal = parseFloat(trueCount());
  const advice = applyDeviation(base, tcVal);

  document.getElementById("rc").textContent = runningCount;
  document.getElementById("tc").textContent = tcVal;
  document.getElementById("advice").textContent = advice;
  document.getElementById("explanation").textContent = "Basic Strategy + True Count";

  sessionStorage.setItem("currentAdvice", advice);
  sessionStorage.setItem("currentHand", JSON.stringify([p1, p2]));
  sessionStorage.setItem("currentDealer", up);

  buildStrategyTables();
  highlightStrategy([p1, p2], up);
  document.getElementById("strategyOverlay").classList.remove("hidden");

  renderHistory();
  updateCharts();
};

/*************************
 RECORD RESULT
*************************/
document.getElementById("outcome").onclick = () => {
  const r = prompt("Enter result (WIN/LOSE/PUSH):").toUpperCase();
  if (!["WIN","LOSE","PUSH"].includes(r)) return alert("Invalid");

  const advice = sessionStorage.getItem("currentAdvice");
  const hand = JSON.parse(sessionStorage.getItem("currentHand"));
  const dealer = sessionStorage.getItem("currentDealer");

  historyArr.push({
    time: new Date().toLocaleTimeString(),
    player: hand,
    dealer,
    advice,
    result: r,
    tc: trueCount()
  });

  localStorage.setItem("bjHistory", JSON.stringify(historyArr));
  renderHistory();
  updateCharts();
};

/*************************
 HISTORY + CHARTS
*************************/
function renderHistory() {
  const ul = document.getElementById("historyList");
  ul.innerHTML = "";
  historyArr.slice(-15).reverse().forEach(h => {
    const li = document.createElement("li");
    li.textContent = `${h.time} — ${h.player.join(", ")} vs ${h.dealer} : ${h.advice} → ${h.result} (TC=${h.tc})`;
    ul.appendChild(li);
  });
}

function updateCharts() {
  const results = historyArr.map(h => h.result);
  const wins = results.filter(x => x === "WIN").length;
  const losses = results.filter(x => x === "LOSE").length;
  const pushes = results.filter(x => x === "PUSH").length;

  const ctx1 = document.getElementById("winRateChart")?.getContext("2d");
  if (ctx1) {
    if (winRateChart) winRateChart.destroy();
    winRateChart = new Chart(ctx1, {
      type: "pie",
      data: {
        labels: ["WIN","LOSE","PUSH"],
        datasets: [{
          data: [wins, losses, pushes],
          backgroundColor: ["#4caf50","#f44336","#ff9800"]
        }]
      }
    });
  }

  const counts = historyArr.map(h => parseFloat(h.tc));
  const ctx2 = document.getElementById("trueCountChart")?.getContext("2d");
  if (ctx2) {
    if (trueCountChart) trueCountChart.destroy();
    trueCountChart = new Chart(ctx2, {
      type: "line",
      data: {
        labels: counts.map((_,i) => i+1),
        datasets: [{
          label: "True Count",
          data: counts,
          borderColor: "#2196f3",
          fill: false
        }]
      }
    });
  }
}

/*************************
 NEXT HAND / NEW SHOE
*************************/
document.getElementById("nextHand").onclick = () => {
  document.getElementById("p1").selectedIndex = 0;
  document.getElementById("p2").selectedIndex = 0;
  document.getElementById("dealerUp").selectedIndex = 0;
  document.getElementById("dealerHole").selectedIndex = 0;
  document.getElementById("others").value = "";
  document.getElementById("advice").textContent = "—";
  document.getElementById("explanation").textContent = "";
};

document.getElementById("newShoe").onclick = () => {
  runningCount = 0;
  remainingCards = 312;
  document.getElementById("rc").textContent = "0";
  document.getElementById("tc").textContent = "0";
  alert("New shoe started — count reset.");
};
