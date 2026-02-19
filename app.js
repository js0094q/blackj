<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BLACKJ · Pro Trainer</title>
<link rel="stylesheet" href="./styles.css">
</head>
<body>

<header class="topbar">
  <div class="brand">
    <div class="brand-title">BLACKJ</div>
    <div class="brand-sub">MYBOOKIE.AG ONLY · 6D · H17 · LS · SPLIT A: 1 CARD</div>
  </div>

  <div class="hud">
    <div class="hud-box">
      <div class="hud-label">RC</div>
      <div id="rc-val" class="hud-val">0</div>
    </div>

    <div class="hud-box hud-focus">
      <div class="hud-label">TC</div>
      <div id="tc-val" class="hud-val">0.0</div>
      <div id="tc-band" class="hud-band">NEUTRAL</div>
    </div>

    <div class="hud-box">
      <div class="hud-label">DECKS</div>
      <div id="decks-left" class="hud-val">6.0</div>
    </div>
  </div>
</header>

<main class="main">
<section class="primary">

  <div class="action-card" id="action-card">

    <div class="status-row">
      <div id="state-tag" class="status">READY</div>
      <div id="dev-tag" class="status muted">NO DEVIATION</div>
    </div>

    <div class="mode-indicator">MODE: <span id="mode-indicator-val">DEALER</span></div>
    <div class="mode-indicator">FLOW: <span id="flow-indicator-val">MANUAL</span></div>

    <div class="action-label">RECOMMENDED</div>
    <div id="rec-action" class="action-val">---</div>
    <div class="mini-grid">
      <div>
        <div class="state-k">Action Winrate</div>
        <div id="rec-winrate" class="state-v">--</div>
      </div>
      <div>
        <div class="state-k">Last Result</div>
        <div id="stats-last" class="state-v">--</div>
      </div>
    </div>
    <div id="rec-reason" class="action-reason">MYBOOKIE ONLY · Enter player/others/dealer cards via keyboard.</div>

    <div class="divider"></div>

    <div class="result-row">
      <button id="btn-win" type="button">WIN (W)</button>
      <button id="btn-loss" type="button">LOSS (-/Y)</button>
      <button id="btn-push" type="button">PUSH (P)</button>
      <button id="stats-reset" type="button" class="ghost">RESET STATS</button>
    </div>

    <div class="divider"></div>

    <div class="recent-row">
      <div class="state-k">Recent Inputs</div>
      <div id="input-log" class="state-v">--</div>
    </div>

    <div class="divider"></div>

    <div class="state-grid">
      <div>
        <div class="state-k">Dealer Cards</div>
        <div id="disp-dealer" class="state-v">?</div>
      </div>
      <div>
        <div class="state-k">Dealer Total</div>
        <div id="disp-dealer-total" class="state-v">--</div>
      </div>
      <div>
        <div class="state-k">Player Hand</div>
        <div id="disp-player" class="state-v">--</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="state-grid">
      <div>
        <div class="state-k">Other Player Deals</div>
        <div id="disp-table" class="state-v">--</div>
      </div>
      <div>
        <div class="state-k">Hands Logged</div>
        <div id="stats-hands" class="state-v">0</div>
      </div>
      <div>
        <div class="state-k">W-L-P</div>
        <div id="stats-wlp" class="state-v">0-0-0</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="bet-grid">
      <div>
        <div class="state-k">Est. Edge</div>
        <div id="edge-val" class="state-v">-0.60%</div>
      </div>
      <div>
        <div class="state-k">Bet TC</div>
        <div id="bet-tc-val" class="state-v">0</div>
      </div>
      <div>
        <div class="state-k">Count Confidence</div>
        <div id="count-conf-val" class="state-v">0%</div>
      </div>
      <div>
        <div class="state-k">Bet Units</div>
        <div id="bet-units" class="state-v">0</div>
      </div>
      <div>
        <div class="state-k">Wong</div>
        <div id="wong-val" class="state-v">WAIT</div>
      </div>
      <div>
        <div class="state-k">Bankroll</div>
        <div id="bankroll-val" class="state-v">$0.00</div>
      </div>
      <div>
        <div class="state-k">Unit Size</div>
        <div id="unit-val" class="state-v">$0.00</div>
      </div>
      <div>
        <div class="state-k">Hand Bet</div>
        <div id="hand-bet-val" class="state-v">$0.00</div>
      </div>
      <div>
        <div class="state-k">Profit</div>
        <div id="stats-profit" class="state-v">0.0u / $0.00</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="count-check">
      <div class="state-k">Count Skill Check (RC)</div>
      <div class="count-check-row">
        <input id="rc-guess" type="number" step="1" placeholder="Your RC guess">
        <button id="rc-check" type="button">CHECK COUNT</button>
        <button id="rc-skill-reset" type="button" class="ghost">RESET SKILL</button>
      </div>
      <div id="count-skill-val" class="state-v">No checks yet</div>
    </div>

    <div class="divider"></div>

    <div class="config-wrap">
      <div class="action-label">BET RAMP CONFIG (MYBOOKIE · INT TC · 1 DECK WARMUP)</div>
      <div class="config-grid">
        <label>Starting Bankroll
          <input id="cfg-bankroll" type="number" min="100" step="100">
        </label>
        <label>Unit % of Bankroll
          <input id="cfg-unit-pct" type="number" min="0.1" max="10" step="0.1">
        </label>
        <label>Spread Cap (units)
          <input id="cfg-spread-cap" type="number" min="1" max="50" step="1">
        </label>
        <label>Other Players (seats)
          <input id="cfg-other-players" type="number" min="0" max="6" step="1">
        </label>
      </div>

      <div class="ramp-grid">
        <div class="state-k">TC >=</div><div class="state-k">Units</div>
        <input id="cfg-tc-1" type="number" step="0.5"><input id="cfg-units-1" type="number" min="0" step="1">
        <input id="cfg-tc-2" type="number" step="0.5"><input id="cfg-units-2" type="number" min="0" step="1">
        <input id="cfg-tc-3" type="number" step="0.5"><input id="cfg-units-3" type="number" min="0" step="1">
        <input id="cfg-tc-4" type="number" step="0.5"><input id="cfg-units-4" type="number" min="0" step="1">
        <input id="cfg-tc-5" type="number" step="0.5"><input id="cfg-units-5" type="number" min="0" step="1">
      </div>

      <div class="result-row">
        <button id="cfg-apply" type="button">APPLY CONFIG + RESET BANKROLL</button>
      </div>
    </div>

  </div>

</section>
</main>

<script type="module" src="./app.js"></script>
</body>
</html>
