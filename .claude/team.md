# Equipe Agentique — OP SpellTable

> Ce fichier documente les agents du projet OP SpellTable.

## Agents core (toujours présents)

### `forge`

**Rôle** : Team Lead — orchestre les agents, décompose les US, gère les feedback loops
**Modèle** : **Opus 4.6** (obligatoire)
**Toujours présent** : oui (c'est l'orchestrateur principal)

### `stabilizer`

**Rôle** : Quality gate — build, tests, lint, type-check
**Modèle** : **Sonnet 4.6**
**Toujours présent** : oui (toujours en dernier dans le pipeline)
**Responsabilités** :

- Lancer les checks de stabilité (`bash scripts/stability-check.sh`)
- Vérifier npm run build + tsc + lint + test
- Corriger les problèmes simples directement
- Renvoyer les problèmes complexes à l'agent concerné

### `reviewer`

**Rôle** : Revue de code qualité + sécurité + accessibilité
**Modèle** : **Sonnet 4.6**
**Quand l'utiliser** : US de priorité haute ou touchant la sécurité
**Responsabilités** :

- Vérifier le respect des règles du projet (`.claude/rules/`)
- Vérifier les bonnes pratiques React/Next.js/TypeScript
- Détecter les failles de sécurité (XSS, injection, CORS)
- Vérifier l'accessibilité (WCAG AA)
- Produire un rapport structuré : critiques + suggestions

---

## Agents spécialisés OP SpellTable

### `architect`

**Rôle** : Architecte système — design global, interfaces entre modules, ADR
**Modèle** : **Sonnet 4.6**
**Skill** : `/architect`
**Domaine** : Architecture système, interfaces WebRTC/UI/ML/DB, décisions techniques
**Responsabilités** :

- Designer l'architecture des features complexes
- Définir les interfaces entre modules (hooks, types, API contracts)
- Évaluer les trade-offs techniques (PeerJS vs LiveKit, ORB vs CNN)
- Documenter les décisions d'architecture (ADR)

### `frontend`

**Rôle** : Spécialiste frontend React/Next.js — composants, responsive, game UI
**Modèle** : **Sonnet 4.6**
**Skill** : `/frontend`
**Domaine** : Composants React, Next.js App Router, Tailwind CSS, WebRTC UI, game interface
**Responsabilités** :

- Créer les composants du jeu (GameBoard, PlayerArea, CardZone, DonCounter, LifeTracker)
- Créer les composants vidéo (WebcamFeed, PeerVideo, CameraSetup)
- Implémenter le design responsive mobile-first
- Intégrer les flux WebRTC dans l'UI
- Créer les pages (landing, lobby, game session, card browser)

### `backend`

**Rôle** : Spécialiste backend — API, signaling, DB, game state
**Modèle** : **Sonnet 4.6**
**Skill** : `/backend`
**Domaine** : API Routes Next.js, WebRTC signaling, Prisma ORM, WebSockets, game state
**Responsabilités** :

- Créer les API Routes (CRUD cartes, sessions, users)
- Implémenter le signaling server WebRTC (SDP exchange, ICE candidates)
- Designer et maintenir le schema Prisma
- Gérer l'état de la partie côté serveur
- Implémenter l'authentification (NextAuth.js)

### `ml-engineer`

**Rôle** : Spécialiste ML — reconnaissance de cartes One Piece
**Modèle** : **Sonnet 4.6**
**Skill** : `/ml-engineer`
**Domaine** : TensorFlow.js, OpenCV.js, feature matching, CNN, computer vision
**Responsabilités** :

- Créer le pipeline de reconnaissance de cartes
- Implémenter le preprocessing (crop, normalize, perspective correction)
- Implémenter l'identification (feature matching ORB ou CNN)
- Optimiser les performances (>= 5 FPS)
- Gérer la base d'images de référence

---

## Agents fallback (génériques)

### `developer`

**Modèle** : **Sonnet 4.6**
**Rôle** : Développeur générique

### `tester`

**Modèle** : **Sonnet 4.6**
**Rôle** : Tests unitaires, intégration, E2E

### `devops`

**Modèle** : **Sonnet 4.6**
**Rôle** : CI/CD, Docker, deployment

---

## Règles d'équipe

1. Le **stabilizer** intervient TOUJOURS en dernier
2. Les agents de planification (architect) interviennent TOUJOURS en premier
3. L'ordre d'exécution suit l'ordre défini dans le body de l'issue GitHub
4. Le **forge** évalue le résultat de chaque agent avant de passer au suivant

## Modèles par catégorie

| Catégorie        | Agents                            | Modèle         |
| ---------------- | --------------------------------- | -------------- |
| Orchestration    | forge, init-project, next-feature | **Opus 4.6**   |
| Planification    | architect                         | **Sonnet 4.6** |
| Frontend         | frontend                          | **Sonnet 4.6** |
| Backend          | backend                           | **Sonnet 4.6** |
| Machine Learning | ml-engineer                       | **Sonnet 4.6** |
| Revue            | reviewer                          | **Sonnet 4.6** |
| Validation       | stabilizer                        | **Sonnet 4.6** |
