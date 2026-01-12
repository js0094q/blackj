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
 INIT
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
 SHOE BUILDER
*************************/
function buildShoe(visible) {
  // 6 decks
  const shoe = [];
  const suits = ["H","D","C","S"]; // suit is irrelevant for value, but counts
  for (let d = 0; d < 6; d++) {
    RANKS.forEach(r => {
      suits.forEach(s => shoe.push(r));
    });
  }
  // remove visible cards
  visible.forEach(vc => {
    const idx = shoe.indexOf(vc);
    if (idx !== -1) shoe.splice(idx, 1);
  });
  return shoe;
}

/*************************
 DEALER PLAY (RULES)
*************************/
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

function isSoft(hand) {
  return hand.includes("A") && handValue(hand) <= 21;
}

function simulateDealerPlay(upcard, hole, shoe) {
  const hand = [upcard, hole];
  let total = handValue(hand);
  const deck = shoe.slice();

  while (total < 17 || (total === 17 && isSoft(hand))) {
    if (deck.length === 0) break;
    const idx = Math.floor(Math.random() * deck.length);
    const draw = deck.splice(idx, 1)[0];
    hand.push(draw);
    total = handValue(hand);
  }
  return total;
}

/*************************
 MONTE CARLO SIMULATION
*************************/
function monteCarloDealer(yourHand, dealerUp, visible, trials = 10000) {
  const shoeTemplate = buildShoe(visible);
  const results = { win: 0, push: 0, loss: 0 };

  for (let t = 0; t < trials; t++) {
    const shoe = shoeTemplate.slice();
    const holeIdx = Math.floor(Math.random() * shoe.length);
    const hole = shoe.splice(holeIdx, 1)[0];
    const dealerFinal = simulateDealerPlay(dealerUp, hole, shoe);

    const playerVal = handValue(yourHand);

    if (playerVal > 21) results.loss++;
    else if (dealerFinal > 21) results.win++;
    else if (playerVal > dealerFinal) results.win++;
    else if (playerVal < dealerFinal) results.loss++;
    else results.push++;
  }
  return results;
}

function confidenceInterval(p, n, z = 1.96) {
  const se = Math.sqrt((p*(1-p))/n);
  return z * se;
}

/*************************
 EVALUATE HAND
*************************/
document.getElementById("evaluate").onclick = () => {
  const p1 = document.getElementById("p1").value;
  const p2 = document.getElementById("p2").value;
  const up = document.getElementById("dealerUp").value;

  const otherText = document.getElementById("others")?.value.trim() || "";
  const others = otherText ? otherText.split(",").map(x => x.trim()) : [];

  const visibleCards = [p1, p2, up, ...others];

  runningCount = 0; remainingCards = 312;
  visibleCards.forEach(c => { runningCount += hiLo[c] || 0; remainingCards--; });

  document.getElementById("yourCards").textContent = `${p1}, ${p2}`;
  document.getElementById("dealerCard").textContent = up;
  document.getElementById("rc").textContent = runningCount;
  document.getElementById("tc").textContent = ((runningCount)/(remainingCards/52)).toFixed(2);

  const yourHand = [p1, p2];
  const baseAdvice = basicStrategy(yourHand, up);
  document.getElementById("advice").textContent = baseAdvice;

  // Run Monte Carlo
  const trials = 10000;
  const sim = monteCarloDealer(yourHand, up, visibleCards, trials);

  const pWin = sim.win / trials;
  const pPush = sim.push / trials;
  const pLoss = sim.loss / trials;

  const ciWin = confidenceInterval(pWin, trials).toFixed(3);
  const ciPush = confidenceInterval(pPush, trials).toFixed(3);
  const ciLoss = confidenceInterval(pLoss, trials).toFixed(3);

  document.getElementById("explanation").textContent =
    `Win: ${(pWin*100).toFixed(1)}% ± ${(ciWin*100).toFixed(1)}%, ` +
    `Push: ${(pPush*100).toFixed(1)}% ± ${(ciPush*100).toFixed(1)}%, ` +
    `Loss: ${(pLoss*100).toFixed(1)}% ± ${(ciLoss*100).toFixed(1)}%`;

  buildStrategyTables();
  highlightStrategy(yourHand, up);

  historyArr.push({
    time: new Date().toLocaleTimeString(),
    player: yourHand,
    dealer: up,
    advice: baseAdvice,
    trueCount: ((runningCount)/(remainingCards/52)).toFixed(2),
    pWin: (pWin*100).toFixed(1),
    pPush: (pPush*100).toFixed(1),
    pLoss: (pLoss*100).toFixed(1)
  });
  localStorage.setItem("bjHistory", JSON.stringify(historyArr));
  renderHistory();
  updateCharts();
};
