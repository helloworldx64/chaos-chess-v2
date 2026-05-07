import { BoardSquare, Color, Move, Piece, PieceType, Position } from './types';
import { inBounds, oppositeColor, posKey } from '../utils/helpers';

export function generateLegalMoves(board: BoardSquare[][], piece: Piece): Move[] {
  const moves = generateRawMoves(board, piece);
  return moves.filter(m => !wouldBeInCheck(board, piece.color, m));
}

export function generateRawMoves(board: BoardSquare[][], piece: Piece): Move[] {
  switch (piece.type) {
    case PieceType.Pawn: return pawnMoves(board, piece);
    case PieceType.Knight: return knightMoves(board, piece);
    case PieceType.Bishop: return bishopMoves(board, piece);
    case PieceType.Rook: return rookMoves(board, piece);
    case PieceType.Queen: return queenMoves(board, piece);
    case PieceType.King: return kingMoves(board, piece);
  }
}

function addMove(moves: Move[], from: Position, to: Position, piece: Piece, board: BoardSquare[][]): void {
  if (!inBounds(to.row, to.col)) return;
  const target = board[to.row][to.col].piece;
  if (target && target.color === piece.color) return;
  const move: Move = {
    from: { ...from },
    to: { ...to },
    piece,
    captures: target ? [target] : [],
  };
  moves.push(move);
}

function pawnMoves(board: BoardSquare[][], piece: Piece): Move[] {
  const moves: Move[] = [];
  const dir = piece.color === Color.White ? -1 : 1;
  const startRow = piece.color === Color.White ? 6 : 1;
  const promoRow = piece.color === Color.White ? 0 : 7;
  const r = piece.position.row;
  const c = piece.position.col;

  const oneStep: Position = { row: r + dir, col: c };
  if (inBounds(oneStep.row, oneStep.col) && !board[oneStep.row][oneStep.col].piece) {
    addPromotionMoves(moves, piece, oneStep, board);
  }

  if (r === startRow) {
    const twoStep: Position = { row: r + 2 * dir, col: c };
    const midPos: Position = { row: r + dir, col: c };
    if (
      inBounds(twoStep.row, twoStep.col) &&
      !board[twoStep.row][twoStep.col].piece &&
      !board[midPos.row][midPos.col].piece
    ) {
      addPromotionMoves(moves, piece, twoStep, board);
    }
  }

  for (const dc of [-1, 1]) {
    const capPos: Position = { row: r + dir, col: c + dc };
    if (!inBounds(capPos.row, capPos.col)) continue;
    const target = board[capPos.row][capPos.col].piece;
    if (target && target.color !== piece.color) {
      addPromotionMoves(moves, piece, capPos, board);
    }
  }

  return moves;
}

function addPromotionMoves(moves: Move[], piece: Piece, to: Position, board: BoardSquare[][]): void {
  const promoRow = piece.color === Color.White ? 0 : 7;
  if (to.row === promoRow) {
    for (const pt of [PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight]) {
      const target = board[to.row][to.col].piece;
      moves.push({
        from: { ...piece.position },
        to,
        piece,
        captures: target ? [target] : [],
        promotionType: pt,
      });
    }
  } else {
    const target = board[to.row][to.col].piece;
    moves.push({
      from: { ...piece.position },
      to,
      piece,
      captures: target ? [target] : [],
    });
  }
}

function knightMoves(board: BoardSquare[][], piece: Piece): Move[] {
  const moves: Move[] = [];
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of offsets) {
    addMove(moves, piece.position, { row: piece.position.row + dr, col: piece.position.col + dc }, piece, board);
  }
  return moves;
}

function bishopMoves(board: BoardSquare[][], piece: Piece): Move[] {
  return slidingMoves(board, piece, [[-1,-1], [-1,1], [1,-1], [1,1]]);
}

function rookMoves(board: BoardSquare[][], piece: Piece): Move[] {
  return slidingMoves(board, piece, [[-1,0], [1,0], [0,-1], [0,1]]);
}

function queenMoves(board: BoardSquare[][], piece: Piece): Move[] {
  return slidingMoves(board, piece, [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]]);
}

function kingMoves(board: BoardSquare[][], piece: Piece): Move[] {
  const moves: Move[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      addMove(moves, piece.position, { row: piece.position.row + dr, col: piece.position.col + dc }, piece, board);
    }
  }
  return moves;
}

function slidingMoves(board: BoardSquare[][], piece: Piece, directions: number[][]): Move[] {
  const moves: Move[] = [];
  for (const [dr, dc] of directions) {
    let r = piece.position.row + dr;
    let c = piece.position.col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c].piece;
      if (target) {
        if (target.color !== piece.color) {
          moves.push({
            from: { ...piece.position },
            to: { row: r, col: c },
            piece,
            captures: [target],
          });
        }
        break;
      }
      moves.push({
        from: { ...piece.position },
        to: { row: r, col: c },
        piece,
        captures: [],
      });
      r += dr;
      c += dc;
    }
  }
  return moves;
}

export function wouldBeInCheck(board: BoardSquare[][], color: Color, move: Move): boolean {
  const testBoard = cloneBoardForCheck(board);
  testBoard[move.to.row][move.to.col].piece = testBoard[move.from.row][move.from.col].piece;
  testBoard[move.from.row][move.from.col].piece = null;
  if (testBoard[move.to.row][move.to.col].piece) {
    testBoard[move.to.row][move.to.col].piece!.position = { ...move.to };
  }
  return isInCheck(testBoard, color);
}

function cloneBoardForCheck(board: BoardSquare[][]): BoardSquare[][] {
  return board.map(row => row.map(sq => ({
    ...sq,
    piece: sq.piece ? { ...sq.piece, position: { ...sq.piece.position }, statuses: new Map(sq.piece.statuses) } : null,
  })));
}

export function isInCheck(board: BoardSquare[][], color: Color): boolean {
  const king = board.flat().find(sq => sq.piece && sq.piece.type === PieceType.King && sq.piece.color === color)?.piece;
  if (!king) return false;

  const enemyColor = oppositeColor(color);
  for (const row of board) {
    for (const sq of row) {
      if (sq.piece && sq.piece.color === enemyColor) {
        const attacks = generateRawMoves(board, sq.piece);
        if (attacks.some(m => m.to.row === king.position.row && m.to.col === king.position.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function isCheckmate(board: BoardSquare[][], color: Color): boolean {
  if (!isInCheck(board, color)) return false;
  return hasNoLegalMoves(board, color);
}

export function isStalemate(board: BoardSquare[][], color: Color): boolean {
  if (isInCheck(board, color)) return false;
  return hasNoLegalMoves(board, color);
}

export function hasNoLegalMoves(board: BoardSquare[][], color: Color): boolean {
  for (const row of board) {
    for (const sq of row) {
      if (sq.piece && sq.piece.color === color) {
        const moves = generateLegalMoves(board, sq.piece);
        if (moves.length > 0) return false;
      }
    }
  }
  return true;
}
