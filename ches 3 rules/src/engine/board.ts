import { BoardSquare, Color, Piece, PieceType, Position } from './types';
import { inBounds } from '../utils/helpers';

export function createBoard(): BoardSquare[][] {
  const board: BoardSquare[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: BoardSquare[] = [];
    for (let c = 0; c < 8; c++) {
      row.push({
        row: r,
        col: c,
        piece: null,
        hasMine: false,
        isPit: false,
        isPortal: false,
        isMarked: false,
        isTreasure: false,
      });
    }
    board.push(row);
  }
  return board;
}

export function placePieces(board: BoardSquare[][]): Piece[] {
  const pieces: Piece[] = [];
  let id = 1;

  const backRank: PieceType[] = [
    PieceType.Rook, PieceType.Knight, PieceType.Bishop, PieceType.Queen,
    PieceType.King, PieceType.Bishop, PieceType.Knight, PieceType.Rook,
  ];

  for (let c = 0; c < 8; c++) {
    pieces.push(makePiece(id++, backRank[c], Color.Black, { row: 0, col: c }));
  }
  for (let c = 0; c < 8; c++) {
    pieces.push(makePiece(id++, PieceType.Pawn, Color.Black, { row: 1, col: c }));
  }
  for (let c = 0; c < 8; c++) {
    pieces.push(makePiece(id++, PieceType.Pawn, Color.White, { row: 6, col: c }));
  }
  for (let c = 0; c < 8; c++) {
    pieces.push(makePiece(id++, backRank[c], Color.White, { row: 7, col: c }));
  }

  for (const p of pieces) {
    board[p.position.row][p.position.col].piece = p;
  }

  return pieces;
}

function makePiece(id: number, type: PieceType, color: Color, pos: Position): Piece {
  return {
    id: `p${id}`,
    type,
    color,
    position: { ...pos },
    hasMoved: false,
    statuses: new Map(),
  };
}

export function findKing(board: BoardSquare[][], color: Color): Piece | null {
  for (const row of board) {
    for (const sq of row) {
      if (sq.piece && sq.piece.type === PieceType.King && sq.piece.color === color) {
        return sq.piece;
      }
    }
  }
  return null;
}

export function getPiecesOfColor(pieces: Piece[], color: Color): Piece[] {
  return pieces.filter(p => p.color === color);
}

export function getAllPieces(pieces: Piece[], board: BoardSquare[][]): Piece[] {
  const result: Piece[] = [];
  for (const row of board) {
    for (const sq of row) {
      if (sq.piece) result.push(sq.piece);
    }
  }
  return result;
}

export function pieceAt(board: BoardSquare[][], row: number, col: number): Piece | null {
  if (!inBounds(row, col)) return null;
  return board[row][col].piece;
}

export function movePiece(board: BoardSquare[][], from: Position, to: Position): void {
  const piece = board[from.row][from.col].piece;
  board[to.row][to.col].piece = piece;
  board[from.row][from.col].piece = null;
  if (piece) {
    piece.position = { ...to };
    piece.hasMoved = true;
  }
}

export function removePiece(board: BoardSquare[][], pos: Position): Piece | null {
  const piece = board[pos.row][pos.col].piece;
  board[pos.row][pos.col].piece = null;
  return piece;
}

export function cloneBoard(board: BoardSquare[][]): BoardSquare[][] {
  return board.map(row => row.map(sq => ({
    ...sq,
    piece: sq.piece ? { ...sq.piece, position: { ...sq.piece.position }, statuses: new Map(sq.piece.statuses) } : null,
  })));
}

export function clonePieces(pieces: Piece[]): Piece[] {
  return pieces.map(p => ({
    ...p,
    position: { ...p.position },
    statuses: new Map(p.statuses),
  }));
}
