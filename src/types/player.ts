export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface PlayerConnection {
  playerId: string;
  peerId: string; // WebRTC peer ID
  isConnected: boolean;
  stream: MediaStream | null;
}
