// ===== GLOBAL STATE =====
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};
const TOTAL_DECKS = 6;

let seats = [];  
let dealerUpcard = null;
let shoe = buildShoe();
let cardHistory = [];
let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

// ===== BUILD SHOE =====
function buildShoe(){
  const counts = {};
  RANKS.forEach(r => counts[r] = 4 * TOTAL_DECKS);
  return counts;
}

// ===== BUTTONS UI =====
function buildCardButtons(){
  const container = document.getElementById("cardButtons");
  container.innerHTML="";
  RANKS.forEach(r => {
    const btn = document.createElement("button");
    btn.textContent = r;
    btn.onclick = () => recordCard(r);
    container.appendChild(btn);
  });
}

// ===== RECORD CARD =====
function recordCard(rank){
  if (shoe[rank] <= 0) {
    alert("No more " + rank + " in shoe.");
    return;
  }
  // Fill seats in order
  for(let i=0;i<seats.length;i++){
    if(seats[i].length < 2){
      seats[i].push(rank);
      shoe[rank]--;
      cardHistory.push({seat:i,rank});
      updateUI(); updateCounts();
      return;
    }
  }
  // Then dealer
  if(!dealerUpcard){
    dealerUpcard = rank;
    shoe[rank]--;
    cardHistory.push({seat:"dealer",rank});
    updateUI(); updateCounts();
    return;
  }
  alert("All seats and dealer card are filled.");
}

// ===== UNDO LAST =====
document.getElementById("undo").onclick = ()=>{
  if(!cardHistory.length) return;
  const last = cardHistory.pop();
  shoe[last.rank]++;
  if(last.seat==="dealer") dealerUpcard = null;
  else seats[last.seat].pop();
  updateUI(); updateCounts();
};

// ===== SEAT CONTROLS =====
document.getElementById("addSeat").onclick = ()=>{
  seats.push([]);
  updateUI();
};
document.getElementById("removeSeat").onclick = ()=>{
  if(!seats.length) return;
  const removed = seats.pop();
  removed.forEach(r => shoe[r]++);
  updateUI(); updateCounts();
};

// ===== HAND VALUE =====
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

// ===== BASIC STRATEGY with Split/Double =====
function basicStrategy(hand,dealer){
  const total=handValue(hand);
  const upVal = dealer==="A"?11:(["J","Q","K"].includes(dealer)?10:parseInt(dealer));
  const isPair = hand[0]===hand[1];
  const isSoft = hand.includes("A") && total<=21 && !["10","J","Q","K"].includes(hand[0]);

  if(isPair){
    if(hand[0]==="A"||hand[0]==="8") return "Split";
    if(["10","J","Q","K"].includes(hand[0])) return "Stand";
  }
  if(isSoft){
    if(total>=19) return "Stand";
    if(total===18){
      if(upVal>=3&&upVal<=6) return "Double";
      if(upVal>=9) return "Hit";
      return "Stand";
    }
    return "Hit";
  }
  if(total>=17) return "Stand";
  if(total>=13&&upVal<=6) return "Stand";
  if(total===12&&upVal>=4&&upVal<=6) return "Stand";
  if(total===11) return "Double";
  if(total===10&&upVal<=9) return "Double";
  if(total===9&&upVal>=3&&upVal<=6) return "Double";
  return "Hit";
}

// ===== SIDE BETS =====
function sideBetResults(hand,dealerUp){
  const results = [];
  if(hand[0]===hand[1]) results.push("PAIR (11:1)");
  const rummy = [...hand,dealerUp].sort((a,b)=>RANKS.indexOf(a)-RANKS.indexOf(b));
  const isStraight = RANKS.indexOf(rummy[1])===RANKS.indexOf(rummy[0])+1 &&
                     RANKS.indexOf(rummy[2])===RANKS.indexOf(rummy[1])+1;
  if(isStraight) results.push("RUMMY (9:1)");
  if(hand[0]==="7"&&hand[1]==="7"&&dealerUp==="7") results.push("JACKPOT 777");
  return results.length?results.join(", "):"—";
}

