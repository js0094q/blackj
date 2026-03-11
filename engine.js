(function (global) {
"use strict";

const RULES = Object.freeze({
  decks: 6,
  dealerHitsSoft17: true,
  blackjackPayout: 1.5,
  insuranceAllowed: true,
  insurancePayout: 2,
  doubleAllowed: true,
  doubleAfterSplit: true,
  splitLimit: 1,
  splitAcesOneCard: true,
  surrender: "late"
});

const MIN_DECK_FRACTION = 0.25;
const CARD_ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T"];
const DEALER_UPCARDS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "A"];
const ACTIONS = Object.freeze({
  HIT: "HIT",
  STAND: "STAND",
  DOUBLE: "DOUBLE",
  SPLIT: "SPLIT",
  SURRENDER: "SURRENDER"
});

const COUNT_SYSTEMS = Object.freeze({
  hilo: {
    name: "Hi-Lo",
    weights: { A: -1, T: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0 }
  },
  wong_halves: {
    name: "Wong Halves",
    weights: { A: -1, T: -1, 2: 0.5, 3: 1, 4: 1, 5: 1.5, 6: 1, 7: 0.5, 8: 0, 9: -0.5 }
  },
  hiopt2: {
    name: "Hi-Opt II",
    weights: { A: 0, T: -2, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 0, 9: 0 }
  }
});

const INDEX_SETS = Object.freeze({
  basic_only: { id: "basic_only", name: "Basic Only", tags: [] },
  illustrious18: { id: "illustrious18", name: "Illustrious 18", tags: ["illustrious18"] },
  illustrious18_fab4: { id: "illustrious18_fab4", name: "Illustrious 18 + Fab 4", tags: ["illustrious18", "fab4"] },
  custom_ready: { id: "custom_ready", name: "Custom Ready", tags: ["illustrious18", "fab4"] }
});

const SIDE_BET_PAYOUTS = Object.freeze({
  pairs: {
    anyPair: Object.freeze({
      id: "any_pair",
      label: "Any Pair",
      payout: 11
    })
  },
  rummy: {
    threeOfAKind: Object.freeze({
      id: "three_of_a_kind",
      label: "Three of a Kind",
      payout: 9
    }),
    straight: Object.freeze({
      id: "straight",
      label: "Straight",
      payout: 4
    }),
    flush: Object.freeze({
      id: "flush",
      label: "Flush",
      payout: 4,
      requiresSuitTracking: true
    }),
    straightFlush: Object.freeze({
      id: "straight_flush",
      label: "Straight Flush",
      payout: 30,
      requiresSuitTracking: true
    }),
    suitedTrips: Object.freeze({
      id: "suited_trips",
      label: "Suited Trips",
      payout: 100,
      requiresSuitTracking: true
    })
  }
});

const HI_LO_DEVIATIONS = Object.freeze([
  { id: "insurance", tag: "illustrious18", group: "insurance", dealerUp: "A", threshold: 3, comparison: ">=", action: "TAKE", description: "Take insurance at +3 or higher." },
  { id: "16v10", tag: "illustrious18", handClass: "hard", total: 16, dealerUp: "T", threshold: 0, comparison: ">=", action: ACTIONS.STAND, requiresNoSurrender: true, description: "Stand 16 vs 10 at 0 or higher without surrender." },
  { id: "15v10", tag: "illustrious18", handClass: "hard", total: 15, dealerUp: "T", threshold: 4, comparison: ">=", action: ACTIONS.STAND, requiresNoSurrender: true, description: "Stand 15 vs 10 at +4 or higher without surrender." },
  { id: "10v10", tag: "illustrious18", handClass: "hard", total: 10, dealerUp: "T", threshold: 4, comparison: ">=", action: ACTIONS.DOUBLE, description: "Double 10 vs 10 at +4 or higher." },
  { id: "12v3", tag: "illustrious18", handClass: "hard", total: 12, dealerUp: "3", threshold: 2, comparison: ">=", action: ACTIONS.STAND, description: "Stand 12 vs 3 at +2 or higher." },
  { id: "12v2", tag: "illustrious18", handClass: "hard", total: 12, dealerUp: "2", threshold: 3, comparison: ">=", action: ACTIONS.STAND, description: "Stand 12 vs 2 at +3 or higher." },
  { id: "11vA", tag: "illustrious18", handClass: "hard", total: 11, dealerUp: "A", threshold: 1, comparison: ">=", action: ACTIONS.DOUBLE, dealerHitsSoft17: true, description: "Double 11 vs A at +1 or higher in H17." },
  { id: "9v2", tag: "illustrious18", handClass: "hard", total: 9, dealerUp: "2", threshold: 1, comparison: ">=", action: ACTIONS.DOUBLE, description: "Double 9 vs 2 at +1 or higher." },
  { id: "10vA", tag: "illustrious18", handClass: "hard", total: 10, dealerUp: "A", threshold: 4, comparison: ">=", action: ACTIONS.DOUBLE, dealerHitsSoft17: true, description: "Double 10 vs A at +4 or higher in H17." },
  { id: "9v7", tag: "illustrious18", handClass: "hard", total: 9, dealerUp: "7", threshold: 3, comparison: ">=", action: ACTIONS.DOUBLE, description: "Double 9 vs 7 at +3 or higher." },
  { id: "16v9", tag: "illustrious18", handClass: "hard", total: 16, dealerUp: "9", threshold: 5, comparison: ">=", action: ACTIONS.STAND, requiresNoSurrender: true, description: "Stand 16 vs 9 at +5 or higher without surrender." },
  { id: "13v2", tag: "illustrious18", handClass: "hard", total: 13, dealerUp: "2", threshold: -1, comparison: "<", action: ACTIONS.HIT, description: "Hit 13 vs 2 below -1." },
  { id: "12v4", tag: "illustrious18", handClass: "hard", total: 12, dealerUp: "4", threshold: 0, comparison: "<", action: ACTIONS.HIT, description: "Hit 12 vs 4 below 0." },
  { id: "12v5", tag: "illustrious18", handClass: "hard", total: 12, dealerUp: "5", threshold: -2, comparison: "<", action: ACTIONS.HIT, description: "Hit 12 vs 5 below -2." },
  { id: "12v6", tag: "illustrious18", handClass: "hard", total: 12, dealerUp: "6", threshold: -3, comparison: "<", action: ACTIONS.HIT, dealerHitsSoft17: true, description: "Hit 12 vs 6 below -3 in H17." },
  { id: "13v3", tag: "illustrious18", handClass: "hard", total: 13, dealerUp: "3", threshold: -2, comparison: "<", action: ACTIONS.HIT, description: "Hit 13 vs 3 below -2." },
  { id: "T,Tv5", tag: "illustrious18", handClass: "pair", pairRank: "T", dealerUp: "5", threshold: 5, comparison: ">=", action: ACTIONS.SPLIT, description: "Split 10s vs 5 at +5 or higher." },
  { id: "T,Tv6", tag: "illustrious18", handClass: "pair", pairRank: "T", dealerUp: "6", threshold: 5, comparison: ">=", action: ACTIONS.SPLIT, description: "Split 10s vs 6 at +5 or higher." },
  { id: "14v10", tag: "fab4", handClass: "hard", total: 14, dealerUp: "T", threshold: 3, comparison: ">=", action: ACTIONS.SURRENDER, requiresSurrender: true, description: "Surrender 14 vs 10 at +3 or higher." },
  { id: "15v9", tag: "fab4", handClass: "hard", total: 15, dealerUp: "9", threshold: 2, comparison: ">=", action: ACTIONS.SURRENDER, requiresSurrender: true, description: "Surrender 15 vs 9 at +2 or higher." },
  { id: "15v10_surr", tag: "fab4", handClass: "hard", total: 15, dealerUp: "T", threshold: 0, comparison: "<", action: ACTIONS.HIT, requiresSurrender: true, description: "Hit 15 vs 10 below 0." },
  { id: "15vA_surr", tag: "fab4", handClass: "hard", total: 15, dealerUp: "A", threshold: -1, comparison: "<", action: ACTIONS.HIT, requiresSurrender: true, dealerHitsSoft17: true, description: "Hit 15 vs A below -1 in H17." }
]);

const DEVIATION_TABLES = Object.freeze({
  hilo: HI_LO_DEVIATIONS,
  wong_halves: Object.freeze([]),
  hiopt2: Object.freeze([])
});

const EV_BY_TC = Object.freeze({
  "-3": -2.10,
  "-2": -1.60,
  "-1": -1.10,
  "0": -0.55,
  "1": 0.00,
  "2": 0.50,
  "3": 1.00,
  "4": 1.60,
  "5": 2.10,
  "6": 2.60
});

function normalizeRank(input) {
  const rank = String(input == null ? "" : input).toUpperCase().trim();
  if (rank === "A") return "A";
  if (["T", "10", "J", "Q", "K", "0"].includes(rank)) return "T";
  if ("23456789".includes(rank)) return rank;
  return null;
}

function rankValue(rank) {
  const normalized = normalizeRank(rank);
  if (!normalized) return 0;
  if (normalized === "A") return 11;
  if (normalized === "T") return 10;
  return Number(normalized);
}

function upcardValue(rank) {
  return rankValue(rank);
}

function resolveRules(overrides) {
  const merged = Object.assign({}, RULES, overrides || {});
  if (merged.surrender !== "early" && merged.surrender !== "late" && merged.surrender !== "none") {
    merged.surrender = RULES.surrender;
  }
  return merged;
}

function createShoe(decks) {
  const actualDecks = Number.isFinite(decks) ? decks : RULES.decks;
  const counts = {};
  for (const rank of CARD_ORDER) {
    counts[rank] = rank === "T" ? (16 * actualDecks) : (4 * actualDecks);
  }
  return {
    decks: actualDecks,
    counts,
    cardsRemaining: 52 * actualDecks
  };
}

function cloneShoe(shoe) {
  return {
    decks: shoe.decks,
    counts: { ...shoe.counts },
    cardsRemaining: shoe.cardsRemaining
  };
}

function consumeCardFromShoe(shoe, rank) {
  const normalized = normalizeRank(rank);
  if (!shoe || !normalized) return false;
  if (!Number.isFinite(shoe.counts[normalized]) || shoe.counts[normalized] <= 0) return false;
  shoe.counts[normalized] -= 1;
  shoe.cardsRemaining = Math.max(0, shoe.cardsRemaining - 1);
  return true;
}

function restoreCardToShoe(shoe, rank) {
  const normalized = normalizeRank(rank);
  if (!shoe || !normalized) return false;
  shoe.counts[normalized] = (shoe.counts[normalized] || 0) + 1;
  shoe.cardsRemaining += 1;
  return true;
}

function drawCardFromShoe(shoe, rng) {
  if (!shoe || shoe.cardsRemaining <= 0) return null;
  const randomFn = typeof rng === "function" ? rng : Math.random;
  let cursor = Math.floor(randomFn() * shoe.cardsRemaining);
  for (const rank of CARD_ORDER) {
    const count = shoe.counts[rank] || 0;
    if (cursor < count) {
      consumeCardFromShoe(shoe, rank);
      return rank;
    }
    cursor -= count;
  }
  return null;
}

function weightFor(rank, system) {
  const normalized = normalizeRank(rank);
  if (!normalized) return 0;
  const currentSystem = COUNT_SYSTEMS[system] || COUNT_SYSTEMS.hilo;
  return currentSystem.weights[normalized] || 0;
}

function aceSideAdjustment(remainingDecks, acesSeen, decks) {
  const expectedSeen = ((decks - remainingDecks) / decks) * (4 * decks);
  const aceDelta = expectedSeen - acesSeen;
  return aceDelta / Math.max(MIN_DECK_FRACTION, remainingDecks);
}

function classifyBand(tc) {
  if (tc <= -1) return "NEGATIVE";
  if (tc < 1) return "NEUTRAL";
  if (tc < 4) return "POSITIVE";
  return "HIGH";
}

function trueCountState(rc, cardsDealt, decks, overrideDecksRemaining, options) {
  const actualDecks = Number.isFinite(decks) ? decks : RULES.decks;
  const decksSeen = cardsDealt / 52;
  const decksRemaining = (
    typeof overrideDecksRemaining === "number" && Number.isFinite(overrideDecksRemaining)
      ? Math.max(MIN_DECK_FRACTION, overrideDecksRemaining)
      : Math.max(MIN_DECK_FRACTION, actualDecks - decksSeen)
  );

  let tc = rc / decksRemaining;
  const opts = options || {};
  if (
    (opts.countSystem || "hilo") === "hiopt2" &&
    opts.aceSideEnabled &&
    Number.isFinite(opts.acesSeen)
  ) {
    tc += aceSideAdjustment(decksRemaining, opts.acesSeen, actualDecks);
  }

  return {
    tc,
    decksSeen,
    decksRemaining,
    band: classifyBand(tc)
  };
}

function interpolatedEdge(tc) {
  if (!Number.isFinite(tc)) return -0.55;
  if (tc <= -3) return EV_BY_TC["-3"];
  if (tc >= 6) return EV_BY_TC["6"];

  const low = Math.floor(tc);
  const high = Math.ceil(tc);
  if (low === high) return EV_BY_TC[String(low)];

  const lowValue = EV_BY_TC[String(low)];
  const highValue = EV_BY_TC[String(high)];
  const fraction = tc - low;
  return lowValue + ((highValue - lowValue) * fraction);
}

function systemEdgeBias(system) {
  if (system === "wong_halves") return 0.03;
  if (system === "hiopt2") return 0.05;
  return 0;
}

function penetrationBias(decksSeen, decks) {
  if (!Number.isFinite(decksSeen) || !Number.isFinite(decks) || decks <= 0) return 0;
  const penetration = decksSeen / decks;
  if (penetration < 0.25) return -0.05;
  if (penetration < 0.50) return 0;
  if (penetration < 0.75) return 0.05;
  return 0.10;
}

function edgeEstimate(tc, decksSeen, decks, system) {
  return interpolatedEdge(tc) + systemEdgeBias(system) + penetrationBias(decksSeen, decks);
}

function kellyFraction(edgePct, variance, cap) {
  const actualVariance = Number.isFinite(variance) ? variance : 1.3;
  const actualCap = Number.isFinite(cap) ? cap : 0.25;
  const edge = (Number(edgePct) || 0) / 100;

  if (!Number.isFinite(edge) || edge <= 0) {
    return { frac: 0 };
  }

  let fraction = edge / actualVariance;
  if (fraction > actualCap) fraction = actualCap;
  if (fraction < 0) fraction = 0;
  return { frac: fraction };
}

function betUnits(edgePct, bankrollUnits, minUnit, cap) {
  const bankroll = Math.max(1, Number(bankrollUnits) || 100);
  const minimum = Math.max(1, Number(minUnit) || 1);
  const { frac } = kellyFraction(edgePct, 1.3, cap);
  const raw = bankroll * frac;
  if (raw <= 0) return { units: minimum };
  return {
    units: Math.max(minimum, Math.round(raw * 100) / 100)
  };
}

function parseCards(input) {
  if (!Array.isArray(input)) return [];
  const cards = [];
  for (const card of input) {
    const rank = normalizeRank(card);
    if (rank) cards.push(rank);
  }
  return cards;
}

function parseHandState(playerHand) {
  if (Array.isArray(playerHand)) {
    return {
      cards: parseCards(playerHand),
      fromSplit: false,
      splitFromAces: false,
      stood: false,
      doubled: false,
      surrendered: false,
      completed: false
    };
  }

  if (!playerHand || typeof playerHand !== "object") {
    return {
      cards: [],
      fromSplit: false,
      splitFromAces: false,
      stood: false,
      doubled: false,
      surrendered: false,
      completed: false
    };
  }

  return {
    cards: parseCards(playerHand.cards),
    fromSplit: !!playerHand.fromSplit,
    splitFromAces: !!playerHand.splitFromAces,
    stood: !!playerHand.stood,
    doubled: !!playerHand.doubled,
    surrendered: !!playerHand.surrendered,
    completed: !!playerHand.completed
  };
}

function handValue(hand) {
  const cards = parseCards(hand);
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += rankValue(card);
    if (card === "A") aces += 1;
  }

  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  return {
    total,
    soft: softAces > 0,
    bust: total > 21
  };
}

