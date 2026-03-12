(function () {
  "use strict";

  const Engine = window.BJEngine || {};

  const REQUIRED_EXPORTS = [
    "rules",
    "actions",
    "countSystems",
    "indexSets",
    "normalizeRank",
    "resolveRules",
    "createShoe",
    "consumeCardFromShoe",
    "drawCardFromShoe",
    "weightFor",
    "trueCountState",
    "edgeEstimate",
    "betUnits",
    "handValue",
    "describeHand",
    "recommendPlay",
    "canHit",
    "canDouble",
    "canSplit",
    "canSurrender",
    "canTakeInsurance",
    "shouldDealerHit",
    "settleHand",
    "isBlackjack"
  ];

  const HISTORY_LIMIT = 160;
  const TAP_DEBOUNCE_MS = 25;
  const PREFS_KEY = "blackj_v3_prefs";

  for (const key of REQUIRED_EXPORTS) {
    if (!Engine[key]) {
      console.error(`BLACKJ boot failed. Missing engine export: ${key}`);
      return;
    }
  }

  function createHand(overrides) {
    return Object.assign({
      cards: [],
      fromSplit: false,
      splitFromAces: false,
      stood: false,
      doubled: false,
      surrendered: false,
      completed: false,
      busted: false,
      result: "",
      resultDetail: "",
      netUnits: 0
    }, overrides || {});
  }

  function createUserSeat(index) {
    return {
      id: `player-${index}`,
      label: `User Seat ${index}`,
      subtitle: index === 1 ? "Primary recommendation seat" : "Secondary recommendation seat",
      active: index === 1,
      hands: [createHand()],
      splitCount: 0,
      activeHandIndex: 0,
      insuranceTaken: false,
      insurancePromptDone: false,
      surrenderPromptDone: false,
      insuranceResult: "",
      netUnits: 0,
      openingCards: []
    };
  }

  function createTableSeat(index) {
    return {
      id: `table-${index}`,
      label: `Table Seat ${index}`,
      occupied: false,
      cards: []
    };
  }

  function defaultPrefs() {
    return {
      countSystem: "hilo",
      tcMode: "auto",
      manualDecksRemaining: 3,
      bankrollUnits: 100,
      maxKelly: 0.25,
      aceSideEnabled: false,
      totalSeats: 7,
      userSeatCount: 1,
      surrenderEnabled: true,
      pairsEnabled: false,
      rummyEnabled: false,
      indexSet: "illustrious18_fab4"
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sanitizePrefs(rawPrefs) {
    const prefs = Object.assign({}, defaultPrefs(), rawPrefs || {});
    prefs.countSystem = Engine.countSystems[prefs.countSystem] ? prefs.countSystem : "hilo";
    prefs.indexSet = Engine.indexSets[prefs.indexSet] ? prefs.indexSet : "illustrious18_fab4";
    prefs.tcMode = prefs.tcMode === "manual" ? "manual" : "auto";
    prefs.manualDecksRemaining = clamp(Number(prefs.manualDecksRemaining) || 3, 0.25, Engine.rules.decks);
    prefs.bankrollUnits = Math.max(10, Number(prefs.bankrollUnits) || 100);
    prefs.maxKelly = clamp(Number(prefs.maxKelly) || 0.25, 0.01, 1);
    prefs.totalSeats = clamp(Math.round(Number(prefs.totalSeats) || 7), 1, 7);
    prefs.userSeatCount = clamp(Math.round(Number(prefs.userSeatCount) || 1), 1, 2);
    if (prefs.userSeatCount > prefs.totalSeats) prefs.totalSeats = prefs.userSeatCount;
    prefs.aceSideEnabled = prefs.countSystem === "hiopt2" && !!prefs.aceSideEnabled;
    prefs.surrenderEnabled = !!prefs.surrenderEnabled;
    prefs.pairsEnabled = !!prefs.pairsEnabled;
    prefs.rummyEnabled = !!prefs.rummyEnabled;
    return prefs;
  }

  function safeStorage() {
    try {
      const probe = "__blackj_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (_) {
      return window.sessionStorage;
    }
  }

  function loadPrefs() {
    try {
      const raw = safeStorage().getItem(PREFS_KEY);
      if (!raw) return defaultPrefs();
      return sanitizePrefs(JSON.parse(raw));
    } catch (_) {
      return defaultPrefs();
    }
  }

  function buildRules() {
    return Engine.resolveRules({
      surrender: state.prefs.surrenderEnabled ? "late" : "none"
    });
  }

  function resetUserSeatRound(seat, active) {
    seat.active = !!active;
    seat.hands = [createHand()];
    seat.splitCount = 0;
    seat.activeHandIndex = 0;
    seat.insuranceTaken = false;
    seat.insurancePromptDone = false;
    seat.surrenderPromptDone = false;
    seat.insuranceResult = "";
    seat.netUnits = 0;
    seat.openingCards = [];
  }

  function resetTableSeatRound(seat, occupied) {
    seat.occupied = !!occupied;
    seat.cards = [];
  }

  function applySeatTopology(targetState, resetRoundData) {
    const totalSeats = clamp(Math.round(Number(targetState.prefs.totalSeats) || 7), 1, 7);
    const userSeatCount = clamp(Math.round(Number(targetState.prefs.userSeatCount) || 1), 1, 2);
    const adjustedTotalSeats = Math.max(totalSeats, userSeatCount);
    targetState.tableConfig = {
      totalSeats: adjustedTotalSeats,
      userSeatCount
    };
    targetState.prefs.totalSeats = adjustedTotalSeats;
    targetState.prefs.userSeatCount = userSeatCount;

    if (!Array.isArray(targetState.playerSeats) || targetState.playerSeats.length !== 2) {
      targetState.playerSeats = [createUserSeat(1), createUserSeat(2)];
    }

    if (!Array.isArray(targetState.tableSeats) || targetState.tableSeats.length !== 7) {
      targetState.tableSeats = [];
      for (let index = 1; index <= 7; index += 1) {
        targetState.tableSeats.push(createTableSeat(index));
      }
    }

    targetState.playerSeats.forEach((seat, index) => {
      seat.id = `player-${index + 1}`;
      seat.label = `User Seat ${index + 1}`;
      seat.subtitle = index === 0 ? "Primary recommendation seat" : "Secondary recommendation seat";
      if (resetRoundData || !seat.active || index >= userSeatCount) {
        resetUserSeatRound(seat, index < userSeatCount);
      } else {
        seat.active = index < userSeatCount;
      }
    });

    const observedSeatCount = adjustedTotalSeats - userSeatCount;
    targetState.tableSeats.forEach((seat, index) => {
      seat.id = `table-${index + 1}`;
      seat.label = `Table Seat ${index + 1}`;
      if (resetRoundData || !seat.occupied || index >= observedSeatCount) {
        resetTableSeatRound(seat, index < observedSeatCount);
      } else {
        seat.occupied = index < observedSeatCount;
      }
    });
  }

  function createState() {
    const prefs = loadPrefs();
    const fresh = {
      prefs,
      handNumber: 1,
      phase: "idle",
      promptStage: "none",
      activeTargetId: "player-1",
      dealerHand: {
        cards: [],
        revealed: false
      },
      playerSeats: [createUserSeat(1), createUserSeat(2)],
      tableSeats: [],
      tableConfig: {
        totalSeats: prefs.totalSeats,
        userSeatCount: prefs.userSeatCount
      },
      turn: {
        seatId: null,
        handIndex: 0
      },
      dealerBlackjackChecked: false,
      dealerHasBlackjack: false,
      shoe: Engine.createShoe(Engine.rules.decks),
      seenCards: [],
      rc: 0,
      tc: 0,
      edge: -0.55,
      betUnits: 1,
      band: "NEUTRAL",
      cardsDealt: 0,
      acesSeen: 0,
      decksSeen: 0,
      decksRemaining: Engine.rules.decks
    };
    for (let index = 1; index <= 7; index += 1) {
      fresh.tableSeats.push(createTableSeat(index));
    }
    applySeatTopology(fresh, true);
    return fresh;
  }

  const state = createState();
  const history = [];
  const els = {};
  const IDS = [
    "tcVal", "rcVal", "cardsDealtVal", "decksRemainVal", "edgeVal", "betVal", "bandBadge",
    "phaseVal", "handNoVal", "turnVal", "focusVal", "focusPrevBtn", "focusNextBtn",
    "dealerPanel", "dealerCards", "activeSeatPanel", "activeSeatLabel", "activeSeatMeta", "activeSeatCards", "activeSeatStatus", "userSeatGrid", "tableSeatGrid",
    "actionVal", "guideLine", "detailLine", "targetVal", "activeSideBetStrip", "seatRecList",
    "hitBtn", "standBtn", "doubleBtn", "splitBtn", "surrenderBtn", "insuranceBtn", "continuePromptBtn",
    "nextHandBtn", "autoPlayBtn", "resetBtn", "settingsBtn",
    "settingsBackdrop", "settingsDrawer", "settingsCloseBtn", "settingsApplyBtn", "settingsResetBtn",
    "countSystemSelect", "indexSetSelect",
    "tcModeAutoBtn", "tcModeManualBtn", "decksRemainField", "decksRemainRange", "decksRemainReadout",
    "totalSeatsSelect", "userSeatCountSelect",
    "surrenderToggleOn", "surrenderToggleOff",
    "bankrollInput", "kellySelect",
    "aceSideField", "aceSideOnBtn", "aceSideOffBtn",
    "pairsToggleOn", "pairsToggleOff", "rummyToggleOn", "rummyToggleOff",
    "tapPad", "tapUndo", "tapTarget", "tapTargetVal", "toast"
  ];
  IDS.forEach((id) => { els[id] = document.getElementById(id); });

  let failureMessage = "";
  let lastTapAt = 0;

  function persistPrefs() {
    try {
      safeStorage().setItem(PREFS_KEY, JSON.stringify(state.prefs));
    } catch (_) {}
  }

  function cloneState() {
    if (typeof window.structuredClone === "function") {
      return window.structuredClone(state);
    }
    return JSON.parse(JSON.stringify(state));
  }

  function reject(message) {
    failureMessage = message;
    return false;
  }

  function toast(message) {
    const node = els.toast;
    if (!node || !message) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => node.classList.remove("show"), 900);
  }

  function pushHistory(snapshot) {
    history.push(snapshot);
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  function activeUserSeats() {
    return state.playerSeats.filter((seat) => seat.active);
  }

  function occupiedTableSeats() {
    return state.tableSeats.filter((seat) => seat.occupied);
  }

  function focusOrder() {
    return occupiedTableSeats().map((seat) => seat.id)
      .concat("dealer")
      .concat(activeUserSeats().map((seat) => seat.id));
  }

  function sanitizeActiveTarget() {
    const order = focusOrder();
    if (!order.length) {
      state.activeTargetId = "dealer";
      return;
    }
    if (!order.includes(state.activeTargetId) && state.activeTargetId !== "dealer") {
      state.activeTargetId = activeUserSeats()[0] ? activeUserSeats()[0].id : order[0];
    }
    if (state.activeTargetId === "dealer" && !order.includes("dealer")) {
      state.activeTargetId = order[0];
    }
  }

  function getUserSeat(seatId) {
    return state.playerSeats.find((seat) => seat.id === seatId) || null;
  }

  function getTableSeat(seatId) {
    return state.tableSeats.find((seat) => seat.id === seatId) || null;
  }

  function currentSeat() {
    return getUserSeat(state.turn.seatId);
  }

  function currentHand() {
    const seat = currentSeat();
    if (!seat) return null;
    return seat.hands[state.turn.handIndex] || null;
  }

  function currentTurnContext() {
    if (!state.turn.seatId) return null;
    return buildContext(state.turn.seatId, state.turn.handIndex);
  }

  function seatPreviewHandIndex(seat) {
    if (!seat || !seat.hands.length) return 0;
    if (state.turn.seatId === seat.id) return state.turn.handIndex;
    for (let index = 0; index < seat.hands.length; index += 1) {
      const hand = seat.hands[index];
      if (!hand.completed && !hand.surrendered && !hand.busted && !Engine.isBlackjack(hand.cards, hand)) {
        return index;
      }
    }
    return seat.activeHandIndex || 0;
  }

  function targetLabel(targetId) {
    if (targetId === "dealer") return "Dealer";
    const userSeat = getUserSeat(targetId);
    if (userSeat) return userSeat.label;
    const tableSeat = getTableSeat(targetId);
    if (tableSeat) return tableSeat.label;
    return "Dealer";
  }

  function formatPhase(phase) {
    if (phase === "insurance_surrender") {
      return state.promptStage === "insurance" ? "Insurance Prompt" : "Surrender Prompt";
    }
    const labels = {
      idle: "Idle",
      initial_deal_setup: "Initial Deal Setup",
      awaiting_decision: "Awaiting Decision",
      split_hand_1: "Split Hand 1",
      split_hand_2: "Split Hand 2",
      dealer_resolution: "Dealer Resolution",
      hand_complete: "Hand Complete",
      next_hand_ready: "Next Hand Ready"
    };
    return labels[phase] || phase;
  }

  function isSettingsOpen() {
    return !els.settingsDrawer.classList.contains("hidden");
  }

  function isTypingContext() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = (active.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!active.isContentEditable;
  }

  function roundStarted() {
    if (state.dealerHand.cards.length > 0) return true;
    for (const seat of activeUserSeats()) {
      if (seat.hands[0].cards.length > 0) return true;
    }
    return occupiedTableSeats().some((seat) => seat.cards.length > 0);
  }

  function seatHasInitialCards(seat) {
    return seat && seat.hands[0] && seat.hands[0].cards.length === 2;
  }

  function tableSeatHasInitialCards(seat) {
    return seat && seat.cards.length >= 2;
  }

  function initialDealReady() {
    if (state.dealerHand.cards.length < 1) return false;
    for (const seat of activeUserSeats()) {
      if (!seatHasInitialCards(seat)) return false;
    }
    for (const seat of occupiedTableSeats()) {
      if (!tableSeatHasInitialCards(seat)) return false;
    }
    return true;
  }

  function recomputeSeenStats() {
    state.rc = 0;
    state.cardsDealt = state.seenCards.length;
    state.acesSeen = 0;
    for (const rank of state.seenCards) {
      state.rc += Engine.weightFor(rank, state.prefs.countSystem);
      if (rank === "A") state.acesSeen += 1;
    }
  }

  function computeDerived() {
    const decksOverride = state.prefs.tcMode === "manual" ? state.prefs.manualDecksRemaining : undefined;
    const derived = Engine.trueCountState(
      state.rc,
      state.cardsDealt,
      Engine.rules.decks,
      decksOverride,
      {
        countSystem: state.prefs.countSystem,
        aceSideEnabled: state.prefs.aceSideEnabled,
        acesSeen: state.acesSeen
      }
    );

    state.tc = derived.tc;
    state.band = derived.band;
    state.decksSeen = derived.decksSeen;
    state.decksRemaining = derived.decksRemaining;
    state.edge = Engine.edgeEstimate(state.tc, state.decksSeen, Engine.rules.decks, state.prefs.countSystem);
    state.betUnits = Engine.betUnits(state.edge, state.prefs.bankrollUnits, 1, state.prefs.maxKelly).units;
  }

  function commitSeenCard(rank, consumeFromShoe) {
    const normalized = Engine.normalizeRank(rank);
    if (!normalized) return reject("Invalid card.");
    if (consumeFromShoe !== false && !Engine.consumeCardFromShoe(state.shoe, normalized)) {
      return reject(`No ${normalized} cards remain in the shoe.`);
    }
    state.seenCards.push(normalized);
    state.cardsDealt += 1;
    state.rc += Engine.weightFor(normalized, state.prefs.countSystem);
    if (normalized === "A") state.acesSeen += 1;
    return normalized;
  }

  function drawToCards(cards) {
    const rank = Engine.drawCardFromShoe(state.shoe);
    if (!rank) return null;
    commitSeenCard(rank, false);
    cards.push(rank);
    return rank;
  }

  function buildContext(seatId, handIndex) {
    const seat = getUserSeat(seatId);
    if (!seat) return null;
    const hand = seat.hands[handIndex];
    if (!hand) return null;
    return {
      rules: buildRules(),
      dealerUp: state.dealerHand.cards[0] || null,
      seat,
      hand,
      sideBetCards: seat.openingCards,
      sideBets: {
        pairsEnabled: state.prefs.pairsEnabled,
        rummyEnabled: state.prefs.rummyEnabled
      },
      round: {
        phase: state.phase,
        promptStage: state.promptStage,
        dealerPeekResolved: state.dealerBlackjackChecked,
        dealerHasBlackjack: state.dealerHasBlackjack,
        dealerRevealed: state.dealerHand.revealed
      },
      tc: state.tc,
      countSystem: state.prefs.countSystem,
      indexSet: state.prefs.indexSet
    };
  }

  function seatRecommendation(seat, handIndex) {
    const index = typeof handIndex === "number" ? handIndex : seatPreviewHandIndex(seat);
    const context = buildContext(seat.id, index);
    if (!context) return null;
    return {
      seat,
      handIndex: index,
      context,
      recommendation: Engine.recommendPlay(context.hand, context.dealerUp, state.tc, context)
    };
  }

  function dominantSeatRecommendation() {
    if (state.turn.seatId) {
      const seat = getUserSeat(state.turn.seatId);
      if (seat) return seatRecommendation(seat, state.turn.handIndex);
    }
    const focusedSeat = getUserSeat(state.activeTargetId);
    if (focusedSeat && focusedSeat.active) return seatRecommendation(focusedSeat);
    const firstSeat = activeUserSeats()[0];
    return firstSeat ? seatRecommendation(firstSeat) : null;
  }

  function seatNeedsInsurancePrompt(seat) {
    const context = buildContext(seat.id, 0);
    return !!(context && Engine.canTakeInsurance(context));
  }

  function seatNeedsSurrenderPrompt(seat) {
    const context = buildContext(seat.id, 0);
    return !!(context && Engine.canSurrender(context));
  }

  function isActionableHand(hand) {
    if (!hand) return false;
    if (hand.completed || hand.surrendered || hand.stood || hand.busted) return false;
    if (Engine.isBlackjack(hand.cards, hand)) return false;
    return Engine.handValue(hand.cards).total < 21;
  }

  function finalizeHandState(hand) {
    if (!hand) return;
    const value = Engine.handValue(hand.cards);
    hand.busted = value.bust;

    if (hand.surrendered || value.bust) {
      hand.completed = true;
      return;
    }

    if (hand.splitFromAces && buildRules().splitAcesOneCard && hand.cards.length >= 2) {
      hand.stood = true;
      hand.completed = true;
      return;
    }

    if (hand.doubled || Engine.isBlackjack(hand.cards, hand) || value.total === 21) {
      hand.stood = true;
      hand.completed = true;
    }
  }

  function resetPromptFlags() {
    activeUserSeats().forEach((seat) => {
      seat.insurancePromptDone = false;
      seat.surrenderPromptDone = false;
      seat.insuranceTaken = false;
      seat.insuranceResult = "";
    });
  }

  function resetRoundState(nextPhase) {
    state.dealerHand = { cards: [], revealed: false };
    state.playerSeats.forEach((seat, index) => resetUserSeatRound(seat, index < state.tableConfig.userSeatCount));
    state.tableSeats.forEach((seat, index) => resetTableSeatRound(seat, index < (state.tableConfig.totalSeats - state.tableConfig.userSeatCount)));
    state.turn = { seatId: null, handIndex: 0 };
    state.promptStage = "none";
    state.dealerBlackjackChecked = false;
    state.dealerHasBlackjack = false;
    state.phase = nextPhase;
    state.activeTargetId = "player-1";
    sanitizeActiveTarget();
  }

  function nextHandRaw() {
    const wasIdle = state.phase === "idle" && !roundStarted();
    resetRoundState(wasIdle ? "idle" : "next_hand_ready");
    if (!wasIdle) state.handNumber += 1;
    return true;
  }

  function resetShoeRaw() {
    const prefs = sanitizePrefs(state.prefs);
    const fresh = createState();
    Object.assign(state, fresh);
    state.prefs = prefs;
    applySeatTopology(state, true);
    state.phase = "idle";
    state.handNumber = 1;
    state.shoe = Engine.createShoe(Engine.rules.decks);
    persistPrefs();
    sanitizeActiveTarget();
    return true;
  }

  function addDealerCardRaw(rank) {
    if (state.phase === "dealer_resolution" || state.phase === "hand_complete") {
      return reject("Press Enter to start the next hand.");
    }
    if (!(state.phase === "idle" || state.phase === "next_hand_ready" || state.phase === "initial_deal_setup")) {
      return reject("Dealer cards are locked after the initial deal.");
    }
    if (state.dealerHand.cards.length >= 2) {
      return reject("Dealer already has an upcard and hole card.");
    }
    const normalized = commitSeenCard(rank, true);
    if (!normalized) return false;
    if (state.phase === "idle" || state.phase === "next_hand_ready") {
      state.phase = "initial_deal_setup";
    }
    state.dealerHand.cards.push(normalized);
    state.dealerHand.revealed = false;
    return true;
  }

  function addTableSeatCardRaw(seat, rank) {
    if (!seat || !seat.occupied) return reject("That table seat is not occupied.");
    if (state.phase === "dealer_resolution" || state.phase === "hand_complete") {
      return reject("Press Enter to start the next hand.");
    }
    const normalized = commitSeenCard(rank, true);
    if (!normalized) return false;
    if (state.phase === "idle" || state.phase === "next_hand_ready") {
      state.phase = "initial_deal_setup";
    }
    seat.cards.push(normalized);
    return true;
  }

  function addUserInitialCardRaw(seat, rank) {
    const hand = seat.hands[0];
    if (hand.cards.length >= 2) {
      return reject(`${seat.label} already has two opening cards.`);
    }
    const normalized = commitSeenCard(rank, true);
    if (!normalized) return false;
    hand.cards.push(normalized);
    if (hand.cards.length === 2) {
      seat.openingCards = hand.cards.slice(0, 2);
    }
    return true;
  }

  function addUserLiveCardRaw(seat, rank) {
    if (!state.turn.seatId || state.turn.seatId !== seat.id || state.activeTargetId !== seat.id) {
      return reject(`It is not ${seat.label}'s turn.`);
    }
    if (state.phase === "insurance_surrender") {
      return reject("Resolve the current prompt first.");
    }
    const hand = currentHand();
    if (!hand || !Engine.canHit(hand, buildRules())) {
      return reject("Hit is not legal on this hand.");
    }
    const normalized = commitSeenCard(rank, true);
    if (!normalized) return false;
    hand.cards.push(normalized);
    finalizeHandState(hand);
    return true;
  }

  function addUserCardRaw(seatId, rank) {
    const seat = getUserSeat(seatId);
    if (!seat || !seat.active) return reject("Seat is disabled.");
    if (state.phase === "dealer_resolution" || state.phase === "hand_complete") {
      return reject("Press Enter to start the next hand.");
    }
    if (state.phase === "idle" || state.phase === "next_hand_ready") {
      state.phase = "initial_deal_setup";
    }
    if (state.phase === "initial_deal_setup") {
      return addUserInitialCardRaw(seat, rank);
    }
    return addUserLiveCardRaw(seat, rank);
  }

  function addCardToTargetRaw(targetId, rank) {
    if (targetId === "dealer") return addDealerCardRaw(rank);
    const tableSeat = getTableSeat(targetId);
    if (tableSeat) return addTableSeatCardRaw(tableSeat, rank);
    return addUserCardRaw(targetId, rank);
  }

  function markNaturalsComplete() {
    activeUserSeats().forEach((seat) => {
      const hand = seat.hands[0];
      if (Engine.isBlackjack(hand.cards, hand)) {
        hand.completed = true;
        hand.stood = true;
      }
    });
  }

  function nextActionableTurn() {
    for (const seat of activeUserSeats()) {
      for (let index = 0; index < seat.hands.length; index += 1) {
        if (isActionableHand(seat.hands[index])) {
          return { seatId: seat.id, handIndex: index };
        }
      }
    }
    return null;
  }

  function setTurn(turn) {
    if (!turn) {
      state.turn = { seatId: null, handIndex: 0 };
      return;
    }
    const seat = getUserSeat(turn.seatId);
    seat.activeHandIndex = turn.handIndex;
    state.turn = turn;
    state.activeTargetId = turn.seatId;
    state.phase = seat.hands.length > 1
      ? (turn.handIndex === 0 ? "split_hand_1" : "split_hand_2")
      : "awaiting_decision";
  }

  function handNeedsDealer(hand) {
    if (!hand || hand.surrendered || hand.busted) return false;
    if (Engine.isBlackjack(hand.cards, hand)) return false;
    return true;
  }

  function settleRound() {
    const dealerCards = state.dealerHand.cards.slice();
    const dealerBlackjack = Engine.isBlackjack(dealerCards, null);

    activeUserSeats().forEach((seat) => {
      seat.netUnits = 0;
      seat.insuranceResult = "";

      seat.hands.forEach((hand) => {
        const result = Engine.settleHand(hand, dealerCards, buildRules());
        hand.result = result.result;
        hand.resultDetail = result.detail;
        hand.netUnits = result.netUnits;
        seat.netUnits += result.netUnits;
      });

      if (seat.insuranceTaken) {
        const insuranceNet = dealerBlackjack ? 1 : -0.5;
        seat.netUnits += insuranceNet;
        seat.insuranceResult = dealerBlackjack ? "Insurance +1u" : "Insurance -0.5u";
      }
    });
  }

  function resolveDealerIfNeeded() {
    state.phase = "dealer_resolution";
    state.promptStage = "none";
    state.dealerHand.revealed = true;

    let comparisonNeeded = false;
    for (const seat of activeUserSeats()) {
      for (const hand of seat.hands) {
        if (handNeedsDealer(hand)) {
          comparisonNeeded = true;
          break;
        }
      }
      if (comparisonNeeded) break;
    }

    if (comparisonNeeded) {
      while (Engine.shouldDealerHit(state.dealerHand.cards, buildRules())) {
        const draw = drawToCards(state.dealerHand.cards);
        if (!draw) break;
      }
    }

    settleRound();
    state.phase = "hand_complete";
    state.turn = { seatId: null, handIndex: 0 };
  }

  function nextInsuranceSeat() {
    return activeUserSeats().find((seat) => !seat.insurancePromptDone && seatNeedsInsurancePrompt(seat)) || null;
  }

  function nextSurrenderSeat() {
    return activeUserSeats().find((seat) => !seat.surrenderPromptDone && seatNeedsSurrenderPrompt(seat)) || null;
  }

  function advancePromptOrTurn() {
    const insuranceSeat = nextInsuranceSeat();
    if (insuranceSeat) {
      state.turn = { seatId: insuranceSeat.id, handIndex: 0 };
      state.promptStage = "insurance";
      state.phase = "insurance_surrender";
      state.activeTargetId = insuranceSeat.id;
      return;
    }

    if (!state.dealerBlackjackChecked) {
      state.dealerBlackjackChecked = true;
      state.dealerHasBlackjack = Engine.isBlackjack(state.dealerHand.cards, null);
    }

    if (state.dealerHasBlackjack) {
      state.dealerHand.revealed = true;
      settleRound();
      state.phase = "hand_complete";
      state.promptStage = "none";
      state.turn = { seatId: null, handIndex: 0 };
      return;
    }

    const surrenderSeat = nextSurrenderSeat();
    if (surrenderSeat) {
      state.turn = { seatId: surrenderSeat.id, handIndex: 0 };
      state.promptStage = "surrender";
      state.phase = "insurance_surrender";
      state.activeTargetId = surrenderSeat.id;
      return;
    }

    state.promptStage = "none";
    markNaturalsComplete();
    const turn = nextActionableTurn();
    if (!turn) {
      resolveDealerIfNeeded();
      return;
    }
    setTurn(turn);
  }

  function syncRoundState() {
    if ((state.phase === "idle" || state.phase === "next_hand_ready") && roundStarted() && state.dealerHand.cards.length > 0) {
      state.phase = "initial_deal_setup";
    }

    if (state.phase === "initial_deal_setup" && initialDealReady()) {
      if (state.dealerHand.cards.length < 2) {
        const hole = drawToCards(state.dealerHand.cards);
        if (!hole) return;
      }
      state.dealerHand.revealed = false;
      state.dealerBlackjackChecked = false;
      state.dealerHasBlackjack = false;
      state.promptStage = "none";
      resetPromptFlags();
      advancePromptOrTurn();
      return;
    }

    if (state.phase === "insurance_surrender") {
      advancePromptOrTurn();
      return;
    }

    if (state.phase === "awaiting_decision" || state.phase === "split_hand_1" || state.phase === "split_hand_2") {
      const turn = nextActionableTurn();
      if (!turn) {
        resolveDealerIfNeeded();
      } else {
        setTurn(turn);
      }
    }
  }

  function transact(fn, successMessage) {
    failureMessage = "";
    const snapshot = cloneState();
    const changed = fn();
    if (!changed) {
      Object.assign(state, snapshot);
      computeDerived();
      render();
      if (failureMessage) toast(failureMessage);
      return false;
    }

    pushHistory(snapshot);
    syncRoundState();
    computeDerived();
    sanitizeActiveTarget();
    render();
    if (successMessage) toast(successMessage);
    return true;
  }

  function currentSeatSelected() {
    return !!state.turn.seatId && state.activeTargetId === state.turn.seatId;
  }

  function continuePromptRaw() {
    if (state.phase !== "insurance_surrender" || !state.turn.seatId || !currentSeatSelected()) {
      return reject("Select the active seat and resolve the prompt.");
    }
    const seat = getUserSeat(state.turn.seatId);
    if (state.promptStage === "insurance") {
      seat.insurancePromptDone = true;
      return true;
    }
    if (state.promptStage === "surrender") {
      seat.surrenderPromptDone = true;
      return true;
    }
    return reject("No prompt is active.");
  }

  function toggleInsuranceRaw() {
    const context = currentTurnContext();
    if (!context || !currentSeatSelected() || state.promptStage !== "insurance" || !Engine.canTakeInsurance(context)) {
      return reject("Insurance is not available.");
    }
    context.seat.insuranceTaken = !context.seat.insuranceTaken;
    return true;
  }

  function surrenderRaw() {
    const context = currentTurnContext();
    if (!context || !currentSeatSelected() || state.promptStage !== "surrender" || !Engine.canSurrender(context)) {
      return reject("Surrender is not legal here.");
    }
    context.hand.surrendered = true;
    context.hand.completed = true;
    context.seat.surrenderPromptDone = true;
    return true;
  }

  function standRaw() {
    const hand = currentHand();
    if (!hand || !currentSeatSelected() || state.phase === "insurance_surrender") {
      return reject("Stand is not available right now.");
    }
    hand.stood = true;
    hand.completed = true;
    return true;
  }

  function hitRaw() {
    const hand = currentHand();
    if (!hand || !currentSeatSelected() || state.phase === "insurance_surrender") {
      return reject("Hit is not available right now.");
    }
    if (!Engine.canHit(hand, buildRules())) {
      return reject("Hit is illegal on this hand.");
    }
    const draw = drawToCards(hand.cards);
    if (!draw) return reject("The shoe is empty.");
    finalizeHandState(hand);
    return true;
  }

  function doubleRaw() {
    const context = currentTurnContext();
    if (!context || !currentSeatSelected() || state.phase === "insurance_surrender") {
      return reject("Double is not available right now.");
    }
    if (!Engine.canDouble(context.hand, context.seat, buildRules())) {
      return reject("Double is not legal on this hand.");
    }
    context.hand.doubled = true;
    const draw = drawToCards(context.hand.cards);
    if (!draw) return reject("The shoe is empty.");
    finalizeHandState(context.hand);
    return true;
  }

  function splitRaw() {
    const context = currentTurnContext();
    if (!context || !currentSeatSelected() || state.phase === "insurance_surrender") {
      return reject("Split is not available right now.");
    }
    if (!Engine.canSplit(context.hand, context.seat, buildRules())) {
      return reject("Split is not legal on this hand.");
    }

    const firstRank = context.hand.cards[0];
    const secondRank = context.hand.cards[1];
    const splitAces = firstRank === "A";
    const firstHand = createHand({
      cards: [firstRank],
      fromSplit: true,
      splitFromAces: splitAces
    });
    const secondHand = createHand({
      cards: [secondRank],
      fromSplit: true,
      splitFromAces: splitAces
    });

    context.seat.hands = [firstHand, secondHand];
    context.seat.splitCount += 1;
    context.seat.activeHandIndex = 0;

    if (!drawToCards(firstHand.cards) || !drawToCards(secondHand.cards)) {
      return reject("The shoe is empty.");
    }

    finalizeHandState(firstHand);
    finalizeHandState(secondHand);
    return true;
  }

  function autoPlayRaw() {
    if (state.phase === "idle" || state.phase === "next_hand_ready") {
      return reject("Enter an initial deal first.");
    }
    if (state.phase === "initial_deal_setup" && !initialDealReady()) {
      return reject("Finish the initial deal before auto play.");
    }

    let guard = 0;
    while (guard < 120) {
      guard += 1;

      if (state.phase === "initial_deal_setup") {
        syncRoundState();
        continue;
      }

      if (state.phase === "insurance_surrender") {
        const context = currentTurnContext();
        if (!context) break;
        const recommendation = Engine.recommendPlay(context.hand, context.dealerUp, state.tc, context);

        if (state.promptStage === "insurance") {
          if (recommendation.insurance.available && recommendation.insurance.recommended) {
            context.seat.insuranceTaken = true;
          }
          context.seat.insurancePromptDone = true;
          syncRoundState();
          continue;
        }

        if (state.promptStage === "surrender") {
          if (recommendation.action === Engine.actions.SURRENDER && Engine.canSurrender(context)) {
            context.hand.surrendered = true;
            context.hand.completed = true;
          }
          context.seat.surrenderPromptDone = true;
          syncRoundState();
          continue;
        }
      }

      if (state.phase === "awaiting_decision" || state.phase === "split_hand_1" || state.phase === "split_hand_2") {
        const context = currentTurnContext();
        if (!context) break;
        const recommendation = Engine.recommendPlay(context.hand, context.dealerUp, state.tc, context);

        if (recommendation.action === Engine.actions.DOUBLE) {
          if (!Engine.canDouble(context.hand, context.seat, buildRules())) return reject("Auto play hit a double legality mismatch.");
          context.hand.doubled = true;
          if (!drawToCards(context.hand.cards)) return reject("The shoe is empty.");
          finalizeHandState(context.hand);
          syncRoundState();
          continue;
        }

        if (recommendation.action === Engine.actions.SPLIT) {
          if (!Engine.canSplit(context.hand, context.seat, buildRules())) return reject("Auto play hit a split legality mismatch.");
          const firstRank = context.hand.cards[0];
          const secondRank = context.hand.cards[1];
          const splitAces = firstRank === "A";
          context.seat.hands = [
            createHand({ cards: [firstRank], fromSplit: true, splitFromAces: splitAces }),
            createHand({ cards: [secondRank], fromSplit: true, splitFromAces: splitAces })
          ];
          context.seat.splitCount += 1;
          if (!drawToCards(context.seat.hands[0].cards) || !drawToCards(context.seat.hands[1].cards)) {
            return reject("The shoe is empty.");
          }
          finalizeHandState(context.seat.hands[0]);
          finalizeHandState(context.seat.hands[1]);
          syncRoundState();
          continue;
        }

        if (recommendation.action === Engine.actions.HIT) {
          if (!Engine.canHit(context.hand, buildRules())) return reject("Auto play hit a hit legality mismatch.");
          if (!drawToCards(context.hand.cards)) return reject("The shoe is empty.");
          finalizeHandState(context.hand);
          syncRoundState();
          continue;
        }

        context.hand.stood = true;
        context.hand.completed = true;
        syncRoundState();
        continue;
      }

      if (state.phase === "dealer_resolution" || state.phase === "hand_complete") {
        break;
      }

      break;
    }

    return true;
  }

  function undo() {
    const snapshot = history.pop();
    if (!snapshot) return;
    Object.assign(state, snapshot);
    computeDerived();
    sanitizeActiveTarget();
    render();
    toast("Undo");
  }

  function setActiveTarget(targetId) {
    const targetSeat = getUserSeat(targetId);
    if (targetSeat && !targetSeat.active) return;
    const tableSeat = getTableSeat(targetId);
    if (tableSeat && !tableSeat.occupied) return;
    state.activeTargetId = targetId;
    sanitizeActiveTarget();
    render();
  }

  function cycleFocus(delta) {
    const order = focusOrder();
    if (!order.length) return;
    const currentIndex = Math.max(0, order.indexOf(state.activeTargetId));
    const nextIndex = (currentIndex + delta + order.length) % order.length;
    state.activeTargetId = order[nextIndex];
    render();
  }

  function openSettings() {
    els.settingsBackdrop.classList.remove("hidden");
    els.settingsDrawer.classList.remove("hidden");
    hydrateSettingsUI();
  }

  function closeSettings() {
    els.settingsBackdrop.classList.add("hidden");
    els.settingsDrawer.classList.add("hidden");
  }

  function setSegmented(onNode, offNode, enabled) {
    onNode.classList.toggle("active", !!enabled);
    offNode.classList.toggle("active", !enabled);
  }

  function hydrateSettingsUI() {
    els.countSystemSelect.value = state.prefs.countSystem;
    els.indexSetSelect.value = state.prefs.indexSet;
    els.bankrollInput.value = String(state.prefs.bankrollUnits);
    els.kellySelect.value = String(state.prefs.maxKelly);
    els.decksRemainRange.value = String(state.prefs.manualDecksRemaining);
    els.decksRemainReadout.textContent = Number(state.prefs.manualDecksRemaining).toFixed(2);
    els.totalSeatsSelect.value = String(state.prefs.totalSeats);
    els.userSeatCountSelect.value = String(state.prefs.userSeatCount);

    const manual = state.prefs.tcMode === "manual";
    els.tcModeAutoBtn.classList.toggle("active", !manual);
    els.tcModeManualBtn.classList.toggle("active", manual);
    els.decksRemainField.classList.toggle("hidden", !manual);

    const hiOpt = state.prefs.countSystem === "hiopt2";
    els.aceSideField.classList.toggle("hidden", !hiOpt);
    setSegmented(els.aceSideOnBtn, els.aceSideOffBtn, hiOpt && state.prefs.aceSideEnabled);
    setSegmented(els.surrenderToggleOn, els.surrenderToggleOff, state.prefs.surrenderEnabled);
    setSegmented(els.pairsToggleOn, els.pairsToggleOff, state.prefs.pairsEnabled);
    setSegmented(els.rummyToggleOn, els.rummyToggleOff, state.prefs.rummyEnabled);
  }

  function applySettings() {
    const nextPrefs = sanitizePrefs({
      countSystem: els.countSystemSelect.value,
      indexSet: els.indexSetSelect.value,
      tcMode: els.tcModeManualBtn.classList.contains("active") ? "manual" : "auto",
      manualDecksRemaining: Number(els.decksRemainRange.value),
      bankrollUnits: Number(els.bankrollInput.value),
      maxKelly: Number(els.kellySelect.value),
      aceSideEnabled: els.aceSideOnBtn.classList.contains("active"),
      totalSeats: Number(els.totalSeatsSelect.value),
      userSeatCount: Number(els.userSeatCountSelect.value),
      surrenderEnabled: els.surrenderToggleOn.classList.contains("active"),
      pairsEnabled: els.pairsToggleOn.classList.contains("active"),
      rummyEnabled: els.rummyToggleOn.classList.contains("active")
    });

    const topologyChanged = nextPrefs.totalSeats !== state.prefs.totalSeats || nextPrefs.userSeatCount !== state.prefs.userSeatCount;
    if (topologyChanged && roundStarted()) {
      toast("Finish the current hand before changing seats in play.");
      return;
    }

    state.prefs = nextPrefs;
    persistPrefs();

    if (topologyChanged) {
      applySeatTopology(state, true);
      resetRoundState(state.phase === "idle" ? "idle" : "next_hand_ready");
    }

    recomputeSeenStats();
    computeDerived();
    sanitizeActiveTarget();
    render();
    closeSettings();
    toast("Settings applied");
  }

  function resetSettings() {
    const defaults = defaultPrefs();
    const roundInProgress = roundStarted();
    if (roundInProgress) {
      defaults.totalSeats = state.prefs.totalSeats;
      defaults.userSeatCount = state.prefs.userSeatCount;
    }
    state.prefs = sanitizePrefs(defaults);
    persistPrefs();
    if (!roundInProgress) {
      applySeatTopology(state, true);
      resetRoundState(state.phase === "idle" ? "idle" : "next_hand_ready");
    }
    recomputeSeenStats();
    computeDerived();
    hydrateSettingsUI();
    render();
    toast("Settings reset");
  }

  function formatCount() {
    return state.prefs.countSystem === "wong_halves"
      ? state.rc.toFixed(1)
      : String(Math.round(state.rc));
  }

  function formatUnits(value) {
    if (value > 0) return `+${value.toFixed(2).replace(/\.00$/, "")}u`;
    if (value < 0) return `${value.toFixed(2).replace(/\.00$/, "")}u`;
    return "0u";
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderCardCollection(cards, hiddenHole, emptyText) {
    const container = createNode("div", "cards");
    if (!cards.length) {
      container.appendChild(createNode("div", "empty-copy", emptyText || "No cards"));
      return container;
    }

    cards.forEach((rank, index) => {
      const chip = createNode("div", hiddenHole && index === 1 ? "card-chip card-hole" : "card-chip", hiddenHole && index === 1 ? "HOLE" : rank);
      container.appendChild(chip);
    });
    return container;
  }

  function handBadges(hand) {
    const flags = [];
    if (Engine.isBlackjack(hand.cards, hand)) flags.push("BJ");
    if (hand.splitFromAces) flags.push("Split Aces");
    if (hand.doubled) flags.push("Double");
    if (hand.surrendered) flags.push("Surrender");
    if (hand.busted) flags.push("Bust");
    if (hand.stood && !hand.busted && !hand.surrendered) flags.push("Stand");
    return flags;
  }

  function renderSideBetStrip(recommendation) {
    const strip = createNode("div", "sidebet-strip");
    if (!recommendation || !recommendation.sideBets) return strip;

    const items = [
      { label: "Pairs", value: recommendation.sideBets.pairs },
      { label: "Rummy", value: recommendation.sideBets.rummy }
    ];

    items.forEach((item) => {
      const result = item.value;
      if (!result || !result.enabled) return;
      const label = result.qualification === "qualifies"
        ? `${item.label}: ${result.payoutTierLabel || result.handClass}`
        : result.qualification === "pending"
          ? `${item.label}: Live`
          : result.qualification === "miss"
            ? `${item.label}: No Hit`
            : `${item.label}: ${result.payoutTierLabel || result.handClass}`;
      const chip = createNode("div", `sidebet-chip ${result.qualification}`, label);
      strip.appendChild(chip);
    });

    return strip;
  }

  function primarySeatSnapshot() {
    let seat = state.turn.seatId ? getUserSeat(state.turn.seatId) : null;
    let handIndex = seat ? state.turn.handIndex : 0;

    if (!seat) {
      const focusedSeat = getUserSeat(state.activeTargetId);
      if (focusedSeat && focusedSeat.active) {
        seat = focusedSeat;
        handIndex = seatPreviewHandIndex(focusedSeat);
      }
    }

    if (!seat) {
      seat = activeUserSeats()[0] || null;
      handIndex = seat ? seatPreviewHandIndex(seat) : 0;
    }

    if (!seat) return null;
    const hand = seat.hands[handIndex] || seat.hands[0] || null;
    if (!hand) return null;
    return { seat, handIndex, hand };
  }

  function renderDealer() {
    els.dealerPanel.classList.toggle("is-focus", state.activeTargetId === "dealer");
    els.dealerPanel.classList.toggle("is-turn", false);
    const cards = renderCardCollection(
      state.dealerHand.cards,
      !state.dealerHand.revealed && state.dealerHand.cards.length >= 2,
      "Awaiting cards"
    );
    els.dealerCards.replaceChildren(...Array.from(cards.childNodes));
  }

  function renderActiveSeat() {
    const snapshot = primarySeatSnapshot();
    els.activeSeatPanel.classList.toggle("is-focus", !!(snapshot && state.activeTargetId === snapshot.seat.id));
    els.activeSeatPanel.classList.toggle("is-turn", !!(snapshot && state.turn.seatId === snapshot.seat.id));

    if (!snapshot) {
      els.activeSeatLabel.textContent = "No active seat";
      els.activeSeatMeta.textContent = "Set at least one user seat";
      const empty = renderCardCollection([], false, "No cards");
      els.activeSeatCards.replaceChildren(...Array.from(empty.childNodes));
      els.activeSeatStatus.replaceChildren();
      return;
    }

    const { seat, handIndex, hand } = snapshot;
    const seatLabel = seat.hands.length > 1 ? `${seat.label} · Hand ${handIndex + 1}` : seat.label;
    const statusBits = [Engine.describeHand(hand.cards)];
    if (seat.id === state.turn.seatId) {
      statusBits.unshift("Active");
    } else if (state.phase === "hand_complete") {
      statusBits.unshift("Settled");
    } else {
      statusBits.unshift("Ready");
    }

    els.activeSeatLabel.textContent = seatLabel;
    els.activeSeatMeta.textContent = statusBits.filter(Boolean).join(" · ");

    const cards = renderCardCollection(hand.cards, false, "Awaiting cards");
    els.activeSeatCards.replaceChildren(...Array.from(cards.childNodes));

    const badgeContainer = createNode("div", "badge-row");
    handBadges(hand).forEach((flag) => badgeContainer.appendChild(createNode("span", "badge", flag)));
    if (seat.insuranceTaken && state.phase !== "insurance_surrender") {
      badgeContainer.appendChild(createNode("span", "badge", "Insurance"));
    }
    if (seat.insuranceResult) {
      badgeContainer.appendChild(createNode("span", "badge", seat.insuranceResult));
    }
    if (state.phase === "hand_complete") {
      badgeContainer.appendChild(createNode("span", "badge", `Net ${formatUnits(seat.netUnits)}`));
    }
    els.activeSeatStatus.replaceChildren(...Array.from(badgeContainer.childNodes));
  }

  function renderUserSeats() {
    const fragment = document.createDocumentFragment();
    activeUserSeats().forEach((seat) => {
      const panel = createNode("article", "seat-panel");
      panel.dataset.target = seat.id;
      panel.classList.toggle("is-focus", state.activeTargetId === seat.id);
      panel.classList.toggle("is-turn", state.turn.seatId === seat.id);

      const head = createNode("div", "seat-head");
      const headLeft = createNode("div");
      headLeft.appendChild(createNode("div", "zone-label", seat.label));
      headLeft.appendChild(createNode("div", "seat-title", `${seat.hands.length} hand${seat.hands.length === 1 ? "" : "s"}`));

      const summaryBits = [];
      if (seat.insuranceResult) summaryBits.push(seat.insuranceResult);
      if (state.phase === "hand_complete") summaryBits.push(`Net ${formatUnits(seat.netUnits)}`);
      if (!summaryBits.length) {
        if (seat.id === state.turn.seatId) {
          summaryBits.push(`Turn · Hand ${state.turn.handIndex + 1}`);
        } else {
          summaryBits.push("Waiting");
        }
      }
      const headRight = createNode("div", "seat-summary", summaryBits.join(" · "));
      head.appendChild(headLeft);
      head.appendChild(headRight);
      panel.appendChild(head);

      const recommendation = seatRecommendation(seat);
      if (recommendation) {
        panel.appendChild(createNode("div", "seat-summary", `Next: ${recommendation.recommendation.action}`));
      }

      const hands = createNode("div", "seat-hands");
      seat.hands.forEach((hand, index) => {
        const shell = createNode("div", "seat-hand");
        if (seat.id === state.turn.seatId && index === state.turn.handIndex) {
          shell.classList.add("is-turn-hand");
        }

        const header = createNode("div", "seat-hand-head");
        const headerLeft = createNode("div");
        headerLeft.appendChild(createNode("div", "seat-hand-title", seat.hands.length > 1 ? `Hand ${index + 1}` : "Hand"));
        headerLeft.appendChild(createNode("div", "seat-hand-meta", Engine.describeHand(hand.cards)));
        header.appendChild(headerLeft);

        if (recommendation && recommendation.handIndex === index) {
          header.appendChild(createNode("div", "info-chip", recommendation.recommendation.action));
        }

        shell.appendChild(header);
        shell.appendChild(renderCardCollection(hand.cards, false, "Awaiting cards"));

        const badges = createNode("div", "badges");
        handBadges(hand).forEach((flag) => badges.appendChild(createNode("span", "badge", flag)));
        if (badges.childNodes.length) shell.appendChild(badges);

        const result = createNode("div", "result-line");
        if (hand.result) {
          result.textContent = `${hand.result} · ${formatUnits(hand.netUnits)}`;
        } else {
          result.textContent = hand.completed ? "Resolved" : "Live";
        }
        shell.appendChild(result);
        hands.appendChild(shell);
      });

      panel.appendChild(hands);
      fragment.appendChild(panel);
    });

    els.userSeatGrid.replaceChildren(fragment);
  }

  function renderTableSeats() {
    const fragment = document.createDocumentFragment();
    const seats = occupiedTableSeats();

    if (!seats.length) {
      fragment.appendChild(createNode("div", "empty-copy", "No observed seats in play."));
      els.tableSeatGrid.replaceChildren(fragment);
      return;
    }

    seats.forEach((seat) => {
      const panel = createNode("article", "compact-seat");
      panel.dataset.target = seat.id;
      panel.classList.toggle("is-focus", state.activeTargetId === seat.id);

      const head = createNode("div", "seat-head");
      const left = createNode("div");
      left.appendChild(createNode("div", "zone-label", seat.label));
      left.appendChild(createNode("div", "seat-title", seat.cards.length >= 2 ? "Observed" : "Opening"));
      const right = createNode("div", "seat-summary", `${seat.cards.length} card${seat.cards.length === 1 ? "" : "s"}`);
      head.appendChild(left);
      head.appendChild(right);
      panel.appendChild(head);
      panel.appendChild(renderCardCollection(seat.cards, false, "No cards"));
      fragment.appendChild(panel);
    });

    els.tableSeatGrid.replaceChildren(fragment);
  }

  function formatRecReason(recommendation) {
    if (!recommendation) return "";
    const explanation = recommendation.explanation || {};
    if (recommendation.reason === "index-deviation" && explanation.matchedDeviationIndex) {
      return `Index ${explanation.matchedDeviationIndex} @ ${explanation.threshold}`;
    }
    if (explanation.fallbackReason === "count-system-deviation-table-unavailable") {
      return "Basic fallback";
    }
    if (explanation.fallbackReason === "basic-only-selected") {
      return "Basic only";
    }
    if (recommendation.reason === "side-bet-only") {
      return "Side-bet only";
    }
    if (recommendation.reason === "insufficient-hand-state") {
      return "Need full hand";
    }
    return "Basic";
  }

  function recommendationView() {
    if (state.phase === "idle" || state.phase === "next_hand_ready") {
      return {
        action: "READY",
        guide: "Enter dealer upcard and opening cards.",
        detail: "Use Tab/C/X to switch focus. Input rank keys or keypad."
      };
    }

    if (state.phase === "initial_deal_setup") {
      return {
        action: "DEAL",
        guide: `Complete opening cards for ${state.tableConfig.totalSeats} seat${state.tableConfig.totalSeats === 1 ? "" : "s"} in play.`,
        detail: "Dealer hole card auto-deals when the opening layout is complete."
      };
    }

    const dominant = dominantSeatRecommendation();
    if (!dominant) {
      return {
        action: state.phase === "hand_complete" ? "SETTLED" : "WAIT",
        guide: state.phase === "hand_complete" ? "Hand settled. Press Enter for next hand." : "Awaiting state sync.",
        detail: ""
      };
    }

    const recommendation = dominant.recommendation;
    const handLabel = `${dominant.seat.label}${dominant.seat.hands.length > 1 ? ` · Hand ${dominant.handIndex + 1}` : ""}`;
    const focusWarning = state.activeTargetId !== dominant.seat.id
      ? `Focus ${dominant.seat.label} to apply action keys.`
      : "";

    if (state.phase === "insurance_surrender") {
      if (state.promptStage === "insurance") {
        const insuranceText = recommendation.insurance.recommended
          ? `Insurance +EV at TC ${recommendation.insurance.evaluatedTc}.`
          : "Insurance not +EV.";
        return {
          action: recommendation.insurance.recommended ? "INSURE" : "PROMPT",
          guide: `${handLabel} · ${Engine.describeHand(dominant.context.hand.cards)} vs ${dominant.context.dealerUp}. ${insuranceText}`,
          detail: [focusWarning, "I toggle · Space continue"].filter(Boolean).join(" · ")
        };
      }

      return {
        action: recommendation.action === Engine.actions.SURRENDER ? "SURRENDER" : "PLAY ON",
        guide: `${handLabel} · ${Engine.describeHand(dominant.context.hand.cards)} vs ${dominant.context.dealerUp} · ${formatRecReason(recommendation)}`,
        detail: [focusWarning, "U surrender · Space continue"].filter(Boolean).join(" · ")
      };
    }

    let guide = `${handLabel} · ${Engine.describeHand(dominant.context.hand.cards)} vs ${dominant.context.dealerUp} · ${formatRecReason(recommendation)}`;
    const detailBits = [];

    if (recommendation.explanation && recommendation.explanation.description) {
      detailBits.push(recommendation.explanation.description);
    }
    if (recommendation.downgradedFrom === Engine.actions.DOUBLE) {
      detailBits.push("Double fallback (illegal).");
    } else if (recommendation.downgradedFrom === Engine.actions.SPLIT) {
      detailBits.push("Split fallback (limit).");
    } else if (recommendation.downgradedFrom === Engine.actions.SURRENDER) {
      detailBits.push("Surrender fallback (illegal).");
    }

    return {
      action: recommendation.action,
      guide,
      detail: [focusWarning].concat(detailBits).filter(Boolean).join(" · ")
    };
  }

  function renderRecommendation() {
    const dominant = dominantSeatRecommendation();
    const view = recommendationView();
    els.actionVal.textContent = view.action;
    els.guideLine.textContent = view.guide;
    els.detailLine.textContent = view.detail;

    const sideBetStrip = dominant ? renderSideBetStrip(dominant.recommendation) : createNode("div", "sidebet-strip");
    els.activeSideBetStrip.replaceChildren(...Array.from(sideBetStrip.childNodes));

    const fragment = document.createDocumentFragment();
    activeUserSeats().forEach((seat) => {
      const snapshot = seatRecommendation(seat);
      if (!snapshot) return;
      const card = createNode("div", "rec-seat-card");
      if (dominant && dominant.seat.id === seat.id) card.classList.add("is-active");
      card.appendChild(createNode("div", "rec-seat-title", seat.label));
      card.appendChild(createNode("div", "rec-seat-action", snapshot.recommendation.action));
      card.appendChild(createNode("div", "rec-seat-meta", `${Engine.describeHand(snapshot.context.hand.cards)} vs ${snapshot.context.dealerUp || "-"}`));
      card.appendChild(createNode("div", "rec-seat-meta", formatRecReason(snapshot.recommendation)));
      fragment.appendChild(card);
    });
    if (!fragment.childNodes.length) {
      fragment.appendChild(createNode("div", "empty-copy", "No active recommendation seats."));
    }
    els.seatRecList.replaceChildren(fragment);
  }

  function updateActionButtons() {
    const context = currentTurnContext();
    const selected = currentSeatSelected();
    const recommendation = context ? Engine.recommendPlay(context.hand, context.dealerUp, state.tc, context) : null;
    const moves = recommendation ? recommendation.legalMoves : null;

    const promptInsurance = state.phase === "insurance_surrender" && state.promptStage === "insurance";
    const promptSurrender = state.phase === "insurance_surrender" && state.promptStage === "surrender";
    const promptActive = state.phase === "insurance_surrender";

    els.hitBtn.disabled = !(selected && moves && !promptActive && moves.hit);
    els.standBtn.disabled = !(selected && moves && !promptActive && moves.stand);
    els.doubleBtn.disabled = !(selected && moves && !promptActive && moves.double);
    els.splitBtn.disabled = !(selected && moves && !promptActive && moves.split);
    els.surrenderBtn.disabled = !(selected && moves && promptSurrender && moves.surrender);
    els.insuranceBtn.disabled = !(selected && recommendation && promptInsurance && recommendation.insurance.available);
    els.continuePromptBtn.disabled = !(selected && state.phase === "insurance_surrender");
    els.autoPlayBtn.disabled = state.phase === "idle" || state.phase === "next_hand_ready" || state.phase === "hand_complete";
  }

  function render() {
    els.rcVal.textContent = formatCount();
    els.tcVal.textContent = state.tc.toFixed(2);
    els.cardsDealtVal.textContent = String(state.cardsDealt);
    els.decksRemainVal.textContent = state.decksRemaining.toFixed(2);
    els.edgeVal.textContent = `${state.edge.toFixed(2)}%`;
    els.betVal.textContent = `${state.betUnits}u`;
    els.bandBadge.textContent = state.band;
    els.bandBadge.className = `band ${state.band === "NEGATIVE" ? "band-negative" : state.band === "POSITIVE" ? "band-positive" : state.band === "HIGH" ? "band-high" : "band-neutral"}`;

    els.phaseVal.textContent = formatPhase(state.phase);
    els.handNoVal.textContent = `Hand ${state.handNumber}`;
    els.turnVal.textContent = state.turn.seatId
      ? `${targetLabel(state.turn.seatId)} · Hand ${state.turn.handIndex + 1}`
      : (state.phase === "hand_complete" ? "Round settled" : "No active turn");
    els.focusVal.textContent = targetLabel(state.activeTargetId);
    els.targetVal.textContent = targetLabel(state.activeTargetId).toUpperCase();
    els.tapTargetVal.textContent = targetLabel(state.activeTargetId).toUpperCase();

    renderDealer();
    renderActiveSeat();
    renderUserSeats();
    renderTableSeats();
    renderRecommendation();
    updateActionButtons();
  }

  function bindSettingsButtons() {
    els.tcModeAutoBtn.addEventListener("click", () => {
      els.tcModeAutoBtn.classList.add("active");
      els.tcModeManualBtn.classList.remove("active");
      els.decksRemainField.classList.add("hidden");
    });
    els.tcModeManualBtn.addEventListener("click", () => {
      els.tcModeManualBtn.classList.add("active");
      els.tcModeAutoBtn.classList.remove("active");
      els.decksRemainField.classList.remove("hidden");
    });
    els.decksRemainRange.addEventListener("input", () => {
      els.decksRemainReadout.textContent = Number(els.decksRemainRange.value).toFixed(2);
    });
    els.countSystemSelect.addEventListener("change", () => {
      const hiOpt = els.countSystemSelect.value === "hiopt2";
      els.aceSideField.classList.toggle("hidden", !hiOpt);
      if (!hiOpt) setSegmented(els.aceSideOnBtn, els.aceSideOffBtn, false);
    });
    els.aceSideOnBtn.addEventListener("click", () => {
      if (els.countSystemSelect.value !== "hiopt2") return;
      setSegmented(els.aceSideOnBtn, els.aceSideOffBtn, true);
    });
    els.aceSideOffBtn.addEventListener("click", () => setSegmented(els.aceSideOnBtn, els.aceSideOffBtn, false));
    els.surrenderToggleOn.addEventListener("click", () => setSegmented(els.surrenderToggleOn, els.surrenderToggleOff, true));
    els.surrenderToggleOff.addEventListener("click", () => setSegmented(els.surrenderToggleOn, els.surrenderToggleOff, false));
    els.pairsToggleOn.addEventListener("click", () => setSegmented(els.pairsToggleOn, els.pairsToggleOff, true));
    els.pairsToggleOff.addEventListener("click", () => setSegmented(els.pairsToggleOn, els.pairsToggleOff, false));
    els.rummyToggleOn.addEventListener("click", () => setSegmented(els.rummyToggleOn, els.rummyToggleOff, true));
    els.rummyToggleOff.addEventListener("click", () => setSegmented(els.rummyToggleOn, els.rummyToggleOff, false));
  }

  function bind() {
    els.nextHandBtn.addEventListener("click", () => transact(nextHandRaw, "Next hand"));
    els.resetBtn.addEventListener("click", () => transact(resetShoeRaw, "Shoe reset"));
    els.autoPlayBtn.addEventListener("click", () => transact(autoPlayRaw, "Auto play"));
    els.focusPrevBtn.addEventListener("click", () => cycleFocus(-1));
    els.focusNextBtn.addEventListener("click", () => cycleFocus(1));

    els.dealerPanel.addEventListener("click", () => setActiveTarget("dealer"));
    els.activeSeatPanel.addEventListener("click", () => {
      const snapshot = primarySeatSnapshot();
      if (!snapshot) return;
      setActiveTarget(snapshot.seat.id);
    });
    els.userSeatGrid.addEventListener("click", (event) => {
      const target = event.target.closest("[data-target]");
      if (!target) return;
      setActiveTarget(target.dataset.target);
    });
    els.tableSeatGrid.addEventListener("click", (event) => {
      const target = event.target.closest("[data-target]");
      if (!target) return;
      setActiveTarget(target.dataset.target);
    });

    els.hitBtn.addEventListener("click", () => transact(hitRaw));
    els.standBtn.addEventListener("click", () => transact(standRaw));
    els.doubleBtn.addEventListener("click", () => transact(doubleRaw));
    els.splitBtn.addEventListener("click", () => transact(splitRaw));
    els.surrenderBtn.addEventListener("click", () => transact(surrenderRaw));
    els.insuranceBtn.addEventListener("click", () => transact(toggleInsuranceRaw, "Insurance toggled"));
    els.continuePromptBtn.addEventListener("click", () => transact(continuePromptRaw));

    els.settingsBtn.addEventListener("click", openSettings);
    els.settingsCloseBtn.addEventListener("click", closeSettings);
    els.settingsBackdrop.addEventListener("click", closeSettings);
    els.settingsApplyBtn.addEventListener("click", applySettings);
    els.settingsResetBtn.addEventListener("click", resetSettings);
    bindSettingsButtons();

    els.tapPad.addEventListener("pointerdown", (event) => {
      const rankButton = event.target.closest("button[data-rank]");
      if (!rankButton) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastTapAt < TAP_DEBOUNCE_MS) return;
      lastTapAt = now;
      transact(() => addCardToTargetRaw(state.activeTargetId, rankButton.dataset.rank));
    }, { passive: false });

    els.tapUndo.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      undo();
    }, { passive: false });

    els.tapTarget.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      cycleFocus(1);
    }, { passive: false });

    document.addEventListener("keydown", (event) => {
      if (isSettingsOpen()) {
        if (event.key === "Escape") closeSettings();
        return;
      }
      if (isTypingContext()) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        transact(nextHandRaw, "Next hand");
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        cycleFocus(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === " " && state.phase === "insurance_surrender") {
        event.preventDefault();
        transact(continuePromptRaw);
        return;
      }

      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        cycleFocus(1);
        return;
      }

      if (event.key === "x" || event.key === "X") {
        event.preventDefault();
        cycleFocus(-1);
        return;
      }

      if (event.key === "h" || event.key === "H") {
        event.preventDefault();
        transact(hitRaw);
        return;
      }

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        transact(standRaw);
        return;
      }

      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        transact(doubleRaw);
        return;
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        transact(splitRaw);
        return;
      }

      if (event.key === "u" || event.key === "U") {
        event.preventDefault();
        transact(surrenderRaw);
        return;
      }

      if (event.key === "i" || event.key === "I") {
        event.preventDefault();
        transact(toggleInsuranceRaw, "Insurance toggled");
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        transact(autoPlayRaw, "Auto play");
        return;
      }

      const rank = Engine.normalizeRank(event.key);
      if (!rank) return;
      transact(() => addCardToTargetRaw(state.activeTargetId, rank));
    });
  }

  recomputeSeenStats();
  computeDerived();
  sanitizeActiveTarget();
  bind();
  render();
  toast("Ready");
})();
