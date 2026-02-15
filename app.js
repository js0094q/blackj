import { HILO_VALUES, normalizeRank, getTrueCount } from './count.js';
import { recommendMove } from './strategy-h17-ls.js';

const ACTION_KEYS = {
  h:'HIT', s:'STAND', d:'DOUBLE',
  p:'SPLIT', r:'SURRENDER', i:'INSURE'
};

let session = { hands:0, correct:0, streak:0, log:[] };

let state = {
  rc:0, totalDecks:6, cardsSeen:0,
  dealer:null, hand:[], tableCards:[],
  mode:'dealer', autoNext:true, answered:false
};

const el = {
  rc:document.getElementById('rc-val'),
  tc:document.getElementById('tc-val'),
  decks:document.getElementById('decks-left'),
  recAction:document.getElementById('rec-action'),
  recReason:document.getElementById('rec-reason'),
  dispDealer:document.getElementById('disp-dealer'),
  dispPlayer:document.getElementById('disp-player'),
  dispTable:document.getElementById('disp-table'),
  modeIndicator:document.getElementById('mode-indicator-val'),
  mHands:document.getElementById('m-hands'),
  mCorrect:document.getElementById('m-correct'),
  mAcc:document.getElementById('m-acc'),
  mStreak:document.getElementById('m-streak'),
  overlay:document.getElementById('overlay'),
  ovLog:document.getElementById('ov-log'),
  openOverlay:document.getElementById('open-overlay'),
  closeOverlay:document.getElementById('close-overlay')
};

function decksRemaining(){return Math.max(.5,state.totalDecks-(state.cardsSeen/52));}
function tcNow(){return getTrueCount(state.rc,decksRemaining());}

function resetHand(){
  state.dealer=null;
  state.hand=[];
  state.tableCards=[];
  state.answered=false;
  state.mode='dealer';
}

function render(){
  el.rc.textContent=state.rc;
  el.tc.textContent=tcNow().toFixed(1);
  el.decks.textContent=decksRemaining().toFixed(1);
  el.dispDealer.textContent=state.dealer||'?';
  el.dispPlayer.textContent=state.hand.join(' ')||'--';
  el.dispTable.textContent=state.tableCards.join(' ')||'--';
  el.modeIndicator.textContent=state.mode.toUpperCase();

  if(state.dealer&&state.hand.length>=2){
    const move=recommendMove(state.hand,state.dealer,tcNow());
    el.recAction.textContent=move.action;
    el.recReason.textContent=move.reason;
  }else{
    el.recAction.textContent='---';
  }

  el.mHands.textContent=session.hands;
  el.mCorrect.textContent=session.correct;
  el.mAcc.textContent=session.hands?((session.correct/session.hands)*100).toFixed(1)+'%':'0.0%';
  el.mStreak.textContent=session.streak;
}

function processCard(raw){
  const rank=normalizeRank(raw);
  state.rc+=(HILO_VALUES[rank]||0);
  state.cardsSeen++;

  if(state.mode==='dealer') state.dealer=rank;
  else if(state.mode==='player') state.hand.push(rank);
  else state.tableCards.push(rank);

  render();
}

function commit(action){
  if(!state.dealer||state.hand.length<2||state.answered)return;
  const move=recommendMove(state.hand,state.dealer,tcNow());
  state.answered=true;
  const ok=action===move.action;

  session.hands++;
  if(ok){session.correct++;session.streak++;}
  else session.streak=0;

  session.log.unshift({up:state.dealer,hand:state.hand.join(' '),rec:move.action,did:action,ok});

  if(state.autoNext)resetHand();
  render();
}

function handleKey(e){
  const k=e.key.toLowerCase();
  if(k==='g')state.mode='dealer';
  if(k==='l')state.mode='player';
  if(k==='t')state.mode='table';
  if(k>='2'&&k<='9')processCard(k);
  if(k==='a')processCard('A');
  if(['0','t','j','q','k'].includes(k))processCard('T');
  if(ACTION_KEYS[k])commit(ACTION_KEYS[k]);
  if(k===' ')resetHand();
  if(k==='o')el.overlay.classList.add('show');
  if(k==='escape')el.overlay.classList.remove('show');
  render();
}

window.addEventListener('keydown',handleKey);
render();
