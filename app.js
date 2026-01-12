document.addEventListener("DOMContentLoaded", () => {

console.log("Blackjack Trainer Pro – Engine Loaded");

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const TOTAL_DECKS = 6;
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let seats = [[]];
let dealerUpcard = null;
let shoe = buildShoe();
let cardHistory = [];

let evChartInstance = null;

function buildShoe(){
  const c = {};
  RANKS.forEach(r => c[r] = 4 * TOTAL_DECKS);
  return c;
}

function buildFullDeck(visible){
  const deck=[];
  for(let d=0; d<TOTAL_DECKS; d++){
    RANKS.forEach(r=>{
      for(let i=0;i<4;i++) deck.push(r);
    });
  }
  visible.forEach(v=>{
    const i=deck.indexOf(v);
    if(i>=0) deck.splice(i,1);
  });
  return deck;
}

function handValue(cards){
  let total=0, aces=0;
  cards.forEach(c=>{
    if(["J","Q","K"].includes(c)) total+=10;
    else if(c==="A"){ total+=11; aces++; }
    else total+=parseInt(c);
  });
  while(total>21 && aces){ total-=10; aces--; }
  return total;
}

function simulateDealer(up,hole,deck){
  const h=[up,hole];
  let t=handValue(h);
  while(t<17 || (t===17 && h.includes("A"))){
    if(!deck.length) break;
    h.push(deck.splice(Math.floor(Math.random()*deck.length),1)[0]);
    t=handValue(h);
  }
  return t;
}

function simulateOutcome(playerTotal, deck, up){
  const hole = deck.splice(Math.floor(Math.random()*deck.length),1)[0];
  const dTotal = simulateDealer(up, hole, deck);

  if(playerTotal>21) return -1;
  if(dTotal>21) return 1;
  if(playerTotal>dTotal) return 1;
  if(playerTotal<dTotal) return -1;
  return 0;
}

function monteCarloEV(callback, trials=2000){
  let ev=0;
  for(let i=0;i<trials;i++) ev += callback();
  return ev/trials;
}

function EV_Stand(hand, visible){
  const total = handValue(hand);
  return monteCarloEV(()=>{
    const deck = buildFullDeck(visible);
    return simulateOutcome(total, deck, visible[1]);
  });
}

function EV_Hit(hand, visible){
  return monteCarloEV(()=>{
    const deck = buildFullDeck(visible);
    const card = deck.splice(Math.floor(Math.random()*deck.length),1)[0];
    const newHand = [...hand,card];
    const total = handValue(newHand);
    return simulateOutcome(total, deck, visible[1]);
  });
}

function EV_Double(hand, visible){
  return monteCarloEV(()=>{
    const deck = buildFullDeck(visible);
    const card = deck.splice(Math.floor(Math.random()*deck.length),1)[0];
    const total = handValue([...hand,card]);
    const r = simulateOutcome(total, deck, visible[1]);
    return r*2;
  });
}

function EV_Surrender(){
  return -0.5;
}

function EV_Split(hand, visible){
  if(hand[0]!==hand[1]) return null;

  return monteCarloEV(()=>{
    const deck = buildFullDeck(visible);
    let ev=0;

    for(let i=0;i<2;i++){
      const card = deck.splice(Math.floor(Math.random()*deck.length),1)[0];
      const total = handValue([hand[0],card]);
      ev += simulateOutcome(total, deck, visible[1]);
    }
    return ev;
  });
}

function renderEVChart(values){
  const ctx = document.getElementById("evChart").getContext("2d");
  if(evChartInstance) evChartInstance.destroy();

  evChartInstance = new Chart(ctx,{
    type:"bar",
    data:{
      labels:Object.keys(values),
      datasets:[{
        label:"Expected Value",
        data:Object.values(values),
        backgroundColor:["#4caf50","#2196f3","#ff9800","#9c27b0","#f44336"]
      }]
    },
    options:{ responsive:true }
  });
}

function renderHeatmap(hand){
  const canvas=document.getElementById("heatmap");
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const cellW=canvas.width/13;
  const cellH=canvas.height;

  RANKS.forEach((up,i)=>{
    const visible=[...hand,up];
    const ev=EV_Stand(hand,visible);

    const color = ev>0 ? `rgba(0,200,0,${Math.min(ev,1)})` :
                 `rgba(200,0,0,${Math.min(Math.abs(ev),1)})`;

    ctx.fillStyle=color;
    ctx.fillRect(i*cellW,0,cellW,cellH);
    ctx.fillStyle="#000";
    ctx.fillText(up,i*cellW+cellW/2-4,20);
  });
}

document.getElementById("evaluate").onclick = ()=>{
  if(!dealerUpcard || seats[0].length<2) return alert("Enter your hand & dealer upcard");

  const yourHand = seats[0];
  const visible=[...yourHand,dealerUpcard];

  const evStand = EV_Stand(yourHand,visible);
  const evHit = EV_Hit(yourHand,visible);
  const evDouble = EV_Double(yourHand,visible);
  const evSplit = EV_Split(yourHand,visible);
  const evSurrender = EV_Surrender();

  document.getElementById("evStand").textContent = evStand.toFixed(3);
  document.getElementById("evHit").textContent = evHit.toFixed(3);
  document.getElementById("evDouble").textContent = evDouble.toFixed(3);
  document.getElementById("evSplit").textContent = evSplit===null?"N/A":evSplit.toFixed(3);
  document.getElementById("evSurrender").textContent = evSurrender.toFixed(3);

  renderEVChart({
    Stand:evStand,
    Hit:evHit,
    Double:evDouble,
    Split:evSplit===null?0:evSplit,
    Surrender:evSurrender
  });

  renderHeatmap(yourHand);
};

});