function total(hand) {
  return handValue(hand).total;
}

function isSoft(hand) {
  return handValue(hand).soft;
}

function isPair(hand) {
  const cards = parseCards(hand);
  if (cards.length !== 2) return false;
  return cards[0] === cards[1];
}

function isBlackjack(hand, handState) {
  const cards = parseCards(hand);
  const parsed = parseHandState(handState || { cards });
  if (cards.length !== 2) return false;
  if (parsed.fromSplit || parsed.splitFromAces) return false;
  return total(cards) === 21;
}

function classifyHand(hand, handState) {
  const parsed = parseHandState(handState || hand);
  const cards = parsed.cards;
  const value = handValue(cards);
  const pair = isPair(cards);
  return {
    cards,
    total: value.total,
    soft: value.soft,
    bust: value.bust,
    isPair: pair,
    pairRank: pair ? cards[0] : null,
    cardCount: cards.length,
    isBlackjack: isBlackjack(cards, parsed),
    category: pair ? "pair" : value.soft ? "soft" : "hard"
  };
}

function describeHand(hand) {
  const classification = classifyHand(hand);
  if (classification.cardCount === 0) return "Empty hand";
  if (classification.isPair) {
    return `Pair ${classification.pairRank === "T" ? "10s" : `${classification.pairRank}s`}`;
  }
  return `${classification.soft ? "Soft" : "Hard"} ${classification.total}`;
}

