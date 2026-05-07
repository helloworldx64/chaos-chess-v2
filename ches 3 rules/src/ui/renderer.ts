import { ChoiceType, Color, GamePhase, Piece, PieceType, Position, RuleDefinition } from '../engine/types';
import { GameManager } from '../engine/game';
import { isInCheck } from '../engine/moves';
import { findKing } from '../engine/board';
import { generateRawMoves } from '../engine/moves';
import { ALL_RULES } from '../engine/rules/rules';
import { RuleCategory } from '../engine/types';

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
  private toasts: HTMLElement | null = null;

  constructor(app: HTMLElement, game: GameManager) {
    this.app = app;
    this.game = game;
    this.game.onStateChange = () => {
      if (this.game.state.pendingToast) {
        this.showToast(this.game.state.pendingToast.message, this.game.state.pendingToast.icon);
        this.game.state.pendingToast = null;
      }
      this.render();
    };
    this.render();
  }

  render(): void {
    this.app.innerHTML = '';
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
        <p class="tagline">90 game-breaking rules. 3-turn chaos drafts. Kings that explode.<br>Normal chess was never the point.</p>
        <div class="title-buttons">
          <button class="btn btn-primary" id="btn-start">⚔️ PLAY</button>
          <button class="btn btn-secondary" id="btn-rules">📜 ALL RULES</button>
          <button class="btn btn-secondary" id="btn-how">📖 HOW IT WORKS</button>
        </div>
      </div>
    `;
    this.app.querySelector('#btn-start')?.addEventListener('click', () => {
      this.game.state.phase = GamePhase.Setup;
      this.render();
    });
    this.app.querySelector('#btn-rules')?.addEventListener('click', () => {
      this.renderAllRules();
    });
    this.app.querySelector('#btn-how')?.addEventListener('click', () => {
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

    this.app.innerHTML = `
      <div class="screen active game-screen" style="position:relative;">
        <button class="menu-btn" id="btn-pause">⏸ MENU</button>
        <div id="toast-container" style="position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none;"></div>
        <div class="left-panel">
          ${this.renderTurnIndicator()}
          ${this.renderDraftCountdown()}
          <div class="active-rules-panel">
            <h3>⚡ ACTIVE RULES</h3>
            ${s.activeRules.length === 0 ? '<div style="color:var(--text-secondary);font-size:13px;">No active rules yet</div>' : ''}
            ${s.activeRules.map(r => `
              <div class="rule-badge">
                <span class="rule-icon">${r.definition.icon}</span>
                <span class="rule-name">${r.definition.name}</span>
                ${r.definition.duration === 'timed' ? `<span class="rule-timer">${r.turnsRemaining}t</span>` : `<span style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;">${r.definition.duration}</span>`}
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

    this.app.querySelector('#btn-pause')?.addEventListener('click', () => {
      this.game.pause();
      this.render();
    });

    this.app.querySelector('#chess-board')?.addEventListener('click', (e) => {
      const s = this.game.state;
      // If there's a pending choice, handle it specially
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
      this.game.selectSquare({ row, col });
    });
  }

  handleChoiceClick(row: number, col: number): void {
    const choice = this.game.state.pendingChoice;
    if (!choice) return;

    const sq = this.game.state.board[row][col];

    // Validate selection
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

    // Add to selection
    const posKey = `${row},${col}`;
    const already = choice.selected.some(s => {
      if (typeof s === 'string') return s === posKey;
      const p = s as Position;
      return p.row === row && p.col === col;
    });
    if (already) return;

    const selection = choice.type === 'selectFriendlyPiece' || choice.type === 'selectEnemyPiece' || choice.type === 'selectPiece'
      ? sq.piece!.id
      : { row, col } as Position;

    choice.selected.push(selection);

    // If enough selections made, complete
    if (choice.selected.length >= choice.count) {
      this.game.resolveChoice(choice.selected);
      this.render();
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

        // Choice target highlighting
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

        // Mines and pits are HIDDEN - not shown on board
        // Players discover them by stepping on them

        let pieceHtml = '';
        if (sq.piece) {
          const p = sq.piece;
          const isWhite = p.color === Color.White;
          const char = isWhite ? PIECE_CHARS_WHITE[p.type] : PIECE_CHARS_BLACK[p.type];

          let statusBadges = '';
          for (const [key] of p.statuses) {
            const icon = key === 'invulnerable' ? '🛡️' : key === 'frozen' ? '❄️' : key === 'plagued' ? '🦠' : key === 'webbed' ? '🕸️' : '💫';
            statusBadges += `<span class="status-badge">${icon}</span>`;
          }

          let pieceClasses = `piece ${isWhite ? 'white-piece' : 'black-piece'}`;
          for (const [key] of p.statuses) {
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
    if (turnsUntil <= 0 || turnsUntil > 3) return '';
    return `<div class="draft-countdown">🎲 Next chaos in <strong>${turnsUntil}</strong> turn${turnsUntil !== 1 ? 's' : ''}</div>`;
  }

  renderDraftOverlay(): string {
    const s = this.game.state;
    const playerName = s.draftForColor === Color.White ? s.whitePlayer : s.blackPlayer;

    return `
      <div class="draft-overlay" id="draft-overlay">
        <h2>🎲 ${playerName}, CHOOSE YOUR CHAOS!</h2>
        <div class="draft-cards">
          ${s.draftOptions.map((rule, i) => `
            <div class="draft-card" data-rule-index="${i}">
              <div class="card-icon">${rule.icon}</div>
              <div class="card-name">${rule.name}</div>
              <div class="card-desc">${rule.description}</div>
              <div class="card-type ${rule.duration}">${rule.duration} ${rule.duration === 'timed' ? '· ' + rule.baseTurns + ' turns' : ''}</div>
              <div style="font-size:11px;color:var(--text-secondary);text-align:center;opacity:0.7;font-style:italic;">"${rule.flavor}"</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderChoiceOverlay(): string {
    const pc = this.game.state.pendingChoice;
    if (!pc) return '';
    const playerName = pc.playerColor === Color.White ? this.game.state.whitePlayer : this.game.state.blackPlayer;
    const remaining = pc.count - pc.selected.length;
    return `
      <div class="draft-overlay" id="choice-overlay">
        <h2>👆 ${playerName}: ${pc.message}</h2>
        <p style="color:var(--text-secondary);font-size:18px;">${remaining > 0 ? `Select ${remaining} more...` : 'Click a valid target on the board'}</p>
        <div style="display:flex;gap:12px;margin-top:16px;">
          <button class="btn btn-danger" id="btn-cancel-choice" style="font-size:14px;padding:10px 24px;">✕ CANCEL</button>
        </div>
      </div>
    `;
  }

  renderPauseOverlay(): string {
    return `
      <div class="pause-overlay">
        <h2>⏸ PAUSED</h2>
        <button class="btn btn-primary" id="btn-resume">▶ RESUME</button>
        <button class="btn btn-secondary" id="btn-restart">🔄 RESTART</button>
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

    this.app.innerHTML = `
      <div class="screen active end-screen">
        <div class="result-icon">${isDraw ? '🤝' : '👑'}</div>
        <h2 class="${isDraw ? 'draw-text' : 'winner-text'}">${isDraw ? 'DRAW!' : `${winnerName} WINS!`}</h2>
        ${isDraw ? `<p class="end-cause">${s.endCause}</p>` : `<p class="end-cause">${winnerName} (${winnerColor}) defeated ${loserName}<br>${s.endCause}</p>`}
        <div class="title-buttons">
          <button class="btn btn-primary" id="btn-rematch">🔄 REMATCH</button>
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
      this.game.state.phase = GamePhase.Title;
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
            <li><strong>Invulnerability &gt; Death</strong> — Invulnerable pieces survive ANY death effect. Surrounding pieces still die normally.</li>
            <li><strong>Specific &gt; General</strong> — A rule targeting specific piece types overrides general movement rules.</li>
            <li><strong>Newer &gt; Older</strong> — When two rules directly conflict, the most recently drafted rule wins.</li>
            <li><strong>King death is FINAL</strong> — No rule saves a king unless it specifically grants "invulnerable" to the king.</li>
          </ol>
          <p><strong>Example:</strong> "Bishops cannot die" + "Living Bomb" on a bishop → When bomb explodes, bishop survives, but adjacent pieces still get hit.</p>

          <h3>🏆 WIN CONDITIONS</h3>
          <ul>
            <li><strong>King death by any cause:</strong> The other player wins. Explosion, pit, lightning, forced movement — all count.</li>
            <li><strong>Double king death:</strong> If both kings die simultaneously, it's a draw.</li>
            <li><strong>Checkmate:</strong> Still works.</li>
            <li><strong>Stalemate:</strong> Also a draw.</li>
          </ul>
          <p>The engine checks for king death after <em>every</em> piece removal, not just during normal moves.</p>

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
      this.game.state.phase = GamePhase.Title;
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
