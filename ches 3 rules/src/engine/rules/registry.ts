import { RuleDefinition } from '../types';
import { ALL_RULES } from './rules';

export class RuleRegistry {
  private rules: Map<string, RuleDefinition> = new Map();

  constructor() {
    for (const rule of ALL_RULES) {
      this.rules.set(rule.id, rule);
    }
  }

  get(id: string): RuleDefinition | undefined {
    return this.rules.get(id);
  }

  getAll(): RuleDefinition[] {
    return ALL_RULES;
  }

  getRandom(previous: string[] = []): RuleDefinition {
    const available = ALL_RULES.filter(r => !previous.includes(r.id));
    if (available.length === 0) return ALL_RULES[Math.floor(Math.random() * ALL_RULES.length)];
    return available[Math.floor(Math.random() * available.length)];
  }

  getRandomDraft(exclude: string[] = []): RuleDefinition[] {
    const available = ALL_RULES.filter(r => !exclude.includes(r.id));
    const pool = shuffleArray([...available]);
    return pool.slice(0, Math.min(3, pool.length));
  }

  count(): number {
    return ALL_RULES.length;
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
