import { HILO_VALUES, normalizeRank, getTrueCount, getExactTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

const MYBOOKIE_RULES = Object.freeze({
  venue: 'MYBOOKIE.AG LIVE',
  decks: 6,
  dealer: 'H17',
  surrender: 'LS',
  splitAces: 'ONE_CARD_ONLY',
  wongInTc: 1
});

const state = {
  rc:0,
  totalDecks:MYBOOKIE_RULES.decks,
  cardsSeen:0,
  dealer:null,
  hand:[],
  tableCards:[],
  mode:'dealer',
  autoFlow:false,
  autoStage:'player',
  history:[],
  inputLog:[]
};

const el = {
  rc:document.getElementById('rc-val'),
  tc:document.getElementById('tc-val'),
  tcBand:document.getElementById('tc-band'),
  decks:document.getElementById('decks-left'),
  recAction:document.getElementById('rec-action'),
  recReason:document.getElementById('rec-reason'),
  dispDealer:document.getElementById('disp-dealer'),
  dispPlayer:document.getElementById('disp-player'),
  dispTable:document.getElementById('disp-table'),
  modeIndicator:document.getElementById('mode-indicator-val'),
  flowIndicator:document.getElementById('flow-indicator-val'),
  inputLog:document.getElementById('input-log'),
  edgeVal:document.getElementById('edge-val'),
  betUnits:document.getElementById('bet-units'),
  wongVal:document.getElementById('wong-val'),
  stateTag:document.getElementById('state-tag'),
  devTag:document.getElementById('dev-tag'),
  actionCard:document.getElementById('action-card')
};

const HISTORY_LIMIT = 400;
const BET_RAMP = [
  { minTc: 5, units: 8 },
  { minTc: 4, units: 6 },
  { minTc: 3, units: 4 },
  { minTc: 2, units: 2 },
  { minTc: 1, units: 1 }
];

function decksRemaining(){
  return Math.max(0.25, state.totalDecks - (state.cardsSeen/52));
}

function exactTCNow(){
  return getExactTrueCount(state.rc, decksRemaining());
}

function displayTCNow(){
  return getTrueCount(state.rc, decksRemaining());
}

function estimatePlayerEdgePct(tc){
  return Math.max(-4, Math.min(4, -0.6 + (0.5 * tc)));
}

function recommendedBetUnits(tc){
  for(const entry of BET_RAMP){
    if(tc >= entry.minTc) return entry.units;
  }
  return 0;
}

function getTCBand(tc){
  if(tc <= -2) return {label:'NEGATIVE', cls:'band-neg'};
  if(tc < 1) return {label:'NEUTRAL', cls:'band-neutral'};
  if(tc < 3) return {label:'POSITIVE', cls:'band-pos'};
  return {label:'HIGH', cls:'band-high'};
}

function normalizeKeyToRank(k){
  if(k>='2' && k<='9') return k;
  if(k==='a') return 'A';
  if(['0','j','q','k'].includes(k)) return 'T';
  return null;
}

function pushHistory(){
  state.history.push({
    rc:state.rc,
    cardsSeen:state.cardsSeen,
    dealer:state.dealer,
    hand:[...state.hand],
    tableCards:[...state.tableCards],
    mode:state.mode,
    autoFlow:state.autoFlow,
    autoStage:state.autoStage,
    inputLog:[...state.inputLog]
  });

  if(state.history.length > HISTORY_LIMIT) state.history.shift();
}

function restoreSnapshot(snap){
  state.rc = snap.rc;
  state.cardsSeen = snap.cardsSeen;
  state.dealer = snap.dealer;
  state.hand = [...snap.hand];
  state.tableCards = [...snap.tableCards];
  state.mode = snap.mode;
  state.autoFlow = snap.autoFlow;
  state.autoStage = snap.autoStage;
  state.inputLog = [...snap.inputLog];
}

function modePrefix(mode){
  if(mode==='player') return 'P';
  if(mode==='dealer') return 'D';
  return 'T';
}

function addInputLog(mode, rank){
  state.inputLog.unshift(`${modePrefix(mode)}:${rank}`);
  if(state.inputLog.length > 5) state.inputLog.pop();
}

function modeFromAutoStage(stage){
  if(stage === 'table') return 'table';
  if(stage === 'dealer') return 'dealer';
  return 'player';
}

function syncAutoMode(){
  if(!state.autoFlow) return;
  state.mode = modeFromAutoStage(state.autoStage);
}

function setMode(mode, isManual=false){
  state.mode = mode;
  if(!state.autoFlow || !isManual) return;

  if(mode === 'table') state.autoStage = 'table';
  else if(mode === 'dealer') state.autoStage = 'dealer';
  else state.autoStage = state.dealer ? 'post' : 'player';
}

function advanceAutoFlowAfterCard(){
  if(!state.autoFlow) return;

  if(state.autoStage === 'player' && state.hand.length >= 2){
    state.autoStage = 'table';
    state.mode = 'table';
    return;
  }

  if(state.autoStage === 'dealer' && state.dealer){
    state.autoStage = 'post';
    state.mode = 'player';
  }
}

function applyCard(rank){
  const r = normalizeRank(rank);
  const targetMode = state.mode;

  state.rc += (HILO_VALUES[r]||0);
  state.cardsSeen++;

  if(targetMode==='dealer') state.dealer=r;
  else if(targetMode==='player') state.hand.push(r);
  else state.tableCards.push(r);

  addInputLog(targetMode, r);
  advanceAutoFlowAfterCard();
}

function resetHand(){
  state.dealer=null;
  state.hand=[];
  state.tableCards=[];
  state.inputLog=[];
  if(state.autoFlow){
    state.autoStage='player';
    state.mode='player';
  }
}

function resetShoe(){
  state.rc=0;
  state.cardsSeen=0;
  resetHand();
}

function toggleAutoFlow(){
  state.autoFlow = !state.autoFlow;
  if(!state.autoFlow) return;

  if(state.dealer) state.autoStage='post';
  else if(state.hand.length < 2) state.autoStage='player';
  else state.autoStage='table';
  syncAutoMode();
}

function render(){

  const exactTc = exactTCNow();
  const displayTc = displayTCNow();
  const band = getTCBand(exactTc);
  const edgePct = estimatePlayerEdgePct(exactTc);
  const betUnits = recommendedBetUnits(exactTc);

  el.rc.textContent = state.rc;
  el.tc.textContent = displayTc.toFixed(1);
  el.tcBand.textContent = band.label;
  el.tcBand.className = 'hud-band ' + band.cls;
  el.decks.textContent = decksRemaining().toFixed(1);

  el.dispDealer.textContent = state.dealer || '?';
  el.dispPlayer.textContent = state.hand.join(' ') || '--';
  el.dispTable.textContent = state.tableCards.join(' ') || '--';
  el.modeIndicator.textContent = state.mode.toUpperCase();
  el.flowIndicator.textContent = state.autoFlow
    ? `AUTO (${state.autoStage.toUpperCase()})`
    : 'MANUAL';
  el.inputLog.textContent = state.inputLog.join('  ') || '--';
  el.edgeVal.textContent = `${edgePct >= 0 ? '+' : ''}${edgePct.toFixed(2)}%`;
  el.betUnits.textContent = `${betUnits}`;
  el.wongVal.textContent = exactTc >= MYBOOKIE_RULES.wongInTc ? 'PLAY' : 'WAIT';
  el.stateTag.textContent = state.autoFlow ? 'MYBOOKIE AUTO' : 'MYBOOKIE READY';

  if(state.dealer && state.hand.length>=2){

    const move = recommendMove(state.hand, state.dealer, exactTc);

    el.recAction.textContent = move.action;
    el.recReason.textContent = move.reason || '';

    if(move.deviation){
      el.actionCard.classList.add('deviation-active');
      el.devTag.textContent = 'DEVIATION';
      el.devTag.classList.remove('muted');
    } else {
      el.actionCard.classList.remove('deviation-active');
      el.devTag.textContent = 'NO DEVIATION';
      el.devTag.classList.add('muted');
    }

  } else {
    el.recAction.textContent='---';
    el.recReason.textContent='MYBOOKIE ONLY · Modes: G/L/T manual, M auto-flow, ; dealer-next, U/Backspace undo.';
    el.actionCard.classList.remove('deviation-active');
  }
}

function handleKey(e){
  if(e.repeat) return;
  const k=e.key.toLowerCase();

  if(k==='g'){ setMode('dealer', true); render(); return; }
  if(k==='l'){ setMode('player', true); render(); return; }
  if(k==='t'){ setMode('table', true); render(); return; }

  if(k==='m'){ toggleAutoFlow(); render(); return; }
  if(k===';' && state.autoFlow){
    state.autoStage='dealer';
    syncAutoMode();
    render();
    return;
  }

  if(k==='backspace' || k==='u'){
    e.preventDefault();
    const snap = state.history.pop();
    if(snap) restoreSnapshot(snap);
    render();
    return;
  }

  if(k==='x'){
    pushHistory();
    resetShoe();
    render();
    return;
  }
  if(k===' '){
    e.preventDefault();
    pushHistory();
    resetHand();
    render();
    return;
  }

  const rank = normalizeKeyToRank(k);
  if(rank){
    pushHistory();
    applyCard(rank);
    render();
  }
}

window.addEventListener('keydown', handleKey);
render();