function truncateTrueCount(tc) {
  if (!Number.isFinite(tc)) return 0;
  return tc < 0 ? Math.ceil(tc) : Math.floor(tc);
}

function canSplit(handState, seatState, rules) {
  const parsed = parseHandState(handState);
  const seat = seatState || {};
  const gameRules = resolveRules(rules);
  if (!parsed || !seat) return false;
  if (!isPair(parsed.cards)) return false;
  if ((seat.splitCount || 0) >= gameRules.splitLimit) return false;
  if (parsed.cards.length !== 2) return false;
  if (parsed.completed || parsed.surrendered || parsed.stood || parsed.doubled) return false;
  return true;
}

function canDouble(handState, seatState, rules) {
  const parsed = parseHandState(handState);
  const gameRules = resolveRules(rules);
  if (!gameRules.doubleAllowed) return false;
  if (parsed.cards.length !== 2) return false;
  if (parsed.completed || parsed.surrendered || parsed.stood || parsed.doubled) return false;
  if (parsed.splitFromAces && gameRules.splitAcesOneCard) return false;
  if (parsed.fromSplit && !gameRules.doubleAfterSplit) return false;
  return true;
}

function canHit(handState, rules) {
  const parsed = parseHandState(handState);
  const gameRules = resolveRules(rules);
  if (parsed.completed || parsed.surrendered || parsed.stood || parsed.doubled) return false;
  if (parsed.splitFromAces && gameRules.splitAcesOneCard && parsed.cards.length >= 2) return false;
  return total(parsed.cards) < 21;
}

