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
 DROPDOWNS
*************************/
function populateSelects() {
  const ids = Array.from({length: 14}, (_, i) => `p${i+1}`).concat("dealerUp");
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
  ["hard","soft","pairs"].forEach(type => {
    const t = document.createElement("table");
    t.className="basicTable";
    let header=`<tr><th>${type.toUpperCase()}</th>`;
    RANKS.forEach(d=>header+=`<th>${d}</th>`);
    header+="</tr>";
    t.innerHTML = header;
    Object.keys(basicTable[type]).forEach(rKey=>{
      let row=`<tr data-type="${type}" data-key="${rKey}"><td>${rKey}</td>`;
      RANKS.forEach(d=>{
        const m=basicTable[type][rKey][d]||"-";
        row+=`<td data-dealer="${d}" data-dealertype="${type}" data-row="${rKey}">${m}</td>`;
      });
      row+="</tr>";
      t.innerHTML+=row;
    });
    container.appendChild(t);
  });
}

function highlightStrategy(player,dealerUp) {
  document.querySelectorAll(".highlight").forEach(c=>c.classList.remove("highlight"));
  const total = handValue(player);
  const up = dealerUp;
  const isPair = player[0]===player[1];
  const isSoft = player.includes("A") && total<=21 && !["10","J","Q","K"].includes(player[0]);
  let type,key;
  if(isPair){ type="pairs"; key=player[0]; }
  else if(isSoft){ type="soft"; key=total.toString(); }
  else { type="hard"; key=(total<8?"8":total.toString()); }
  document.querySelectorAll(`td[data-dealertype="${type}"][data-row="${key}"][data-dealer="${up}"]`)
    .forEach(cell=>cell.classList.add("highlight"));
}

/*************************
 HAND EVALUATION
*************************/
document.getElementById("evaluate").onclick = () => {
  const selectedCards = [];
  for(let i=1; i<=14; i++){
    const val=document.getElementById(`p${i}`).value;
    if(val) selectedCards.push(val);
  }
  const up=document.getElementById("dealerUp").value;
  const bookLeanText=document.getElementById("bookLean").value.trim();

  runningCount=0;
  remainingCards=312;
  [...selectedCards, up].forEach(c=>{
    runningCount += hiLo[c]||0;
    remainingCards--;
  });

  document.getElementById("yourCards").textContent= `${document.getElementById("p1").value}, ${document.getElementById("p2").value}`;
  document.getElementById("dealerCard").textContent = up;
  document.getElementById("historyBookLean").textContent = bookLeanText;

  const yourHand=[document.getElementById("p1").value,document.getElementById("p2").value];
  const base=basicStrategy(yourHand, up);
  const tc=parseFloat(trueCount());
  const advice=applyDeviation(base, tc);

  document.getElementById("rc").textContent=runningCount;
  document.getElementById("tc").textContent=tc;
  document.getElementById("advice").textContent=advice;
  document.getElementById("explanation").textContent="Basic + True Count deviation";

  buildStrategyTables();
  highlightStrategy(yourHand, up);

  sessionStorage.setItem("currentAdvice", advice);
  sessionStorage.setItem("currentHand", JSON.stringify(yourHand));
  sessionStorage.setItem("currentDealer", up);

  renderHistory();
  updateCharts();
};

/*************************
 RECORD RESULT
*************************/
document.getElementById("outcome").onclick = () => {
  const r=prompt("Enter result (WIN/LOSE/PUSH):").toUpperCase();
  if(!["WIN","LOSE","PUSH"].includes(r)) return alert("Invalid");
  const advice=sessionStorage.getItem("currentAdvice");
  const hand=JSON.parse(sessionStorage.getItem("currentHand"));
  const dealer=sessionStorage.getItem("currentDealer");
  const bookLeanLogged=document.getElementById("historyBookLean").textContent;

  historyArr.push({
    time:new Date().toLocaleTimeString(),
    player:hand,dealer,advice,result:r,tc:trueCount(),bookLean:bookLeanLogged
  });

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
    li.textContent=`${h.time} ─ ${h.player.join(",")} vs ${h.dealer} | ${h.advice} → ${h.result} | TC ${h.tc} | Lean: ${h.bookLean}`;
    ul.appendChild(li);
  });
}

function updateCharts(){
  const res=historyArr.map(h=>h.result);
  const wins=res.filter(r=>"WIN").length;
  const losses=res.filter(r=>"LOSE").length;
  const pushes=res.filter(r=>"PUSH").length;

  const ctx1=document.getElementById("winRateChart")?.getContext("2d");
  if(ctx1){
    if(winRateChart) winRateChart.destroy();
    winRateChart=new Chart(ctx1,{type:"pie",data:{
      labels:["WIN","LOSE","PUSH"],
      datasets:[{data:[wins,losses,pushes],backgroundColor:["#4caf50","#f44336","#ff9800"]}]
    }});
  }

  const counts=historyArr.map(h=>parseFloat(h.tc));
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
document.getElementById("nextHand").onclick = () => {
  for(let i=1;i<=14;i++){
    document.getElementById(`p${i}`).selectedIndex=0;
  }
  document.getElementById("dealerUp").selectedIndex=0;
  document.getElementById("bookLean").value="";
  document.getElementById("advice").textContent="—";
  document.getElementById("explanation").textContent="";
};

document.getElementById("newShoe").onclick = () => {
  runningCount=0;
  remainingCards=312;
  document.getElementById("rc").textContent="0";
  document.getElementById("tc").textContent="0";
  alert("New shoe started — count reset.");
};
