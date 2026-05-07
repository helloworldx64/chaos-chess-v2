import './ui/styles/main.css';
import { GameManager } from './engine/game';
import { GamePhase } from './engine/types';
import { UIRenderer } from './ui/renderer';

const app = document.getElementById('app');
if (!app) throw new Error('No #app element found');

const game = new GameManager();
const ui = new UIRenderer(app, game);

// Global event delegation for dynamic elements
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  // Draft card selection
  const draftCard = target.closest('.draft-card') as HTMLElement;
  if (draftCard) {
    const index = parseInt(draftCard.dataset.ruleIndex!);
    const rule = game.state.draftOptions[index];
    if (rule) {
      game.selectDraftRule(rule);
      ui.render();
    }
    return;
  }

  // Pause menu buttons
  if (target.id === 'btn-resume') {
    game.resume();
    ui.render();
    return;
  }
  if (target.id === 'btn-restart') {
    game.startGame();
    ui.render();
    return;
  }
  if (target.id === 'btn-quit') {
    game.goToTitle();
    ui.render();
    return;
  }
  if (target.id === 'btn-rules-paused' || target.id === 'btn-rules') {
    game.state.phase = GamePhase.Paused;
    (ui as any).renderAllRules?.();
    return;
  }
  if (target.id === 'btn-how-paused') {
    game.state.phase = GamePhase.Paused;
    (ui as any).renderHowItWorks?.();
    return;
  }
  if (target.id === 'btn-cancel-choice') {
    game.state.pendingChoice = null;
    game.state.phase = GamePhase.Playing;
    ui.render();
    return;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (game.state.phase === GamePhase.Playing) {
      game.pause();
      ui.render();
    } else if (game.state.phase === GamePhase.Paused) {
      game.resume();
      ui.render();
    }
  }
});

console.log(`🚀 Chaos Chess loaded with ${game.registry.count()} rules!`);
