# Goblin Grotto

A small browser arcade game about grabbing loot, dodging sentries, and surviving deeper waves in a cave.

## Play

Open the local game URL in your browser:

```text
http://127.0.0.1:5173/
```

If the server is not running, start one from this folder:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://127.0.0.1:5173/
```

You can also open `index.html` directly in a browser, since the game is plain HTML, CSS, and JavaScript.

## Controls

- Move: `WASD` or arrow keys
- Dash: `Space`
- Touch: use the on-screen direction buttons and Dash button

## Goal

Collect every gold coin in the cave to advance to the next wave. Each wave adds more danger, and clearing a wave restores one health point up to a maximum of 5.

Red sentries chase you. If they touch you, you lose health. Dash into a sentry to briefly stun it.

Your best loot score is saved in your browser.

## Files

- `index.html`: page structure and game UI
- `styles.css`: layout, colors, and responsive styling
- `game.js`: gameplay, drawing, controls, scoring, and enemy behavior

## Tuning

Most gameplay values live near the top of `game.js`. Good things to experiment with:

- Player speed: search for `const speed`
- Number of coins: search for `7 + wave`
- Number of sentries: search for `3 + Math.floor`
- Sentry speed: search for `speed: 88`
- Starting health: search for `player.health = 3`
