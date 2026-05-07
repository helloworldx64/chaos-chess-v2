import { io, Socket } from 'socket.io-client';

export type GameEventCallback = (data: any) => void;

export class NetworkManager {
  private socket: Socket | null = null;
  public lobbyId: string | null = null;
  public playerColor: 'white' | 'black' | null = null;
  public code: string | null = null;
  public connected: boolean = false;

  // Event callbacks
  public onGameState: GameEventCallback | null = null;
  public onPlayerJoined: GameEventCallback | null = null;
  public onGameStarted: GameEventCallback | null = null;
  public onGameOver: GameEventCallback | null = null;
  public onPlayerDisconnected: GameEventCallback | null = null;
  public onError: GameEventCallback | null = null;
  public onSquareSelected: GameEventCallback | null = null;

  constructor(private serverUrl: string = 'http://localhost:3001') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('[Network] Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('[Network] Connection error:', err);
        reject(err);
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('[Network] Disconnected');
      });

      // Game state updates
      this.socket.on('game_state', (data: any) => {
        this.onGameState?.(data);
      });

      this.socket.on('player_joined', (data: any) => {
        this.onPlayerJoined?.(data);
      });

      this.socket.on('game_started', (data: any) => {
        this.onGameStarted?.(data);
      });

      this.socket.on('game_over', (data: any) => {
        this.onGameOver?.(data);
      });

      this.socket.on('player_disconnected', (data: any) => {
        this.onPlayerDisconnected?.(data);
      });

      this.socket.on('square_selected', (data: any) => {
        this.onSquareSelected?.(data);
      });
    });
  }

  createLobby(playerName: string): Promise<{ lobbyId: string; code: string; playerColor: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }
      this.socket.emit('create_lobby', { playerName }, (response: any) => {
        if (response.success) {
          this.lobbyId = response.lobbyId;
          this.code = response.code;
          this.playerColor = response.playerColor as 'white' | 'black';
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to create lobby'));
        }
      });
    });
  }

  joinLobby(code: string, playerName: string): Promise<{ lobbyId: string; code: string; playerColor: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }
      this.socket.emit('join_lobby', { code: code.toUpperCase(), playerName }, (response: any) => {
        if (response.success) {
          this.lobbyId = response.lobbyId;
          this.code = response.code;
          this.playerColor = response.playerColor as 'white' | 'black';
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to join lobby'));
        }
      });
    });
  }

  startGame(): void {
    if (!this.socket || !this.lobbyId) return;
    this.socket.emit('start_game', { lobbyId: this.lobbyId });
  }

  selectSquare(row: number, col: number): void {
    if (!this.socket || !this.lobbyId) return;
    this.socket.emit('select_square', { lobbyId: this.lobbyId, row, col });
  }

  executeMove(move: any): void {
    if (!this.socket || !this.lobbyId) return;
    this.socket.emit('execute_move', { lobbyId: this.lobbyId, move });
  }

  selectDraftRule(rule: any): void {
    if (!this.socket || !this.lobbyId) return;
    this.socket.emit('select_draft_rule', { lobbyId: this.lobbyId, rule });
  }

  resolveChoice(selected: any[]): void {
    if (!this.socket || !this.lobbyId) return;
    this.socket.emit('resolve_choice', { lobbyId: this.lobbyId, selected });
  }

  requestGameState(): void {
    if (!this.socket || !this.lobbyId) return;
    this.socket.emit('get_game_state', { lobbyId: this.lobbyId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.lobbyId = null;
    this.playerColor = null;
    this.code = null;
  }
}