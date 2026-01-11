const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};

let runningCount = 0;
let remainingCards = 312;

function populate() {
  ["p1","p2","dealer"].forEach(id=>{
    const sel=document.getElementById(id);
    RANKS.forEach(r=>{
      const o=document.createElement("option");
      o.value=r;o.textContent=r;
      sel.appendChild(o);
    });
  });
}

function handValue(hand){
  let total=0, aces=0;
  hand.forEach(c=>{
    if(["J","Q","K","10"].includes(c)) total+=10;
    else if(c==="A"){total+=11;aces++;}
    else total+=parseInt(c);
  });
  while(total>21 && aces){total-=10;aces--;}
  return total;
}

function trueCount(){
  return (runningCount / (remainingCards/52)).toFixed(2);
}

function cardValue(c){
  if(["J","Q","K"].includes(c)) return 10;
  if(c==="A") return 11;
  return parseInt(c);
}

function basicStrategy(player,dealer){
  const total=handValue(player);
  const up=cardValue(dealer);
  const isPair = player[0]===player[1];
  const isSoft = player.includes("A") && total<=21;

  // Pairs
  if(isPair){
    if(player[0]==="A"||player[0]==="8") return "Split";
    if(["10","J","Q","K"].includes(player[0])) return "Stand";
  }

  // Soft hands
  if(isSoft){
    if(total>=19) return "Stand";
    if(total===18){
      if(up>=3 && up<=6) return "Double";
      if(up>=9) return "Hit";
      return "Stand";
    }
    return "Hit";
  }

  // Hard hands
  if(total>=17) return "Stand";
  if(total>=13 && up<=6) return "Stand";
  if(total===12 && up>=4 && up<=6) return "Stand";
  if(total===11) return "Double";
  if(total===10 && up<=9) return "Double";
  if(total===9 && up>=3 && up<=6) return "Double";
  return "Hit";
}

function deviation(advice, tc){
  if(advice==="Stand" && tc>=3) return "Stand (High count favors standing)";
  if(advice==="Hit" && tc<=-1) return "Hit (Low count, fewer tens left)";
  return advice;
}

document.getElementById("start").onclick = ()=>{
  runningCount=0;
  remainingCards=312;

  const p1=document.getElementById("p1").value;
  const p2=document.getElementById("p2").value;
  const dealer=document.getElementById("dealer").value;
  const others=document.getElementById("others").value.split(",").map(c=>c.trim()).filter(Boolean);

  const all=[p1,p2,dealer,...others];
  all.forEach(c=>{
    runningCount+=hiLo[c];
    remainingCards--;
  });

  const player=[p1,p2];
  let advice=basicStrategy(player,dealer);
  const tc=parseFloat(trueCount());
  advice=deviation(advice,tc);

  document.getElementById("yourCards").textContent=player.join(", ");
  document.getElementById("dealerCard").textContent=dealer;
  document.getElementById("rc").textContent=runningCount;
  document.getElementById("tc").textContent=tc;
  document.getElementById("advice").textContent=advice;
  document.getElementById("explain").textContent =
    `Count includes your cards, dealer card, and all other visible player cards.`;
};

window.onload=populate;
