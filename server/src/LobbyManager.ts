import { v4 as uuidv4 } from 'uuid';

export interface Lobby {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  createdAt: number;
}

export class LobbyManager {
  private lobbies: Map<string, Lobby> = new Map();
  private codeToId: Map<string, string> = new Map();

  getLobbyCount(): number {
    return this.lobbies.size;
  }

  generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  createLobby(hostId: string, hostName: string): Lobby {
    let code: string;
    do {
      code = this.generateCode();
    } while (this.codeToId.has(code));

    const lobby: Lobby = {
      id: uuidv4(),
      code,
      hostId,
      hostName,
      guestId: null,
      guestName: null,
      createdAt: Date.now(),
    };

    this.lobbies.set(lobby.id, lobby);
    this.codeToId.set(code, lobby.id);
    return lobby;
  }

  joinLobby(code: string, guestId: string, guestName: string): Lobby | null {
    const id = this.codeToId.get(code.toUpperCase());
    if (!id) return null;
    const lobby = this.lobbies.get(id)!;
    if (lobby.guestId) return null; // Already full
    lobby.guestId = guestId;
    lobby.guestName = guestName;
    return lobby;
  }

  getLobbyByCode(code: string): Lobby | null {
    const id = this.codeToId.get(code.toUpperCase());
    if (!id) return null;
    return this.lobbies.get(id) || null;
  }

  getLobby(id: string): Lobby | null {
    return this.lobbies.get(id) || null;
  }

  removeLobby(id: string): void {
    const lobby = this.lobbies.get(id);
    if (lobby) {
      this.codeToId.delete(lobby.code);
      this.lobbies.delete(id);
    }
  }

  cleanup(): void {
    const timeout = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    for (const [id, lobby] of this.lobbies) {
      if (now - lobby.createdAt > timeout) {
        this.removeLobby(id);
      }
    }
  }
}