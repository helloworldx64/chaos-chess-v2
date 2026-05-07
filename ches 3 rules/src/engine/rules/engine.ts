import { ActiveRule, BoardSquare, Color, GameState, Move, Piece, RuleContext, RuleDefinition } from '../types';

export class RuleEngine {
  private activeRules: ActiveRule[] = [];

  getActiveRules(): ActiveRule[] {
    return this.activeRules;
  }

  activateRule(rule: RuleDefinition, state: GameState, customData?: Record<string, any>): ActiveRule {
    const active: ActiveRule = {
      definition: rule,
      turnsRemaining: rule.duration === 'timed' ? rule.baseTurns : -1,
      isActive: true,
      data: customData || { ...rule.data },
    };
    this.activeRules.push(active);

    if (rule.onActivate) {
      const ctx = this.makeContext(state);
      rule.onActivate(ctx);
    }

    return active;
  }

  deactivateRule(active: ActiveRule, state: GameState): void {
    active.isActive = false;
    if (active.definition.onDeactivate) {
      const ctx = this.makeContext(state);
      active.definition.onDeactivate(ctx);
    }
  }

  removeRule(active: ActiveRule): void {
    this.activeRules = this.activeRules.filter(r => r !== active);
  }

  advanceTurns(state: GameState): void {
    for (const rule of this.activeRules) {
      if (rule.definition.duration !== 'timed') continue;
      rule.turnsRemaining--;
      if (rule.turnsRemaining <= 0) {
        this.deactivateRule(rule, state);
      }
    }
    this.activeRules = this.activeRules.filter(r => r.isActive);
  }

  applyBeforeMove(state: GameState, move: Move): Move | null {
    const ctx = this.makeContext(state);
    let currentMove: Move | null = move;
    for (const rule of this.activeRules) {
      if (rule.definition.onBeforeMove) {
        currentMove = rule.definition.onBeforeMove(ctx, currentMove);
        if (!currentMove) return null;
      }
    }
    return currentMove;
  }

  applyAfterMove(state: GameState, move: Move): void {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onAfterMove) {
        rule.definition.onAfterMove(ctx, move);
      }
    }
  }

  applyBeforeCapture(state: GameState, move: Move): boolean {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onBeforeCapture) {
        if (!rule.definition.onBeforeCapture(ctx, move)) return false;
      }
    }
    return true;
  }

  applyOnCapture(state: GameState, captured: Piece, capturer: Piece): void {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onCapture) {
        rule.definition.onCapture(ctx, captured, capturer);
      }
    }
  }

  applyOnDeath(state: GameState, piece: Piece, cause: string): void {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onDeath) {
        rule.definition.onDeath(ctx, piece, cause);
      }
    }
  }

  applyTurnStart(state: GameState, color: Color): void {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onTurnStart) {
        rule.definition.onTurnStart(ctx, color);
      }
    }
  }

  applyTurnEnd(state: GameState, color: Color): void {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onTurnEnd) {
        rule.definition.onTurnEnd(ctx, color);
      }
    }
  }

  applyGetMoves(state: GameState, piece: Piece, moves: Move[]): Move[] {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.onGetMoves) {
        moves = rule.definition.onGetMoves(ctx, piece, moves);
      }
    }
    return moves;
  }

  applyModifyPieceStatus(state: GameState, piece: Piece): void {
    const ctx = this.makeContext(state);
    for (const rule of this.activeRules) {
      if (rule.definition.modifyPieceStatus) {
        rule.definition.modifyPieceStatus(ctx, piece);
      }
    }
  }

  makeContext(state: GameState): RuleContext {
    return {
      board: state.board,
      pieces: state.pieces,
      activeRules: this.activeRules,
      turnNumber: state.turnNumber,
      currentColor: state.currentTurn,
      random: () => Math.random(),
    };
  }
}