function canTakeInsurance(context) {
  if (!context || !context.round || !context.rules) return false;
  if (!context.rules.insuranceAllowed) return false;
  if (context.round.dealerPeekResolved) return false;
  if (normalizeRank(context.dealerUp) !== "A") return false;
  if (!context.hand || parseHandState(context.hand).surrendered) return false;
  return true;
}

function canSurrender(context) {
  if (!context || !context.hand || !context.rules || !context.round) return false;
  const rules = resolveRules(context.rules);
  const hand = parseHandState(context.hand);
  if (rules.surrender === "none") return false;
  if (hand.fromSplit || hand.splitFromAces) return false;
  if (hand.cards.length !== 2) return false;
  if (hand.completed || hand.stood || hand.doubled || hand.surrendered) return false;
  if (isBlackjack(hand.cards, hand)) return false;
  if (rules.surrender === "early") {
    return !context.round.dealerPeekResolved;
  }
  return !!context.round.dealerPeekResolved && !context.round.dealerHasBlackjack;
}

function pairIntent(rank, dealerUp) {
  const up = normalizeRank(dealerUp);
  if (!rank || !up) return null;
  if (rank === "A" || rank === "8") return ACTIONS.SPLIT;
  if (rank === "T") return ACTIONS.STAND;
  if (rank === "9") return ["2", "3", "4", "5", "6", "8", "9"].includes(up) ? ACTIONS.SPLIT : ACTIONS.STAND;
  if (rank === "7") return ["2", "3", "4", "5", "6", "7"].includes(up) ? ACTIONS.SPLIT : ACTIONS.HIT;
  if (rank === "6") return ["2", "3", "4", "5", "6"].includes(up) ? ACTIONS.SPLIT : ACTIONS.HIT;
  if (rank === "5") return ["2", "3", "4", "5", "6", "7", "8", "9"].includes(up) ? ACTIONS.DOUBLE : ACTIONS.HIT;
  if (rank === "4") return ["5", "6"].includes(up) ? ACTIONS.SPLIT : ACTIONS.HIT;
  if (rank === "3" || rank === "2") return ["2", "3", "4", "5", "6", "7"].includes(up) ? ACTIONS.SPLIT : ACTIONS.HIT;
  return null;
}

function hardIntent(totalValue, dealerUp) {
  const up = upcardValue(dealerUp);
  if (totalValue >= 17) return ACTIONS.STAND;
  if (totalValue >= 13 && totalValue <= 16) return up >= 2 && up <= 6 ? ACTIONS.STAND : ACTIONS.HIT;
  if (totalValue === 12) return up >= 4 && up <= 6 ? ACTIONS.STAND : ACTIONS.HIT;
  if (totalValue === 11) return ACTIONS.DOUBLE;
  if (totalValue === 10) return up >= 2 && up <= 9 ? ACTIONS.DOUBLE : ACTIONS.HIT;
  if (totalValue === 9) return up >= 3 && up <= 6 ? ACTIONS.DOUBLE : ACTIONS.HIT;
  return ACTIONS.HIT;
}

