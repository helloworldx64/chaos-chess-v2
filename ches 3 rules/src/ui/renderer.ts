import { ChoiceType, Color, GamePhase, Piece, PieceType, Position, RuleDefinition } from '../engine/types';
import { GameManager } from '../engine/game';
import { isInCheck } from '../engine/moves';
import { findKing } from '../engine/board';
import { generateRawMoves } from '../engine/moves';
import { ALL_RULES } from '../engine/rules/rules';
import { RuleCategory } from '../engine/types';
import { NetworkManager } from '../network/NetworkManager';

const PIECE_CHARS_BLACK: Record<PieceType, string> = {
  [PieceType.King]: '♚',
  [PieceType.Queen]: '♛',
  [PieceType.Rook]: '♜',
  [PieceType.Bishop]: '♝',
  [PieceType.Knight]: '♞',
  [PieceType.Pawn]: '♟',
};

const PIECE_CHARS_WHITE: Record<PieceType, string> = {
  [PieceType.King]: '♔',
  [PieceType.Queen]: '♕',
  [PieceType.Rook]: '♖',
  [PieceType.Bishop]: '♗',
  [PieceType.Knight]: '♘',
  [PieceType.Pawn]: '♙',
};

export class UIRenderer {
  private app: HTMLElement;
  private game: GameManager;
  private network: NetworkManager;
  private toasts: HTMLElement | null = null;
  private displayName: string = '';

  constructor(app: HTMLElement, game: GameManager, network: NetworkManager) {
    this.app = app;
    this.game = game;
    this.network = network;
    this.setupNetworkListeners();
    this.game.onStateChange = () => {
      if (this.game.state.pendingToast) {
        this.showToast(this.game.state.pendingToast.message, this.game.state.pendingToast.icon);
        this.game.state.pendingToast = null;
      }
      this.render();
    };
    this.render();
  }

  setupNetworkListeners(): void {
    this.network.onGameState = (data: any) => {
      this.applyServerState(data);
    };

    this.network.onPlayerJoined = (data: any) => {
      this.render();
    };

    this.network.onGameStarted = (data: any) => {
      window.__mode = 'multi';
      this.render();
    };

    this.network.onGameOver = (data: any) => {
      this.render();
    };

    this.network.onPlayerDisconnected = (data: any) => {
      this.showToast(`⚠️ ${data.playerName} disconnected!`, '⚠️');
    };
  }

  applyServerState(data: any): void {
    if (!data) return;
    // Apply phase first
    this.game.state.phase = data.phase;
    
    // Apply game state from server
    if (data.board) this.game.state.board = data.board;
    if (data.currentTurn !== undefined) this.game.state.currentTurn = data.currentTurn;
    if (data.turnNumber !== undefined) this.game.state.turnNumber = data.turnNumber;
    if (data.movesSinceLastDraft !== undefined) this.game.state.movesSinceLastDraft = data.movesSinceLastDraft;
    if (data.nextDraftAt !== undefined) this.game.state.nextDraftAt = data.nextDraftAt;
    if (data.activeRules) this.game.state.activeRules = data.activeRules;
    if (data.moveHistory) this.game.state.moveHistory = data.moveHistory;
    if (data.eventLog) this.game.state.eventLog = data.eventLog;
    if (data.whitePlayer) this.game.state.whitePlayer = data.whitePlayer;
    if (data.blackPlayer) this.game.state.blackPlayer = data.blackPlayer;
    if (data.winner !== undefined) this.game.state.winner = data.winner;
    if (data.draw !== undefined) this.game.state.draw = data.draw;
    if (data.endCause) this.game.state.endCause = data.endCause;
    if (data.selectedSquare) this.game.state.selectedSquare = data.selectedSquare;
    if (data.legalMoves) this.game.state.legalMoves = data.legalMoves;
    if (data.draftOptions) this.game.state.draftOptions = data.draftOptions;
    if (data.draftForColor !== undefined) this.game.state.draftForColor = data.draftForColor;
    
    // Pending choice only if it's for this player
    if (data.pendingChoice) {
      this.game.state.pendingChoice = data.pendingChoice;
    } else {
      this.game.state.pendingChoice = null;
    }

    this.render();
  }

  render(): void {
    this.app.innerHTML = '';
    
    // If in multiplayer mode and not in a game, show lobby screens
    if (window.__mode === 'multi') {
      if (this.network.code && !this.network.lobbyId) {
        this.renderMultiLobbyCreated();
        return;
      }
      if (this.network.lobbyId && this.game.state.phase !== GamePhase.Playing && this.game.state.phase !== GamePhase.RuleDraft && this.game.state.phase !== GamePhase.Ended) {
        // Host or guest with an established lobby
        if (this.network.playerColor === 'white') {
          this.renderMultiLobbyCreated();
        } else {
          this.renderWaitingForHost();
        }
        return;
      }
      if (this.game.state.phase === GamePhase.Title) {
        this.renderTitle();
        return;
      }
    }

    switch (this.game.state.phase) {
      case GamePhase.Title: this.renderTitle(); break;
      case GamePhase.Setup: this.renderSetup(); break;
      case GamePhase.Playing: this.renderGame(); break;
      case GamePhase.RuleDraft: this.renderGame(); break;
      case GamePhase.Paused: this.renderGame(); break;
      case GamePhase.Ended: this.renderEnd(); break;
    }
  }

