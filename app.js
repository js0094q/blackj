// Updated state in app.js
const state = {
  // ... existing state
  tagMode: "table", // "table" (Others), "player" (Me), "dealer"
  tableLog: [],     // Stores cards from other players
  hands: [{ cards: [] }], // Your active hand(s)
};

// Updated logCard to handle "Other Players"
function logCard(rawCard, forcedTag = null) {
  const tok = normalizeCardToken(rawCard); //
  if (!tok) return;

  const tag = forcedTag ?? state.tagMode; //
  const delta = hiloValue(tok); //

  state.runningCount += delta; // Update global RC

  if (tag === "table") {
    // These are "Other Players" or general table exposures
    state.tableLog.push(tok); //
    state.history.push({ type: "CARD", tag: "table", card: tok, delta }); //
  } else if (tag === "dealer") {
    state.dealerUp = tok; //
    state.history.push({ type: "CARD", tag: "dealer", card: tok, delta }); //
  } else if (tag === "player") {
    // Only these cards trigger strategy advice
    state.hands[state.activeHand].cards.push(tok); //
    state.history.push({ type: "CARD", tag: "player", card: tok, delta }); //
  }

  render(); //
}