function softIntent(totalValue, dealerUp) {
  const up = upcardValue(dealerUp);
  if (totalValue >= 20) return ACTIONS.STAND;
  if (totalValue === 19) return up === 6 ? ACTIONS.DOUBLE : ACTIONS.STAND;
  if (totalValue === 18) {
    if (up >= 2 && up <= 6) return ACTIONS.DOUBLE;
    if (up === 7 || up === 8) return ACTIONS.STAND;
    return ACTIONS.HIT;
  }
  if (totalValue === 17) return up >= 3 && up <= 6 ? ACTIONS.DOUBLE : ACTIONS.HIT;
  if (totalValue === 16 || totalValue === 15) return up >= 4 && up <= 6 ? ACTIONS.DOUBLE : ACTIONS.HIT;
  if (totalValue === 14 || totalValue === 13) return up >= 5 && up <= 6 ? ACTIONS.DOUBLE : ACTIONS.HIT;
  return ACTIONS.HIT;
}

function shouldEarlySurrender(context, classification) {
  if (!canSurrender(context)) return false;
  const hand = classification || classifyHand(context.hand, context.hand);
  const up = upcardValue(context.dealerUp);
  const pairRank = hand.isPair ? hand.pairRank : null;

  if (up === 10) {
    if (pairRank === "7" || pairRank === "8") return true;
    return !hand.soft && hand.total >= 14 && hand.total <= 16;
  }

  if (up === 11) {
    if (pairRank === "2" || pairRank === "3" || pairRank === "6" || pairRank === "7" || pairRank === "8") {
      return true;
    }
    return !hand.soft && (
      (hand.total >= 5 && hand.total <= 7) ||
      (hand.total >= 12 && hand.total <= 17)
    );
  }

  if (up === 9) {
    return !hand.soft && hand.total === 16;
  }

  return false;
}

function shouldLateSurrender(context, classification) {
  if (!canSurrender(context)) return false;
  const hand = classification || classifyHand(context.hand, context.hand);
  const up = normalizeRank(context.dealerUp);
  if (!up) return false;

  if (hand.isPair && hand.pairRank === "8" && up === "A") return true;
  if (hand.soft) return false;
  if (hand.total === 17 && up === "A") return true;
  if (hand.total === 16 && ["9", "T", "A"].includes(up)) return true;
  if (hand.total === 15 && ["T", "A"].includes(up)) return true;
  return false;
}

function surrenderIntent(context, classification) {
  const rules = resolveRules(context && context.rules);
  if (rules.surrender === "early") {
    return shouldEarlySurrender(context, classification) ? ACTIONS.SURRENDER : null;
  }
  if (rules.surrender === "late") {
    return shouldLateSurrender(context, classification) ? ACTIONS.SURRENDER : null;
  }
  return null;
}

function getBaseStrategy(context, options) {
  const dealerUp = normalizeRank(context && context.dealerUp);
  const parsedHand = parseHandState(context && context.hand);
  if (!dealerUp || !parsedHand.cards.length) {
    return {
      action: "—",
      source: "incomplete",
      handClass: "incomplete"
    };
  }

  const opts = options || {};
  const classification = classifyHand(parsedHand.cards, parsedHand);
  if (classification.bust) {
    return {
      action: "—",
      source: "bust",
      handClass: classification.category
    };
  }

  if (opts.allowSurrender !== false) {
    const surrenderAction = surrenderIntent(Object.assign({}, context, { hand: parsedHand }), classification);
    if (surrenderAction) {
      return {
        action: surrenderAction,
        source: `${resolveRules(context && context.rules).surrender}-surrender`,
        handClass: classification.category
      };
    }
  }

  if (opts.allowSplit !== false && classification.isPair) {
    const pairAction = pairIntent(classification.pairRank, dealerUp);
    if (pairAction) {
      return {
        action: pairAction,
        source: "pair",
        handClass: classification.category
      };
    }
  }

  if (classification.soft) {
    return {
      action: softIntent(classification.total, dealerUp),
      source: "soft",
      handClass: classification.category
    };
  }

  return {
    action: hardIntent(classification.total, dealerUp),
    source: "hard",
    handClass: classification.category
  };
}

function legalMoves(context) {
  const parsedHand = parseHandState(context && context.hand);
  const seat = context && context.seat;
  const rules = resolveRules(context && context.rules);
  return {
    hit: canHit(parsedHand, rules),
    stand: parsedHand.cards.length > 0 && !parsedHand.completed && !parsedHand.surrendered,
    double: canDouble(parsedHand, seat, rules),
    split: canSplit(parsedHand, seat, rules),
    surrender: canSurrender(Object.assign({}, context, { hand: parsedHand, rules })),
    insurance: canTakeInsurance(Object.assign({}, context, { hand: parsedHand, rules }))
  };
}

function withOptionDisabled(context, action) {
  const options = {};
  if (action === ACTIONS.SURRENDER) options.allowSurrender = false;
  if (action === ACTIONS.SPLIT) options.allowSplit = false;
  return getBaseStrategy(context, options);
}

function normalizeRecommendation(context, intent, moves) {
  let desired = intent || getBaseStrategy(context);
  let finalAction = desired.action;
  let downgradedFrom = null;

  if (finalAction === ACTIONS.SURRENDER && !moves.surrender) {
    downgradedFrom = ACTIONS.SURRENDER;
    desired = withOptionDisabled(context, ACTIONS.SURRENDER);
    finalAction = desired.action;
  }

  if (finalAction === ACTIONS.SPLIT && !moves.split) {
    downgradedFrom = downgradedFrom || ACTIONS.SPLIT;
    desired = withOptionDisabled(context, ACTIONS.SPLIT);
    finalAction = desired.action;
  }

  if (finalAction === ACTIONS.DOUBLE && !moves.double) {
    downgradedFrom = downgradedFrom || ACTIONS.DOUBLE;
    finalAction = classifyHand(context.hand, context.hand).soft ? ACTIONS.STAND : ACTIONS.HIT;
  }

  return {
    action: finalAction,
    desiredAction: intent && intent.action ? intent.action : finalAction,
    source: desired.source,
    downgradedFrom,
    legal: !downgradedFrom
  };
}

