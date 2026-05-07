import { BoardSquare, Color, GamePhase, GameState, LogEntry, Move, Piece, PieceType, Position, RuleCategory, RuleDefinition } from './types';
import { createBoard, placePieces, movePiece, removePiece, findKing, pieceAt } from './board';
import { generateLegalMoves, generateRawMoves, isCheckmate, isStalemate, isInCheck } from './moves';
import { RuleEngine } from './rules/engine';
import { RuleRegistry } from './rules/registry';
import { shuffleArray, randomInt } from '../utils/helpers';

export class GameManager {
  state!: GameState;
  engine: RuleEngine = new RuleEngine();
  registry: RuleRegistry = new RuleRegistry();
  onStateChange?: () => void;

  constructor() {
    this.reset();
  }

  reset(): void {
    const board = createBoard();
    const pieces = placePieces(board);
    const usedIds = new Set<string>();
    const draftPool = this.registry.getRandomDraft([]);
    const draftIds = draftPool.map(r => r.id);

    this.state = {
      phase: GamePhase.Title,
      board,
      pieces,
      currentTurn: Color.White,
      turnNumber: 1,
      movesSinceLastDraft: 0,
      nextDraftAt: randomInt(6, 10),
      activeRules: [],
      moveHistory: [],
      eventLog: [],
      player1Name: 'Player 1',
      player2Name: 'Player 2',
      whitePlayer: '',
      blackPlayer: '',
      selectedSquare: null,
      legalMoves: [],
      winner: null,
      draw: false,
      endCause: '',
      draftOptions: [],
      draftForColor: Color.White,
      pendingAnimations: [],
      pendingToast: null,
      pendingChoice: null,
      pieceIdCounter: 33,
    };

    this.engine = new RuleEngine();
  }

  startGame(): void {
    const board = createBoard();
    const pieces = placePieces(board);
    this.state.board = board;
    this.state.pieces = pieces;
    this.state.phase = GamePhase.Playing;
    this.state.currentTurn = Color.White;
    this.state.turnNumber = 1;
    this.state.movesSinceLastDraft = 0;
    this.state.nextDraftAt = randomInt(6, 10);
    this.state.activeRules = [];
    this.state.moveHistory = [];
    this.state.eventLog = [{ turn: 0, message: 'Game started! White moves first.', type: 'system' }];
    this.state.legalMoves = [];
    this.state.selectedSquare = null;
    this.state.winner = null;
    this.state.draw = false;
    this.state.endCause = '';
    this.state.pendingToast = null;
    this.state.pendingChoice = null;
    this.state.pendingAnimations = [];
    this.engine = new RuleEngine();
    this.state.pieceIdCounter = 33;
    this.onStateChange?.();
  }

  setPlayerNames(p1: string, p2: string): void {
    this.state.player1Name = p1 || 'Player 1';
    this.state.player2Name = p2 || 'Player 2';
    const colors = shuffleArray([Color.White, Color.Black]);
    this.state.whitePlayer = colors[0] === Color.White ? this.state.player1Name : this.state.player2Name;
    this.state.blackPlayer = colors[0] === Color.Black ? this.state.player1Name : this.state.player2Name;
  }

  getCurrentPlayerName(): string {
    return this.state.currentTurn === Color.White ? this.state.whitePlayer : this.state.blackPlayer;
  }

  selectSquare(pos: Position): void {
    if (this.state.phase !== GamePhase.Playing) return;

    const clickedPiece = this.state.board[pos.row][pos.col].piece;

    // If clicking on own piece, select it
    if (clickedPiece && clickedPiece.color === this.state.currentTurn) {
      this.state.selectedSquare = pos;
      this.state.legalMoves = this.getLegalMovesFor(pos);
      this.onStateChange?.();
      return;
    }

    // If a square is already selected and clicked square is a legal move
    if (this.state.selectedSquare) {
      const isLegal = this.state.legalMoves.some(m => m.to.row === pos.row && m.to.col === pos.col);
      if (isLegal) {
        const move = this.state.legalMoves.find(m => m.to.row === pos.row && m.to.col === pos.col)!;
        this.executeMove(move);
        return;
      }
    }

    // Deselect
    this.state.selectedSquare = null;
    this.state.legalMoves = [];
    this.onStateChange?.();
  }

  getLegalMovesFor(pos: Position): Move[] {
    const piece = this.state.board[pos.row][pos.col].piece;
    if (!piece) return [];
    const baseMoves = generateLegalMoves(this.state.board, piece);
    return this.engine.applyGetMoves(this.state, piece, baseMoves);
  }

