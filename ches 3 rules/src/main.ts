import './ui/styles/main.css';
import { GameManager } from './engine/game';
import { GamePhase } from './engine/types';
import { UIRenderer } from './ui/renderer';
import { NetworkManager } from './network/NetworkManager';

const app = document.getElementById('app');
if (!app) throw new Error('No #app element found');

const game = new GameManager();
const network = new NetworkManager(
  // Use production URL or localhost
  (window as any).__SERVER_URL__ || 'http://localhost:3001'
);
const ui = new UIRenderer(app, game, network);

// Global event delegation for dynamic elements
document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  // Draft card selection (local hotseat)
  const draftCard = target.closest('.draft-card') as HTMLElement;
  if (draftCard && !draftCard.classList.contains('locked')) {
    const index = parseInt(draftCard.dataset.ruleIndex!);
    const mode = window.__mode || 'local';
    if (mode === 'local') {
      const rule = game.state.draftOptions[index];
      if (rule) {
        game.selectDraftRule(rule);
        ui.render();
      }
    } else {
      // Multiplayer: send to server
      const rule = game.state.draftOptions[index];
      if (rule) {
        network.selectDraftRule(rule);
      }
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
    window.__mode = 'local';
    ui.render();
    return;
  }
  if (target.id === 'btn-rules-paused' || target.id === 'btn-rules') {
    game.state.phase = GamePhase.Paused;
    (ui as any).renderAllRules?.();
    return;
  }
  if (target.id === 'btn-rules-multi') {
    game.state.phase = GamePhase.Paused;
    (ui as any).renderAllRules?.();
    return;
  }
  if (target.id === 'btn-how-paused' || target.id === 'btn-how') {
    game.state.phase = GamePhase.Paused;
    (ui as any).renderHowItWorks?.();
    return;
  }
  if (target.id === 'btn-how-multi') {
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

  // Multiplayer: cancel choice via network
  if (target.id === 'btn-cancel-choice-multi') {
    // For multiplayer, we just clear locally and request new state
    window.__pendingChoice = null;
    if (network.connected) {
      network.requestGameState();
    }
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

// Expose for debugging
(window as any).__game = game;
(window as any).__network = network;

console.log(`🚀 Chaos Chess loaded with ${game.registry.count()} rules!`);