function compareThreshold(tc, threshold, comparison) {
  if (comparison === ">=") return tc >= threshold;
  if (comparison === ">") return tc > threshold;
  if (comparison === "<=") return tc <= threshold;
  if (comparison === "<") return tc < threshold;
  return false;
}

function activeDeviationEntries(countSystem, indexSet) {
  const systemEntries = DEVIATION_TABLES[countSystem] || [];
  const setConfig = INDEX_SETS[indexSet] || INDEX_SETS.basic_only;
  if (!setConfig.tags.length) return [];
  return systemEntries.filter((entry) => setConfig.tags.includes(entry.tag));
}

function handMatchesDeviation(entry, classification, dealerUp) {
  if (entry.group === "insurance") {
    return dealerUp === entry.dealerUp;
  }
  if (entry.handClass && entry.handClass !== classification.category) return false;
  if (entry.total != null && entry.total !== classification.total) return false;
  if (entry.pairRank && entry.pairRank !== classification.pairRank) return false;
  return dealerUp === entry.dealerUp;
}

function lookupDeviation(context) {
  const countSystem = context && context.countSystem ? context.countSystem : "hilo";
  const indexSet = context && context.indexSet ? context.indexSet : "basic_only";
  const rules = resolveRules(context && context.rules);
  const dealerUp = normalizeRank(context && context.dealerUp);
  const hand = parseHandState(context && context.hand);
  const classification = classifyHand(hand.cards, hand);
  const evaluatedTc = truncateTrueCount(Number(context && context.tc));
  const entries = activeDeviationEntries(countSystem, indexSet);

  let fallbackReason = null;
  if (!entries.length && indexSet !== "basic_only") {
    fallbackReason = countSystem === "hilo"
      ? "index-set-empty"
      : "count-system-deviation-table-unavailable";
  }

  for (const entry of entries) {
    if (entry.group === "insurance") continue;
    if (entry.requiresSurrender && rules.surrender === "none") continue;
    if (entry.requiresNoSurrender && rules.surrender !== "none") continue;
    if (entry.dealerHitsSoft17 != null && !!entry.dealerHitsSoft17 !== !!rules.dealerHitsSoft17) continue;
    if (!handMatchesDeviation(entry, classification, dealerUp)) continue;
    if (compareThreshold(evaluatedTc, entry.threshold, entry.comparison)) {
      return {
        matched: {
          ...entry,
          evaluatedTc,
          appliedCountSystem: countSystem,
          appliedIndexSet: indexSet
        },
        evaluatedTc,
        fallbackReason
      };
    }
  }

  return {
    matched: null,
    evaluatedTc,
    fallbackReason
  };
}

function insuranceDecision(context) {
  const parsedHand = parseHandState(context && context.hand);
  const fullContext = Object.assign({}, context, { hand: parsedHand, rules: resolveRules(context && context.rules) });
  const available = canTakeInsurance(fullContext);
  const countSystem = context && context.countSystem ? context.countSystem : "hilo";
  const indexSet = context && context.indexSet ? context.indexSet : "basic_only";
  const evaluatedTc = truncateTrueCount(Number(context && context.tc));
  const entries = activeDeviationEntries(countSystem, indexSet);

  if (!available) {
    return {
      available: false,
      recommended: false,
      source: "unavailable",
      threshold: null,
      matchedDeviationIndex: null,
      appliedCountSystem: countSystem,
      evaluatedTc
    };
  }

  const match = entries.find((entry) => (
    entry.group === "insurance" &&
    entry.dealerUp === normalizeRank(context && context.dealerUp) &&
    compareThreshold(evaluatedTc, entry.threshold, entry.comparison)
  ));

  if (!match) {
    return {
      available: true,
      recommended: false,
      source: "basic",
      threshold: null,
      matchedDeviationIndex: null,
      appliedCountSystem: countSystem,
      evaluatedTc
    };
  }

  return {
    available: true,
    recommended: true,
    source: "index-deviation",
    threshold: match.threshold,
    matchedDeviationIndex: match.id,
    appliedCountSystem: countSystem,
    description: match.description,
    evaluatedTc
  };
}

function evaluatePairs(playerCards, options) {
  const opts = options || {};
  if (!opts.enabled) {
    return {
      enabled: false,
      qualification: "disabled",
      handClass: null,
      payoutTierLabel: null,
      payout: null,
      reason: "disabled"
    };
  }

  const cards = parseCards(playerCards);
  if (cards.length < 2) {
    return {
      enabled: true,
      qualification: "pending",
      handClass: cards.length === 1 ? "Live first card" : "Awaiting opening cards",
      payoutTierLabel: null,
      payout: null,
      reason: "need-two-player-cards"
    };
  }

  const opening = cards.slice(0, 2);
  const pair = opening[0] === opening[1];
  if (pair) {
    return {
      enabled: true,
      qualification: "qualifies",
      handClass: `Pair ${opening[0] === "T" ? "10s" : `${opening[0]}s`}`,
      payoutTierLabel: SIDE_BET_PAYOUTS.pairs.anyPair.label,
      payout: SIDE_BET_PAYOUTS.pairs.anyPair.payout,
      reason: "rank-pair-match"
    };
  }

  return {
    enabled: true,
    qualification: "miss",
    handClass: "No Pair",
    payoutTierLabel: null,
    payout: null,
    reason: "opening-cards-do-not-pair"
  };
}

