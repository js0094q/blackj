/*************************
 GLOBAL STATE
*************************/
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let visibleCards = [];
let runningCount = 0;
let remainingCards = 312;
let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

let winRateChart=null, trueCountChart=null;

/*************************
 BUILD CARD BUTTONS
*************************/
function buildCardButtons(){
  const container=document.getElementById("cardButtons");
  container.innerHTML="";
  RANKS.forEach(r=>{
    const btn=document.createElement("button");
    btn.className="cardBtn";
    btn.textContent=r;
    btn.onclick=()=>addCard(r);
    container.appendChild(btn);
  });
}
buildCardButtons();

function addCard(card){
  visibleCards.push(card);
  document.getElementById("yourCards").textContent=visibleCards.slice(0,2).join(", ");
  document.getElementById("dealerUpcard").textContent=visibleCards[2]||"";
}

/*************************
 COUNT + UTILS
*************************/
function updateCounts(){
  runningCount=0; remainingCards=312;
  visibleCards.forEach(c=>{ runningCount+=hiLo[c]||0; remainingCards--; });
  document.getElementById("rc").textContent=runningCount;
  document.getElementById("tc").textContent=(runningCount/(remainingCards/52)).toFixed(2);
}

/*************************
 EVALUATE HAND
*************************/
document.getElementById("evaluate").onclick=()=>{
  if(visibleCards.length<3){
    alert("Tap at least your 2 cards and dealer upcard.");
    return;
  }

  updateCounts();

  const p1=visibleCards[0], p2=visibleCards[1], up=visibleCards[2];
  const yourHand=[p1,p2];

  const strat=basicStrategy(yourHand, up);
  document.getElementById("advice").textContent=strat;

  const sim=monteCarloDealer(yourHand,up,visibleCards,5000);
  document.getElementById("winPct").textContent=((sim.win/5000)*100).toFixed(1);
  document.getElementById("pushPct").textContent=((sim.push/5000)*100).toFixed(1);
  document.getElementById("lossPct").textContent=((sim.loss/5000)*100).toFixed(1);

  historyArr.push({
    time:new Date().toLocaleTimeString(),
    player:yourHand, dealer:up,
    advice:strat,
    win:((sim.win/5000)*100).toFixed(1),
    push:((sim.push/5000)*100).toFixed(1),
    loss:((sim.loss/5000)*100).toFixed(1),
    tc:(runningCount/(remainingCards/52)).toFixed(2)
  });
  localStorage.setItem("bjHistory",JSON.stringify(historyArr));
  renderHistory();
  updateCharts();
};

document.getElementById("resetEntry").onclick=()=>{
  visibleCards=[];
  document.getElementById("yourCards").textContent="";
  document.getElementById("dealerUpcard").textContent="";
  updateCounts();
};

/*************************
 HISTORY + CHARTS
*************************/
function renderHistory(){
  const ul=document.getElementById("historyList");
  ul.innerHTML="";
  historyArr.slice(-20).reverse().forEach(h=>{
    const li=document.createElement("li");
    li.textContent=
      `${h.time}: [${h.player.join(", ")}] vs ${h.dealer} | ${h.advice} | `+
      `Win ${h.win}% Push ${h.push}% Loss ${h.loss}% | TC ${h.tc}`;
    ul.appendChild(li);
  });
}

function updateCharts(){
  const wins=historyArr.filter(h=>h.win>h.loss).length;
  const losses=historyArr.filter(h=>h.loss>h.win).length;
  const pushes=historyArr.filter(h=>parseFloat(h.push)>0).length;

  const ctx1=document.getElementById("winRateChart")?.getContext("2d");
  if(ctx1){
    if(winRateChart) winRateChart.destroy();
    winRateChart=new Chart(ctx1,{type:"pie",data:{
      labels:["Win","Lose","Push"],
      datasets:[{data:[wins,losses,pushes],backgroundColor:["#4caf50","#f44336","#ff9800"]}]
    }});
  }

  const tcSeries=historyArr.map(h=>parseFloat(h.tc));
  const ctx2=document.getElementById("trueCountChart")?.getContext("2d");
  if(ctx2){
    if(trueCountChart) trueCountChart.destroy();
    trueCountChart=new Chart(ctx2,{type:"line",data:{
      labels:tcSeries.map((_,i)=>i+1),
      datasets:[{label:"True Count",data:tcSeries,borderColor:"#2196f3",fill:false}]
    }});
  }
}
