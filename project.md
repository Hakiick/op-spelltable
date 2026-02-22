# OP SpellTable — One Piece TCG Remote Play

## Project overview

Application web permettant de jouer au **One Piece Trading Card Game** (TCG) à distance via webcam, inspirée de [SpellTable](https://spelltable.wizards.com/) (l'outil officiel de Wizards of the Coast pour jouer à Magic: The Gathering en remote).

**Concept** : Deux joueurs se connectent, filment leur table de jeu avec une webcam, et l'application reconnaît les cartes jouées via du machine learning pour afficher leurs détails en temps réel.

**Objectif MVP** : Permettre à 2 joueurs de jouer une partie complète de One Piece TCG en remote avec flux webcam, interface de jeu interactive, et reconnaissance basique des cartes.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 14+ (App Router) avec TypeScript |
| Visio/Webcam | WebRTC (via PeerJS ou LiveKit) — peer-to-peer |
| Reconnaissance de cartes | TensorFlow.js (côté client) ou API Python séparée (OpenCV/PyTorch) |
| Base de données | SQLite + Prisma (dev) / PostgreSQL (prod) |
| Temps réel | WebSockets (Socket.io) |
| Styling | Tailwind CSS + shadcn/ui |
| Hébergement cible | Vercel (front) + Railway/Fly.io (services backend) |

---

## Règles du One Piece TCG

### Zones de jeu (par joueur)

| Zone | Description |
|------|-------------|
| Leader | 1 carte Leader face visible (personnage principal) |
| Character Area | Jusqu'à 5 cartes personnage |
| Stage Area | 1 carte stage maximum |
| DON!! Deck | Pile de 10 cartes DON!! (ressources) |
| Cost Area (DON!! Area) | Cartes DON!! actives/utilisées |
| Life Area | Cartes vie face cachée (nombre initial = vie du Leader) |
| Trash | Défausse |
| Main Deck | Pile de 50 cartes |

### Déroulement d'un tour

1. **Refresh Phase** — Redresser les cartes
2. **Draw Phase** — Piocher 1 carte
3. **DON!! Phase** — Ajouter 2 DON!! du DON!! Deck à la Cost Area
4. **Main Phase** — Jouer des cartes, attaquer, utiliser des effets
5. **End Phase**

### Types de cartes

- **Leader** — 1 par deck, définit la couleur et les life points
- **Character** — Personnages posés sur le terrain
- **Event** — Sorts/actions, usage unique
- **Stage** — Lieux, effets passifs
- **DON!!** — Ressources, toujours 10 par deck

### Couleurs

Rouge, Vert, Bleu, Violet, Noir, Jaune (et multi-couleurs)

### Identification des cartes

Les cartes sont identifiées par un code set : `OP01-001`, `ST01-012`, `EB01-025`, etc.

---

## Architecture cible

```
op-spelltable/
├── .claude/                         # Config Claude Code
│   ├── skills/
│   ├── rules/
│   └── settings.json
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── page.tsx                 # Landing page
│   │   ├── lobby/                   # Lobby / matchmaking
│   │   ├── game/[id]/               # Session de jeu
│   │   ├── cards/                   # Browser de cartes
│   │   └── api/                     # API Routes
│   │       ├── game/                # CRUD sessions
│   │       ├── cards/               # API cartes One Piece
│   │       └── signaling/           # WebRTC signaling
│   ├── components/
│   │   ├── ui/                      # Composants UI génériques (shadcn/ui)
│   │   ├── game/                    # Composants spécifiques au jeu
│   │   │   ├── GameBoard.tsx        # Plateau de jeu complet
│   │   │   ├── PlayerArea.tsx       # Zone d'un joueur
│   │   │   ├── CardZone.tsx         # Zone de cartes (Leader, Stage, etc.)
│   │   │   ├── DonCounter.tsx       # Compteur de DON!!
│   │   │   ├── LifeTracker.tsx      # Suivi des Life Cards
│   │   │   └── CardDetail.tsx       # Détail d'une carte (overlay)
│   │   └── video/
│   │       ├── WebcamFeed.tsx       # Flux webcam local
│   │       ├── PeerVideo.tsx        # Flux adversaire
│   │       └── CameraSetup.tsx      # Configuration caméra
│   ├── lib/
│   │   ├── webrtc/                  # Logique WebRTC / PeerJS
│   │   ├── card-recognition/        # ML / reconnaissance de cartes
│   │   ├── database/                # Prisma client & queries
│   │   └── game-state/              # Gestion état de la partie
│   ├── data/
│   │   └── cards/                   # Données des cartes One Piece (JSON)
│   └── types/
│       ├── card.ts                  # Types pour les cartes OP
│       ├── game.ts                  # Types pour l'état du jeu
│       └── player.ts               # Types pour les joueurs
├── prisma/
│   └── schema.prisma               # Schéma base de données
├── public/
│   └── cards/                       # Images des cartes (ou CDN)
└── scripts/
    └── seed-cards.ts                # Script pour populer la DB de cartes
```

---

## User Stories

### Phase 1 — Fondations

- [US-00] Setup initial | Créer le projet Next.js 14 + TypeScript + Tailwind + Prisma + shadcn/ui. Structure de dossiers, ESLint, Prettier, scripts de dev | haute
  - Team: architect, frontend, stabilizer

- [US-01] Base de données des cartes | Modèle Prisma pour les cartes One Piece, script de seed JSON, données des sets principaux (OP01-OP09, ST01-ST18) | haute | après:US-00
  - Team: architect, backend, stabilizer

- [US-02] Card Browser | Page de consultation des cartes avec recherche, filtres (couleur, type, set, coût), détails, images | haute | après:US-01
  - Team: frontend, backend, reviewer, stabilizer

### Phase 2 — Visio WebRTC

- [US-03] WebRTC peer-to-peer | Connexion P2P entre 2 joueurs, flux webcam bidirectionnel, signaling server WebSocket | haute | après:US-00
  - Team: architect, backend, frontend, stabilizer

- [US-04] Interface webcam | Composants WebcamFeed, PeerVideo, CameraSetup. Affichage des 2 flux côte à côte. Configuration caméra (résolution, miroir) | haute | après:US-03
  - Team: frontend, reviewer, stabilizer

### Phase 3 — Interface de jeu

- [US-05] GameBoard layout | Plateau de jeu avec toutes les zones One Piece (Leader, Characters, Stage, DON!!, Life, Trash, Deck). Layout responsive mobile-first | haute | après:US-04
  - Team: architect, frontend, reviewer, stabilizer

- [US-06] Compteurs interactifs | Compteur DON!! interactif, Life tracker (face cachée/révélée), indicateur de phase de tour | haute | après:US-05
  - Team: frontend, stabilizer

- [US-07] Overlay carte détail | Affichage en overlay du détail d'une carte (image HD, stats, effets) au survol ou tap. Intégration avec le card browser | moyenne | après:US-02,US-05
  - Team: frontend, stabilizer

### Phase 4 — Reconnaissance de cartes (ML)

- [US-08] Pipeline ML de reconnaissance | Capture frame webcam → preprocessing → identification carte → résultat. Feature matching (ORB/SIFT) ou CNN. Base d'images de référence | haute | après:US-04
  - Team: architect, ml-engineer, stabilizer

- [US-09] Intégration ML temps réel | Connexion du pipeline ML au flux webcam live. Reconnaissance continue, overlay des cartes détectées, optimisation FPS | haute | après:US-08,US-05
  - Team: ml-engineer, frontend, reviewer, stabilizer

### Phase 5 — Matchmaking & Social

- [US-10] Auth & profils | Authentification (NextAuth.js), profils joueurs, avatars, stats de base | moyenne | après:US-00
  - Team: backend, frontend, stabilizer

- [US-11] Lobby & matchmaking | Page lobby, création/rejoindre une partie, matchmaking basique, liste des parties en cours | moyenne | après:US-10,US-03
  - Team: architect, backend, frontend, stabilizer

- [US-12] Historique des parties | Enregistrement des résultats, historique par joueur, replay basique | basse | après:US-11
  - Team: backend, frontend, stabilizer