function straightRanks(cards) {
  const values = cards.map((rank) => {
    if (rank === "A") return 14;
    if (rank === "T") return 10;
    return Number(rank);
  }).sort((a, b) => a - b);

  const sequences = [
    values,
    values.map((value) => (value === 14 ? 1 : value)).sort((a, b) => a - b)
  ];

  return sequences.some((sequence) => (
    sequence[1] === sequence[0] + 1 &&
    sequence[2] === sequence[1] + 1 &&
    new Set(sequence).size === 3
  ));
}

function evaluateRummy(playerCards, dealerUp, options) {
  const opts = options || {};
  if (!opts.enabled) {
    return {
      enabled: false,
      qualification: "disabled",
      handClass: null,
      payoutTierLabel: null,
      payout: null,
      reason: "disabled",
      suitTracking: false
    };
  }

  const cards = parseCards(playerCards).slice(0, 2);
  const up = normalizeRank(dealerUp);
  if (cards.length < 2 || !up) {
    return {
      enabled: true,
      qualification: "pending",
      handClass: "Awaiting opening cards and dealer upcard",
      payoutTierLabel: null,
      payout: null,
      reason: !up ? "need-dealer-upcard" : "need-two-player-cards",
      suitTracking: false
    };
  }

  const combo = [cards[0], cards[1], up];
  const uniqueRanks = new Set(combo);
  if (uniqueRanks.size === 1) {
    return {
      enabled: true,
      qualification: "qualifies",
      handClass: "Three of a Kind",
      payoutTierLabel: SIDE_BET_PAYOUTS.rummy.threeOfAKind.label,
      payout: SIDE_BET_PAYOUTS.rummy.threeOfAKind.payout,
      reason: "rank-trips",
      suitTracking: false,
      upgradeAvailable: true
    };
  }

  if (straightRanks(combo)) {
    return {
      enabled: true,
      qualification: "qualifies",
      handClass: "Straight",
      payoutTierLabel: SIDE_BET_PAYOUTS.rummy.straight.label,
      payout: SIDE_BET_PAYOUTS.rummy.straight.payout,
      reason: "rank-straight",
      suitTracking: false,
      upgradeAvailable: true
    };
  }

  return {
    enabled: true,
    qualification: "indeterminate",
    handClass: "Suit-dependent check unavailable",
    payoutTierLabel: "Flush tiers require suit tracking",
    payout: null,
    reason: "rank-only-rummy-model",
    suitTracking: false
  };
}

function evaluateSideBets(playerCards, dealerUp, options) {
  const opts = options || {};
  return {
    pairs: evaluatePairs(playerCards, { enabled: !!opts.pairsEnabled }),
    rummy: evaluateRummy(playerCards, dealerUp, { enabled: !!opts.rummyEnabled })
  };
}

function recommendPlay(playerHand, dealerUp, tc, context) {
  const hand = parseHandState(playerHand);
  const rules = resolveRules(context && context.rules);
  const dealerUpRank = normalizeRank(dealerUp);
  const countSystem = context && context.countSystem ? context.countSystem : "hilo";
  const indexSet = context && context.indexSet ? context.indexSet : "basic_only";
  const sideBetCards = parseCards((context && context.sideBetCards) || hand.cards);
  const recommendationContext = Object.assign({}, context, {
    hand,
    dealerUp: dealerUpRank,
    tc: Number(tc) || 0,
    rules,
    countSystem,
    indexSet
  });
  const classification = classifyHand(hand.cards, hand);
  const sideBets = evaluateSideBets(sideBetCards, dealerUpRank, {
    pairsEnabled: !!(context && context.sideBets && context.sideBets.pairsEnabled),
    rummyEnabled: !!(context && context.sideBets && context.sideBets.rummyEnabled)
  });
  const insurance = insuranceDecision(recommendationContext);

  if (!dealerUpRank || classification.cardCount === 0) {
    const sideBetOnly = (
      sideBets.pairs.qualification === "qualifies" ||
      sideBets.pairs.qualification === "miss" ||
      sideBets.rummy.qualification === "qualifies" ||
      sideBets.rummy.qualification === "indeterminate"
    );
    return {
      action: "—",
      desiredAction: "—",
      baseAction: null,
      source: "incomplete",
      reason: sideBetOnly ? "side-bet-only" : "insufficient-hand-state",
      legal: true,
      downgradedFrom: null,
      legalMoves: {
        hit: false,
        stand: false,
        double: false,
        split: false,
        surrender: false,
        insurance: insurance.available
      },
      insurance,
      sideBets,
      explanation: {
        matchedDeviationIndex: null,
        threshold: null,
        comparison: null,
        appliedCountSystem: countSystem,
        evaluatedTrueCount: truncateTrueCount(Number(tc) || 0),
        indexSet,
        fallbackReason: !dealerUpRank ? "missing-dealer-upcard" : "missing-player-cards",
        handClass: classification.category,
        handDescription: describeHand(hand.cards)
      }
    };
  }

  const baseIntent = getBaseStrategy(recommendationContext);
  const moves = legalMoves(recommendationContext);
  const deviationResult = lookupDeviation(recommendationContext);
  const deviation = deviationResult.matched;
  const intent = deviation
    ? {
      action: deviation.action,
      source: "index-deviation",
      handClass: classification.category
    }
    : baseIntent;
  const normalized = normalizeRecommendation(recommendationContext, intent, moves);
  const reason = deviation ? "index-deviation" : "basic";
  let fallbackReason = deviationResult.fallbackReason || null;

  if (!deviation && indexSet !== "basic_only" && countSystem === "hilo") {
    fallbackReason = fallbackReason || "no-matching-index";
  }
  if (!deviation && indexSet === "basic_only") {
    fallbackReason = "basic-only-selected";
  }
  if (normalized.downgradedFrom) {
    fallbackReason = `${normalized.downgradedFrom.toLowerCase()}-illegal`;
  }

  return {
    action: normalized.action,
    desiredAction: normalized.desiredAction,
    baseAction: baseIntent.action,
    source: normalized.source,
    reason,
    legal: normalized.legal,
    downgradedFrom: normalized.downgradedFrom,
    legalMoves: moves,
    insurance,
    sideBets,
    explanation: {
      matchedDeviationIndex: deviation ? deviation.id : null,
      threshold: deviation ? deviation.threshold : null,
      comparison: deviation ? deviation.comparison : null,
      appliedCountSystem: countSystem,
      evaluatedTrueCount: deviationResult.evaluatedTc,
      indexSet,
      fallbackReason,
      handClass: classification.category,
      handDescription: describeHand(hand.cards),
      handTotal: classification.total,
      dealerUp: dealerUpRank,
      description: deviation ? deviation.description : null
    }
  };
}