  executeMove(move: Move): void {
    const modified = this.engine.applyBeforeMove(this.state, move);
    if (!modified) {
      this.state.selectedSquare = null;
      this.state.legalMoves = [];
      this.onStateChange?.();
      return;
    }

    const fromPiece = this.state.board[modified.from.row][modified.from.col].piece;
    if (!fromPiece) return;

    if (modified.promotionType) {
      fromPiece.type = modified.promotionType;
    }

    // Recalculate captures after rules may have changed destination
    const captured = this.state.board[modified.to.row][modified.to.col].piece;
    modified.captures = captured ? [captured] : [];

    if (captured) {
      const canCapture = this.engine.applyBeforeCapture(this.state, modified);
      if (!canCapture) {
        this.state.selectedSquare = null;
        this.state.legalMoves = [];
        this.onStateChange?.();
        return;
      }
      removePiece(this.state.board, { row: modified.to.row, col: modified.to.col });
      this.engine.applyOnCapture(this.state, captured, modified.piece);
      if (captured.type === PieceType.King && this.checkGameEnd()) {
        this.state.selectedSquare = null;
        this.state.legalMoves = [];
        this.onStateChange?.();
        return;
      }
    }

    // Check for mines/pits on destination
    const destSquare = this.state.board[modified.to.row][modified.to.col];
    if (destSquare.hasMine || destSquare.isPit) {
      const cause = destSquare.hasMine ? 'mine' : 'pit';
      this.logEvent(`${fromPiece.color} ${fromPiece.type} stepped on a ${cause}!`, 'death');
      removePiece(this.state.board, { row: modified.from.row, col: modified.from.col });
      this.engine.applyOnDeath(this.state, fromPiece, cause);
      this.state.selectedSquare = null;
      this.state.legalMoves = [];
      this.checkGameEnd();
      this.onStateChange?.();
      return;
    }

    // Execute the move
    const pieceTypeName = fromPiece.type;
    movePiece(this.state.board, modified.from, modified.to);

    this.state.moveHistory.push(modified);
    this.logEvent(`${this.getCurrentPlayerName()} moved ${pieceTypeName} from ${String.fromCharCode(97 + modified.from.col)}${8 - modified.from.row} to ${String.fromCharCode(97 + modified.to.col)}${8 - modified.to.row}${captured ? ' capturing ' + captured.type : ''}`, 'move');

    this.engine.applyAfterMove(this.state, modified);

    // Process status effects
    for (const p of this.getAllPieces()) {
      for (const [key, status] of p.statuses) {
        if (status.turnsRemaining > 0 && status.turnsRemaining < 999) {
          status.turnsRemaining--;
          if (status.turnsRemaining <= 0) {
            p.statuses.delete(key);
          }
        }
      }
    }

    this.state.selectedSquare = null;
    this.state.legalMoves = [];
    this.state.movesSinceLastDraft++;

    if (this.checkGameEnd()) {
      this.onStateChange?.();
      return;
    }

    // Check for chaos draft BEFORE switching turns
    // The player who just moved gets to pick the rule
    if (this.state.movesSinceLastDraft >= this.state.nextDraftAt) {
      this.triggerRuleDraft();
      return; // don't switch turns yet; draft resolves in selectDraftRule
    }

    this.engine.applyTurnEnd(this.state, this.state.currentTurn);

    if (this.checkGameEnd()) {
      this.onStateChange?.();
      return;
    }

    this.state.currentTurn = this.state.currentTurn === Color.White ? Color.Black : Color.White;
    this.state.turnNumber++;

    this.engine.applyTurnStart(this.state, this.state.currentTurn);

    for (const p of this.getAllPieces()) {
      this.engine.applyModifyPieceStatus(this.state, p);
    }

    if (this.checkGameEnd()) {
      this.onStateChange?.();
      return;
    }

    this.engine.advanceTurns(this.state);

    this.onStateChange?.();
  }

  triggerRuleDraft(): void {
    const exclude = this.state.activeRules.map(r => r.definition.id);
    const options = this.registry.getRandomDraft(exclude);
    this.state.draftOptions = options;
    this.state.draftForColor = this.state.currentTurn;
    this.state.phase = GamePhase.RuleDraft;
    this.logEvent(`Rule draft! ${this.getCurrentPlayerName()} picks a new rule.`, 'rule');
    this.onStateChange?.();
  }

