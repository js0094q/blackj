# BLACKJ

BLACKJ is a single-page blackjack counting and decision trainer aligned to the MyBookie live table rules below:

- 6 decks
- Dealer hits soft 17
- Blackjack pays 3:2
- Double allowed
- Double after split allowed
- Split once only
- Split aces receive exactly one card each
- Insurance available against a dealer Ace
- Early surrender supported

## Current Practice Model

- One shared shoe, discard flow, running count, true count, and decks remaining estimate
- Dealer hand plus Player Seat 1 and optional Player Seat 2
- Explicit round phases: idle, initial deal setup, insurance / surrender window, seat turns, dealer resolution, hand complete, next hand ready
- Dealer hole card is auto-dealt from the shoe once the opening layout is complete
- Dealer resolution follows H17 exactly
- Auto Play completes unresolved hands using the exact rule-aware recommendation engine

## Controls

- Card entry: `A`, `2-9`, `T` on keyboard or tap pad
- Focus cycle: `Tab`, `Shift+Tab`, `C`, `X`
- Undo: `Backspace`
- Next hand: `Enter`
- Auto play: `M`
- Hit: `H`
- Stand: `S`
- Double: `D`
- Split: `P`
- Surrender: `U`
- Insurance toggle: `I`
- Continue insurance / surrender prompt: `Space`

## Settings

- Hi-Lo, Wong Halves, and Hi-Opt II count systems
- Manual true count override
- Bankroll units and Kelly cap
- Optional Hi-Opt II ace side count

## Notes

- Insurance is shown only during the dealer Ace prompt and is kept separate from the main move recommendation.
- Natural blackjack is only a two-card 21 that was not created after a split.
- Split aces are forced to stand after one card each.
