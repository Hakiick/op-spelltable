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
