import { Color } from '../engine/types';

export function oppositeColor(c: Color): Color {
  return c === Color.White ? Color.Black : Color.White;
}

export function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parsePosKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(',').map(Number);
  return { row: r, col: c };
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