function deviationDecision(context) {
  const resolved = lookupDeviation(context || {});
  return resolved.matched || null;
}

function getRecommendation(context) {
  const recommendation = recommendPlay(
    context && context.hand,
    context && context.dealerUp,
    Number(context && context.tc) || 0,
    context || {}
  );
  return {
    action: recommendation.action,
    desiredAction: recommendation.desiredAction,
    source: recommendation.source,
    reason: recommendation.reason,
    downgradedFrom: recommendation.downgradedFrom,
    legal: recommendation.legal,
    legalMoves: recommendation.legalMoves,
    insuranceAvailable: recommendation.insurance.available,
    insuranceRecommendation: recommendation.insurance,
    explanation: recommendation.explanation,
    sideBets: recommendation.sideBets,
    baseAction: recommendation.baseAction
  };
}

function shouldDealerHit(hand, rules) {
  const gameRules = resolveRules(rules);
  const value = handValue(hand);
  if (value.total < 17) return true;
  if (value.total > 17) return false;
  return value.soft && gameRules.dealerHitsSoft17;
}

function simulateDealerPlay(startingHand, shoe, rules, rng) {
  const dealerCards = parseCards(startingHand);
  const workingShoe = cloneShoe(shoe);
  while (shouldDealerHit(dealerCards, rules || RULES)) {
    const draw = drawCardFromShoe(workingShoe, rng);
    if (!draw) break;
    dealerCards.push(draw);
  }
  return {
    cards: dealerCards,
    shoe: workingShoe
  };
}

function settleHand(handState, dealerCards, rules) {
  const parsedHand = parseHandState(handState);
  const gameRules = resolveRules(rules);
  const wager = parsedHand.doubled ? 2 : 1;
  const dealerValue = handValue(dealerCards || []);
  const playerValue = handValue(parsedHand.cards);
  const dealerBlackjack = isBlackjack(dealerCards || [], null);
  const playerBlackjack = isBlackjack(parsedHand.cards, parsedHand);

  if (parsedHand.surrendered) {
    return {
      result: "SURRENDER",
      detail: `${gameRules.surrender === "late" ? "Late" : "Early"} surrender`,
      netUnits: -0.5
    };
  }

  if (playerBlackjack && dealerBlackjack) {
    return {
      result: "PUSH",
      detail: "Blackjack push",
      netUnits: 0
    };
  }

  if (playerBlackjack) {
    return {
      result: "BLACKJACK",
      detail: "Natural blackjack pays 3:2",
      netUnits: gameRules.blackjackPayout
    };
  }

  if (dealerBlackjack) {
    return {
      result: "LOSE",
      detail: "Dealer blackjack",
      netUnits: -wager
    };
  }

  if (playerValue.bust) {
    return {
      result: "LOSE",
      detail: "Player bust",
      netUnits: -wager
    };
  }

  if (dealerValue.bust) {
    return {
      result: "WIN",
      detail: "Dealer bust",
      netUnits: wager
    };
  }

  if (playerValue.total > dealerValue.total) {
    return {
      result: "WIN",
      detail: `${playerValue.total} beats ${dealerValue.total}`,
      netUnits: wager
    };
  }

  if (playerValue.total < dealerValue.total) {
    return {
      result: "LOSE",
      detail: `${dealerValue.total} beats ${playerValue.total}`,
      netUnits: -wager
    };
  }

  return {
    result: "PUSH",
    detail: `${playerValue.total} pushes ${dealerValue.total}`,
    netUnits: 0
  };
}

global.BJEngine = {
  rules: RULES,
  actions: ACTIONS,
  cardOrder: CARD_ORDER,
  dealerUpcards: DEALER_UPCARDS,
  countSystems: COUNT_SYSTEMS,
  indexSets: INDEX_SETS,
  deviationTables: DEVIATION_TABLES,
  sideBetPayouts: SIDE_BET_PAYOUTS,
  normalizeRank,
  rankValue,
  upcardValue,
  resolveRules,
  createShoe,
  cloneShoe,
  consumeCardFromShoe,
  restoreCardToShoe,
  drawCardFromShoe,
  weightFor,
  classifyBand,
  trueCountState,
  edgeEstimate,
  kellyFraction,
  betUnits,
  parseHandState,
  parseCards,
  handValue,
  total,
  isSoft,
  isPair,
  isBlackjack,
  classifyHand,
  describeHand,
  truncateTrueCount,
  canSplit,
  canDouble,
  canHit,
  canSurrender,
  canTakeInsurance,
  getBaseStrategy,
  evaluatePairs,
  evaluateRummy,
  evaluateSideBets,
  recommendPlay,
  getRecommendation,
  deviationDecision,
  legalMoves,
  shouldDealerHit,
  simulateDealerPlay,
  settleHand
};

})(window);
