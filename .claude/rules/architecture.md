---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "prisma/**"
---

# Architecture Rules — OP SpellTable

## Next.js App Router

- Server Components par défaut — `"use client"` uniquement quand nécessaire
- Composants qui nécessitent `"use client"` :
  - WebRTC / MediaStream (getUserMedia, RTCPeerConnection)
  - TensorFlow.js (modèle ML côté client)
  - Interactivité (onClick, useState, useEffect)
  - Webcam feed / vidéo
- API Routes dans `src/app/api/` — RESTful, typage strict des Request/Response
- Layouts partagés dans `layout.tsx` — header, navigation, metadata

## Structure des modules

```
src/
├── app/              # Pages et API Routes (Next.js App Router)
├── components/
│   ├── ui/           # shadcn/ui — composants génériques
│   ├── game/         # Composants du jeu (GameBoard, CardZone, etc.)
│   └── video/        # Composants webcam/vidéo (WebcamFeed, PeerVideo)
├── lib/
│   ├── webrtc/       # Logique WebRTC P2P + signaling
│   ├── card-recognition/  # Pipeline ML TensorFlow.js
│   ├── database/     # Prisma client, queries typées
│   └── game-state/   # Logique métier du One Piece TCG
├── hooks/            # Hooks custom (useWebRTC, useGameState, useCamera)
├── types/            # Types partagés (Card, Game, Player)
├── data/             # Données statiques (cartes JSON)
└── config/           # Configuration (constants, env validation)
```

## Séparation des responsabilités

| Layer | Contenu | Pas de |
|-------|---------|--------|
| `components/` | UI React, rendering, event handlers | Logique métier, fetch API direct |
| `hooks/` | State management, effets, connexion aux services | Rendering, JSX |
| `lib/` | Logique métier pure, services, utilitaires | React, JSX, hooks |
| `types/` | Types TypeScript, interfaces, enums | Logique, imports de lib |
| `app/api/` | Validation input, appels DB, réponses HTTP | Logique métier complexe |

## WebRTC Architecture

- **P2P direct** entre joueurs — pas de media server
- **Signaling server** minimal — échange SDP + ICE uniquement
- **Data channels** pour synchroniser l'état de jeu (phase, DON!!, life)
- **MediaStreams** gérés par des hooks custom, cleanup dans useEffect return

## ML Pipeline Architecture

- **Client-side** (TensorFlow.js) — pas de roundtrip serveur pour la latence
- **Pipeline** : capture frame → resize/normalize → inference → résultat
- **Web Worker** pour ne pas bloquer le main thread
- **Lazy loading** du modèle — `next/dynamic` avec loading fallback

## Database Architecture

- **Prisma** comme ORM — schema-first, migrations versionnées
- **SQLite** en développement, **PostgreSQL** en production
- **Singleton pattern** pour le client Prisma (éviter les connexions multiples en dev)

## State Management

- **Server state** : React Server Components pour les données statiques (cartes, profils)
- **Client state** : `useState`/`useReducer` pour l'état local (UI, formulaires)
- **Real-time state** : WebSocket/DataChannel pour l'état partagé (jeu en cours)
- Pas de store global (Redux/Zustand) sauf si vraiment nécessaire
