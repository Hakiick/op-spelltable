export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export type RoomStatus = "waiting" | "ready" | "playing" | "closed";

export interface RoomRecord {
  id: string;
  roomCode: string;
  hostPeerId: string | null;
  guestPeerId: string | null;
  status: RoomStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebRTCState {
  status: ConnectionStatus;
  peerId: string | null;
  remotePeerId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
}

export interface WebRTCActions {
  connect: (remotePeerId: string) => void;
  disconnect: () => void;
  call: (stream: MediaStream) => void;
  answer: (stream: MediaStream) => void;
}