// ===== DEALER SIMULATION (Monte Carlo) =====
function buildFullShoe(visible){
  const deck=[];
  const suits=["H","D","C","S"];
  for(let d=0; d<TOTAL_DECKS; d++){
    RANKS.forEach(r=>suits.forEach(s=>deck.push(r)));
  }
  visible.forEach(v=>{
    const idx=deck.indexOf(v);
    if(idx!==-1) deck.splice(idx,1);
  });
  return deck;
}

function simulateDealerPlay(up,hole,deck){
  const hand=[up,hole];
  let total=handValue(hand);
  while(total<17 || (total===17 && hand.includes("A"))){
    if(!deck.length) break;
    const idx=Math.floor(Math.random()*deck.length);
    const card=deck.splice(idx,1)[0];
    hand.push(card);
    total=handValue(hand);
  }
  return total;
}

function monteCarloOdds(playerHand, upcard, visible, trials=3000){
  const baseShoe=buildFullShoe(visible);
  const counts={win:0,push:0,loss:0};
  for(let t=0;t<trials;t++){
    const deck=baseShoe.slice();
    const holeIdx=Math.floor(Math.random()*deck.length);
    const hole=deck.splice(holeIdx,1)[0];
    const dealerTotal=simulateDealerPlay(upcard,hole,deck);
    const playerTotal=handValue(playerHand);

    if(playerTotal>21) counts.loss++;
    else if(dealerTotal>21) counts.win++;
    else if(playerTotal>dealerTotal) counts.win++;
    else if(playerTotal<dealerTotal) counts.loss++;
    else counts.push++;
  }
  return counts;
}

// ===== EVALUATE =====
document.getElementById("evaluate").onclick = ()=>{
  if(!seats.length || seats[0].length<2 || !dealerUpcard){
    alert("Enter your own 2 cards and the dealer upcard.");
    return;
  }

  const yourHand = seats[0];
  const advice = basicStrategy(yourHand,dealerUpcard);
  document.getElementById("strategy").textContent = advice;

  const visible=[...yourHand,dealerUpcard];
  seats.slice(1).forEach(h=>visible.push(...h));

  const odds = monteCarloOdds(yourHand,dealerUpcard,visible);

  const total=odds.win+odds.push+odds.loss;
  document.getElementById("winPct").textContent = ((odds.win/total)*100).toFixed(1);
  document.getElementById("pushPct").textContent = ((odds.push/total)*100).toFixed(1);
  document.getElementById("lossPct").textContent = ((odds.loss/total)*100).toFixed(1);

  document.getElementById("evDisplay").textContent = ((odds.win - odds.loss)/total).toFixed(3);
  document.getElementById("sideBetResults").textContent = sideBetResults(yourHand,dealerUpcard);

  historyArr.push({
    time:new Date().toLocaleTimeString(), yourHand,dealer:dealerUpcard,advice
  });
  localStorage.setItem("bjHistory",JSON.stringify(historyArr));
};

// ===== COUNT + UI =====
function updateCounts(){
  let count=0,remaining=0;
  for(let r in shoe){
    count+=(hiLo[r]||0)*((4*TOTAL_DECKS)-shoe[r]);
    remaining+=shoe[r];
  }
  document.getElementById("runningCount").textContent=count;
  document.getElementById("trueCount").textContent=remaining?(count/(remaining/52)).toFixed(2):0;
}

function updateUI(){
  const seatDiv=document.getElementById("seats");
  seatDiv.innerHTML="";
  seats.forEach((hand,i)=>{
    const d=document.createElement("div");
    d.className="seat";
    if(i===0) d.classList.add("mySeat");
    d.textContent=`${i===0?"You":"Player "+i}: ${hand.join(", ")||"—"}`;
    seatDiv.appendChild(d);
  });
  document.getElementById("dealerCard").textContent=dealerUpcard||"—";
}

document.getElementById("clear").onclick = ()=>{
  seats=[]; dealerUpcard=null;
  shoe=buildShoe(); cardHistory=[];
  document.getElementById("strategy").textContent="—";
  document.getElementById("winPct").textContent="—";
  document.getElementById("pushPct").textContent="—";
  document.getElementById("lossPct").textContent="—";
  document.getElementById("evDisplay").textContent="—";
  document.getElementById("sideBetResults").textContent="—";
  updateUI(); updateCounts();
};

buildCardButtons();
updateUI();
updateCounts();