  renderTitle(): void {
    this.app.innerHTML = `
      <div class="screen active title-screen">
        <h1>CHAOS CHESS</h1>
        <p class="tagline">80 game-breaking rules. 3-turn chaos drafts. Kings that explode.<br>Normal chess was never the point.</p>
        
        <div class="name-input-container">
          <label>Your Display Name</label>
          <input type="text" id="input-display-name" placeholder="Enter your name..." value="${this.displayName || 'Player'}">
        </div>

        <div class="title-buttons">
          <button class="btn btn-primary" id="btn-local">🎮 LOCAL HOTSEAT</button>
          <button class="btn btn-primary" id="btn-create-multi">🌐 CREATE MULTIPLAYER LOBBY</button>
          <button class="btn btn-primary" id="btn-join-multi">🔗 JOIN LOBBY VIA CODE</button>
          <button class="btn btn-secondary" id="btn-rules">📜 ALL RULES</button>
          <button class="btn btn-secondary" id="btn-how">📖 HOW IT WORKS</button>
        </div>
      </div>
    `;

    this.app.querySelector('#input-display-name')?.addEventListener('input', (e: any) => {
      this.displayName = e.target.value || 'Player';
    });

    this.app.querySelector('#btn-local')?.addEventListener('click', () => {
      window.__mode = 'local';
      this.game.state.phase = GamePhase.Setup;
      this.render();
    });

    this.app.querySelector('#btn-create-multi')?.addEventListener('click', async () => {
      const name = this.displayName || 'Player';
      window.__mode = 'multi';
      try {
        if (!this.network.connected) {
          await this.network.connect();
        }
        const result = await this.network.createLobby(name);
        this.game.state.whitePlayer = name;
        this.game.state.blackPlayer = 'Waiting for opponent...';
        this.renderMultiLobbyCreated();
      } catch (err) {
        this.showToast('❌ Failed to create lobby', '❌');
      }
    });

    this.app.querySelector('#btn-join-multi')?.addEventListener('click', () => {
      window.__mode = 'multi';
      this.renderJoinLobby();
    });

    this.app.querySelector('#btn-rules')?.addEventListener('click', () => {
      this.renderAllRules();
    });
    this.app.querySelector('#btn-how')?.addEventListener('click', () => {
      this.renderHowItWorks();
    });
  }

  renderJoinLobby(): void {
    this.app.innerHTML = `
      <div class="screen active setup-screen">
        <h2>🔗 JOIN LOBBY</h2>
        <div class="setup-container" style="flex-direction:column;gap:16px;">
          <div class="player-setup" style="width:100%;">
            <label>Your Name</label>
            <input type="text" id="join-name" placeholder="Enter name..." value="${this.displayName || 'Player 2'}">
          </div>
          <div class="player-setup" style="width:100%;">
            <label>Lobby Code</label>
            <input type="text" id="join-code" placeholder="Enter 6-character code..." style="text-transform:uppercase;letter-spacing:4px;font-size:20px;text-align:center;">
          </div>
        </div>
        <button class="btn btn-primary" id="btn-join-now">🚪 JOIN LOBBY</button>
        <div id="join-status" style="margin-top:12px;color:var(--text-secondary);font-size:14px;"></div>
        <button class="btn btn-secondary" id="btn-back-join" style="margin-top:12px;">← BACK</button>
      </div>
    `;

    this.app.querySelector('#btn-join-now')?.addEventListener('click', async () => {
      const code = (this.app.querySelector('#join-code') as HTMLInputElement).value.trim().toUpperCase();
      const name = (this.app.querySelector('#join-name') as HTMLInputElement).value || 'Player 2';
      if (code.length < 4) {
        this.app.querySelector('#join-status')!.textContent = '⚠️ Please enter a valid code';
        return;
      }
      try {
        if (!this.network.connected) {
          await this.network.connect();
        }
        const result = await this.network.joinLobby(code, name);
        this.displayName = name;
        this.game.state.blackPlayer = name;
        // Get game state from server
        this.network.requestGameState();
      } catch (err: any) {
        this.app.querySelector('#join-status')!.textContent = `⚠️ ${err.message}`;
      }
    });

    this.app.querySelector('#btn-back-join')?.addEventListener('click', () => {
      this.game.state.phase = GamePhase.Title;
      this.render();
    });
  }

