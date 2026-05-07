# 🏆 Chaos Chess

**80 game-breaking rules. 3-turn chaos drafts. Kings that explode. Normal chess was never the point.**

A chaotic chess variant where every 3 turns, players draft new reality-bending rules. Featuring mines, portals, earthquakes, zombie apocalypses, living bombs, and 70+ more ways to make your king explode.

## 🎯 Features

- **80+ Unique Rules** — Movement, hazards, transformations, meta effects
- **3-Turn Rule Draft** — Every 3 full turns, pick from 3 random rules
- **Hotseat Local Multiplayer** — Play on the same screen
- **Online Multiplayer** — Play with friends via lobby codes (Socket.IO)
- **Rule Overlap Logic** — Invulnerability > death, specific > general, newer > older
- **Hidden Traps** — Mines, pits, and other surprises
- **Real-time Check Lines** — Visual indicators of threats to your king
- **Status Effects** — Frozen, poisoned, webbed, invulnerable, and more

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### Local Hotseat (Single Computer)

```bash
cd "ches 3 rules"
npm install
npm run dev
```

Open the URL shown in terminal (usually `http://localhost:5173`).

### Online Multiplayer

#### 1. Start the Server

```bash
cd server
npm install
npm run dev
```

Server runs on `http://localhost:3001`.

#### 2. Start the Frontend

```bash
cd "ches 3 rules"
npm install
npm run dev
```

#### 3. Play!

- Player 1: Click **CREATE MULTIPLAYER LOBBY** → share the 6-character code
- Player 2: Click **JOIN LOBBY VIA CODE** → enter the code
- Player 1 clicks **START GAME**

## 🌐 Deployment

### Server (Render, Railway, Fly.io, etc.)

```bash
cd server
npm install
npm run build
npm start
```

Environment variables:
- `PORT` — Server port (default: 3001)

### Frontend (Netlify, Vercel, Cloudflare Pages)

1. Build: `cd "ches 3 rules" && npm install && npm run build`
2. Publish the `dist/` directory
3. Set environment variable: `__SERVER_URL__` to your deployed server URL

## 📜 Gameplay

### Objective
Kill the enemy king by any means necessary. If a king dies, the game ends.

**Win conditions:**
- King death by any cause (explosion, pit, lightning, capture)
- Checkmate
- Draw on double king death or stalemate

### The 3-Turn Rule Draft
Every **3 full turns** (6 moves), the current player picks a new rule from 3 random options.

**Rule types:**
- ⚡ **Instant** — One-shot effects (earthquake, column swap)
- ⏱ **Timed** — Lasts N turns with visible countdown
- ♾️ **Permanent** — Lasts the entire match (choose wisely!)

### Rule Interaction Order
1. **Invulnerability > Death** — Invulnerable pieces survive anything
2. **Specific > General** — Type-specific rules override general
3. **Newer > Older** — Most recently drafted rule wins conflicts
4. **King death is FINAL** — Unless king has invulnerable status

## 🎮 Controls

- **Click** a piece to select it → shows legal moves
- **Click** a legal target to move/capture
- **Click** a draft card to select a rule
- **Click** a highlighted target when choice is required
- **ESC** to pause

## 🏗 Project Structure

```
chaos-chess/
├── ches 3 rules/          # Frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── engine/         # Game engine (board, moves, rules)
│   │   ├── ui/             # Renderer, styles
│   │   ├── network/        # Socket.IO client
│   │   └── main.ts         # Entry point
│   └── index.html
├── server/                 # Backend (Express + Socket.IO)
│   ├── src/
│   │   ├── engine/         # Server-side game engine (copied)
│   │   ├── LobbyManager.ts # Lobby code management
│   │   ├── GameRoom.ts     # Game session management
│   │   └── index.ts        # Socket.IO server
│   └── package.json
└── README.md
```

## 🛠 Tech Stack

- **Frontend:** TypeScript, Vite, Socket.IO Client
- **Backend:** Node.js, Express, Socket.IO
- **Rendering:** Vanilla DOM (no framework)
- **Styling:** CSS with custom properties

## 📝 License

MIT