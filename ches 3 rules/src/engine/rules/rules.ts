import { BoardSquare, ChoiceType, Color, Move, Piece, PieceType, Position, RuleCategory, RuleDefinition, RuleDuration } from '../types';
import { inBounds, oppositeColor, randomInt, shuffleArray } from '../../utils/helpers';
import { findKing, movePiece, removePiece, pieceAt } from '../board';
import { generateRawMoves } from '../moves';

let _ctxRules: any = null;
function ctx(state: any) {
  _ctxRules = state;
  return state;
}
function getBoard() { return _ctxRules?.board; }
function getPieces() { return _ctxRules?.pieces; }
function getRandom() { return _ctxRules?.random?.() ?? Math.random(); }

const ctxHelper = (fn: (...args: any[]) => any) => (...args: any[]) => {
  _ctxRules = args[0];
  return fn(...args);
};

function getAllOfColor(board: BoardSquare[][], color: Color): Piece[] {
  return board.flat().map(s => s.piece).filter(p => p && p.color === color) as Piece[];
}

function getAllPiecesOnBoard(board: BoardSquare[][]): Piece[] {
  return board.flat().map(s => s.piece).filter(p => p !== null) as Piece[];
}

function findActiveRule(activeRules: any[], id: string) {
  return activeRules.find((r: any) => r.definition.id === id);
}

function randomEmptySquare(board: BoardSquare[][]): Position | null {
  const empties: Position[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!board[r][c].piece) empties.push({ row: r, col: c });
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(getRandom() * empties.length)];
}

function squaresAdjacentTo(pos: Position): Position[] {
  const result: Position[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = pos.row + dr, c = pos.col + dc;
      if (inBounds(r, c)) result.push({ row: r, col: c });
    }
  }
  return result;
}

function isSlapPathClear(board: BoardSquare[][], from: Position, to: Position): boolean {
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  let r = from.row + dr, c = from.col + dc;
  while (r !== to.row || c !== to.col) {
    if (board[r][c].piece) return false;
    r += dr; c += dc;
  }
  return true;
}

// ============ RULE DEFINITIONS ============