  renderMultiLobbyCreated(): void {
    const lobbyCode = this.network.code || '------';
    const hostName = this.displayName || 'Host';

    this.app.innerHTML = `
      <div class="screen active setup-screen">
        <h2>🌐 LOBBY CREATED</h2>
        <div class="lobby-code-display">
          <div class="lobby-code-label">Share this code with your opponent:</div>
          <div class="lobby-code-value">${lobbyCode}</div>
        </div>
        <div class="lobby-players">
          <div class="lobby-player host">
            <span class="player-color-dot white"></span>
            <span>${hostName} (You)</span>
            <span class="player-color-tag">WHITE</span>
          </div>
          <div class="lobby-vs">VS</div>
          <div class="lobby-player guest" id="guest-slot">
            <span class="player-color-dot black"></span>
            <span id="guest-name">Waiting for opponent...</span>
            <span class="player-color-tag">BLACK</span>
          </div>
        </div>
        <div id="lobby-status" style="color:var(--text-secondary);font-size:14px;margin-top:12px;">Waiting for a player to join...</div>
        <button class="btn btn-primary" id="btn-start-multi" style="display:none;">🎲 START GAME</button>
        <button class="btn btn-secondary" id="btn-leave-lobby">← LEAVE LOBBY</button>
        <button class="btn btn-secondary" id="btn-rules-multi">📜 ALL RULES</button>
        <button class="btn btn-secondary" id="btn-how-multi">📖 HOW IT WORKS</button>
      </div>
    `;

    // Listen for player join
    this.network.onPlayerJoined = (data: any) => {
      const guestEl = this.app.querySelector('#guest-name');
      if (guestEl) guestEl.textContent = data.guestName || 'Opponent';
      const statusEl = this.app.querySelector('#lobby-status');
      if (statusEl) statusEl.textContent = `${data.guestName || 'Opponent'} joined! Ready to play.`;
      const startBtn = this.app.querySelector('#btn-start-multi') as HTMLElement;
      if (startBtn) startBtn.style.display = 'inline-flex';
    };

    this.app.querySelector('#btn-start-multi')?.addEventListener('click', () => {
      this.network.startGame();
    });

    this.app.querySelector('#btn-leave-lobby')?.addEventListener('click', () => {
      this.network.disconnect();
      this.game.goToTitle();
      window.__mode = 'local';
    });

    this.app.querySelector('#btn-rules-multi')?.addEventListener('click', () => {
      this.renderAllRules();
    });

    this.app.querySelector('#btn-how-multi')?.addEventListener('click', () => {
      this.renderHowItWorks();
    });
  }

  renderWaitingForHost(): void {
    const guestName = this.displayName || 'Guest';
    const hostName = this.game.state.whitePlayer || 'Host';

    this.app.innerHTML = `
      <div class="screen active setup-screen">
        <h2>🎮 JOINED LOBBY</h2>
        <div class="lobby-players">
          <div class="lobby-player host">
            <span class="player-color-dot white"></span>
            <span>${hostName}</span>
            <span class="player-color-tag">WHITE</span>
          </div>
          <div class="lobby-vs">VS</div>
          <div class="lobby-player guest">
            <span class="player-color-dot black"></span>
            <span>${guestName} (You)</span>
            <span class="player-color-tag">BLACK</span>
          </div>
        </div>
        <div id="waiting-status" style="color:var(--text-secondary);font-size:16px;margin-top:24px;text-align:center;">
          ⏳ Waiting for ${hostName} to start the game...
        </div>
        <button class="btn btn-secondary" id="btn-leave-lobby">← LEAVE LOBBY</button>
        <button class="btn btn-secondary" id="btn-rules-multi">📜 ALL RULES</button>
        <button class="btn btn-secondary" id="btn-how-multi">📖 HOW IT WORKS</button>
      </div>
    `;

    this.app.querySelector('#btn-leave-lobby')?.addEventListener('click', () => {
      this.network.disconnect();
      this.game.goToTitle();
      window.__mode = 'local';
    });

    this.app.querySelector('#btn-rules-multi')?.addEventListener('click', () => {
      this.renderAllRules();
    });

    this.app.querySelector('#btn-how-multi')?.addEventListener('click', () => {
      this.renderHowItWorks();
    });
  }

  renderSetup(): void {
    this.app.innerHTML = `
      <div class="screen active setup-screen">
        <h2>PLAYER SETUP</h2>
        <div class="setup-container">
          <div class="player-setup">
            <label>Player 1</label>
            <input type="text" id="p1-name" placeholder="Enter name..." value="${this.game.state.player1Name}">
            <div class="color-assignment" id="p1-color">?</div>
          </div>
          <div class="vs-text">VS</div>
          <div class="player-setup">
            <label>Player 2</label>
            <input type="text" id="p2-name" placeholder="Enter name..." value="${this.game.state.player2Name}">
            <div class="color-assignment" id="p2-color">?</div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-start-game">🎲 START GAME</button>
        <button class="btn btn-secondary" id="btn-back-title">← BACK</button>
      </div>
    `;

    this.app.querySelector('#btn-start-game')?.addEventListener('click', () => {
      const p1 = (this.app.querySelector('#p1-name') as HTMLInputElement).value || 'Player 1';
      const p2 = (this.app.querySelector('#p2-name') as HTMLInputElement).value || 'Player 2';
      this.game.setPlayerNames(p1, p2);
      this.game.startGame();
      this.render();
    });

    this.app.querySelector('#btn-back-title')?.addEventListener('click', () => {
      this.game.state.phase = GamePhase.Title;
      this.render();
    });
  }

