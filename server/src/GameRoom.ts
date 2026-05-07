import { Socket } from 'socket.io';
import { Color, GamePhase, GameState, Move, Position, RuleDefinition } from './engine/types.js';
import { GameManager } from './engine/game.js';

export interface PlayerInfo {
  id: string;
  name: string;
  socket: Socket;
  color: Color;
  ready: boolean;
}

export class GameRoom {
  public id: string;
  public code: string;
  public players: PlayerInfo[] = [];
  public game: GameManager;
  public lastDrafter: Color | null = null;
  public started: boolean = false;

  constructor(id: string, code: string) {
    this.id = id;
    this.code = code;
    this.game = new GameManager();
  }

  addPlayer(id: string, name: string, socket: Socket): Color {
    const color = this.players.length === 0 ? Color.White : Color.Black;
    this.players.push({ id, name, socket, color, ready: false });
    return color;
  }

  getPlayer(socketId: string): PlayerInfo | undefined {
    return this.players.find(p => p.id === socketId);
  }

  removePlayer(socketId: string): void {
    this.players = this.players.filter(p => p.id !== socketId);
  }

  startGame(): void {
    this.started = true;
    this.game = new GameManager();
    const p1 = this.players[0];
    const p2 = this.players[1];
    this.game.setPlayerNames(p1.name, p2.name);
    // Force white/black assignment based on who is host vs guest
    this.game.state.whitePlayer = p1.color === Color.White ? p1.name : p2.name;
    this.game.state.blackPlayer = p1.color === Color.Black ? p1.name : p2.name;
    this.game.startGame();
    this.lastDrafter = null;
  }

  getStateForPlayer(playerColor: Color): Partial<GameState> {
    return {
      phase: this.game.state.phase,
      board: this.game.state.board,
      currentTurn: this.game.state.currentTurn,
      turnNumber: this.game.state.turnNumber,
      movesSinceLastDraft: this.game.state.movesSinceLastDraft,
      nextDraftAt: this.game.state.nextDraftAt,
      activeRules: this.game.state.activeRules,
      moveHistory: this.game.state.moveHistory,
      eventLog: this.game.state.eventLog,
      whitePlayer: this.game.state.whitePlayer,
      blackPlayer: this.game.state.blackPlayer,
      winner: this.game.state.winner,
      draw: this.game.state.draw,
      endCause: this.game.state.endCause,
      pendingChoice: this.game.state.pendingChoice,
      draftForColor: this.game.state.draftForColor,
      selectedSquare: this.game.state.selectedSquare,
      legalMoves: this.game.state.selectedSquare
        ? this.game.getLegalMovesFor(this.game.state.selectedSquare)
        : [],
    };
  }

  handleSelectSquare(playerColor: Color, pos: Position): { selectedSquare: Position | null; legalMoves: Move[] } {
    if (this.game.state.currentTurn !== playerColor) {
      return { selectedSquare: null, legalMoves: [] };
    }
    this.game.selectSquare(pos);
    return {
      selectedSquare: this.game.state.selectedSquare,
      legalMoves: this.game.state.legalMoves,
    };
  }

  handleExecuteMove(playerColor: Color, move: Move): boolean {
    if (this.game.state.currentTurn !== playerColor) return false;
    if (this.game.state.phase !== GamePhase.Playing) return false;
    this.game.executeMove(move);
    return true;
  }

  handleSelectDraftRule(playerColor: Color, rule: RuleDefinition): boolean {
    if (this.game.state.phase !== GamePhase.RuleDraft) return false;
    if (this.game.state.draftForColor !== playerColor) return false;
    this.game.selectDraftRule(rule);
    return true;
  }

  handleResolveChoice(playerColor: Color, selected: any[]): boolean {
    if (this.game.state.phase !== GamePhase.Playing) return false;
    if (!this.game.state.pendingChoice) return false;
    if (this.game.state.pendingChoice.playerColor !== playerColor) return false;
    this.game.resolveChoice(selected);
    return true;
  }

  isGameOver(): boolean {
    return this.game.state.phase === GamePhase.Ended;
  }
}