  selectDraftRule(rule: RuleDefinition): void {
    const active = this.engine.activateRule(rule, this.state);
    this.state.activeRules.push(active);
    this.logEvent(`${this.getCurrentPlayerName()} selected rule: ${rule.name}`, 'rule');
    this.state.pendingToast = {
      message: `NEW RULE: ${rule.icon} ${rule.name}`,
      icon: rule.icon,
    };

    this.state.draftOptions = [];
    this.state.movesSinceLastDraft = 0;
    this.state.nextDraftAt = randomInt(6, 10); // next draft in random 3-5 turns (6-10 half-moves)

    const afterDraft = () => {
      // Switch turns now that draft is resolved
      this.engine.applyTurnEnd(this.state, this.state.currentTurn);
      this.state.currentTurn = this.state.currentTurn === Color.White ? Color.Black : Color.White;
      this.state.turnNumber++;
      this.engine.applyTurnStart(this.state, this.state.currentTurn);
      for (const p of this.getAllPieces()) {
        this.engine.applyModifyPieceStatus(this.state, p);
      }
      this.engine.advanceTurns(this.state);
      this.state.phase = GamePhase.Playing;
      this.checkGameEnd();
      this.onStateChange?.();
    };

    // Check if rule needs player input (choice)
    if (rule.needsChoice) {
      const ctx = this.engine.makeContext(this.state);
      const choice = rule.needsChoice(ctx);
      if (choice) {
        this.state.pendingChoice = choice;
        this.state.phase = GamePhase.Playing;
        this.onStateChange?.();
        return;
      }
    }

    afterDraft();
  }

  resolveChoice(selected: any[]): void {
    if (!this.state.pendingChoice) return;
    const choice = this.state.pendingChoice;
    choice.onComplete(selected);
    this.state.pendingChoice = null;

    if (this.checkGameEnd()) {
      this.onStateChange?.();
      return;
    }

    // Continue the after-draft flow: switch turns and advance
    this.engine.applyTurnEnd(this.state, this.state.currentTurn);
    this.state.currentTurn = this.state.currentTurn === Color.White ? Color.Black : Color.White;
    this.state.turnNumber++;
    this.engine.applyTurnStart(this.state, this.state.currentTurn);
    for (const p of this.getAllPieces()) {
      this.engine.applyModifyPieceStatus(this.state, p);
    }
    this.engine.advanceTurns(this.state);
    this.state.phase = GamePhase.Playing;
    this.checkGameEnd();
    this.onStateChange?.();
  }

  checkGameEnd(): boolean {
    const whiteKing = findKing(this.state.board, Color.White);
    const blackKing = findKing(this.state.board, Color.Black);

    if (!whiteKing && !blackKing) {
      this.state.phase = GamePhase.Ended;
      this.state.draw = true;
      this.state.endCause = 'Both kings died simultaneously!';
      this.logEvent('Both kings died! DRAW!', 'system');
      this.onStateChange?.();
      return true;
    }
    if (!whiteKing) {
      this.state.phase = GamePhase.Ended;
      this.state.winner = Color.Black;
      this.state.endCause = 'White king was killed!';
      this.logEvent(`${this.state.blackPlayer} wins! White king died.`, 'system');
      this.onStateChange?.();
      return true;
    }
    if (!blackKing) {
      this.state.phase = GamePhase.Ended;
      this.state.winner = Color.White;
      this.state.endCause = 'Black king was killed!';
      this.logEvent(`${this.state.whitePlayer} wins! Black king died.`, 'system');
      this.onStateChange?.();
      return true;
    }

    // Check for checkmate/stalemate
    if (isCheckmate(this.state.board, this.state.currentTurn)) {
      this.state.phase = GamePhase.Ended;
      this.state.winner = this.state.currentTurn === Color.White ? Color.Black : Color.White;
      this.state.endCause = 'Checkmate!';
      this.logEvent(`Checkmate! ${this.getCurrentPlayerName()} has no legal moves.`, 'system');
      this.onStateChange?.();
      return true;
    }
    if (isStalemate(this.state.board, this.state.currentTurn)) {
      this.state.phase = GamePhase.Ended;
      this.state.draw = true;
      this.state.endCause = 'Stalemate!';
      this.logEvent('Stalemate! It\'s a draw.', 'system');
      this.onStateChange?.();
      return true;
    }

    return false;
  }

  getAllPieces(): Piece[] {
    const pieces: Piece[] = [];
    for (const row of this.state.board) {
      for (const sq of row) {
        if (sq.piece) pieces.push(sq.piece);
      }
    }
    return pieces;
  }

  logEvent(message: string, type: LogEntry['type']): void {
    this.state.eventLog.push({
      turn: this.state.turnNumber,
      message,
      type,
    });
  }

  getTurnsUntilDraft(): number {
    const remaining = this.state.nextDraftAt - this.state.movesSinceLastDraft;
    return Math.max(0, Math.ceil(remaining / 2));
  }

  pause(): void {
    if (this.state.phase === GamePhase.Playing) {
      this.state.phase = GamePhase.Paused;
      this.onStateChange?.();
    }
  }

  resume(): void {
    if (this.state.phase === GamePhase.Paused) {
      this.state.phase = GamePhase.Playing;
      this.onStateChange?.();
    }
  }

  goToTitle(): void {
    this.reset();
    this.onStateChange?.();
  }
}
