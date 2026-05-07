# Chaos Chess ♟️💥

A chaotic chess variant where **new rules are drafted every 3 turns**, changing movement, adding hazards, transforming pieces, and more!

## Features

- **80 dynamic rules** — Movement modifiers, hazards, transformations, defense, and meta rules
- **3-turn rule drafts** — Every 3 turns, the current player picks 1 of 3 random rules
- **Everything can kill a king** — Mines, pits, lightning, explosions, betrayal...
- **Standard chess mechanics** — Check/checkmate/stalemate still work
- **Status effects** — Invulnerable 🛡️, Frozen ❄️, Plagued 🦠, Webbed 🕸️

## Quick Start

### Option 1: Double-click `run.bat`
Just double-click `ches 3 rules/run.bat` — it will install dependencies and start the dev server.

### Option 2: Manual
```bash
cd "ches 3 rules"
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Building for Production
```bash
cd "ches 3 rules"
npm run build
```

Output goes to `ches 3 rules/dist/`. Open `dist/index.html` in a browser.

## How to Play

1. Enter player names and click START
2. Play normal chess — pieces move the same way
3. Every **3 full turns** (6 half-moves), a draft overlay appears — pick a new rule!
4. Rules are listed in the left panel with countdown timers
5. First player to kill the enemy king wins!

## Rules Overview

| Category | Count | Examples |
|----------|-------|---------|
| 🚶 Movement | 16 | Ice Physics, Pac-Man, Charge!, Ghost Pieces |
| 💥 Hazard | 15 | Minefield, Bottomless Pit, Plague, Volcano |
| 🛡️ Defense | 5 | Force Field, Invulnerability Potion, Guardian Angel |
| 🔄 Transformation | 12 | Inflation, Recession, Zombie Apocalypse, Body Swap |
| 🎭 Meta | 13 | Gambling, Betrayal, Parry, Mystery Box |
| 🎲 Board | 5 | Earthquake, Column Swap, Bamboo Growth |

## Tech Stack

- **TypeScript** — Full type safety
- **Vite** — Fast development & build
- **Pure CSS** — No frameworks needed