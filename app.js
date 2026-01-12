document.addEventListener("DOMContentLoaded", () => {
  console.log("Blackjack Trainer Loaded");

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};
  const TOTAL_DECKS = 6;

  let seats = [];
  let dealerUpcard = null;
  let shoe = buildShoe();
  let cardHistory = [];
  let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

  // Build initial UI
  buildCardButtons();
  updateUI();
  updateCounts();
  renderHistory();

  // == Helpers ==
  function buildShoe(){
    const counts = {};
    RANKS.forEach(r => counts[r] = 4 * TOTAL_DECKS);
    return counts;
  }

  function saveHistory(){
    localStorage.setItem("bjHistory", JSON.stringify(historyArr));
  }

  // == UI Construction ==
  function buildCardButtons(){
    const container = document.getElementById("cardButtons");
    container.innerHTML = "";
    RANKS.forEach(rank => {
      const btn = document.createElement("button");
      btn.textContent = rank;
      btn.onclick = () => recordCard(rank);
      container.appendChild(btn);
    });
  }

  function updateUI(){
    const seatDiv = document.getElementById("seats");
    seatDiv.innerHTML = "";
    seats.forEach((h, i) => {
      const el = document.createElement("div");
      el.className = "seat";
      if(i === 0) el.classList.add("mySeat");
      el.textContent = `${i === 0 ? "You" : "Player " + i}: ${h.join(", ") || "—"}`;
      seatDiv.appendChild(el);
    });
    document.getElementById("dealerCard").textContent = dealerUpcard || "—";
  }

  function renderHistory(){
    const ul = document.getElementById("historyList");
    ul.innerHTML = "";
    historyArr.slice(-20).reverse().forEach(h => {
      const li = document.createElement("li");
      li.textContent = `${h.time} — ${h.yourHand.join(", ")} vs ${h.dealer} : ${h.advice}`;
      ul.appendChild(li);
    });
  }

  // == Recording Cards ==
  function recordCard(rank){
    if (shoe[rank] <= 0) return alert(`No more ${rank} in shoe.`);
    for(let i=0;i<seats.length;i++){
      if(seats[i].length < 2){
        seats[i].push(rank);
        shoe[rank]--;
        cardHistory.push({seat:i,rank});
        updateUI(); updateCounts();
        return;
      }
    }
    if (!dealerUpcard){
      dealerUpcard = rank;
      shoe[rank]--;
      cardHistory.push({seat:"dealer",rank});
      updateUI(); updateCounts();
      return;
    }
    alert("All player seats + dealer upcard filled.");
  }

  // == Undo ==
  document.getElementById("undo").onclick = () => {
    if (!cardHistory.length) return;
    const last = cardHistory.pop();
    shoe[last.rank]++;
    if (last.seat === "dealer") dealerUpcard = null;
    else seats[last.seat].pop();
    updateUI(); updateCounts();
  };

  // == Seat Management ==
  document.getElementById("addSeat").onclick = () => {
    seats.push([]);
    updateUI();
  };
  document.getElementById("removeSeat").onclick = () => {
    if (!seats.length) return;
    const removed = seats.pop();
    removed.forEach(c => shoe[c]++);
    updateUI(); updateCounts();
  };

  // == Count & True Count ==
  function updateCounts(){
    let count = 0, remaining=0;
    for(let r in shoe){
      count += (hiLo[r]||0)*((4*TOTAL_DECKS) - shoe[r]);
      remaining += shoe[r];
    }
    document.getElementById("runningCount").textContent = count;
    document.getElementById("trueCount").textContent = remaining ? (count/(remaining/52)).toFixed(2) : 0;
  }

  // == Hand Value & Strategy ==
  function handValue(cards){
    let total=0, aces=0;
    cards.forEach(c => {
      if (["J","Q","K"].includes(c)) total+=10;
      else if(c==="A"){ total+=11; aces++; }
      else total+=parseInt(c);
    });
    while(total>21 && aces){ total-=10; aces--; }
    return total;
  }

  function basicStrategy(hand,dealer){
    const tot = handValue(hand);
    const upVal = dealer==="A"?11:(["J","Q","K"].includes(dealer)?10:parseInt(dealer));
    const isPair=hand[0]===hand[1], isSoft=hand.includes("A") && tot<=21 && !["10","J","Q","K"].includes(hand[0]);
    if(isPair){
      if(hand[0]==="A"||hand[0]==="8") return "Split";
      if(["10","J","Q","K"].includes(hand[0])) return "Stand";
    }
    if(isSoft){
      if(tot>=19) return "Stand";
      if(tot===18){
        if(upVal>=3&&upVal<=6) return "Double";
        if(upVal>=9) return "Hit";
        return "Stand";
      }
      return "Hit";
    }
    if(tot>=17) return "Stand";
    if(tot>=13&&upVal<=6) return "Stand";
    if(tot===12&&upVal>=4&&upVal<=6) return "Stand";
    if(tot===11) return "Double";
    if(tot===10&&upVal<=9) return "Double";
    if(tot===9&&upVal>=3&&upVal<=6) return "Double";
    return "Hit";
  }

  function sideBetResults(hand,dealerUp){
    const res=[];
    if(hand[0]===hand[1]) res.push("PAIR (11:1)");
    const rSet=[...hand,dealerUp].sort((a,b)=>RANKS.indexOf(a)-RANKS.indexOf(b));
    const isStr=(RANKS.indexOf(rSet[1])===RANKS.indexOf(rSet[0])+1 &&
                 RANKS.indexOf(rSet[2])===RANKS.indexOf(rSet[1])+1);
    if(isStr) res.push("RUMMY (9:1)");
    if(hand[0]==="7"&&hand[1]==="7"&&dealerUp==="7") res.push("JACKPOT 777");
    return res.length?res.join(", "):"—";
  }

  function monteCarloOdds(playerHand,upcard,visible,trials=2000){
    const base=buildFullShoe(visible), counts={win:0,push:0,loss:0};
    for(let t=0;t<trials;t++){
      const deck=base.slice();
      const holeIdx=Math.floor(Math.random()*deck.length);
      const hole=deck.splice(holeIdx,1)[0];
      const dTot = simulateDealer(upcard,hole,deck), pTot=handValue(playerHand);
      if(pTot>21) counts.loss++;
      else if(dTot>21) counts.win++;
      else if(pTot>dTot) counts.win++;
      else if(pTot<dTot) counts.loss++;
      else counts.push++;
    }
    return counts;
  }

  function buildFullShoe(visible){
    const deck=[], suits=["H","D","C","S"];
    for(let d=0; d<TOTAL_DECKS; d++) RANKS.forEach(r=>suits.forEach(s=>deck.push(r)));
    visible.forEach(v=>{
      const i=deck.indexOf(v); if(i!==-1) deck.splice(i,1);
    });
    return deck;
  }

  function simulateDealer(up,hole,deck){
    const hand=[up,hole]; let total=handValue(hand);
    while(total<17 || (total===17 && hand.includes("A"))){
      if(!deck.length) break;
      const idx=Math.floor(Math.random()*deck.length);
      hand.push(deck.splice(idx,1)[0]);
      total=handValue(hand);
    }
    return total;
  }

  // == Evaluate ==
  document.getElementById("evaluate").onclick = ()=>{
    if(!seats.length || seats[0].length<2 || !dealerUpcard) return alert("Add your two cards + dealer upcard.");
    const yourHand=seats[0];
    const strat=basicStrategy(yourHand,dealerUpcard);
    document.getElementById("strategy").textContent=strat;

    const visible=[...yourHand,dealerUpcard]; seats.slice(1).forEach(h=>visible.push(...h));
    const odds=monteCarloOdds(yourHand,dealerUpcard,visible);
    const total=odds.win+odds.push+odds.loss;

    document.getElementById("winPct").textContent=((odds.win/total)*100).toFixed(1);
    document.getElementById("pushPct").textContent=((odds.push/total)*100).toFixed(1);
    document.getElementById("lossPct").textContent=((odds.loss/total)*100).toFixed(1);
    document.getElementById("evDisplay").textContent=((odds.win-odds.loss)/total).toFixed(3);
    document.getElementById("sideBetResults").textContent=sideBetResults(yourHand,dealerUpcard);

    historyArr.push({time:new Date().toLocaleTimeString(),yourHand,dealer:dealerUpcard,strat});
    saveHistory(); renderHistory();
  };

  // == Reset Hand ==
  document.getElementById("resetHand").onclick = ()=>{
    seats.flat().forEach(c=>shoe[c]++);
    if(dealerUpcard) shoe[dealerUpcard]++;
    seats = Array.from({length:seats.length},()=>[]);
    dealerUpcard=null;
    cardHistory=[];

    ["strategy","winPct","pushPct","lossPct","evDisplay","sideBetResults"].forEach(id=>document.getElementById(id).textContent="—");
    updateUI(); updateCounts();
  };

  // == Clear Table ==
  document.getElementById("clearTable").onclick = ()=>{
    seats=[]; dealerUpcard=null; shoe=buildShoe(); cardHistory=[]; historyArr=[];
    localStorage.removeItem("bjHistory");
    renderHistory();

    ["strategy","winPct","pushPct","lossPct","evDisplay","sideBetResults"].forEach(id=>document.getElementById(id).textContent="—");
    updateUI(); updateCounts();
  };

  // == New Shoe ==
  document.getElementById("newShoe").onclick = ()=>{
    seats=[]; dealerUpcard=null; shoe=buildShoe(); cardHistory=[]; historyArr=[];
    localStorage.removeItem("bjHistory");
    renderHistory();

    ["strategy","winPct","pushPct","lossPct","evDisplay","sideBetResults"].forEach(id=>document.getElementById(id).textContent="—");
    updateUI(); updateCounts();
  };
});
