document.addEventListener("DOMContentLoaded", () => {
  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const hiLo = {2:1,3:1,4:1,5:1,6:1,7:0,8:0,9:0,10:-1,J:-1,Q:-1,K:-1,A:-1};
  const TOTAL_DECKS = 6;

  let seats = [];
  let dealerUpcard = null;
  let shoe = buildShoe();
  let cardHistory = [];
  let historyArr = JSON.parse(localStorage.getItem("bjHistory")) || [];

  function buildShoe() {
    const counts = {};
    RANKS.forEach(r => counts[r] = 4 * TOTAL_DECKS);
    return counts;
  }

  function saveHistory() {
    localStorage.setItem("bjHistory", JSON.stringify(historyArr));
  }

  function buildCardButtons() {
    const container = document.getElementById("cardButtons");
    container.innerHTML = "";
    RANKS.forEach(rank => {
      const btn = document.createElement("button");
      btn.textContent = rank;
      btn.onclick = () => recordCard(rank);
      container.appendChild(btn);
    });
  }

  function updateUI() {
    const seatDiv = document.getElementById("seats");
    seatDiv.innerHTML = "";
    seats.forEach((hand, i) => {
      const div = document.createElement("div");
      div.className = "seat";
      if (i === 0) div.classList.add("mySeat");
      div.textContent = `${i === 0 ? "You" : "Player " + i}: ${hand.join(", ") || "—"}`;
      seatDiv.appendChild(div);
    });
    document.getElementById("dealerCard").textContent = dealerUpcard || "—";
  }

  function renderHistory() {
    const ul = document.getElementById("historyList");
    ul.innerHTML = "";
    historyArr.slice(-20).reverse().forEach(h => {
      const li = document.createElement("li");
      li.textContent = `${h.time} — ${h.yourHand.join(", ")} vs ${h.dealer} : ${h.advice}`;
      ul.appendChild(li);
    });
  }

  function updateCounts() {
    let count = 0, remaining = 0;
    for (let r in shoe) {
      count += (hiLo[r] || 0) * ((4 * TOTAL_DECKS) - shoe[r]);
      remaining += shoe[r];
    }
    document.getElementById("runningCount").textContent = count;
    document.getElementById("trueCount").textContent = remaining ? (count / (remaining / 52)).toFixed(2) : 0;
  }

  function recordCard(rank) {
    if (shoe[rank] <= 0) return alert(`No more ${rank} in shoe.`);
    for (let i = 0; i < seats.length; i++) {
      if (seats[i].length < 2) {
        seats[i].push(rank);
        shoe[rank]--;
        cardHistory.push({ seat: i, rank });
        updateUI(); updateCounts();
        return;
      }
    }
    if (!dealerUpcard) {
      dealerUpcard = rank;
      shoe[rank]--;
      cardHistory.push({ seat: "dealer", rank });
      updateUI(); updateCounts();
      return;
    }
    alert("All seats & dealer upcard filled.");
  }

  document.getElementById("undo").onclick = () => {
    if (!cardHistory.length) return;
    const last = cardHistory.pop();
    shoe[last.rank]++;
    if (last.seat === "dealer") dealerUpcard = null;
    else seats[last.seat].pop();
    updateUI(); updateCounts();
  };

  document.getElementById("addSeat").onclick = () => {
    seats.push([]);
    updateUI();
  };

  document.getElementById("removeSeat").onclick = () => {
    if (!seats.length) return;
    const rem = seats.pop();
    rem.forEach(c => shoe[c]++);
    updateUI(); updateCounts();
  };

  function handValue(cards) {
    let total = 0, aces = 0;
    cards.forEach(c => {
      if (["J","Q","K"].includes(c)) total += 10;
      else if (c === "A") { total += 11; aces++; }
      else total += parseInt(c);
    });
    while (total > 21 && aces) { total -= 10; aces--; }
    return total;
  }

  function basicStrategy(hand, dealer) {
    const total = handValue(hand);
    const up = dealer === "A" ? 11 : (["J","Q","K"].includes(dealer) ? 10 : parseInt(dealer));
    const isPair = hand[0] === hand[1];
    const isSoft = hand.includes("A") && total <= 21 && !["10","J","Q","K"].includes(hand[0]);
    if (isPair) {
      if (hand[0]==="A"||hand[0]==="8") return "Split";
      if (["10","J","Q","K"].includes(hand[0])) return "Stand";
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

  function sideBetResults(hand, dealerUp) {
    const res = [];
    if (hand[0]===hand[1]) res.push("PAIR (11:1)");
    const rset = [...hand,dealerUp].sort((a,b)=>RANKS.indexOf(a)-RANKS.indexOf(b));
    const straight = (RANKS.indexOf(rset[1])===RANKS.indexOf(rset[0])+1 &&
                      RANKS.indexOf(rset[2])===RANKS.indexOf(rset[1])+1);
    if (straight) res.push("RUMMY (9:1)");
    if (hand[0]==="7"&&hand[1]==="7"&&dealerUp==="7") res.push("JACKPOT 777");
    return res.length? res.join(", "): "—";
  }

  function buildFullShoe(visible) {
    const deck = [], suits=["H","D","C","S"];
    for(let d=0; d<TOTAL_DECKS; d++) RANKS.forEach(r=>suits.forEach(s=>deck.push(r)));
    visible.forEach(v=>{ const i=deck.indexOf(v); if(i!==-1) deck.splice(i,1); });
    return deck;
  }

  function simulateDealer(up,hole,deck) {
    const hand=[up,hole]; let tot=handValue(hand);
    while(tot<17 || (tot===17 && hand.includes("A"))) {
      if(!deck.length) break;
      hand.push(deck.splice(Math.floor(Math.random()*deck.length),1)[0]);
      tot=handValue(hand);
    }
    return tot;
  }

  function monteCarloOdds(playerHand,upcard,visible,trials=2000) {
    const base = buildFullShoe(visible), counts={win:0,push:0,loss:0};
    for(let i=0;i<trials;i++){
      const deck=base.slice();
      const holeIdx=Math.floor(Math.random()*deck.length);
      const hole=deck.splice(holeIdx,1)[0];
      const dTot=simulateDealer(upcard,hole,deck), pTot=handValue(playerHand);
      if(pTot>21) counts.loss++;
      else if(dTot>21) counts.win++;
      else if(pTot>dTot) counts.win++;
      else if(pTot<dTot) counts.loss++;
      else counts.push++;
    }
    return counts;
  }

  document.getElementById("evaluate").onclick = ()=>{
    if(!seats.length|| seats[0].length<2||!dealerUpcard) return alert("Add your 2 cards and dealer upcard.");
    const yourHand=seats[0];
    const advice=basicStrategy(yourHand,dealerUpcard);
    document.getElementById("strategy").textContent = advice;

    const visible=[...yourHand,dealerUpcard]; seats.slice(1).forEach(h=>visible.push(...h));
    const odds=monteCarloOdds(yourHand,dealerUpcard,visible);
    const tot=odds.win+odds.push+odds.loss;
    document.getElementById("winPct").textContent=((odds.win/tot)*100).toFixed(1);
    document.getElementById("pushPct").textContent=((odds.push/tot)*100).toFixed(1);
    document.getElementById("lossPct").textContent=((odds.loss/tot)*100).toFixed(1);
    document.getElementById("evDisplay").textContent=((odds.win-odds.loss)/tot).toFixed(3);
    document.getElementById("sideBetResults").textContent=sideBetResults(yourHand,dealerUpcard);

    historyArr.push({time:new Date().toLocaleTimeString(),yourHand,dealer:dealerUpcard,advice});
    saveHistory(); renderHistory();
  };

  document.getElementById("resetHand").onclick = resetHandHandler;
  document.getElementById("clearTable").onclick = clearTableHandler;
  document.getElementById("newShoe").onclick = clearTableHandler;
});
