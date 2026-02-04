// ===== State =====
let runningCount = 0;
let decksRemaining = 6;

let tagMode = "table"; // table | player | dealer
let player = [];
let dealerUp = null;
let history = [];

const hilo = c =>
  c === "A" || c === "T" ? -1 :
  ["2","3","4","5","6"].includes(c) ? 1 : 0;

// ===== Elements =====
const rcEl = document.getElementById("rc");
const tcEl = document.getElementById("tc");
const drEl = document.getElementById("dr");
const dealerEl = document.getElementById("dealer");
const playerEl = document.getElementById("player");
const moveEl = document.getElementById("move");

// ===== Tag buttons =====
document.querySelectorAll(".tag").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tag").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    tagMode = btn.dataset.tag;
  };
});

// ===== Card buttons =====
document.querySelectorAll("[data-card]").forEach(btn => {
  btn.onclick = () => logCard(btn.dataset.card);
});

// ===== Controls =====
document.getElementById("newRound").onclick = () => {
  player = [];
  dealerUp = null;
  history = [];
  render();
};

document.getElementById("newShoe").onclick = () => {
  runningCount = 0;
  decksRemaining = 6;
  player = [];
  dealerUp = null;
  history = [];
  render();
};

document.getElementById("undo").onclick = () => {
  const last = history.pop();
  if (!last) return;

  runningCount -= last.delta;
  if (last.tag === "player") player.pop();
  if (last.tag === "dealer") dealerUp = null;
  render();
};

// ===== Core =====
function logCard(card) {
  const delta = hilo(card);
  runningCount += delta;

  history.push({ card, tag: tagMode, delta });

  if (tagMode === "player") player.push(card);
  if (tagMode === "dealer") dealerUp = card;

  render();
}

function render() {
  const tc = runningCount / Math.max(0.25, decksRemaining);

  rcEl.textContent = runningCount;
  tcEl.textContent = tc.toFixed(1);
  drEl.textContent = decksRemaining.toFixed(1);

  dealerEl.textContent = dealerUp ?? "—";
  playerEl.textContent = player.join(" ") || "—";

  moveEl.textContent = getMove();
}

// ===== Strategy (6D H17 LS simplified) =====
function getMove() {
  if (!dealerUp || player.length < 2) return "—";

  const vals = player.map(c => c === "A" ? 11 : c === "T" ? 10 : +c);
  let total = vals.reduce((a,b)=>a+b,0);
  if (total > 21 && vals.includes(11)) total -= 10;

  if (total === 16 && ["9","T","A"].includes(dealerUp)) return "SURRENDER";
  if (total === 15 && ["T","A"].includes(dealerUp)) return "SURRENDER";
  if (total >= 17) return "STAND";
  if (total <= 11) return "HIT";
  if (total >= 12 && ["4","5","6"].includes(dealerUp)) return "STAND";

  return "HIT";
}

// Initial render
render();
