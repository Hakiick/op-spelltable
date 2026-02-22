---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "prisma/**"
---

# Architecture Rules — OP SpellTable

## Next.js App Router

- **Server Components par défaut** — ne jamais ajouter `"use client"` sauf pour :
  - Composants avec state/effects (useState, useEffect)
  - Composants WebRTC (accès navigator.mediaDevices)
  - Composants avec event handlers (onClick, onChange)
  - Composants TensorFlow.js (ML côté client)
- **Route Handlers** (API Routes) dans `src/app/api/` — retourner `NextResponse.json()`
- **Layouts** pour le markup partagé (`layout.tsx`)
- **Loading UI** avec `loading.tsx`, **Error UI** avec `error.tsx`
- **Metadata** dans chaque page pour le SEO

## Structure des dossiers

```
src/
├── app/              # Pages & API routes (App Router)
├── components/
│   ├── ui/           # shadcn/ui (ne pas modifier directement)
│   ├── game/         # GameBoard, PlayerArea, CardZone, DonCounter...
│   └── video/        # WebcamFeed, PeerVideo, CameraSetup
├── lib/
│   ├── webrtc/       # PeerJS/WebRTC logic
│   ├── card-recognition/  # TensorFlow.js pipeline
│   ├── database/     # Prisma client & queries
│   └── game-state/   # Game state management
├── data/             # Static data (card JSON, etc.)
├── types/            # TypeScript type definitions
└── hooks/            # Custom React hooks
```

## Séparation des responsabilités

| Couche | Responsabilité | Emplacement |
|--------|---------------|-------------|
| UI | Rendu, interactions utilisateur | `src/components/` |
| Hooks | Logique réactive, side effects | `src/hooks/` |
| Lib | Logique métier pure, services | `src/lib/` |
| Types | Définitions de types partagés | `src/types/` |
| API | Endpoints HTTP, validation | `src/app/api/` |
| DB | Requêtes Prisma, seeds | `prisma/`, `src/lib/database/` |

## Patterns obligatoires

### Data fetching
- **Server Components** : fetch directement dans le composant (pas de useEffect)
- **Client Components** : utiliser des hooks custom (`useSWR` ou `useQuery`)
- **Mutations** : Server Actions ou API Routes

### State management
- **Local state** : `useState` pour l'état local au composant
- **Shared state** : React Context pour l'état partagé dans un arbre
- **Game state** : Custom hook `useGameState` centralisé
- **WebRTC state** : Custom hook `useWebRTC` encapsulant PeerJS

### WebRTC Architecture
- **Signaling** : WebSocket (Socket.io) ou API Routes pour l'échange SDP/ICE
- **Media** : PeerJS pour simplifier la gestion P2P
- **Flux** : Peer-to-peer direct, pas de media server

### ML Pipeline Architecture
- **Côté client** : TensorFlow.js pour la latence minimale
- **Pipeline** : Capture frame → Resize/Normalize → Inference → Match → Display
- **Référence** : Base d'images de cartes en local ou CDN

## Mobile-first

- Base styles = mobile (320px+)
- `sm:` = tablette portrait (640px+)
- `md:` = tablette paysage (768px+)
- `lg:` = desktop (1024px+)
- `xl:` = grand écran (1280px+)
- Touch targets minimum 44x44px
- Pas de hover-only interactions (toujours un fallback tactile)

## Imports

- Toujours utiliser les imports absolus via `@/`
- Ordre : React → Next.js → libs externes → `@/lib` → `@/components` → `@/types` → relatifs
