---
paths:
  - "src/lib/webrtc/**"
  - "src/components/video/**"
---

# Règles WebRTC / Temps réel

## WebRTC (PeerJS / LiveKit)

- **YOU MUST** gérer proprement le lifecycle des connexions (connect/disconnect/cleanup)
- **YOU MUST** gérer les erreurs de connexion gracieusement (reconnexion automatique)
- **YOU MUST** libérer les MediaStreams quand ils ne sont plus utilisés (`track.stop()`)
- **YOU MUST** demander les permissions caméra/micro avec un UI clair
- **YOU MUST NOT** exposer le signaling server sans authentification en prod
- Utiliser des hooks custom (`useWebRTC`, `usePeerConnection`) pour encapsuler la logique
- Tester sur mobile (getUserMedia constraints différentes)

## MediaStream

```typescript
// Bonnes pratiques pour la capture webcam
const constraints: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "environment", // caméra arrière pour filmer la table
  },
  audio: true,
};
```

- Préférer la caméra arrière (`environment`) pour filmer la table de jeu
- Proposer un switch front/back
- Gérer les cas où la caméra n'est pas disponible

## Socket.io / WebSockets

- Rooms pour les sessions de jeu (1 room = 1 partie)
- Events typés avec TypeScript
- Reconnexion automatique configurée
- Heartbeat/ping pour détecter les déconnexions
- Pas de logique métier dans les handlers WS — déléguer aux services

## Signaling Server

- Le signaling échange uniquement SDP offers/answers et ICE candidates
- Pas de données de jeu via le signaling — utiliser WebRTC data channels ou WS séparés
- CORS configuré correctement en prod

## Sécurité temps réel

- Valider tous les messages entrants (Zod)
- Rate limiting sur les WebSocket events
- Authentification avant la connexion WS
- Pas de données sensibles dans les data channels WebRTC
