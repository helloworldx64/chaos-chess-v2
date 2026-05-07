export enum PieceType {
  King = 'king',
  Queen = 'queen',
  Rook = 'rook',
  Bishop = 'bishop',
  Knight = 'knight',
  Pawn = 'pawn',
}

export enum Color {
  White = 'white',
  Black = 'black',
}

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  position: Position;
  hasMoved: boolean;
  statuses: Map<string, StatusEffect>;
}

export interface StatusEffect {
  id: string;
  name: string;
  turnsRemaining: number;
  data: Record<string, any>;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captures: Piece[];
  special?: string;
  promotionType?: PieceType;
}

export interface BoardSquare {
  row: number;
  col: number;
  piece: Piece | null;
  hasMine: boolean;
  isPit: boolean;
  isPortal: boolean;
  portalPair?: Position;
  isMarked: boolean;
  markType?: string;
  isTreasure: boolean;
}

export enum RuleDuration {
  Instant = 'instant',
  Timed = 'timed',
  Permanent = 'permanent',
}

export enum RuleCategory {
  Movement = 'movement',
  Hazard = 'hazard',
  Transformation = 'transformation',
  Meta = 'meta',
  Defense = 'defense',
  Board = 'board',
  Special = 'special',
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  flavor: string;
  category: RuleCategory;
  duration: RuleDuration;
  baseTurns: number;
  icon: string;
  onActivate?: (ctx: RuleContext) => void;
  onDeactivate?: (ctx: RuleContext) => void;
  onBeforeMove?: (ctx: RuleContext, move: Move) => Move | null;
  onAfterMove?: (ctx: RuleContext, move: Move) => void;
  onBeforeCapture?: (ctx: RuleContext, move: Move) => boolean;
  onCapture?: (ctx: RuleContext, captured: Piece, capturer: Piece) => void;
  onDeath?: (ctx: RuleContext, piece: Piece, cause: string) => void;
  onTurnEnd?: (ctx: RuleContext, color: Color) => void;
  onTurnStart?: (ctx: RuleContext, color: Color) => void;
  onGetMoves?: (ctx: RuleContext, piece: Piece, moves: Move[]) => Move[];
  modifyPieceStatus?: (ctx: RuleContext, piece: Piece) => void;
  needsChoice?: (ctx: RuleContext) => PendingChoice | null;
  data?: Record<string, any>;
}

export interface ActiveRule {
  definition: RuleDefinition;
  turnsRemaining: number;
  isActive: boolean;
  data: Record<string, any>;
}

export interface RuleContext {
  board: BoardSquare[][];
  pieces: Piece[];
  activeRules: ActiveRule[];
  turnNumber: number;
  currentColor: Color;
  triggerPiece?: Piece;
  triggerPosition?: Position;
  random: () => number;
}

export enum GamePhase {
  Title = 'title',
  Setup = 'setup',
  Playing = 'playing',
  RuleDraft = 'ruleDraft',
  Paused = 'paused',
  Ended = 'ended',
}

export interface GameState {
  phase: GamePhase;
  board: BoardSquare[][];
  pieces: Piece[];
  currentTurn: Color;
  turnNumber: number;
  movesSinceLastDraft: number;
  nextDraftAt: number;
  activeRules: ActiveRule[];
  moveHistory: Move[];
  eventLog: LogEntry[];
  player1Name: string;
  player2Name: string;
  whitePlayer: string;
  blackPlayer: string;
  selectedSquare: Position | null;
  legalMoves: Move[];
  winner: Color | null;
  draw: boolean;
  endCause: string;
  draftOptions: RuleDefinition[];
  draftForColor: Color;
  pendingAnimations: AnimationEvent[];
  pendingToast: { message: string; icon: string } | null;
  pendingChoice: PendingChoice | null;
  pieceIdCounter: number;
}

export interface LogEntry {
  turn: number;
  message: string;
  type: 'rule' | 'move' | 'death' | 'explosion' | 'event' | 'system';
}

export interface AnimationEvent {
  type: 'move' | 'capture' | 'explosion' | 'lightning' | 'portal' | 'death' | 'ruleActivate' | 'shake';
  data: Record<string, any>;
  duration: number;
}

export enum ChoiceType {
  SelectFriendlyPiece = 'selectFriendlyPiece',
  SelectEnemyPiece = 'selectEnemyPiece',
  SelectEmptySquare = 'selectEmptySquare',
  SelectPiece = 'selectPiece',
}

export interface PendingChoice {
  type: ChoiceType;
  ruleId: string;
  playerColor: Color;
  message: string;
  count: number;
  excludeKing: boolean;
  onlyTypes?: PieceType[];
  excludeTypes?: PieceType[];
  selected: (Position | string)[];
  onComplete: (selected: any[]) => void;
  onHighlight?: (square: BoardSquare) => boolean;
}

export interface DraftCard {
  rule: RuleDefinition;
  selected: boolean;
}