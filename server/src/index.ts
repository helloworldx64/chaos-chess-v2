import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { LobbyManager } from './LobbyManager.js';
import { GameRoom } from './GameRoom.js';
import { Color, GamePhase } from './engine/types.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const lobbyManager = new LobbyManager();
const gameRooms = new Map<string, GameRoom>();

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: gameRooms.size, lobbies: lobbyManager.getLobbyCount() });
});

io.on('connection', (socket: Socket) => {
  console.log(`[+] Player connected: ${socket.id}`);

  // --- LOBBY MANAGEMENT ---

  socket.on('create_lobby', (data: { playerName: string }, callback) => {
    const { playerName } = data;
    const lobby = lobbyManager.createLobby(socket.id, playerName || 'Player');
    socket.join(`lobby:${lobby.id}`);
    console.log(`[*] Lobby created: ${lobby.code} by ${playerName}`);

    // Create game room
    const gameRoom = new GameRoom(lobby.id, lobby.code);
    gameRooms.set(lobby.id, gameRoom);

    callback({
      success: true,
      lobbyId: lobby.id,
      code: lobby.code,
      playerColor: 'white',
    });
  });

  socket.on('join_lobby', (data: { code: string; playerName: string }, callback) => {
    const { code, playerName } = data;
    const lobby = lobbyManager.joinLobby(code, socket.id, playerName || 'Player 2');
    if (!lobby) {
      callback({ success: false, error: 'Invalid or expired lobby code' });
      return;
    }

    socket.join(`lobby:${lobby.id}`);
    console.log(`[*] Player ${playerName} joined lobby ${lobby.code}`);

    const gameRoom = gameRooms.get(lobby.id)!;

    // Notify the host that someone joined
    io.to(`lobby:${lobby.id}`).emit('player_joined', {
      hostName: lobby.hostName,
      guestName: lobby.guestName,
    });

    callback({
      success: true,
      lobbyId: lobby.id,
      code: lobby.code,
      playerColor: 'black',
    });
  });

  // --- GAME FLOW ---

  socket.on('start_game', (data: { lobbyId: string }) => {
    const gameRoom = gameRooms.get(data.lobbyId);
    if (!gameRoom) return;

    gameRoom.startGame();

    // Broadcast initial state to all players in the room
    broadcastGameState(data.lobbyId, gameRoom);
    io.to(`lobby:${data.lobbyId}`).emit('game_started', {
      whitePlayer: gameRoom.game.state.whitePlayer,
      blackPlayer: gameRoom.game.state.blackPlayer,
    });
  });

  socket.on('select_square', (data: { lobbyId: string; row: number; col: number }) => {
    const gameRoom = gameRooms.get(data.lobbyId);
    if (!gameRoom) return;

    const player = gameRoom.getPlayer(socket.id);
    if (!player) return;

    const result = gameRoom.handleSelectSquare(player.color, { row: data.row, col: data.col });

    // Send selection/legal moves back to the selecting player only
    io.to(socket.id).emit('square_selected', {
      selectedSquare: result.selectedSquare,
      legalMoves: result.legalMoves,
    });

    // Broadcast game state changes to everyone
    broadcastGameState(data.lobbyId, gameRoom);
  });

  socket.on('execute_move', (data: { lobbyId: string; move: any }) => {
    const gameRoom = gameRooms.get(data.lobbyId);
    if (!gameRoom) return;

    const player = gameRoom.getPlayer(socket.id);
    if (!player) return;

    const success = gameRoom.handleExecuteMove(player.color, data.move);
    if (success) {
      broadcastGameState(data.lobbyId, gameRoom);

      if (gameRoom.isGameOver()) {
        io.to(`lobby:${data.lobbyId}`).emit('game_over', {
          winner: gameRoom.game.state.winner,
          draw: gameRoom.game.state.draw,
          endCause: gameRoom.game.state.endCause,
        });
      }
    }
  });

  socket.on('select_draft_rule', (data: { lobbyId: string; rule: any }) => {
    const gameRoom = gameRooms.get(data.lobbyId);
    if (!gameRoom) return;

    const player = gameRoom.getPlayer(socket.id);
    if (!player) return;

    const success = gameRoom.handleSelectDraftRule(player.color, data.rule);
    if (success) {
      broadcastGameState(data.lobbyId, gameRoom);
    }
  });

  socket.on('resolve_choice', (data: { lobbyId: string; selected: any[] }) => {
    const gameRoom = gameRooms.get(data.lobbyId);
    if (!gameRoom) return;

    const player = gameRoom.getPlayer(socket.id);
    if (!player) return;

    const success = gameRoom.handleResolveChoice(player.color, data.selected);
    if (success) {
      broadcastGameState(data.lobbyId, gameRoom);
    }
  });

  socket.on('get_game_state', (data: { lobbyId: string }) => {
    const gameRoom = gameRooms.get(data.lobbyId);
    if (!gameRoom) return;

    const player = gameRoom.getPlayer(socket.id);
    const state = player
      ? getFilteredState(gameRoom, player.color, socket.id)
      : null;

    if (state) {
      io.to(socket.id).emit('game_state', state);
    }
  });

  // --- DISCONNECT ---

  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id}`);

    // Check if this player is in any lobby
    for (const [id, gameRoom] of gameRooms) {
      const player = gameRoom.getPlayer(socket.id);
      if (player) {
        gameRoom.removePlayer(socket.id);
        io.to(`lobby:${id}`).emit('player_disconnected', {
          playerName: player.name,
          color: player.color,
        });

        // If room is empty, clean it up after a delay
        if (gameRoom.players.length === 0) {
          setTimeout(() => {
            lobbyManager.removeLobby(id);
            gameRooms.delete(id);
          }, 30000); // 30 second cleanup delay
        }
        break;
      }
    }
  });
});

function broadcastGameState(lobbyId: string, gameRoom: GameRoom): void {
  for (const player of gameRoom.players) {
    const state = getFilteredState(gameRoom, player.color, player.id);
    io.to(player.id).emit('game_state', state);
  }
}

function getFilteredState(gameRoom: GameRoom, playerColor: Color, socketId: string): any {
  const fullState = gameRoom.game.state;
  const player = gameRoom.getPlayer(socketId);

  // Build a state that's safe to send to this specific player
  const state = {
    phase: fullState.phase,
    board: fullState.board,
    currentTurn: fullState.currentTurn,
    turnNumber: fullState.turnNumber,
    movesSinceLastDraft: fullState.movesSinceLastDraft,
    nextDraftAt: fullState.nextDraftAt,
    activeRules: fullState.activeRules,
    moveHistory: fullState.moveHistory,
    eventLog: fullState.eventLog,
    whitePlayer: fullState.whitePlayer,
    blackPlayer: fullState.blackPlayer,
    winner: fullState.winner,
    draw: fullState.draw,
    endCause: fullState.endCause,
    player1Name: fullState.player1Name,
    player2Name: fullState.player2Name,
    selectedSquare: fullState.selectedSquare,
    legalMoves: [],
    draftOptions: fullState.draftOptions,
    draftForColor: fullState.draftForColor,
    pendingChoice: null,
  };

  // Only send legal moves if the square is selected and it's this player's turn
  if (
    player &&
    fullState.selectedSquare &&
    fullState.currentTurn === player.color
  ) {
    state.legalMoves = gameRoom.game.getLegalMovesFor(fullState.selectedSquare);
  }

  // For draft: only the drafting player sees selectable options
  // Opponent sees the options with a "waiting" indicator
  if (fullState.phase === GamePhase.RuleDraft) {
    if (player && fullState.draftForColor !== player.color) {
      // Opponent: mark all options as locked
      state.draftOptions = fullState.draftOptions.map(r => ({
        ...r,
        locked: true,
      }));
    }
  }

  // For pending choice: only the choosing player sees it
  if (fullState.pendingChoice) {
    if (player && fullState.pendingChoice.playerColor === player.color) {
      state.pendingChoice = fullState.pendingChoice;
    }
  }

  return state;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Chaos Chess Server] Running on port ${PORT}`);

  // Cleanup stale lobbies every 10 minutes
  setInterval(() => {
    lobbyManager.cleanup();
  }, 10 * 60 * 1000);
});