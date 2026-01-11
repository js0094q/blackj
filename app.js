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
 POPULATE SELECTS
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
 DYNAMIC SEATS
*************************/
let currentSeats = 0;
let nextId = 3;

document.getElementById("addSeat").onclick = () => {
  if (currentSeats >= 6) return alert("Max 7 players (including you)");
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
  document.getElementById(`seat${currentSeats}`).remove();
  nextId -= 2;
  currentSeats--;
};

/*************************
 COUNT UTILS
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
    else if (c==="A") { total += 11; aces++; }
    else total += parseInt(c);
  });
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

function trueCount() {
  return (runningCount / (remainingCards / 52)).toFixed(2);
}

/*************************
 BASIC STRATEGY
*************************/
function basicStrategy(player, dealerUp) {
  const total=handValue(player);
  const up=cardValue(dealerUp);
  const isPair = player[0]===player[1];
  const isSoft = player.includes("A") && total<=21 && !["10","J","Q","K"].includes(player[0]);

  if (isPair) {
    if (player[0]==="A"||player[0]==="8") return "Split";
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
  if (total>=13&&up<=6) return "Stand";
  if (total===12&&up>=4&&up<=6) return "Stand";
  if (total===11) return "Double";
  if (total===10&&up<=9) return "Double";
  if (total===9&&up>=3&&up<=6) return "Double";
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
    17:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"S",8:"S",9:"S",10:"S",A:"S"},
    16:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    15:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    14:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    13:{2:"S",3:"S",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    12:{2:"H",3:"H",4:"S",5:"S",6:"S",7:"H",8:"H",9:"H",10:"H",A:"H"},
    11:{2:"D",3:"D",4:"D",5:"D",6:"D",7:"D",8:"D",9:"D",10:"H",A:"H"},
    10:{2:"D",3:"D",4:"D",5:"D",6:"D",7:"D",8:"D",9:"D",10:"H",A:"H"},
    9: {2:"H",3:"D",4:"D",5:"D",6:"D",7:"H",8:"H",9:"H",10:"H",A:"H"},
    8: {2:"H",3:"H",4:"H",5:"H",6:"H",7:"H",8:"H",9:"H",10:"H",A:"H"}
  },
  soft:{ /* same structure */ },
  pairs:{ /* same structure */ }
};

/*************************
 BUILD & HIGHLIGHT STRATEGY TABLE
*************************/
function buildStrategyTables() {
  const container = document.getElementById("strategyTables");
  container.innerHTML="";
  ["hard","soft","pairs"].forEach(type=>{
    const t=document.createElement("table");
    t.className="basicTable";
    let header=`<tr><th>${type.toUpperCase()}</th>`;
    RANKS.forEach(d=>header+=`<th>${d}</th>`);
    header+="</tr>";
    t.innerHTML=header;
    Object.keys(basicTable[type]).forEach(rk=>{
      let row=`<tr data-type="${type}" data-key="${rk}"><td>${rk}</td>`;
      RANKS.forEach(d=>{ const val=basicTable[type][rk][d]||"-"; row+=`<td data-dealertype="${type}" data-row="${rk}" data-dealer="${d}">${val}</td>` });
      row+="</tr>";
      t.innerHTML+=row;
    });
    container.appendChild(t);
  });
}

function highlightStrategy(player,dealerUp) {
  document.querySelectorAll(".highlight").forEach(el=>el.classList.remove("highlight"));
  const total=handValue(player);
  const up=dealerUp;
  const isPair=player[0]===player[1];
  const isSoft=player.includes("A") && total<=21 && !["10","J","Q","K"].includes(player[0]);
  let type,key;
  if(isPair){ type="pairs"; key=player[0]; }
  else if(isSoft){ type="soft"; key=total.toString(); }
  else{ type="hard"; key=(total<8?"8":total.toString()); }
  document.querySelectorAll(`td[data-dealertype="${type}"][data-row="${key}"][data-dealer="${up}"]`)
    .forEach(cell=>cell.classList.add("highlight"));
}

/*************************
 EVALUATE HAND
*************************/
document.getElementById("evaluate").onclick = ()=>{
  const selCards=[];
  for(let i=1;i<=14;i++){
    const el=document.getElementById(`p${i}`);
    if(el && el.value) selCards.push(el.value);
  }
  const up=document.getElementById("dealerUp").value;
  selCards.push(up);

  runningCount=0; remainingCards=312;
  selCards.forEach(c=>{ runningCount+=hiLo[c]||0; remainingCards-- });

  const yourHand=[document.getElementById("p1").value,document.getElementById("p2").value];

  document.getElementById("yourCards").textContent=`${yourHand.join(", ")}`;
  document.getElementById("dealerCard").textContent=up;

  const base=basicStrategy(yourHand,up);
  const tc=parseFloat(trueCount());
  const adv=applyDeviation(base,tc);

  document.getElementById("rc").textContent=runningCount;
  document.getElementById("tc").textContent=tc;
  document.getElementById("advice").textContent=adv;
  document.getElementById("explanation").textContent="Basic + True Count";

  buildStrategyTables();
  highlightStrategy(yourHand,up);

  historyArr.push({ player:yourHand, dealer:up, advice:adv, tc:trueCount() });
  localStorage.setItem("bjHistory",JSON.stringify(historyArr));
  renderHistory();
  updateCharts();
};

/*************************
 HISTORY & CHARTS
*************************/
function renderHistory(){
  const ul=document.getElementById("historyList");
  ul.innerHTML="";
  historyArr.slice(-15).reverse().forEach(h=>{
    const li=document.createElement("li");
    li.textContent=`${h.player.join(", ")} vs ${h.dealer} | ${h.advice} (TC=${h.tc})`;
    ul.appendChild(li);
  });
}

function updateCharts(){
  const results=historyArr.map(x=>x.advice);
  const counts=historyArr.map(x=>parseFloat(x.tc));

  const wins=results.filter(r=>"Stand").length;
  const losses=results.filter(r=>"Hit").length;

  const ctx1=document.getElementById("winRateChart")?.getContext("2d");
  if(ctx1){
    if(winRateChart) winRateChart.destroy();
    winRateChart=new Chart(ctx1,{type:"pie",data:{
      labels:["Stand","Hit"],
      datasets:[{data:[wins,losses],backgroundColor:["#4caf50","#f44336"]}]
    }});
  }

  const ctx2=document.getElementById("trueCountChart")?.getContext("2d");
  if(ctx2){
    if(trueCountChart) trueCountChart.destroy();
    trueCountChart=new Chart(ctx2,{type:"line",data:{
      labels:counts.map((_,i)=>i+1),
      datasets:[{label:"True Count",data:counts,borderColor:"#2196f3",fill:false}]
    }});
  }
}

/*************************
 NEXT HAND / NEW SHOE
*************************/
document.getElementById("nextHand").onclick = ()=>{
  for(let i=1;i<=14;i++){
    const el=document.getElementById(`p${i}`);
    if(el) el.selectedIndex=0;
  }
  document.getElementById("dealerUp").selectedIndex=0;
};

document.getElementById("newShoe").onclick = ()=>{ runningCount=0; remainingCards=312; };
