/******************
  STATE
******************/
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {
  2:1,3:1,4:1,5:1,6:1,
  7:0,8:0,9:0,
  10:-1,J:-1,Q:-1,K:-1,A:-1
};

let runningCount = 0;
let remainingCards = 312;

// History & Stats
let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];
let stats = {
  total:0, wins:0, losses:0, pushes:0, correct:0
};

/******************
  SETUP
******************/
function populateDropdowns() {
  ["p1","p2","dealer"].forEach(id=>{
    const sel = document.getElementById(id);
    RANKS.forEach(r=>{
      let opt = document.createElement("option");
      opt.value = r; opt.textContent = r;
      sel.appendChild(opt);
    });
  });
}

function cardValue(c){
  if(["J","Q","K"].includes(c)) return 10;
  if(c==="A") return 11;
  return parseInt(c);
}

function handValue(hand){
  let total=0, aces=0;
  hand.forEach(c=>{
    if(["J","Q","K","10"].includes(c)) total+=10;
    else if(c==="A"){ total+=11; aces++; }
    else total+=parseInt(c);
  });
  while(total>21 && aces){ total-=10; aces--; }
  return total;
}

function trueCount(){
  return (runningCount / (remainingCards/52)).toFixed(2);
}

/******************
  BASIC STRATEGY + DEVIATION
******************/
function basicStrategy(player, dealerUp){
  const total = handValue(player);
  const up = cardValue(dealerUp);
  const isPair = player[0] === player[1];
  const isSoft = player.includes("A") && total <= 21 && total !== 21;

  // Pair
  if(isPair){
    if(player[0]==="A"||player[0]==="8") return "Split";
    if(["10","J","Q","K"].includes(player[0])) return "Stand";
  }

  // Soft
  if(isSoft){
    if(total>=19) return "Stand";
    if(total===18){
      if(up>=3 && up<=6) return "Double";
      if(up>=9) return "Hit";
      return "Stand";
    }
    return "Hit";
  }

  // Hard
  if(total>=17) return "Stand";
  if(total>=13 && up<=6) return "Stand";
  if(total===12 && up>=4 && up<=6) return "Stand";
  if(total===11) return "Double";
  if(total===10 && up<=9) return "Double";
  if(total===9 && up>=3 && up<=6) return "Double";
  return "Hit";
}

function applyDeviation(advice, tc){
  if(advice==="Stand" && tc>=3) return "Stand (high count influence)";
  if(advice==="Hit" && tc<=-1) return "Hit (low count influence)";
  return advice;
}

/******************
  EVALUATE HAND
******************/
document.getElementById("evaluate").onclick = ()=>{
  const p1 = document.getElementById("p1").value;
  const p2 = document.getElementById("p2").value;
  const dealer = document.getElementById("dealer").value;
  const otherText = document.getElementById("others").value.trim();

  const others = otherText
    ? otherText.split(",").map(x=>x.trim()).filter(x=>RANKS.includes(x))
    : [];

  // update count
  [p1,p2,dealer,...others].forEach(c=>{
    runningCount += hiLo[c];
    remainingCards--;
  });

  // UI display
  document.getElementById("yourCards").textContent = `${p1}, ${p2}`;
  document.getElementById("dealerCard").textContent = dealer;

  const playerHand = [p1,p2];
  const baseAdvice = basicStrategy(playerHand, dealer);
  const tc = parseFloat(trueCount());
  const advice = applyDeviation(baseAdvice, tc);

  document.getElementById("rc").textContent = runningCount;
  document.getElementById("tc").textContent = tc;
  document.getElementById("advice").textContent = advice;
  document.getElementById("explain").textContent =
    "Based on visible cards and true count.";

  // store this partial entry for later result
  sessionStorage.setItem("currentAdvice", advice);
  sessionStorage.setItem("currentHand", JSON.stringify(playerHand));
  sessionStorage.setItem("currentDealer", dealer);
};

/******************
  RECORD OUTCOME
******************/
function recordOutcome(res){
  const advice = sessionStorage.getItem("currentAdvice");
  const playerHand = JSON.parse(sessionStorage.getItem("currentHand"));
  const dealerUp = sessionStorage.getItem("currentDealer");

  // update stats
  stats.total++;
  if(res==="WIN") stats.wins++;
  if(res==="LOSE") stats.losses++;
  if(res==="PUSH") stats.pushes++;

  // correct?
  const ideal = basicStrategy(playerHand, dealerUp);
  if(advice && advice.split(" ")[0] === ideal) stats.correct++;

  // add history
  historyArr.push({
    time: new Date().toLocaleTimeString(),
    player: playerHand,
    dealer: dealerUp,
    advice,
    result: res,
    tc: trueCount()
  });

  // save
  localStorage.setItem("bjHistory", JSON.stringify(historyArr));
  updateStatsDisplay();
  renderHistory();
}

/******************
  OUTCOME BUTTONS
******************/
document.getElementById("nextHand").onclick = ()=>{
  document.getElementById("p1").selectedIndex=0;
  document.getElementById("p2").selectedIndex=0;
  document.getElementById("dealer").selectedIndex=0;
  document.getElementById("others").value="";
  document.getElementById("advice").textContent="—";
  document.getElementById("explain").textContent="";
  document.getElementById("outcome").textContent="Enter result:";
};

document.getElementById("newShoe").onclick = ()=>{
  runningCount=0;
  remainingCards=312;
  document.getElementById("rc").textContent="0";
  document.getElementById("tc").textContent="0";
  document.getElementById("outcome").textContent="";
};

/******************
  RESULT CLICK PROMPT
  (ENTER HAND RESULT)
******************/
document.getElementById("outcome").onclick = ()=>{
  const r = prompt("Enter outcome (WIN / LOSE / PUSH):").toUpperCase();
  if(!["WIN","LOSE","PUSH"].includes(r)) return alert("Invalid");
  document.getElementById("outcome").textContent = r;
  recordOutcome(r);
};

/******************
  HISTORY & STATS
******************/
function renderHistory(){
  const ul = document.getElementById("historyList");
  ul.innerHTML = "";
  historyArr.slice(-15).reverse().forEach(h=>{
    const li=document.createElement("li");
    li.textContent =
      `${h.time} - [${h.player.join(", ")} vs ${h.dealer}] Advice: ${h.advice} | Result: ${h.result} | TC: ${h.tc}`;
    ul.appendChild(li);
  });
}

function updateStatsDisplay(){
  document.getElementById("statTotal").textContent = stats.total;
  document.getElementById("statWins").textContent = stats.wins;
  document.getElementById("statLosses").textContent = stats.losses;
  document.getElementById("statPushes").textContent = stats.pushes;
  document.getElementById("statCorrect").textContent = stats.correct;
}

/******************
  INIT
******************/
window.onload = ()=>{
  populateDropdowns();
  renderHistory();
  updateStatsDisplay();
};