export const ALL_RULES: RuleDefinition[] = [

  // ===================== MOVEMENT RULES =====================

  {
    id: 'ice_physics',
    name: 'Ice Physics',
    description: 'Bishops, rooks, and queens must slide the full distance in a chosen direction to the farthest legal square.',
    flavor: 'The floor is slippery! No half-measures!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 8,
    icon: '🧊',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const board = getBoard()!;
      if (piece.type !== PieceType.Bishop && piece.type !== PieceType.Rook && piece.type !== PieceType.Queen) return moves;
      const dirs = piece.type === PieceType.Bishop ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                   piece.type === PieceType.Rook ? [[-1,0],[1,0],[0,-1],[0,1]] :
                   [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
      const sliding: Move[] = [];
      for (const [dr, dc] of dirs) {
        let r = piece.position.row + dr, c = piece.position.col + dc;
        let lastLegal: Move | null = null;
        while (inBounds(r, c)) {
          const target = board[r][c].piece;
          if (target) {
            if (target.color !== piece.color) {
              lastLegal = { from: { ...piece.position }, to: { row: r, col: c }, piece, captures: [target] };
            }
            break;
          }
          lastLegal = { from: { ...piece.position }, to: { row: r, col: c }, piece, captures: [] };
          r += dr; c += dc;
        }
        if (lastLegal) sliding.push(lastLegal);
      }
      return sliding;
    }),
  },

  {
    id: 'hobbit_battle',
    name: 'Hobbit Battle',
    description: 'Only pawns can be moved.',
    flavor: 'The little guys are taking over!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '👣',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type !== PieceType.Pawn) return [];
      return moves;
    }),
  },

  {
    id: 'portal_three',
    name: 'Portal Three',
    description: 'Two random empty squares become linked portals. At the end of each turn, pieces on these squares swap places. Portals are visible on the board.',
    flavor: 'Portal technology is unstable! Don\'t stand on both at once.',
    category: RuleCategory.Board,
    duration: RuleDuration.Timed,
    baseTurns: 8,
    icon: '🌀',
    data: { portalA: null as Position | null, portalB: null as Position | null },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const empties: Position[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (!board[r][c].piece) empties.push({ row: r, col: c });
        }
      }
      if (empties.length >= 2) {
        const shuffled = shuffleArray(empties);
        const rule = findActiveRule(ctx.activeRules, 'portal_three');
        if (rule) {
          rule.data.portalA = shuffled[0];
          rule.data.portalB = shuffled[1];
          board[shuffled[0].row][shuffled[0].col].isPortal = true;
          board[shuffled[1].row][shuffled[1].col].isPortal = true;
        }
      }
    }),
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'portal_three');
      if (!rule) return;
      const a = rule.data.portalA as Position | null;
      const b = rule.data.portalB as Position | null;
      if (!a || !b) return;
      const pA = board[a.row][a.col].piece;
      const pB = board[b.row][b.col].piece;
      if (pA && pB) {
        board[a.row][a.col].piece = pB;
        board[b.row][b.col].piece = pA;
        pA.position = { ...b };
        pB.position = { ...a };
      }
    }),
    onDeactivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'portal_three');
      if (rule && rule.data.portalA) {
        board[rule.data.portalA.row][rule.data.portalA.col].isPortal = false;
      }
      if (rule && rule.data.portalB) {
        board[rule.data.portalB.row][rule.data.portalB.col].isPortal = false;
      }
    }),
  },

  {
    id: 'constipation',
    name: 'Constipation',
    description: 'Bishops and knights cannot move. At end of turn, pawns move backward one square if empty (White pawns move down toward row 7, Black pawns move up toward row 0).',
    flavor: 'Nothing is moving right!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '💩',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type === PieceType.Bishop || piece.type === PieceType.Knight) return [];
      return moves;
    }),
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const row of board) {
        for (const sq of row) {
          const p = sq.piece;
          if (p && p.type === PieceType.Pawn) {
            const dir = p.color === Color.White ? 1 : -1;
            const nr = p.position.row + dir;
            if (inBounds(nr, p.position.col) && !board[nr][p.position.col].piece) {
              movePiece(board, p.position, { row: nr, col: p.position.col });
            }
          }
        }
      }
    }),
  },

  {
    id: 'pacman_style',
    name: 'Pac-Man Style',
    description: 'Movement wraps around horizontally: moving off one edge brings you to the opposite side.',
    flavor: 'Waka waka waka!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 7,
    icon: '🟡',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      return moves.map(m => ({
        ...m,
        to: { ...m.to },
        from: { ...m.from },
        captures: m.captures.map(c => ({ ...c, position: { ...c.position }, statuses: new Map(c.statuses) })),
      })).map(m => {
        if (m.to.col < 0) m.to.col = 7;
        if (m.to.col > 7) m.to.col = 0;
        if (m.to.row < 0) m.to.row = 7;
        if (m.to.row > 7) m.to.row = 0;
        return m;
      });
    }),
  },

  {
    id: 'charge',
    name: 'Charge!',
    description: 'At end of each turn, every piece on both teams moves one square toward the opponent\'s side if the square is free.',
    flavor: 'FORWARD, MARCH!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '⚡',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pieces = getAllPiecesOnBoard(board);
      const toMove: { piece: Piece; nr: number; nc: number }[] = [];
      for (const p of pieces) {
        const dir = p.color === Color.White ? -1 : 1;
        const nr = p.position.row + dir;
        const nc = p.position.col;
        if (inBounds(nr, nc) && !board[nr][nc].piece) {
          toMove.push({ piece: p, nr, nc });
        }
      }
      for (const { piece, nr, nc } of toMove) {
        movePiece(board, piece.position, { row: nr, col: nc });
      }
    }),
  },

  {
    id: 'tornado',
    name: 'Tornado',
    description: 'Pick an empty square; any piece that can legally move there is forced to do so.',
    flavor: 'IT\'S A TORNADO!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🌪️',
    data: { targetSquare: null as Position | null },
    onActivate: ctxHelper((ctx) => {
    }),
    needsChoice: (ctx) => {
      return {
        type: ChoiceType.SelectEmptySquare,
        ruleId: 'tornado',
        playerColor: ctx.currentColor,
        message: 'Choose an empty square for the Tornado!',
        count: 1,
        excludeKing: false,
        selected: [],
        onComplete: (selected) => {
          const board = getBoard()!;
          const pos = selected[0] as Position;
          if (!pos) return;
          const pieces = getAllPiecesOnBoard(board);
          const toMove: { piece: Piece; dest: Position }[] = [];
          for (const p of pieces) {
            const moves = generateRawMoves(board, p);
            if (moves.some(m => m.to.row === pos.row && m.to.col === pos.col)) {
              toMove.push({ piece: p, dest: pos });
            }
          }
          if (toMove.length > 0) {
            const chosen = toMove[Math.floor(getRandom() * toMove.length)];
            const captured = board[pos.row][pos.col].piece;
            if (captured) removePiece(board, { row: pos.row, col: pos.col });
            movePiece(board, chosen.piece.position, chosen.dest);
          }
        },
      };
    },
  },

  {
    id: 'column_swap',
    name: 'Column Swap',
    description: 'Two random columns swap all their pieces.',
    flavor: 'Who moved my columns?!',
    category: RuleCategory.Board,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🔀',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const cols = [0,1,2,3,4,5,6,7];
      const c1 = cols[Math.floor(getRandom() * 8)];
      let c2 = cols[Math.floor(getRandom() * 8)];
      while (c2 === c1) c2 = cols[Math.floor(getRandom() * 8)];
      for (let r = 0; r < 8; r++) {
        const p1 = board[r][c1].piece;
        const p2 = board[r][c2].piece;
        board[r][c1].piece = p2;
        board[r][c2].piece = p1;
        if (p1) p1.position = { row: r, col: c2 };
        if (p2) p2.position = { row: r, col: c1 };
      }
    }),
  },

  {
    id: 'no_cowards',
    name: 'No Cowards',
    description: 'Every move must move a piece closer to the opponent\'s side (no retreat).',
    flavor: 'COWARDS DIE!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '💀',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const dir = piece.color === Color.White ? -1 : 1;
      return moves.filter(m => {
        if (piece.type === PieceType.Knight) {
          return Math.abs(m.to.row - piece.position.row) > 0;
        }
        return dir === -1 ? m.to.row < piece.position.row : m.to.row > piece.position.row;
      });
    }),
  },

  {
    id: 'short_stop',
    name: 'Short Stop',
    description: 'Pieces can only move one square per move, regardless of their normal movement.',
    flavor: 'Take small steps!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🛑',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      return moves.filter(m => {
        const dr = Math.abs(m.to.row - m.from.row);
        const dc = Math.abs(m.to.col - m.from.col);
        return dr <= 1 && dc <= 1;
      }).map(m => ({
        ...m,
        to: { ...m.to },
        from: { ...m.from },
        captures: m.captures.map(c => ({ ...c, position: { ...c.position }, statuses: new Map(c.statuses) })),
      })).map(m => {
        if (m.to.col < 0) m.to.col = 7;
        if (m.to.col > 7) m.to.col = 0;
        if (m.to.row < 0) m.to.row = 7;
        if (m.to.row > 7) m.to.row = 0;
        return m;
      });
    }),
  },

  {
    id: 'magnetic_repulsion',
    name: 'Magnetic Repulsion',
    description: 'At end of each turn, all pieces move one square away from the nearest piece of the same color.',
    flavor: 'Stop touching me!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🧲',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pieces = getAllPiecesOnBoard(board);
      for (const p of pieces) {
        let nearest: Piece | null = null;
        let nearestDist = 999;
        for (const other of pieces) {
          if (other.id === p.id || other.color !== p.color) continue;
          const dist = Math.abs(other.position.row - p.position.row) + Math.abs(other.position.col - p.position.col);
          if (dist < nearestDist) { nearestDist = dist; nearest = other; }
        }
        if (!nearest || nearestDist === 0) continue;
        const dr = p.position.row - nearest.position.row;
        const dc = p.position.col - nearest.position.col;
        const dirR = dr > 0 ? 1 : dr < 0 ? -1 : 0;
        const dirC = dc > 0 ? 1 : dc < 0 ? -1 : 0;
        const nr = p.position.row + dirR;
        const nc = p.position.col + dirC;
        if (inBounds(nr, nc) && !board[nr][nc].piece) {
          movePiece(board, p.position, { row: nr, col: nc });
        }
      }
    }),
  },

  {
    id: 'teleport_fever',
    name: 'Teleport Fever',
    description: 'After each move, the moved piece teleports to a random empty square.',
    flavor: 'I meant to go there!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '✨',
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const board = getBoard()!;
      const p = board[move.to.row][move.to.col].piece;
      if (!p) return;
      const empty = randomEmptySquare(board);
      if (empty && !(empty.row === move.to.row && empty.col === move.to.col)) {
        movePiece(board, p.position, empty);
      }
    }),
  },

  {
    id: 'gravity_shift',
    name: 'Gravity Shift',
    description: 'All pieces are pulled down one row. If occupied, nothing happens for that square.',
    flavor: 'The world is upside down!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '⬇️',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (let r = 6; r >= 0; r--) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c].piece;
          if (p && !board[r + 1][c].piece) {
            movePiece(board, { row: r, col: c }, { row: r + 1, col: c });
          }
        }
      }
    }),
  },

  {
    id: 'dance_dance',
    name: 'Dance Dance Revolution',
    description: 'After each move, the moved piece must move one more square in a random orthogonal direction if possible.',
    flavor: 'STEP LEFT! STEP RIGHT!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '💃',
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const board = getBoard()!;
      const p = board[move.to.row][move.to.col].piece;
      if (!p) return;
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      const valid = dirs.filter(([dr, dc]) => {
        const nr = p.position.row + dr, nc = p.position.col + dc;
        return inBounds(nr, nc) && !board[nr][nc].piece;
      });
      if (valid.length > 0) {
        const [dr, dc] = valid[Math.floor(getRandom() * valid.length)];
        movePiece(board, p.position, { row: p.position.row + dr, col: p.position.col + dc });
      }
    }),
  },

  // ===================== HAZARD / DEATH RULES =====================

  {
    id: 'minefield',
    name: 'Minefield',
    description: 'Two random empty squares are mined. Any piece entering those squares dies.',
    flavor: 'BOOM! Watch your step!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '💣',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (let i = 0; i < 2; i++) {
        const pos = randomEmptySquare(board);
        if (pos) board[pos.row][pos.col].hasMine = true;
      }
    }),
  },

  {
    id: 'bottomless_pit',
    name: 'Bottomless Pit',
    description: 'One random square becomes a permanent pit. Any piece entering it dies instantly.',
    flavor: 'Say goodbye to that piece!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🕳️',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pos = randomEmptySquare(board);
      if (pos) board[pos.row][pos.col].isPit = true;
    }),
  },

  {
    id: 'living_bomb',
    name: 'Living Bomb',
    description: 'Choose a friendly piece to rig with a bomb. After 6 turns it explodes, killing all adjacent pieces. The bombed piece dies too unless it has protection.',
    flavor: 'Tick... tick... BOOM! Choose your suicide bomber wisely.',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '💥',
    data: { bombedPieceId: null as string | null, turnsToDetonate: 6 },
    onActivate: ctxHelper((ctx) => {
    }),
    needsChoice: (ctx) => {
      return {
        type: ChoiceType.SelectFriendlyPiece,
        ruleId: 'living_bomb',
        playerColor: ctx.currentColor,
        message: 'Choose a piece to attach the Living Bomb to!',
        count: 1,
        excludeKing: true,
        selected: [],
        onComplete: (selected) => {
          const board = getBoard()!;
          const pieceId = selected[0] as string;
          const allPieces = getAllPiecesOnBoard(board);
          const target = allPieces.find(p => p.id === pieceId);
          if (target) {
            const rule = findActiveRule(ctx.activeRules, 'living_bomb');
            if (rule) {
              rule.data.bombedPieceId = target.id;
              rule.data.turnsToDetonate = 6;
              target.statuses.set('bomb', { id: 'bomb', name: '💥 Bomb', turnsRemaining: 6, data: {} });
            }
          }
        },
      };
    },
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'living_bomb');
      if (!rule || !rule.data.bombedPieceId) return;
      rule.data.turnsToDetonate--;
      // Tick bomb status on the piece too
      const allPieces = getAllPiecesOnBoard(board);
      const bombed = allPieces.find(p => p.id === rule.data.bombedPieceId);
      if (bombed) {
        const bombStatus = bombed.statuses.get('bomb');
        if (bombStatus) bombStatus.turnsRemaining = rule.data.turnsToDetonate;
      }
      if (rule.data.turnsToDetonate <= 0) {
        if (bombed) {
          const adj = squaresAdjacentTo(bombed.position);
          for (const pos of adj) {
            const target = board[pos.row][pos.col].piece;
            if (target) {
              removePiece(board, target.position);
            }
          }
          if (!bombed.statuses.has('invulnerable')) {
            removePiece(board, bombed.position);
          }
        }
        rule.isActive = false;
        rule.turnsRemaining = 0;
      }
    }),
  },

  {
    id: 'gigachad_aura',
    name: 'Gigachad Aura',
    description: 'After N turns, all pieces adjacent to any king die. Pulses every 3 turns after the first activation.',
    flavor: 'The gigachad energy is too intense!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '💪',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'gigachad_aura');
      if (!rule) return;
      rule.data.turnsToPulse = (rule.data.turnsToPulse || rule.definition.baseTurns) - 1;
      if (rule.data.turnsToPulse <= 0) {
        rule.data.turnsToPulse = 3;
        for (const color of [Color.White, Color.Black]) {
          const king = findKing(board, color);
          if (!king) continue;
          const adj = squaresAdjacentTo(king.position);
          for (const pos of adj) {
            const p = board[pos.row][pos.col].piece;
            if (p && !p.statuses.has('invulnerable')) {
              removePiece(board, p.position);
            }
          }
        }
      }
    }),
  },

  {
    id: 'kamikaze',
    name: 'Kamikaze',
    description: 'When a piece dies, there is a 50% chance all adjacent pieces also die.',
    flavor: 'If I go down, you\'re coming with me!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '💀',
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      if (getRandom() < 0.5) {
        const board = getBoard()!;
        const adj = squaresAdjacentTo(piece.position);
        for (const pos of adj) {
          const p = board[pos.row][pos.col].piece;
          if (p && !p.statuses.has('invulnerable')) {
            removePiece(board, p.position);
          }
        }
      }
    }),
  },

  {
    id: 'blood_sacrifice',
    name: 'Blood Sacrifice',
    description: 'At end of your turn, a random one of your non-king pieces dies.',
    flavor: 'The blood god demands a tribute!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🔪',
    onTurnEnd: ctxHelper((ctx, color: Color) => {
      const board = getBoard()!;
      const pieces = getAllOfColor(board, color).filter(p => p.type !== PieceType.King);
      if (pieces.length > 0) {
        const target = pieces[Math.floor(getRandom() * pieces.length)];
        removePiece(board, target.position);
      }
    }),
  },

  {
    id: 'hobbit_slaughter',
    name: 'Hobbit Slaughter',
    description: 'Only pawns are allowed to die. Other pieces cannot be killed.',
    flavor: 'The little guys are expendable!',
    category: RuleCategory.Defense,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🛡️',
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      if (piece.type !== PieceType.Pawn) {
        const board = getBoard()!;
        if (!board[piece.position.row][piece.position.col].piece) {
          board[piece.position.row][piece.position.col].piece = piece;
        } else {
          const empty = randomEmptySquare(board);
          if (empty) {
            board[empty.row][empty.col].piece = piece;
            piece.position = { ...empty };
          }
        }
      }
    }),
  },

  {
    id: 'down_with_ship',
    name: 'Down With The Ship',
    description: 'Any capture also kills the capturing piece.',
    flavor: 'You take them with you!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '🚢',
    onCapture: ctxHelper((ctx, captured: Piece, capturer: Piece) => {
      const board = getBoard()!;
      if (!capturer.statuses.has('invulnerable')) {
        removePiece(board, capturer.position);
      }
    }),
  },

  {
    id: 'critical_strike',
    name: 'Critical Strike',
    description: 'Captures have a 40% chance to also kill a random adjacent enemy piece.',
    flavor: 'Critical hit!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🎯',
    onCapture: ctxHelper((ctx, captured: Piece, capturer: Piece) => {
      if (getRandom() < 0.4) {
        const board = getBoard()!;
        const adj = squaresAdjacentTo(captured.position);
        const enemies = adj.filter(pos => {
          const p = board[pos.row][pos.col].piece;
          return p && p.color === oppositeColor(capturer.color) && p.id !== captured.id && !p.statuses.has('invulnerable');
        });
        if (enemies.length > 0) {
          const target = enemies[Math.floor(getRandom() * enemies.length)];
          removePiece(board, target);
        }
      }
    }),
  },

  {
    id: 'chain_reaction',
    name: 'Chain Reaction',
    description: 'When a piece dies, all pieces of the same type on the board also die.',
    flavor: 'DOMINO EFFECT!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '⛓️',
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      const board = getBoard()!;
      const toKill = getAllPiecesOnBoard(board).filter(p => p.type === piece.type && p.id !== piece.id && !p.statuses.has('invulnerable'));
      for (const p of toKill) {
        removePiece(board, p.position);
      }
    }),
  },

  {
    id: 'explosive_eggs',
    name: 'Explosive Eggs',
    description: 'Three random pawns become explosive. When they die, they deal damage in a cross pattern.',
    flavor: 'The chickens are fighting back!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🥚',
    data: { eggIds: [] as string[] },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pawns = getAllPiecesOnBoard(board).filter(p => p.type === PieceType.Pawn);
      const chosen = shuffleArray(pawns).slice(0, 3);
      const rule = findActiveRule(ctx.activeRules, 'explosive_eggs');
      if (rule) rule.data.eggIds = chosen.map(p => p.id);
    }),
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'explosive_eggs');
      if (!rule || !rule.data.eggIds.includes(piece.id)) return;
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        let r = piece.position.row + dr, c = piece.position.col + dc;
        while (inBounds(r, c)) {
          const p = board[r][c].piece;
          if (p && !p.statuses.has('invulnerable')) {
            removePiece(board, { row: r, col: c });
          }
          r += dr; c += dc;
        }
      }
    }),
  },

  {
    id: 'volcano',
    name: 'Volcano',
    description: 'Three random squares become lava. Any piece on them at end of turn dies.',
    flavor: 'The earth is angry!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🌋',
    data: { lavaSquares: [] as Position[] },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const squares: Position[] = [];
      for (let i = 0; i < 3; i++) {
        const pos = randomEmptySquare(board);
        if (pos) { squares.push(pos); board[pos.row][pos.col].isMarked = true; board[pos.row][pos.col].markType = 'lava'; }
      }
      const rule = findActiveRule(ctx.activeRules, 'volcano');
      if (rule) rule.data.lavaSquares = squares;
    }),
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'volcano');
      if (!rule) return;
      for (const pos of rule.data.lavaSquares) {
        if (!board[pos.row] || !board[pos.row][pos.col]) continue;
        if (board[pos.row][pos.col].isMarked && board[pos.row][pos.col].markType === 'lava') {
          const p = board[pos.row][pos.col].piece;
          if (p && !p.statuses.has('invulnerable')) {
            removePiece(board, p.position);
          }
        }
      }
    }),
  },

  {
    id: 'plague',
    name: 'Plague',
    description: 'Each turn, one random piece on the board gets infected. Infected pieces die after 2 turns.',
    flavor: 'The plague spreads!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '🦠',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      // Centralized status system ticks all statuses down.
      // Here we just check for expired plague and kill, then infect a new piece.
      const all = getAllPiecesOnBoard(board);
      for (const p of all) {
        const plague = p.statuses.get('plagued');
        if (plague && plague.turnsRemaining <= 0) {
          p.statuses.delete('plagued');
          if (!p.statuses.has('invulnerable')) {
            removePiece(board, p.position);
          }
        }
      }
      // Infect a new random piece
      const alive = getAllPiecesOnBoard(board);
      if (alive.length > 0) {
        const target = alive[Math.floor(getRandom() * alive.length)];
        if (!target.statuses.has('plagued')) {
          target.statuses.set('plagued', { id: 'plagued', name: 'Plagued', turnsRemaining: 2, data: {} });
        }
      }
    }),
  },

  {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    description: 'At end of each turn, 1-3 random pieces are struck by lightning and die.',
    flavor: 'ZEUS IS ANGRY!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '⛈️',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const all = getAllPiecesOnBoard(board);
      const count = 1 + Math.floor(getRandom() * 3);
      const targets = shuffleArray(all).slice(0, count);
      for (const p of targets) {
        if (!p.statuses.has('invulnerable')) {
          removePiece(board, p.position);
        }
      }
    }),
  },

  // ===================== DEFENSE RULES =====================

  {
    id: 'invulnerability_potion',
    name: 'Invulnerability Potion',
    description: 'Choose two friendly pieces to become temporarily unable to die. They can still move and be moved, but nothing can kill them.',
    flavor: 'UNBREAKABLE! Choose your immortals wisely.',
    category: RuleCategory.Defense,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '🛡️',
    onActivate: ctxHelper((ctx) => {
    }),
    needsChoice: (ctx) => {
      return {
        type: ChoiceType.SelectFriendlyPiece,
        ruleId: 'invulnerability_potion',
        playerColor: ctx.currentColor,
        message: 'Choose 2 pieces to become INVULNERABLE!',
        count: 2,
        excludeKing: true,
        selected: [],
        onComplete: (selected) => {
          const board = getBoard()!;
          const rule = findActiveRule(ctx.activeRules, 'invulnerability_potion');
          if (!rule) return;
          const ids = selected as string[];
          rule.data.protectedIds = ids;
          for (const id of ids) {
            const p = getAllPiecesOnBoard(board).find(pp => pp.id === id);
            if (p) {
              p.statuses.set('invulnerable', { id: 'invulnerable', name: 'Invulnerable', turnsRemaining: rule.definition.baseTurns, data: {} });
            }
          }
        },
      };
    },
  },

  {
    id: 'guardian_angel',
    name: 'Guardian Angel',
    description: 'Your king cannot die for N turns.',
    flavor: 'Divine protection!',
    category: RuleCategory.Defense,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '👼',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const currentColor = ctx.currentColor;
      const king = findKing(board, currentColor);
      if (king) {
        king.statuses.set('invulnerable', { id: 'invulnerable', name: 'Divine Shield', turnsRemaining: 5, data: {} });
      }
    }),
  },

  {
    id: 'necromancy',
    name: 'Necromancy',
    description: 'When any piece dies, there\'s a 30% chance a pawn of the same color spawns on a random empty square.',
    flavor: 'Rise from the grave!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🧟',
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      if (getRandom() < 0.3) {
        const board = getBoard()!;
        const pos = randomEmptySquare(board);
        if (pos) {
          const newPiece: Piece = {
            id: `p${Date.now()}_${Math.random()}`,
            type: PieceType.Pawn,
            color: piece.color,
            position: pos,
            hasMoved: false,
            statuses: new Map(),
          };
          board[pos.row][pos.col].piece = newPiece;
        }
      }
    }),
  },

  {
    id: 'phoenix_down',
    name: 'Phoenix Down',
    description: 'The first piece that dies on each team is revived after 2 turns on a random square.',
    flavor: 'Rise from the ashes!',
    category: RuleCategory.Defense,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🔥',
    data: { pendingRevives: [] as { color: Color; type: PieceType; turns: number }[] },
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'phoenix_down');
      if (!rule) return;
      rule.data.pendingRevives.push({ color: piece.color, type: piece.type, turns: 2 });
    }),
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'phoenix_down');
      if (!rule) return;
      for (let i = rule.data.pendingRevives.length - 1; i >= 0; i--) {
        rule.data.pendingRevives[i].turns--;
        if (rule.data.pendingRevives[i].turns <= 0) {
          const pos = randomEmptySquare(board);
          if (pos) {
            const newPiece: Piece = {
              id: `p${Date.now()}_${Math.random()}`,
              type: rule.data.pendingRevives[i].type,
              color: rule.data.pendingRevives[i].color,
              position: pos,
              hasMoved: false,
              statuses: new Map(),
            };
            board[pos.row][pos.col].piece = newPiece;
          }
          rule.data.pendingRevives.splice(i, 1);
        }
      }
    }),
  },

  {
    id: 'force_field',
    name: 'Force Field',
    description: 'Enemy pieces cannot enter your back two ranks (rows 6-7 for White, rows 0-1 for Black). Your own pieces can come and go freely.',
    flavor: 'YOU SHALL NOT PASS! (enemy edition)',
    category: RuleCategory.Defense,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '🛡️',
    data: { ownerColor: null as Color | null },
    onActivate: ctxHelper((ctx) => {
      const rule = findActiveRule(ctx.activeRules, 'force_field');
      if (rule) rule.data.ownerColor = ctx.currentColor;
    }),
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'force_field');
      if (!rule) return moves;
      const ownerColor = rule.data.ownerColor as Color;
      if (!ownerColor) return moves;
      // Block enemy pieces from entering the owner's back ranks
      return moves.filter(m => {
        if (piece.color === ownerColor) return true; // owner's pieces can go anywhere
        const protectedRows = ownerColor === Color.White ? [6, 7] : [0, 1];
        return !protectedRows.includes(m.to.row);
      });
    }),
  },

  // ===================== TRANSFORMATION RULES =====================

  {
    id: 'treasure_chest',
    name: 'Treasure Chest',
    description: 'A random square is marked. The first piece to end its move there gets instantly promoted to a queen.',
    flavor: 'TREASURE!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '📦',
    data: { claimed: false },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pos = randomEmptySquare(board);
      if (pos) {
        board[pos.row][pos.col].isTreasure = true;
        const rule = findActiveRule(ctx.activeRules, 'treasure_chest');
        if (rule) rule.data.treasurePos = pos;
      }
    }),
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'treasure_chest');
      if (!rule || rule.data.claimed) return;
      const tp = rule.data.treasurePos;
      if (tp && move.to.row === tp.row && move.to.col === tp.col) {
        const p = board[tp.row][tp.col].piece;
        if (p) {
          p.type = PieceType.Queen;
          rule.data.claimed = true;
          board[tp.row][tp.col].isTreasure = false;
        }
      }
    }),
  },

  {
    id: 'early_promotion',
    name: 'Early Promotion',
    description: 'Pawns now promote one rank earlier than normal (at row 1 for White, row 6 for Black, which is one step before the final rank).',
    flavor: 'Fast track to success!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '📈',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type !== PieceType.Pawn) return moves;
      const promoRow = piece.color === Color.White ? 1 : 6;
      return moves.map(m => {
        if (m.to.row === promoRow && !m.promotionType) {
          const copies: Move[] = [];
          for (const pt of [PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight]) {
            copies.push({ ...m, promotionType: pt });
          }
          return copies;
        }
        return m;
      }).flat();
    }),
  },

  {
    id: 'kids_in_trenchcoat',
    name: 'Kids In A Trenchcoat',
    description: 'Two random pawns are sacrificed to spawn a bishop on a random empty square.',
    flavor: 'Totally an adult, yes sir!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🧥',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pawns = getAllPiecesOnBoard(board).filter(p => p.type === PieceType.Pawn);
      if (pawns.length < 2) return;
      const shuffled = shuffleArray(pawns);
      const toSac = shuffled.slice(0, 2);
      for (const p of toSac) {
        removePiece(board, p.position);
      }
      const empty = randomEmptySquare(board);
      if (empty) {
        const color = toSac[0].color;
        const bishop: Piece = {
          id: `p${Date.now()}_${Math.random()}`,
          type: PieceType.Bishop,
          color,
          position: empty,
          hasMoved: false,
          statuses: new Map(),
        };
        board[empty.row][empty.col].piece = bishop;
      }
    }),
  },

  {
    id: 'second_chance',
    name: 'Second Chance',
    description: 'When a piece dies, 25% chance it is revived on a random empty square.',
    flavor: 'That\'s not very dead...',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '♻️',
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      if (getRandom() < 0.25) {
        const board = getBoard()!;
        const pos = randomEmptySquare(board);
        if (pos) {
          const revived: Piece = {
            id: `p${Date.now()}_${Math.random()}`,
            type: piece.type,
            color: piece.color,
            position: pos,
            hasMoved: true,
            statuses: new Map(),
          };
          board[pos.row][pos.col].piece = revived;
        }
      }
    }),
  },

  {
    id: 'upsize',
    name: 'Upsize',
    description: 'All pawns are promoted to random pieces (but not queens).',
    flavor: 'GROWING UP FAST!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '📏',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const options = [PieceType.Rook, PieceType.Knight, PieceType.Bishop];
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece && sq.piece.type === PieceType.Pawn) {
            sq.piece.type = options[Math.floor(getRandom() * options.length)];
          }
        }
      }
    }),
  },

  {
    id: 'downgrade',
    name: 'Downgrade',
    description: 'All non-pawn pieces become pawns.',
    flavor: 'Back to basics!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '📉',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece && sq.piece.type !== PieceType.Pawn && sq.piece.type !== PieceType.King) {
            sq.piece.type = PieceType.Pawn;
          }
        }
      }
    }),
  },

  {
    id: 'knightmare',
    name: 'Knightmare',
    description: 'All bishops become knights. All knights become bishops.',
    flavor: 'Identity crisis!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🐴',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece && sq.piece.type === PieceType.Bishop) sq.piece.type = PieceType.Knight;
          else if (sq.piece && sq.piece.type === PieceType.Knight) sq.piece.type = PieceType.Bishop;
        }
      }
    }),
  },

  {
    id: 'body_swap',
    name: 'Body Swap',
    description: 'All pieces (including kings) swap colors. You now control what was your opponent\'s army, and they control yours.',
    flavor: 'WAIT, THAT\'S ILLEGAL! ...Actually, it\'s Chaos Chess.',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🔄',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece) {
            sq.piece.color = oppositeColor(sq.piece.color);
          }
        }
      }
    }),
  },

  {
    id: 'rook_tower',
    name: 'Rook Tower',
    description: 'All rooks become towers: they can move like a rook AND a bishop (basically queens).',
    flavor: 'Castle upgrade!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🏰',
    modifyPieceStatus: ctxHelper((ctx, piece: Piece) => {
      // Visual only - the onGetMoves handles it
    }),
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type !== PieceType.Rook) return moves;
      const board = getBoard()!;
      const allMoves = [...moves];
      const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      for (const [dr, dc] of diagDirs) {
        let r = piece.position.row + dr, c = piece.position.col + dc;
        while (inBounds(r, c)) {
          const target = board[r][c].piece;
          if (target) {
            if (target.color !== piece.color) {
              allMoves.push({ from: { ...piece.position }, to: { row: r, col: c }, piece, captures: [target] });
            }
            break;
          }
          allMoves.push({ from: { ...piece.position }, to: { row: r, col: c }, piece, captures: [] });
          r += dr; c += dc;
        }
      }
      return allMoves;
    }),
  },

  {
    id: 'infinite_pawns',
    name: 'Infinite Pawns',
    description: 'At the start of your turn, if you have fewer than 8 pawns, spawn a new pawn on a random empty square on your back rank.',
    flavor: 'THEY KEEP COMING!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '♟️',
    onTurnStart: ctxHelper((ctx, color: Color) => {
      const board = getBoard()!;
      const pawns = getAllOfColor(board, color).filter(p => p.type === PieceType.Pawn);
      if (pawns.length < 8) {
        const backRank = color === Color.White ? 7 : 0;
        const empties: Position[] = [];
        for (let c = 0; c < 8; c++) {
          if (!board[backRank][c].piece) empties.push({ row: backRank, col: c });
        }
        if (empties.length > 0) {
          const pos = empties[Math.floor(getRandom() * empties.length)];
          const newPawn: Piece = {
            id: `p${Date.now()}_${Math.random()}`,
            type: PieceType.Pawn,
            color,
            position: pos,
            hasMoved: false,
            statuses: new Map(),
          };
          board[pos.row][pos.col].piece = newPawn;
        }
      }
    }),
  },

  // ===================== META / MINI-GAME RULES =====================

  {
    id: 'horse_race',
    name: 'Horse Race',
    description: 'Random event: you gain a knight on a chosen empty square.',
    flavor: 'And they\'re off!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🏇',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pos = randomEmptySquare(board);
      if (pos) {
        const knight: Piece = {
          id: `p${Date.now()}_${Math.random()}`,
          type: PieceType.Knight,
          color: ctx.currentColor,
          position: pos,
          hasMoved: false,
          statuses: new Map(),
        };
        board[pos.row][pos.col].piece = knight;
      }
    }),
  },

  {
    id: 'parry',
    name: 'Parry (RPS)',
    description: 'When a piece would be captured, there is a 33% chance the capture is negated.',
    flavor: 'Quick reflexes!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '✊',
    onBeforeCapture: ctxHelper((ctx, move: Move) => {
      return getRandom() >= 0.33;
    }),
  },

  {
    id: 'call_down_lightning',
    name: 'Call Down Lightning',
    description: 'Each turn, a random enemy piece (not king) is struck by lightning and dies.',
    flavor: 'ZEUS! LEND ME YOUR POWER!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '⚡',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const enemies = getAllPiecesOnBoard(board).filter(p => p.color === oppositeColor(ctx.currentColor) && p.type !== PieceType.King);
      if (enemies.length > 0) {
        const target = enemies[Math.floor(getRandom() * enemies.length)];
        removePiece(board, target.position);
      }
    }),
  },

  {
    id: 'gambling_addiction',
    name: 'Gambling Addiction',
    description: 'At start of your turn, flip a coin. Heads: gain a random piece on a random square. Tails: lose a random piece.',
    flavor: 'The house always wins!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🎰',
    onTurnStart: ctxHelper((ctx, color: Color) => {
      const board = getBoard()!;
      if (getRandom() < 0.5) {
        // Heads - gain piece
        const pos = randomEmptySquare(board);
        if (pos) {
          const types = [PieceType.Pawn, PieceType.Pawn, PieceType.Pawn, PieceType.Knight, PieceType.Bishop, PieceType.Rook];
          const newPiece: Piece = {
            id: `p${Date.now()}_${Math.random()}`,
            type: types[Math.floor(getRandom() * types.length)],
            color,
            position: pos,
            hasMoved: false,
            statuses: new Map(),
          };
          board[pos.row][pos.col].piece = newPiece;
        }
      } else {
        // Tails - lose piece
        const pieces = getAllOfColor(board, color).filter(p => p.type !== PieceType.King);
        if (pieces.length > 0) {
          const target = pieces[Math.floor(getRandom() * pieces.length)];
          removePiece(board, target.position);
        }
      }
    }),
  },

  {
    id: 'chaos_coin',
    name: 'Chaos Coin',
    description: 'Flip a coin each turn. Heads: all your pawns move forward. Tails: all enemy pawns move forward.',
    flavor: 'Chaos is a coin flip!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '🪙',
    onTurnEnd: ctxHelper((ctx, color: Color) => {
      const board = getBoard()!;
      const targetColor = getRandom() < 0.5 ? color : oppositeColor(color);
      const dir = targetColor === Color.White ? -1 : 1;
      const pawns = getAllOfColor(board, targetColor).filter(p => p.type === PieceType.Pawn);
      for (const p of pawns) {
        const nr = p.position.row + dir;
        if (inBounds(nr, p.position.col) && !board[nr][p.position.col].piece) {
          movePiece(board, p.position, { row: nr, col: p.position.col });
        }
      }
    }),
  },

  {
    id: 'tax_day',
    name: 'Tax Day',
    description: 'The player with more pieces on the board must sacrifice one random piece (not king).',
    flavor: 'Nothing is certain except death and taxes!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '💰',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const whiteCount = getAllOfColor(board, Color.White).length;
      const blackCount = getAllOfColor(board, Color.Black).length;
      let targetColor: Color | null = null;
      if (whiteCount > blackCount) targetColor = Color.White;
      else if (blackCount > whiteCount) targetColor = Color.Black;
      if (targetColor) {
        const pieces = getAllOfColor(board, targetColor).filter(p => p.type !== PieceType.King);
        if (pieces.length > 0) {
          const toSac = pieces[Math.floor(getRandom() * pieces.length)];
          removePiece(board, toSac.position);
        }
      }
    }),
  },

  {
    id: 'time_warp',
    name: 'Time Warp',
    description: 'All timed rules have their duration increased by 2 turns.',
    flavor: 'It\'s just a jump to the left!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '⏰',
    onActivate: ctxHelper((ctx) => {
      for (const rule of ctx.activeRules) {
        if (rule.definition.duration === RuleDuration.Timed && rule.turnsRemaining > 0) {
          rule.turnsRemaining += 2;
        }
      }
    }),
  },

  {
    id: 'redistribute',
    name: 'Redistribute Wealth',
    description: 'Each player\'s pieces are randomly scrambled across their side of the board.',
    flavor: 'EQUALITY FOR ALL!',
    category: RuleCategory.Board,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '♻️',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const color of [Color.White, Color.Black]) {
        const pieces = getAllOfColor(board, color);
        const rows = color === Color.White ? [6, 7] : [0, 1];
        const positions: Position[] = [];
        for (const r of rows) {
          for (let c = 0; c < 8; c++) {
            positions.push({ row: r, col: c });
          }
        }
        // Remove all pieces first
        for (const p of pieces) {
          board[p.position.row][p.position.col].piece = null;
        }
        // Shuffle all positions and place pieces
        const shuffled = shuffleArray(positions);
        const count = Math.min(pieces.length, shuffled.length);
        for (let i = 0; i < count; i++) {
          const p = pieces[i];
          const pos = shuffled[i];
          board[pos.row][pos.col].piece = p;
          p.position = { ...pos };
        }
        // If any pieces couldn't be placed, put them back at original positions
        for (let i = count; i < pieces.length; i++) {
          const p = pieces[i];
          board[p.position.row][p.position.col].piece = p;
        }
      }
    }),
  },

  {
    id: 'mystery_box',
    name: 'Mystery Box',
    description: 'A random square gets a mystery box. The first piece to step on it triggers a random instant rule effect.',
    flavor: 'WHAT\'S IN THE BOX?!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🎁',
    data: { boxSquare: null as Position | null },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pos = randomEmptySquare(board);
      if (pos) {
        board[pos.row][pos.col].isMarked = true;
        board[pos.row][pos.col].markType = 'mystery';
        const rule = findActiveRule(ctx.activeRules, 'mystery_box');
        if (rule) rule.data.boxSquare = pos;
      }
    }),
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'mystery_box');
      if (!rule || !rule.data.boxSquare) return;
      const bs = rule.data.boxSquare;
      if (move.to.row === bs.row && move.to.col === bs.col) {
        board[bs.row][bs.col].isMarked = false;
        // Trigger random effect
        const instantRules = ALL_RULES.filter(r => r.duration === RuleDuration.Instant && r.id !== 'mystery_box');
        if (instantRules.length > 0) {
          const effect = instantRules[Math.floor(getRandom() * instantRules.length)];
          if (effect.onActivate) effect.onActivate(ctx);
        }
        rule.data.boxSquare = null;
      }
    }),
  },

  {
    id: 'bounty',
    name: 'Bounty Hunter',
    description: 'A random piece is marked with a bounty. Capturing it gives you an extra turn.',
    flavor: 'WANTED: DEAD OR ALIVE!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🏴‍☠️',
    data: { bountyPieceId: null as string | null },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const all = getAllPiecesOnBoard(board);
      if (all.length > 0) {
        const target = all[Math.floor(getRandom() * all.length)];
        const rule = findActiveRule(ctx.activeRules, 'bounty');
        if (rule) rule.data.bountyPieceId = target.id;
      }
    }),
    onCapture: ctxHelper((ctx, captured: Piece, capturer: Piece) => {
      const rule = findActiveRule(ctx.activeRules, 'bounty');
      if (!rule) return;
      if (captured.id === rule.data.bountyPieceId) {
        rule.data.bountyPieceId = null;
        // Extra turn flag - handled by game logic
      }
    }),
  },

  // ===================== BOARD RULES =====================

  {
    id: 'earthquake',
    name: 'Earthquake',
    description: 'All squares shift: columns are randomly reordered.',
    flavor: 'THE EARTH IS MOVING!',
    category: RuleCategory.Board,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🌍',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const newOrder = shuffleArray([0,1,2,3,4,5,6,7]);
      const newBoard: BoardSquare[][] = [];
      for (let r = 0; r < 8; r++) {
        const row: BoardSquare[] = [];
        for (let c = 0; c < 8; c++) {
          row.push({
            row: r, col: newOrder[c], piece: null,
            hasMine: board[r][c].hasMine, isPit: board[r][c].isPit,
            isPortal: board[r][c].isPortal, portalPair: board[r][c].portalPair ? { ...board[r][c].portalPair! } : undefined,
            isMarked: board[r][c].isMarked, markType: board[r][c].markType,
            isTreasure: board[r][c].isTreasure,
          });
        }
        newBoard.push(row);
      }
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c].piece;
          if (p) {
            newBoard[r][newOrder[c]].piece = p;
            p.position = { row: r, col: newOrder[c] };
          }
        }
      }
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          board[r][c].piece = newBoard[r][c].piece;
          board[r][c].hasMine = newBoard[r][c].hasMine;
          board[r][c].isPit = newBoard[r][c].isPit;
          board[r][c].isPortal = newBoard[r][c].isPortal;
          board[r][c].portalPair = newBoard[r][c].portalPair;
          board[r][c].isMarked = newBoard[r][c].isMarked;
          board[r][c].markType = newBoard[r][c].markType;
          board[r][c].isTreasure = newBoard[r][c].isTreasure;
        }
      }
    }),
  },

  {
    id: 'hole_in_one',
    name: 'Hole In One',
    description: 'All four corners of the board become pits.',
    flavor: 'Watch your corners!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '⛳',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      board[0][0].isPit = true;
      board[0][7].isPit = true;
      board[7][0].isPit = true;
      board[7][7].isPit = true;
      for (const pos of [{row:0,col:0},{row:0,col:7},{row:7,col:0},{row:7,col:7}]) {
        if (board[pos.row][pos.col].piece) {
          removePiece(board, pos);
        }
      }
    }),
  },

  {
    id: 'king_of_hill',
    name: 'King of the Hill',
    description: 'The center 4 squares are radioactive. Pieces on them at end of turn take damage (die in 3 turns).',
    flavor: 'The center is toxic!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '⛰️',
    data: { exposureCounts: {} as Record<string, number> },
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'king_of_hill');
      if (!rule) return;
      const center = [{row:3,col:3},{row:3,col:4},{row:4,col:3},{row:4,col:4}];
      for (const pos of center) {
        const p = board[pos.row][pos.col].piece;
        if (p) {
          const key = p.id;
          rule.data.exposureCounts[key] = (rule.data.exposureCounts[key] || 0) + 1;
          if (rule.data.exposureCounts[key] >= 3) {
            if (!p.statuses.has('invulnerable')) {
              removePiece(board, p.position);
            }
            rule.data.exposureCounts[key] = 0;
          }
        }
      }
    }),
  },

  {
    id: 'mirror_mode',
    name: 'Mirror Mode',
    description: 'Your moves are mirrored: the matching enemy piece copies your move. If none exists at the mirrored position, the same-type piece closest to that spot reacts.',
    flavor: 'Everything you do, they do too!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🪞',
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const board = getBoard()!;
      const mr = 7 - move.from.row;
      const mc = 7 - move.from.col;
      const mtr = 7 - move.to.row;
      const mtc = 7 - move.to.col;

      // Find the piece to mirror: first try exact mirrored position, then same type closest to it
      let enemyPiece = board[mr][mc].piece;
      if (!enemyPiece || enemyPiece.color === move.piece.color) {
        const sameType = getAllPiecesOnBoard(board).filter(p =>
          p.color !== move.piece.color && p.type === move.piece.type
        );
        if (sameType.length > 0) {
          sameType.sort((a, b) => {
            const da = Math.abs(a.position.row - mr) + Math.abs(a.position.col - mc);
            const db = Math.abs(b.position.row - mr) + Math.abs(b.position.col - mc);
            return da - db;
          });
          enemyPiece = sameType[0];
        }
      }

      if (!enemyPiece || enemyPiece.color === move.piece.color) return;

      const dr = move.to.row - move.from.row;
      const dc = move.to.col - move.from.col;
      const targetRow = enemyPiece.position.row + dr;
      const targetCol = enemyPiece.position.col + dc;

      if (!inBounds(targetRow, targetCol)) return;

      const targetPiece = board[targetRow][targetCol].piece;
      if (targetPiece && targetPiece.color === enemyPiece.color) return;

      if (targetPiece) {
        removePiece(board, { row: targetRow, col: targetCol });
      }
      movePiece(board, enemyPiece.position, { row: targetRow, col: targetCol });
    }),
  },

  {
    id: 'inflation',
    name: 'Inflation',
    description: 'Pawns become knights. Knights become bishops. Bishops become rooks. Rooks become queens.',
    flavor: 'The economy is booming!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '📈',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const upgrade: Record<string, PieceType> = {
        [PieceType.Pawn]: PieceType.Knight,
        [PieceType.Knight]: PieceType.Bishop,
        [PieceType.Bishop]: PieceType.Rook,
        [PieceType.Rook]: PieceType.Queen,
      };
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece && upgrade[sq.piece.type]) {
            sq.piece.type = upgrade[sq.piece.type];
          }
        }
      }
    }),
  },

  {
    id: 'recession',
    name: 'Recession',
    description: 'Queens become rooks. Rooks become bishops. Bishops become knights. Knights become pawns.',
    flavor: 'The economy is crashing!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '📉',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const downgrade: Record<string, PieceType> = {
        [PieceType.Queen]: PieceType.Rook,
        [PieceType.Rook]: PieceType.Bishop,
        [PieceType.Bishop]: PieceType.Knight,
        [PieceType.Knight]: PieceType.Pawn,
      };
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece && downgrade[sq.piece.type]) {
            sq.piece.type = downgrade[sq.piece.type];
          }
        }
      }
    }),
  },

  {
    id: 'civil_war',
    name: 'Civil War',
    description: 'All pieces of the same type fight each other: one random piece of each type dies.',
    flavor: 'Friendly fire!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '⚔️',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const types = [PieceType.Pawn, PieceType.Knight, PieceType.Bishop, PieceType.Rook, PieceType.Queen];
      for (const t of types) {
        const pieces = getAllPiecesOnBoard(board).filter(p => p.type === t);
        if (pieces.length >= 2) {
          const target = pieces[Math.floor(getRandom() * pieces.length)];
          if (!target.statuses.has('invulnerable')) {
            removePiece(board, target.position);
          }
        }
      }
    }),
  },

  {
    id: 'demolition_derby',
    name: 'Demolition Derby',
    description: 'At end of each turn, all pieces that are adjacent to an enemy piece of the same type die.',
    flavor: 'CRASH! BANG! BOOM!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '🚗',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const pieces = getAllPiecesOnBoard(board);
      for (const p of pieces) {
        if (p.statuses.has('invulnerable')) continue;
        const adj = squaresAdjacentTo(p.position);
        for (const pos of adj) {
          const neighbor = board[pos.row][pos.col].piece;
          if (neighbor && neighbor.color !== p.color && neighbor.type === p.type) {
            removePiece(board, p.position);
            break;
          }
        }
      }
    }),
  },

  {
    id: 'friendly_fire',
    name: 'Friendly Fire',
    description: 'Pieces can capture their own color.',
    flavor: 'Oops!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🔥',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const board = getBoard()!;
      const newMoves = [...moves];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = piece.position.row + dr;
          const nc = piece.position.col + dc;
          if (inBounds(nr, nc)) {
            const target = board[nr][nc].piece;
            if (target && target.color === piece.color && target.id !== piece.id) {
              newMoves.push({
                from: { ...piece.position },
                to: { row: nr, col: nc },
                piece,
                captures: [target],
                special: 'friendly_fire',
              });
            }
          }
        }
      }
      return newMoves;
    }),
  },

  {
    id: 'frozen_tundra',
    name: 'Frozen Tundra',
    description: 'Pieces that haven\'t moved in 2 turns become frozen and cannot move. They thaw when they make a move.',
    flavor: 'BRRR!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '❄️',
    data: { lastMoveTurn: {} as Record<string, number> },
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'frozen_tundra');
      if (!rule) return;
      const pieces = getAllPiecesOnBoard(board);
      for (const p of pieces) {
        const lastTurn = rule.data.lastMoveTurn[p.id] || 0;
        if (ctx.turnNumber - lastTurn >= 2) {
          p.statuses.set('frozen', { id: 'frozen', name: 'Frozen', turnsRemaining: 999, data: {} });
        }
      }
    }),
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const rule = findActiveRule(ctx.activeRules, 'frozen_tundra');
      if (!rule) return;
      rule.data.lastMoveTurn[move.piece.id] = ctx.turnNumber;
      move.piece.statuses.delete('frozen');
    }),
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.statuses.has('frozen')) return [];
      return moves;
    }),
  },

  {
    id: 'berserker',
    name: 'Berserker Rage',
    description: 'Any piece that captures an enemy piece must also move one more square in the same direction if possible.',
    flavor: 'BLOOD FOR THE BLOOD GOD!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '😡',
    onAfterMove: ctxHelper((ctx, move: Move) => {
      if (move.captures.length === 0) return;
      const board = getBoard()!;
      const p = board[move.to.row][move.to.col].piece;
      if (!p) return;
      const dr = move.to.row - move.from.row;
      const dc = move.to.col - move.from.col;
      if (dr === 0 && dc === 0) return;
      const nr = move.to.row + dr;
      const nc = move.to.col + dc;
      if (inBounds(nr, nc) && !board[nr][nc].piece) {
        movePiece(board, p.position, { row: nr, col: nc });
      }
    }),
  },

  {
    id: 'bamboo_growth',
    name: 'Bamboo Growth',
    description: 'At end of each turn, a random empty square gets a bamboo wall (impassable) for the rest of the game.',
    flavor: 'Nature is reclaiming the board!',
    category: RuleCategory.Board,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '🎋',
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const empty = randomEmptySquare(board);
      if (empty) {
        board[empty.row][empty.col].isMarked = true;
        board[empty.row][empty.col].markType = 'wall';
      }
    }),
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const board = getBoard()!;
      return moves.filter(m => {
        const sq = board[m.to.row][m.to.col];
        return !(sq.isMarked && sq.markType === 'wall');
      });
    }),
  },

  {
    id: 'spider_webs',
    name: 'Spider Webs',
    description: 'Pieces that stay in the same square for 2 turns get trapped and cannot move.',
    flavor: 'Stuck!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🕸️',
    data: { positions: {} as Record<string, number> },
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'spider_webs');
      if (!rule) return;
      const pieces = getAllPiecesOnBoard(board);
      for (const p of pieces) {
        const key = p.id;
        const lastPos = rule.data.positions[key];
        const currentKey = `${p.position.row},${p.position.col}`;
        if (lastPos === currentKey) {
          p.statuses.set('webbed', { id: 'webbed', name: 'Webbed', turnsRemaining: 999, data: {} });
        } else {
          p.statuses.delete('webbed');
        }
        rule.data.positions[key] = currentKey;
      }
    }),
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.statuses.has('webbed')) return [];
      return moves;
    }),
  },

  {
    id: 'magic_beans',
    name: 'Magic Beans',
    description: 'Every 2 turns, a random pawn grows into a giant: it becomes a rook.',
    flavor: 'JACK AND THE BEANSTALK!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Timed,
    baseTurns: 8,
    icon: '🫘',
    data: { tickCounter: 0 },
    onTurnEnd: ctxHelper((ctx) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'magic_beans');
      if (!rule) return;
      rule.data.tickCounter = (rule.data.tickCounter || 0) + 1;
      if (rule.data.tickCounter >= 2) {
        rule.data.tickCounter = 0;
        const pawns = getAllPiecesOnBoard(board).filter(p => p.type === PieceType.Pawn);
        if (pawns.length > 0) {
          const chosen = pawns[Math.floor(getRandom() * pawns.length)];
          chosen.type = PieceType.Rook;
        }
      }
    }),
  },

  {
    id: 'sniper',
    name: 'Sniper',
    description: 'Each turn, a random enemy piece takes a mark. After 2 marks that piece dies.',
    flavor: 'Pew pew!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🔫',
    data: { marks: {} as Record<string, number> },
    onTurnStart: ctxHelper((ctx, color: Color) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'sniper');
      if (!rule) return;
      const enemies = getAllPiecesOnBoard(board).filter(p => p.color === oppositeColor(color) && p.type !== PieceType.King);
      if (enemies.length === 0) return;
      const target = enemies[Math.floor(getRandom() * enemies.length)];
      rule.data.marks[target.id] = (rule.data.marks[target.id] || 0) + 1;
      if (rule.data.marks[target.id] >= 2) {
        removePiece(board, target.position);
        delete rule.data.marks[target.id];
      }
    }),
  },

  {
    id: 'sabotage',
    name: 'Sabotage',
    description: 'At the start of the game, each player loses their queen.',
    flavor: 'NO QUEENS ALLOWED!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '💣',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const row of board) {
        for (const sq of row) {
          if (sq.piece && sq.piece.type === PieceType.Queen) {
            removePiece(board, sq.piece.position);
          }
        }
      }
    }),
  },

  {
    id: 'king_of_north',
    name: 'King of the North',
    description: 'The king on the top half of the board gets +1 move range (can move 2 squares any direction).',
    flavor: 'The North remembers!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '👑',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type !== PieceType.King || piece.position.row > 3) return moves;
      const board = getBoard()!;
      const newMoves = [...moves];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) + Math.abs(dc) === 2 || Math.abs(dr) + Math.abs(dc) === 1) continue;
          const nr = piece.position.row + dr, nc = piece.position.col + dc;
          if (inBounds(nr, nc)) {
            const target = board[nr][nc].piece;
            if (!target || target.color !== piece.color) {
              newMoves.push({ from: { ...piece.position }, to: { row: nr, col: nc }, piece, captures: target ? [target] : [] });
            }
          }
        }
      }
      return newMoves;
    }),
  },

  {
    id: 'trojan_horse',
    name: 'Trojan Horse',
    description: 'A random knight on the board contains enemy soldiers. When it moves, it spawns 2 enemy pawns on adjacent squares.',
    flavor: 'Beware of Greeks bearing gifts!',
    category: RuleCategory.Meta,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '🐴',
    data: { horseId: null as string | null },
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      const knights = getAllPiecesOnBoard(board).filter(p => p.type === PieceType.Knight);
      if (knights.length > 0) {
        const target = knights[Math.floor(getRandom() * knights.length)];
        const rule = findActiveRule(ctx.activeRules, 'trojan_horse');
        if (rule) rule.data.horseId = target.id;
      }
    }),
    onAfterMove: ctxHelper((ctx, move: Move) => {
      const board = getBoard()!;
      const rule = findActiveRule(ctx.activeRules, 'trojan_horse');
      if (!rule || !rule.data.horseId) return;
      const p = board[move.to.row][move.to.col].piece;
      if (!p || p.id !== rule.data.horseId) return;
      const enemyColor = oppositeColor(p.color);
      const adj = squaresAdjacentTo(p.position);
      const empties = adj.filter(pos => !board[pos.row][pos.col].piece);
      const count = Math.min(2, empties.length);
      for (let i = 0; i < count; i++) {
        const pos = empties[i];
        const pawn: Piece = {
          id: `p${Date.now()}_${Math.random()}`,
          type: PieceType.Pawn,
          color: enemyColor,
          position: pos,
          hasMoved: false,
          statuses: new Map(),
        };
        board[pos.row][pos.col].piece = pawn;
      }
    }),
  },

  {
    id: 'zombie_apocalypse',
    name: 'Zombie Apocalypse',
    description: 'When a piece dies, it becomes a zombie pawn of the opposite color on the same square.',
    flavor: 'BRAINSSSS!',
    category: RuleCategory.Transformation,
    duration: RuleDuration.Timed,
    baseTurns: 6,
    icon: '🧟',
    onDeath: ctxHelper((ctx, piece: Piece, cause: string) => {
      if (piece.type === PieceType.King) return;
      const board = getBoard()!;
      const zombie: Piece = {
        id: `p${Date.now()}_${Math.random()}`,
        type: PieceType.Pawn,
        color: oppositeColor(piece.color),
        position: { ...piece.position },
        hasMoved: false,
        statuses: new Map(),
      };
      board[piece.position.row][piece.position.col].piece = zombie;
    }),
  },

  {
    id: 'mutual_assured',
    name: 'Mutual Assured Destruction',
    description: 'When ANY piece captures, both the capturer and the captured die.',
    flavor: 'If I go, you go!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '☢️',
    onCapture: ctxHelper((ctx, captured: Piece, capturer: Piece) => {
      const board = getBoard()!;
      if (!capturer.statuses.has('invulnerable')) removePiece(board, capturer.position);
      if (!captured.statuses.has('invulnerable')) removePiece(board, captured.position);
    }),
  },

  {
    id: 'ghost_pieces',
    name: 'Ghost Pieces',
    description: 'Pieces can move through other pieces (friendly and enemy) but cannot end on occupied squares.',
    flavor: 'BOO!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 4,
    icon: '👻',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const board = getBoard()!;
      if (piece.type === PieceType.Knight) {
        return moves.filter(m => !board[m.to.row][m.to.col].piece);
      }
      const newMoves: Move[] = [];
      const dirs = piece.type === PieceType.Bishop ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                   piece.type === PieceType.Rook ? [[-1,0],[1,0],[0,-1],[0,1]] :
                   piece.type === PieceType.Queen ? [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]] :
                   [];
      for (const [dr, dc] of dirs) {
        let r = piece.position.row + dr, c = piece.position.col + dc;
        while (inBounds(r, c)) {
          if (!board[r][c].piece) {
            newMoves.push({ from: { ...piece.position }, to: { row: r, col: c }, piece, captures: [] });
          } else {
            if (board[r][c].piece!.color !== piece.color) {
              newMoves.push({ from: { ...piece.position }, to: { row: r, col: c }, piece, captures: [board[r][c].piece!] });
            }
            break;
          }
          r += dr; c += dc;
        }
      }
      return newMoves;
    }),
  },

  {
    id: 'king_slapper',
    name: 'King Slapper',
    description: 'The king gains a ranged slap! It can capture any enemy piece up to 2 squares away in any direction.',
    flavor: 'The king learned kung fu. Watch out!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Permanent,
    baseTurns: 0,
    icon: '✋',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type !== PieceType.King) return moves;
      const board = getBoard()!;
      const newMoves = [...moves];
      // Standard adjacent captures (might duplicate, but we filter)
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) > 2 || Math.abs(dc) > 2) continue;
          const nr = piece.position.row + dr, nc = piece.position.col + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc].piece;
          if (target && target.color !== piece.color) {
            if (!newMoves.some(m => m.to.row === nr && m.to.col === nc)) {
              const isPathClear = isSlapPathClear(board, piece.position, { row: nr, col: nc });
              if (isPathClear) {
                newMoves.push({ from: { ...piece.position }, to: { row: nr, col: nc }, piece, captures: [target] });
              }
            }
          }
        }
      }
      return newMoves;
    }),
  },

  {
    id: 'peasant_revolt',
    name: 'Peasant Revolt',
    description: 'All pawns become their own color. Pawns can now attack and be attacked by anyone.',
    flavor: 'The people have risen!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🚩',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      if (piece.type !== PieceType.Pawn) return moves;
      const board = getBoard()!;
      const newMoves: Move[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = piece.position.row + dr, nc = piece.position.col + dc;
          if (inBounds(nr, nc)) {
            const target = board[nr][nc].piece;
            if (!target) {
              newMoves.push({ from: { ...piece.position }, to: { row: nr, col: nc }, piece, captures: [] });
            } else if (target.id !== piece.id) {
              newMoves.push({ from: { ...piece.position }, to: { row: nr, col: nc }, piece, captures: [target] });
            }
          }
        }
      }
      return newMoves;
    }),
  },

  {
    id: 'blitzkrieg',
    name: 'Blitzkrieg',
    description: 'Each turn, every piece gets +1 movement range in all directions.',
    flavor: 'Speed is key!',
    category: RuleCategory.Movement,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '⚡',
    onGetMoves: ctxHelper((ctx, piece: Piece, moves: Move[]) => {
      const board = getBoard()!;
      if (piece.type === PieceType.King || piece.type === PieceType.Knight || piece.type === PieceType.Pawn) return moves;
      const dirs = piece.type === PieceType.Bishop ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                   piece.type === PieceType.Rook ? [[-1,0],[1,0],[0,-1],[0,1]] :
                   [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
      const newMoves = [...moves];
      for (const [dr, dc] of dirs) {
        let r = piece.position.row + dr * 2, c = piece.position.col + dc * 2;
        const midR = piece.position.row + dr, midC = piece.position.col + dc;
        if (inBounds(midR, midC) && board[midR][midC].piece) continue;
        if (inBounds(r, c)) {
          const target = board[r][c].piece;
          if (!target || target.color !== piece.color) {
            newMoves.push({ from: { ...piece.position }, to: { row: r, col: c }, piece, captures: target ? [target] : [] });
          }
        }
      }
      return newMoves;
    }),
  },

  {
    id: 'cursed_king',
    name: 'Cursed King',
    description: 'Your king is cursed: if it\'s your turn and your king is in the center 4 squares, you lose.',
    flavor: 'The center is forbidden!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🤴',
    onTurnStart: ctxHelper((ctx, color: Color) => {
      const board = getBoard()!;
      const king = findKing(board, color);
      if (!king) return;
      const center = [3,4];
      if (center.includes(king.position.row) && center.includes(king.position.col)) {
        // Player loses - game logic handles this via king death
        removePiece(board, king.position);
      }
    }),
  },

  // Last few to push past 70
  {
    id: 'betrayal',
    name: 'Betrayal',
    description: 'After each capture, the capturing piece has a 20% chance to switch to the enemy team.',
    flavor: 'Et tu, Brute?',
    category: RuleCategory.Meta,
    duration: RuleDuration.Timed,
    baseTurns: 5,
    icon: '🗡️',
    onCapture: ctxHelper((ctx, captured: Piece, capturer: Piece) => {
      if (getRandom() < 0.2 && capturer.type !== PieceType.King) {
        capturer.color = oppositeColor(capturer.color);
      }
    }),
  },

  {
    id: 'trap_door',
    name: 'Trap Door',
    description: 'The square under each king (at the time of activation) becomes a pit.',
    flavor: 'The ground gives way!',
    category: RuleCategory.Hazard,
    duration: RuleDuration.Instant,
    baseTurns: 0,
    icon: '🪤',
    onActivate: ctxHelper((ctx) => {
      const board = getBoard()!;
      for (const color of [Color.White, Color.Black]) {
        const king = findKing(board, color);
        if (king) {
          board[king.position.row][king.position.col].isPit = true;
          removePiece(board, king.position);
        }
      }
    }),
  },

];

function createEmptyBoard(): BoardSquare[][] {
  const board: BoardSquare[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: BoardSquare[] = [];
    for (let c = 0; c < 8; c++) {
      row.push({
        row: r, col: c, piece: null,
        hasMine: false, isPit: false, isPortal: false,
        isMarked: false, isTreasure: false,
      });
    }
    board.push(row);
  }
  return board;
}
