/*********************
 GLOBAL STATE
*********************/
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let runningCount = 0;
let remainingCards = 312;

let dealerHand = [];
let playerHands = [];
let currentHandIndex = 0;
let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

// Chart instances
let winRateChart, trueCountChart;

populateSelects();
renderHistory();
updateCharts();

/*********************
 UTILITIES
*********************/
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

/*********************
 POPULATE DROPDOWNS
*********************/
function populateSelects() {
  ["p1","p2","dealerUp","dealerHole"].forEach(id => {
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
 BASIC STRATEGY + DEVIATION
*********************/
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
  if (advice === "Stand" && tc >= 3) return "Stand (High count)";
  if (advice === "Hit" && tc <= -1) return "Hit (Low count)";
  return advice;
}

/*********************
 STRATEGY TABLE OVERLAY
*********************/
// Basic Strategy Master Lookup
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
    20: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    19: {2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    18: {2:"S",3:"D",4:"D",5:"D",6:"D",7:"S",8:"S",9:"H",10:"H",A:"H"},
    17: {2:"H",3:"D",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    16: {2:"H",3:"H",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    15: {2:"H",3:"H",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    14: {2:"H",3:"H",4:"H",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    13: {2:"H",3:"H",4:"H",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"}
  },
  pairs: {
    "A":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"P",9:"P",10:"P",A:"P"},
    "10": {2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    "9":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"S",8:"P",9:"P",10:"S",A:"S"},
    "8":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"P",9:"P",10:"P",A:"P"},
    "7":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"H",9:"H",10:"H",A:"H"},
    "6":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"H",8:"H",9:"H",10:"H",A:"H"},
    "5":  {2:"D",3:"D",4:"D",5:"D",6:"D",7:"D",8:"D",9:"D",10:"H",A:"H"},
    "4":  {2:"H",3:"H",4:"H",5:"P",6:"P",7:"H",8:"H",9:"H",10:"H",A:"H"},
    "3":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"H",9:"H",10:"H",A:"H"},
    "2":  {2:"P",3:"P",4:"P",5:"P",6:"P",7:"P",8:"H",9:"H",10:"H",A:"H"}
  }
};

function buildStrategyTables() {
  const container = document.getElementById("strategyTables");
  container.innerHTML = "";
  ["hard","soft","pairs"].forEach(type=>{
    const t=document.createElement("table");
    t.className="basicTable";
    let header="<tr><th>"+type+"</th>";
    RANKS.forEach(d=>header+=`<th>${d}</th>`);
    header+="</tr>";
    t.innerHTML = header;
    Object.keys(basicTable[type]).forEach(rowKey=>{
      let row = `<tr data-type="${type}" data-key="${rowKey}"><td>${rowKey}</td>`;
      RANKS.forEach(d=>{
        row+=`<td data-dealer="${d}" data-row="${rowKey}" data-type="${type}">${ basicTable[type][rowKey][d] || "-" }</td>`;
      });
      row+="</tr>";
      t.innerHTML += row;
    });
    container.appendChild(t);
  });
}

function highlightStrategy(player,dealerUp) {
  document.querySelectorAll(".basicTable td.highlight")
    .forEach(c=>c.classList.remove("highlight"));
  const total = handValue(player);
  const up = dealerUp;
  const isPair = player[0]===player[1];
  const isSoft = player.includes("A") && total<=21 && !["10","J","Q","K"].includes(player[0]);
  let type, key;
  if(isPair){ type="pairs"; key=player[0]; }
  else if(isSoft){ type="soft"; key=total.toString(); }
  else{ type="hard"; key = (total<8?"8":total.toString()); }
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

/*********************
 HAND EVALUATION
*********************/
document.getElementById("evaluate").onclick = () => {
  // read inputs
  const p1 = document.getElementById("p1").value;
  const p2 = document.getElementById("p2").value;
  const up = document.getElementById("dealerUp").value;
  const hole = document.getElementById("dealerHole").value;
  const otherText = document.getElementById("others").value.trim();

  // parse other visible cards
  const others = otherText
    ? otherText.split(",").map(x => x.trim()).filter(x => RANKS.includes(x))
    : [];

  // reset counts for the current context
  runningCount = 0;
  remainingCards = 312;

  // update running count for all visible cards
  [p1, p2, up, hole, ...others].forEach(c => {
    runningCount += hiLo[c] || 0;
    remainingCards--;
  });

  // store the hands
  dealerHand = [up, hole];
  playerHands = [[p1, p2]];

  // update UI displays
  document.getElementById("yourCards").textContent = `${p1}, ${p2}`;
  document.getElementById("dealerCards").textContent = `${up}, ${hole}`;
  document.getElementById("rc").textContent = runningCount;
  document.getElementById("tc").textContent = trueCount();

  // instantly compute suggested action
  const baseAdvice = basicStrategy([p1, p2], up);
  const tcVal = parseFloat(trueCount());
  const finalAdvice = applyDeviation(baseAdvice, tcVal);

  document.getElementById("advice").textContent = finalAdvice;
  document.getElementById("explanation").textContent = "Instant hint based on current table";

  // show strategy overlay automatically
  buildStrategyTables();
  highlightStrategy([p1, p2], up);
  document.getElementById("strategyOverlay").classList.remove("hidden");

  // save for later result tracking
  sessionStorage.setItem("currentAdvice", finalAdvice);
  sessionStorage.setItem("currentHand", JSON.stringify([p1, p2]));
  sessionStorage.setItem("currentDealer", up);

  // update history UI + charts
  renderHistory();
  updateCharts();
};

/*********************
 RECORD RESULT
*********************/
document.getElementById("outcome").onclick = ()=>{
  const r = prompt("Enter result (WIN/LOSE/PUSH):").toUpperCase();
  if(!["WIN","LOSE","PUSH"].includes(r)) return alert("Invalid");

  const advice = sessionStorage.getItem("currentAdvice");
  const hand = JSON.parse(sessionStorage.getItem("currentHand"));
  const dealer = sessionStorage.getItem("currentDealer");

  historyArr.push({
    time:new Date().toLocaleTimeString(),
    player:hand, dealer, advice,
    result:r, tc:trueCount()
  });
  localStorage.setItem("bjHistory", JSON.stringify(historyArr));
  renderHistory();
  updateCharts();
};

/*********************
 HISTORY + CHARTS
*********************/
function renderHistory(){
  const ul=document.getElementById("historyList");
  ul.innerHTML="";
  historyArr.slice(-15).reverse().forEach(h=>{
    const li=document.createElement("li");
    li.textContent = `${h.time} — ${h.player.join(", ")} vs ${h.dealer} : ${h.advice} -> ${h.result} (TC=${h.tc})`;
    ul.appendChild(li);
  });
}

function updateCharts(){
  const results=historyArr.map(h=>h.result);
  const wins=results.filter(x=>"WIN").length;
  const losses=results.filter(x=>"LOSE").length;
  const pushes=results.filter(x=>"PUSH").length;

  const ctx1=document.getElementById("winRateChart").getContext("2d");
  if(winRateChart) winRateChart.destroy();
  winRateChart=new Chart(ctx1,{
    type:"pie",
    data:{
      labels:["WIN","LOSE","PUSH"],
      datasets:[{data:[wins,losses,pushes],backgroundColor:["#4caf50","#f44336","#ff9800"]}]
    }
  });

  const counts = historyArr.map(h=>parseFloat(h.tc));
  const ctx2 = document.getElementById("trueCountChart").getContext("2d");
  if(trueCountChart) trueCountChart.destroy();
  trueCountChart=new Chart(ctx2,{
    type:"line",
    data:{
      labels:counts.map((_,i)=>i+1),
      datasets:[{label:"True Count",data:counts,borderColor:"#2196f3",fill:false}]
    }
  });
}