  renderGame(): void {
    const s = this.game.state;
    const isMulti = window.__mode === 'multi';

    this.app.innerHTML = `
      <div class="screen active game-screen" style="position:relative;">
        <button class="menu-btn" id="btn-pause">⏸ ${isMulti ? 'MENU' : 'MENU'}</button>
        <div id="toast-container" style="position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none;"></div>
        <div class="left-panel">
          ${this.renderTurnIndicator()}
          ${isMulti ? `<div class="player-color-badge ${this.network.playerColor === 'white' ? 'white-turn' : 'black-turn'}">You are ${this.network.playerColor === 'white' ? 'WHITE' : 'BLACK'}</div>` : ''}
          ${this.renderDraftCountdown()}
          <div class="active-rules-panel">
            <h3>⚡ ACTIVE RULES</h3>
            ${s.activeRules.length === 0 ? '<div style="color:var(--text-secondary);font-size:13px;">No active rules yet</div>' : ''}
            ${s.activeRules.map(r => `
              <div class="rule-badge" data-rule-id="${r.definition.id}">
                <span class="rule-icon">${r.definition.icon}</span>
                <span class="rule-name">${r.definition.name}</span>
                ${r.definition.duration === 'timed' ? `<span class="rule-timer">${r.turnsRemaining}t</span>` : `<span style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;">${r.definition.duration}</span>`}
                <span class="rule-info-icon" title="Click for details">ℹ️</span>
              </div>
            `).join('')}
          </div>
          <div class="turn-counter">
            Turn <span class="turn-num">${s.turnNumber}</span>
          </div>
        </div>
        <div class="board-container">
          <div class="board-wrapper">
            <div class="board" id="chess-board">
              ${this.renderBoard()}
              ${this.renderCheckLines()}
            </div>
          </div>
        </div>
        <div class="right-panel">
          <div class="event-log">
            <h3>📜 EVENT LOG</h3>
            ${s.eventLog.slice(-10).reverse().map((e: any) => `
              <div class="log-entry ${e.type}">${e.message}</div>
            `).join('')}
          </div>
        </div>
      </div>
      ${s.phase === GamePhase.RuleDraft ? this.renderDraftOverlay() : ''}
      ${s.phase === GamePhase.Paused ? this.renderPauseOverlay() : ''}
      ${s.pendingChoice ? this.renderChoiceOverlay() : ''}
    `;

    // Rule badge click to show description tooltip
    this.app.querySelectorAll('.rule-badge').forEach(el => {
      el.addEventListener('click', () => {
        const ruleId = (el as HTMLElement).dataset.ruleId;
        if (!ruleId) return;
        const rule = ALL_RULES.find(r => r.id === ruleId);
        if (rule) {
          this.showToast(`${rule.icon} ${rule.name}: ${rule.description}`, rule.icon);
        }
      });
    });

    this.app.querySelector('#btn-pause')?.addEventListener('click', () => {
      this.game.pause();
      this.render();
    });

    this.app.querySelector('#chess-board')?.addEventListener('click', (e) => {
      const s = this.game.state;
      if (s.pendingChoice) {
        const target = (e.target as HTMLElement).closest('.square') as HTMLElement;
        if (!target) return;
        const row = parseInt(target.dataset.row!);
        const col = parseInt(target.dataset.col!);
        this.handleChoiceClick(row, col);
        return;
      }
      const target = (e.target as HTMLElement).closest('.square') as HTMLElement;
      if (!target) return;
      const row = parseInt(target.dataset.row!);
      const col = parseInt(target.dataset.col!);

      if (isMulti) {
        this.network.selectSquare(row, col);
      } else {
        this.game.selectSquare({ row, col });
      }
    });
  }

  handleChoiceClick(row: number, col: number): void {
    const choice = this.game.state.pendingChoice;
    if (!choice) return;

    const sq = this.game.state.board[row][col];

    if (choice.type === 'selectFriendlyPiece') {
      if (!sq.piece || sq.piece.color !== choice.playerColor) return;
      if (choice.excludeKing && sq.piece.type === PieceType.King) return;
      if (choice.onlyTypes && !choice.onlyTypes.includes(sq.piece.type)) return;
      if (choice.excludeTypes && choice.excludeTypes.includes(sq.piece.type)) return;
    } else if (choice.type === 'selectEnemyPiece') {
      if (!sq.piece || sq.piece.color === choice.playerColor) return;
      if (choice.excludeKing && sq.piece.type === PieceType.King) return;
    } else if (choice.type === 'selectEmptySquare') {
      if (sq.piece) return;
    } else if (choice.type === 'selectPiece') {
      if (!sq.piece) return;
      if (choice.excludeKing && sq.piece.type === PieceType.King) return;
      if (choice.onlyTypes && !choice.onlyTypes.includes(sq.piece.type)) return;
    }

    const posKey = `${row},${col}`;
    const already = choice.selected.some((s: any) => {
      if (typeof s === 'string') return s === posKey;
      const p = s as Position;
      return p.row === row && p.col === col;
    });
    if (already) return;

    const selection = choice.type === 'selectFriendlyPiece' || choice.type === 'selectEnemyPiece' || choice.type === 'selectPiece'
      ? sq.piece!.id
      : { row, col } as Position;

    choice.selected.push(selection);

    if (choice.selected.length >= choice.count) {
      if (window.__mode === 'multi') {
        this.network.resolveChoice(choice.selected);
      } else {
        this.game.resolveChoice(choice.selected);
        this.render();
      }
    } else {
      this.render();
    }
  }

