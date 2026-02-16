import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

const state = {
  rc:0,
  totalDecks:6,
  cardsSeen:0,
  dealer:null,
  hand:[],
  tableCards:[],
  mode:'dealer'
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
  stateTag:document.getElementById('state-tag'),
  devTag:document.getElementById('dev-tag'),
  actionCard:document.getElementById('action-card')
};

function decksRemaining(){
  return Math.max(0.5, state.totalDecks - (state.cardsSeen/52));
}

function tcNow(){
  return getTrueCount(state.rc, decksRemaining());
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

function applyCard(rank){
  const r = normalizeRank(rank);
  state.rc += (HILO_VALUES[r]||0);
  state.cardsSeen++;

  if(state.mode==='dealer') state.dealer=r;
  else if(state.mode==='player') state.hand.push(r);
  else state.tableCards.push(r);
}

function resetHand(){
  state.dealer=null;
  state.hand=[];
  state.tableCards=[];
}

function render(){

  const tc = tcNow();
  const band = getTCBand(tc);

  el.rc.textContent = state.rc;
  el.tc.textContent = tc.toFixed(1);
  el.tcBand.textContent = band.label;
  el.tcBand.className = 'hud-band ' + band.cls;
  el.decks.textContent = decksRemaining().toFixed(1);

  el.dispDealer.textContent = state.dealer || '?';
  el.dispPlayer.textContent = state.hand.join(' ') || '--';
  el.dispTable.textContent = state.tableCards.join(' ') || '--';
  el.modeIndicator.textContent = state.mode.toUpperCase();

  if(state.dealer && state.hand.length>=2){

    const move = recommendMove(state.hand, state.dealer, tc);

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
    el.recReason.textContent='Enter dealer (G), then table (T) or player (L) cards.';
    el.actionCard.classList.remove('deviation-active');
  }
}

function handleKey(e){
  const k=e.key.toLowerCase();

  if(k==='g'){ state.mode='dealer'; render(); return; }
  if(k==='l'){ state.mode='player'; render(); return; }
  if(k==='t'){ state.mode='table'; render(); return; }

  if(k==='x'){ state.rc=0; state.cardsSeen=0; resetHand(); render(); return; }
  if(k===' '){ resetHand(); render(); return; }

  const rank = normalizeKeyToRank(k);
  if(rank){
    applyCard(rank);
    render();
  }
}

window.addEventListener('keydown', handleKey);
render();
