/*************************
 GLOBAL STATE
*************************/
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let runningCount = 0;
let remainingCards = 312;
let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

let winRateChart = null;
let trueCountChart = null;

/*************************
 SETUP
*************************/
window.onload = () => {
  populateSelects();
  renderHistory();
  updateCharts();
};

/*************************
 DROP DOWNS
*************************/
function populateSelects() {
  const ids = ["p1","p2","dealerUp"];
  for (let i = 3; i <= 14; i++) ids.push(`p${i}`);
  ids.forEach(id => {
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
 SEAT MANAGEMENT
*************************/
let currentSeats = 0;
let nextId = 3;

document.getElementById("addSeat").onclick = () => {
  if (currentSeats >= 6) return alert("Max seats reached");

  const seatDiv = document.createElement("div");
  seatDiv.className = "row playerSeat";
  seatDiv.id = `seat${currentSeats+1}`;

  const c1 = `p${nextId++}`;
  const c2 = `p${nextId++}`;

  seatDiv.innerHTML = `
    <label>Player ${currentSeats+2} Card 1: <select id="${c1}"></select></label>
    <label>Card 2: <select id="${c2}"></select></label>
  `;

  document.getElementById("playerSeats").appendChild(seatDiv);
  populateSelects();
  currentSeats++;
};

document.getElementById("removeSeat").onclick = () => {
  if (currentSeats === 0) return;
  const div = document.getElementById(`seat${currentSeats}`);
  div.remove();
  nextId -= 2;
  currentSeats--;
};

/*************************
 COUNT UTILS
*************************/
function cardValue(c) {
  if (["J","Q","K"].includes(c)) return 10;
  if (c==="A") return 11;
  return parseInt(c);
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  hand.forEach(c => {
    if (["J","Q","K","10"].includes(c)) total += 10;
    else if (c==="A") { total += 11; aces++; }
    else total += parseInt(c);
  });
  while (total>21 && aces) { total-=10; aces--; }
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
  const isPair = player[0]===player[1];
  const isSoft = player.includes("A") && total<=21 && !["10","J","Q","K"].includes(player[0]);

  if (isPair) {
    if (player[0]==="A" || player[0]==="8") return "Split";
    if (["10","J","Q","K"].includes(player[0])) return "Stand";
  }
  if (isSoft) {
    if (total>=19) return "Stand";
    if (total===18) {
      if (up>=3&&up<=6) return "Double";
      if (up>=9) return "Hit";
      return "Stand";
    }
    return "Hit";
  }
  if (total>=17) return "Stand";
  if (total>=13 && up<=6) return "Stand";
  if (total===12 && up>=4 && up<=6) return "Stand";
  if (total===11) return "Double";
  if (total===10 && up<=9) return "Double";
  if (total===9 && up>=3&&up<=6) return "Double";
  return "Hit";
}

function applyDeviation(advice, tc) {
  if (advice==="Stand" && tc>=3) return "Stand (High Count)";
  if (advice==="Hit" && tc<=-1) return "Hit (Low Count)";
  return advice;
}

/*************************
 BASIC STRATEGY TABLE
*************************/
const basicTable = {
  hard: {
    17: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    16: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    15: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    14: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    13: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    12: {2:"H",3:"H",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    11: {2:"D",3:"D",4:"D",5:"D",6:"D",7:"D",8:"D",9:"D",10:"H",A:"H"},
    10: {2:"D",3:"D",4:"D",5:"D",6:"D",7:"D",8:"D",9:"D",10:"H",A:"H"},
    9:  {2:"H",3:"D",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    8:  {2:"H",3:"H",4:"H",5:"H",6:"H",7:"H",8:"H",9:"H",10:"H",A:"H"}
  },
  soft: {
    20:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    19:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    18:{2:"S",3:"D",4:"D",5:"D",6:"D",7:"S",8:"S",9:"H",10:"H",A:"H"},
    17:{2:"H",3:"D",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    16:{2:"H",3:"H",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    15:{2:"H",3:"H",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    14:{2:"H",3:"H",4:"H",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    13:{2:"H",3:"H",4:"H",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"}
  },
  pairs: {
    "A": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"P",9:"P",10:"P",A:"P"},
    "10":{2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    "9": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"S",8:"P",9:"P",10:"S",A:"S"},
    "8": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"P",9:"P",10:"P",A:"P"},
    "7": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"H",9:"H",10:"H",A:"H"},
    "6": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"H",8:"H",9:"H",10:"H",A:"H"},
    "5": {2:"D",3:"D",4:"D",5:"D",6:"D",7:"D",8:"D",9:"D",10:"H",A:"H"},
    "4": {2:"H",3:"H",4:"H",5:"P",6:"P",7:"H",8:"H",9:"H",10:"H",A:"H"},
    "3": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"H",9:"H",10:"H",A:"H"},
    "2": {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"H",9:"H",10:"H",A:"H"}
  }
};

// … remains unchanged (buildStrategyTables, highlightStrategy, evaluate, record result, history, charts, nextHand, newShoe)