  renderCheckLines(): string {
    const s = this.game.state;
    const board = s.board;
    const currentColor = s.currentTurn;

    if (!isInCheck(board, currentColor)) return '';

    const king = findKing(board, currentColor);
    if (!king) return '';

    const enemyColor = currentColor === Color.White ? Color.Black : Color.White;
    const lines: string[] = [];

    for (const row of board) {
      for (const sq of row) {
        if (sq.piece && sq.piece.color === enemyColor) {
          const attacks = generateRawMoves(board, sq.piece);
          if (attacks.some(m => m.to.row === king.position.row && m.to.col === king.position.col)) {
            const fromX = (sq.col / 8 * 100);
            const fromY = (sq.row / 8 * 100);
            const toX = (king.position.col / 8 * 100);
            const toY = (king.position.row / 8 * 100);
            lines.push(`
              <line x1="${fromX}%" y1="${fromY}%" x2="${toX}%" y2="${toY}%"
                stroke="#ff2244" stroke-width="0.6%" stroke-linecap="round"
                stroke-dasharray="1.2%,0.6%" opacity="0.9">
                <animate attributeName="stroke-dashoffset" from="0" to="3.6%" dur="0.5s" repeatCount="indefinite"/>
              </line>
            `);
          }
        }
      }
    }

    if (lines.length === 0) return '';

    return `
      <svg class="check-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;">
        <defs>
          <filter id="glow-check">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#glow-check)">
          ${lines.join('\n')}
        </g>
        <rect x="${(king.position.col / 8 * 100)}%" y="${(king.position.row / 8 * 100)}%" width="12.5%" height="12.5%"
          fill="none" stroke="#ff2244" stroke-width="0.5%" rx="4" opacity="0.8">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="0.8s" repeatCount="indefinite"/>
        </rect>
      </svg>
    `;
  }

