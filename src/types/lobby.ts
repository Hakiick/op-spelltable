export interface LobbyRoom {
  id: string;
  roomCode: string;
  name: string | null;
  status: string;
  hostName: string | null;
  guestName: string | null;
  isPublic: boolean;
  createdAt: string;
}