  renderBoard(): string {
    const s = this.game.state;
    const lastMove = s.moveHistory.length > 0 ? s.moveHistory[s.moveHistory.length - 1] : null;
    let html = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = s.board[r][c];
        const isLight = (r + c) % 2 === 0;
        const isSelected = s.selectedSquare && s.selectedSquare.row === r && s.selectedSquare.col === c;
        const isLegalMove = s.legalMoves.some(m => m.to.row === r && m.to.col === c);
        const isLegalCapture = s.legalMoves.some(m => m.to.row === r && m.to.col === c && m.captures.length > 0);
        const isLastMoveFrom = lastMove && lastMove.from.row === r && lastMove.from.col === c;
        const isLastMoveTo = lastMove && lastMove.to.row === r && lastMove.to.col === c;

        let isChoiceTarget = false;
        const pc = s.pendingChoice;
        if (pc) {
          if (pc.type === 'selectFriendlyPiece' || pc.type === 'selectPiece') {
            if (sq.piece && sq.piece.color === pc.playerColor) {
              if (!(pc.excludeKing && sq.piece.type === PieceType.King)) {
                if ((!pc.onlyTypes || pc.onlyTypes.includes(sq.piece.type)) &&
                    (!pc.excludeTypes || !pc.excludeTypes.includes(sq.piece.type))) {
                  isChoiceTarget = true;
                }
              }
            }
          } else if (pc.type === 'selectEnemyPiece') {
            if (sq.piece && sq.piece.color !== pc.playerColor) {
              if (!(pc.excludeKing && sq.piece.type === PieceType.King)) {
                isChoiceTarget = true;
              }
            }
          } else if (pc.type === 'selectEmptySquare') {
            if (!sq.piece) isChoiceTarget = true;
          }
        }

        let classes = `square ${isLight ? 'light' : 'dark'}`;
        if (isSelected) classes += ' selected';
        if (isLegalMove && !isLegalCapture) classes += ' legal-move';
        if (isLegalCapture) classes += ' legal-capture';
        if (isLastMoveFrom) classes += ' last-move-from';
        if (isLastMoveTo) classes += ' last-move-to';
        if (sq.isTreasure) classes += ' is-treasure';
        if (sq.isMarked && sq.markType === 'wall') classes += ' marked-wall';
        if (sq.isMarked && sq.markType === 'lava') classes += ' marked-lava';
        if (sq.isMarked && sq.markType === 'mystery') classes += ' marked-mystery';
        if (isChoiceTarget) classes += ' choice-target';
        if (sq.isPortal) classes += ' is-portal';

        let pieceHtml = '';
        if (sq.piece) {
          const p = sq.piece;
          const isWhite = p.color === Color.White;
          const char = isWhite ? PIECE_CHARS_WHITE[p.type] : PIECE_CHARS_BLACK[p.type];

          // statuses is a Map client-side, but plain {} when from server JSON
          const statusEntries: [string, any][] = p.statuses instanceof Map
            ? [...p.statuses.entries()]
            : Object.entries(p.statuses || {});

          let statusBadges = '';
          for (const [key] of statusEntries) {
            const icon = key === 'invulnerable' ? '🛡️' : key === 'frozen' ? '❄️' : key === 'plagued' ? '🦠' : key === 'webbed' ? '🕸️' : key === 'bomb' ? '💥' : '💫';
            statusBadges += `<span class="status-badge">${icon}</span>`;
          }

          let pieceClasses = `piece ${isWhite ? 'white-piece' : 'black-piece'}`;
          for (const [key] of statusEntries) {
            pieceClasses += ` ${key}`;
          }

          pieceHtml = `<div class="${pieceClasses}">${char}${statusBadges}</div>`;
        }

        html += `<div class="${classes}" data-row="${r}" data-col="${c}">
          <span class="coord-label file">${c === 7 ? (8 - r) : ''}</span>
          <span class="coord-label rank">${r === 7 ? String.fromCharCode(97 + c) : ''}</span>
          ${pieceHtml}
        </div>`;
      }
    }
    return html;
  }

  renderTurnIndicator(): string {
    const s = this.game.state;
    const isWhite = s.currentTurn === Color.White;
    const playerName = isWhite ? s.whitePlayer : s.blackPlayer;
    const inCheck = isInCheck(s.board, s.currentTurn);
    return `
      <div class="turn-indicator ${isWhite ? 'white-turn' : 'black-turn'}" style="${inCheck ? 'border-color:#ff2244!important;animation:checkFlash 0.5s ease-in-out infinite;' : ''}">
        <div class="turn-dot ${isWhite ? 'white' : 'black'}"></div>
        <span>${playerName}'s turn (${isWhite ? 'White' : 'Black'})${inCheck ? ' 🔴 IN CHECK!' : ''}</span>
      </div>
    `;
  }

  renderDraftCountdown(): string {
    const turnsUntil = this.game.getTurnsUntilDraft();
    if (turnsUntil <= 0) return '';
    return `<div class="draft-countdown">🎲 Next chaos in <strong>${turnsUntil}</strong> turn${turnsUntil !== 1 ? 's' : ''}</div>`;
  }

  renderDraftOverlay(): string {
    const s = this.game.state;
    const playerName = s.draftForColor === Color.White ? s.whitePlayer : s.blackPlayer;
    const drafterColor = s.draftForColor === Color.White ? 'White' : 'Black';
    const isMulti = window.__mode === 'multi';
    const isMyDraft = isMulti
      ? ((this.network.playerColor === 'white' && s.draftForColor === Color.White) ||
         (this.network.playerColor === 'black' && s.draftForColor === Color.Black))
      : true;

    return `
      <div class="draft-overlay" id="draft-overlay">
        <h2>🎲 ${isMulti && !isMyDraft ? `${playerName} IS` : `${playerName},`} CHOOSING CHAOS!</h2>
        <p style="color:var(--text-secondary);font-size:16px;margin-bottom:16px;">
          ${isMulti && !isMyDraft
            ? `Your opponent (${drafterColor}) is picking a new rule...`
            : isMulti
            ? `Pick a rule to add chaos to the game!`
            : `Pick a rule to add chaos to the game!`}
        </p>
        <div class="draft-cards">
          ${s.draftOptions.map((rule, i) => {
            const isLocked = isMulti && !isMyDraft;
            return `
              <div class="draft-card ${isLocked ? 'locked' : ''}" data-rule-index="${i}">
                ${isLocked ? '<div class="lock-overlay">🔒</div>' : ''}
                <div class="card-icon">${rule.icon}</div>
                <div class="card-name">${rule.name}</div>
                <div class="card-desc">${rule.description}</div>
                <div class="card-type ${rule.duration}">${rule.duration} ${rule.duration === 'timed' ? '· ' + rule.baseTurns + ' turns' : ''}</div>
                <div style="font-size:11px;color:var(--text-secondary);text-align:center;opacity:0.7;font-style:italic;">"${rule.flavor}"</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderChoiceOverlay(): string {
    const pc = this.game.state.pendingChoice;
    if (!pc) return '';
    const playerName = pc.playerColor === Color.White ? this.game.state.whitePlayer : this.game.state.blackPlayer;
    const remaining = pc.count - pc.selected.length;
    const isMulti = window.__mode === 'multi';
    const isMyChoice = isMulti
      ? ((this.network.playerColor === 'white' && pc.playerColor === Color.White) ||
         (this.network.playerColor === 'black' && pc.playerColor === Color.Black))
      : true;

    if (isMulti && !isMyChoice) {
      return `
        <div class="draft-overlay" id="choice-overlay">
          <h2>⏳ ${playerName} is making a choice...</h2>
          <p style="color:var(--text-secondary);font-size:18px;">Waiting for ${playerName} to ${pc.message.toLowerCase()}...</p>
        </div>
      `;
    }

    return `
      <div class="draft-overlay" id="choice-overlay">
        <h2>👆 ${playerName}: ${pc.message}</h2>
        <p style="color:var(--text-secondary);font-size:18px;">${remaining > 0 ? `Select ${remaining} more...` : 'Click a valid target on the board'}</p>
      </div>
    `;
  }

  renderPauseOverlay(): string {
    const isMulti = window.__mode === 'multi';
    return `
      <div class="pause-overlay">
        <h2>⏸ ${isMulti ? 'GAME PAUSED' : 'PAUSED'}</h2>
        <button class="btn btn-primary" id="btn-resume">▶ RESUME</button>
        ${isMulti ? '' : '<button class="btn btn-secondary" id="btn-restart">🔄 RESTART</button>'}
        <button class="btn btn-secondary" id="btn-rules-paused">📜 ALL RULES</button>
        <button class="btn btn-secondary" id="btn-how-paused">📖 HOW IT WORKS</button>
        <button class="btn btn-danger" id="btn-quit">🚪 QUIT TO TITLE</button>
      </div>
    `;
  }

  renderEnd(): void {
    const s = this.game.state;
    const isDraw = s.draw;
    const winner = s.winner;
    const winnerName = winner === Color.White ? s.whitePlayer : s.blackPlayer;
    const loserName = winner === Color.White ? s.blackPlayer : s.whitePlayer;
    const winnerColor = winner === Color.White ? 'White' : 'Black';
    const isMulti = window.__mode === 'multi';

    this.app.innerHTML = `
      <div class="screen active end-screen">
        <div class="result-icon">${isDraw ? '🤝' : '👑'}</div>
        <h2 class="${isDraw ? 'draw-text' : 'winner-text'}">${isDraw ? 'DRAW!' : `${winnerName} WINS!`}</h2>
        ${isDraw ? `<p class="end-cause">${s.endCause}</p>` : `<p class="end-cause">${winnerName} (${winnerColor}) defeated ${loserName}<br>${s.endCause}</p>`}
        <div class="title-buttons">
          ${isMulti ? '' : '<button class="btn btn-primary" id="btn-rematch">🔄 REMATCH</button>'}
          <button class="btn btn-secondary" id="btn-title-end">🏠 TITLE SCREEN</button>
        </div>
      </div>
    `;

    this.app.querySelector('#btn-rematch')?.addEventListener('click', () => {
      this.game.state.phase = GamePhase.Setup;
      this.render();
    });
    this.app.querySelector('#btn-title-end')?.addEventListener('click', () => {
      this.game.goToTitle();
      window.__mode = 'local';
    });
  }

  renderAllRules(): void {
    const categories = [
      { key: RuleCategory.Movement, label: '🚶 Movement & Board', rules: ALL_RULES.filter(r => r.category === RuleCategory.Movement || r.category === RuleCategory.Board) },
      { key: RuleCategory.Hazard, label: '💥 Hazard & Death', rules: ALL_RULES.filter(r => r.category === RuleCategory.Hazard) },
      { key: RuleCategory.Transformation, label: '🔄 Transformation', rules: ALL_RULES.filter(r => r.category === RuleCategory.Transformation) },
      { key: RuleCategory.Meta, label: '🎭 Meta & Defense', rules: ALL_RULES.filter(r => r.category === RuleCategory.Meta || r.category === RuleCategory.Defense) },
      { key: RuleCategory.Special, label: '⭐ Special', rules: ALL_RULES.filter(r => r.category === RuleCategory.Special) },
    ];

    this.app.innerHTML = `
      <div class="screen active how-it-works">
        <button class="menu-btn" id="btn-back-rules">← BACK</button>
        <h2>📜 ALL ${ALL_RULES.length} RULES</h2>
        <div class="content" style="max-width:1000px;">
          <p style="text-align:center;margin-bottom:24px;">Every rule in Chaos Chess. Rules are drafted every 3 turns from a random selection of 3.</p>
          ${categories.filter(c => c.rules.length > 0).map(cat => `
            <h3>${cat.label} <span style="font-size:14px;color:var(--text-secondary);font-family:'Inter',sans-serif;">(${cat.rules.length} rules)</span></h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:24px;">
              ${cat.rules.map(r => `
                <div style="background:var(--bg-card);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.05);">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:24px;">${r.icon}</span>
                    <span style="font-weight:700;font-size:15px;">${r.name}</span>
                    <span style="margin-left:auto;font-size:10px;padding:2px 8px;border-radius:10px;text-transform:uppercase;font-weight:600;
                      ${r.duration === 'instant' ? 'background:rgba(255,68,68,0.2);color:var(--accent-fire);' :
                        r.duration === 'timed' ? 'background:rgba(68,170,255,0.2);color:var(--accent-ice);' :
                        'background:rgba(170,68,255,0.2);color:var(--accent-purple);'}">
                      ${r.duration}${r.duration === 'timed' ? '·'+r.baseTurns+'t' : ''}
                    </span>
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">${r.description}</div>
                  <div style="font-size:11px;color:var(--text-secondary);opacity:0.5;margin-top:4px;font-style:italic;">"${r.flavor}"</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.app.querySelector('#btn-back-rules')?.addEventListener('click', () => {
      this.render();
    });
  }

  renderHowItWorks(): void {
    this.app.innerHTML = `
      <div class="screen active how-it-works">
        <button class="menu-btn" id="btn-back-how">← BACK</button>
        <h2>📖 HOW CHAOS CHESS WORKS</h2>
        <div class="content">
          <h3>🎯 OBJECTIVE</h3>
          <p>Kill the enemy king by any means necessary. In Chaos Chess, a king can die from <strong>anything</strong>: explosions, pits, lightning, betrayal, you name it. If a king dies, the game ends immediately.</p>
          <p>If both kings die at the same time (e.g., from the same explosion), it's a <strong>draw</strong>.</p>
          <p>Standard checkmate also works, but explosions are more fun.</p>

          <h3>🎲 THE 3-TURN RULE DRAFT</h3>
          <p>Every <strong>3 full turns</strong> (6 moves total), the game pauses and the current player picks a new rule from 3 random options drawn from a pool of <strong>${ALL_RULES.length} rules</strong>.</p>
          <p>Rules come in three flavors:</p>
          <ul>
            <li><strong>⚡ Instant</strong> — One-shot effects (earthquakes, column swaps, tornadoes). Happen immediately.</li>
            <li><strong>⏱ Timed</strong> — Effects that last for a set number of turns with a visible countdown.</li>
            <li><strong>♾️ Permanent</strong> — Rules that last for the rest of the match (mines, pits, etc.). Choose wisely!</li>
          </ul>

          <h3>🔄 RULE OVERLAP RESOLUTION</h3>
          <p>Rules interact in this priority order:</p>
          <ol>
            <li><strong>Invulnerability > Death</strong> — Invulnerable pieces survive ANY death effect. Surrounding pieces still die normally.</li>
            <li><strong>Specific > General</strong> — A rule targeting specific piece types overrides general movement rules.</li>
            <li><strong>Newer > Older</strong> — When two rules directly conflict, the most recently drafted rule wins.</li>
            <li><strong>King death is FINAL</strong> — No rule saves a king unless it specifically grants "invulnerable" to the king.</li>
          </ol>

          <h3>🌐 MULTIPLAYER</h3>
          <p>Want to play against a friend online?</p>
          <ul>
            <li><strong>Create Lobby</strong> — Get a 6-character code to share with your opponent</li>
            <li><strong>Join Lobby</strong> — Enter the code your friend shared</li>
            <li><strong>Server-authoritative</strong> — All game logic runs on the server, preventing cheating</li>
            <li><strong>Both see the same board</strong> — Rule draft choices are visible to both players (only the drafter can choose)</li>
          </ul>

          <h3>🏆 WIN CONDITIONS</h3>
          <ul>
            <li><strong>King death by any cause:</strong> The other player wins. Explosion, pit, lightning, forced movement — all count.</li>
            <li><strong>Double king death:</strong> If both kings die simultaneously, it's a draw.</li>
            <li><strong>Checkmate:</strong> Still works.</li>
            <li><strong>Stalemate:</strong> Also a draw.</li>
          </ul>

          <h3>⚠️ ILLEGAL STATES ARE ALLOWED</h3>
          <p>This is NOT FIDE chess. If rules put your king in check but only pawns can move — that's fine. If a tornado drags your king into danger — that's chaos. The engine always obeys active rules.</p>

          <h3>🔍 HIDDEN TRAPS</h3>
          <p>Mines, pits, and other hazards are <strong>invisible</strong>. You won't see them on the board. You only discover them when a piece steps on them. Watch your step!</p>

          <h3>💡 PLAY TIPS</h3>
          <ul>
            <li><strong>Active rules</strong> are listed on the left panel with timers. Check them often!</li>
            <li><strong>Red dashed lines</strong> show which enemy pieces are threatening your king.</li>
            <li><strong>Status badges</strong> on pieces show effects: 🛡️ invulnerable, ❄️ frozen, 🦠 plagued, 🕸️ webbed.</li>
            <li><strong>Plan drafts</strong> — think about how a rule combos with existing ones.</li>
            <li><strong>Hidden traps</strong> mean every move is a gamble. Risk vs reward!</li>
          </ul>
        </div>
      </div>
    `;

    this.app.querySelector('#btn-back-how')?.addEventListener('click', () => {
      this.render();
    });
  }

  showToast(message: string, icon: string = '⚡'): void {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
      background:linear-gradient(135deg,#1a1a3e,#2a2a5e);
      border:2px solid var(--accent-gold);
      border-radius:12px;
      padding:12px 24px;
      font-size:18px;
      font-weight:700;
      color:var(--accent-gold);
      box-shadow:0 4px 24px rgba(255,215,0,0.3);
      animation: toastSlideIn 0.3s ease-out;
      text-align:center;
      white-space:nowrap;
    `;
    toast.textContent = `${icon} ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}