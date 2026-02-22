# OP SpellTable — Configuration Claude Code

Tu es un orchestrateur de projet. Workflow strict et séquentiel.

Contexte du projet : @project.md

## Projet

**OP SpellTable** — Application web pour jouer au One Piece TCG à distance via webcam avec reconnaissance de cartes par ML. Inspiré de SpellTable (Magic: The Gathering).

**Stack** : Next.js 14+ (App Router), TypeScript, Tailwind CSS, WebRTC (PeerJS/LiveKit), TensorFlow.js, Prisma + SQLite/PostgreSQL, Socket.io, shadcn/ui

---

## Règles IMPORTANTES

- **YOU MUST** stabiliser (build + tests + lint + type-check) avant de passer à la feature suivante
- **YOU MUST** travailler sur une seule feature à la fois
- **YOU MUST** nettoyer le contexte (`/compact`) entre chaque feature
- **YOU MUST** utiliser l'équipe agentique assignée à chaque US
- **YOU MUST** faire des commits au format `type(scope): description` (ex: `feat(game): add GameBoard component`)
- **YOU MUST** nommer les branches au format `type/scope/description-courte` (ex: `feat/game/gameboard-layout`)
- **YOU MUST** utiliser `rebase` — JAMAIS `merge` pour intégrer les changements de `main`
- **YOU MUST** créer la branche sur GitHub dès le début (`git push -u origin <branch>`)
- **YOU MUST** lancer `bash scripts/stability-check.sh` AVANT tout push
- **YOU MUST** re-lancer le stability check APRÈS chaque rebase
- **YOU MUST** vérifier l'éligibilité d'une US avant de la démarrer (`bash scripts/check-us-eligibility.sh <numero>`)
- **YOU MUST NOT** démarrer une US dont les dépendances ne sont pas satisfaites
- **YOU MUST NOT** merger dans main si le stability check échoue
- **YOU MUST NOT** utiliser `git push --force` — utilise `--force-with-lease` uniquement

---

## Skills disponibles

### Skills core (toujours présents)

| Skill | Usage |
|-------|-------|
| `/init-project` | **Setup automatique** : analyse le projet, brainstorm les US, génère agents + règles + issues |
| `/forge` | **Team Lead** : décompose une US, délègue aux agents spécialisés, feedback loops, livre stable |
| `/next-feature` | Pipeline linéaire simple (alternative à /forge pour les features simples) |
| `/reviewer` | Revue de code qualité + sécurité |
| `/stabilizer` | Vérifie build + tests + lint + type-check |

### Skills spécialisés OP SpellTable

| Skill | Usage |
|-------|-------|
| `/architect` | Architecte système — design global, interfaces entre modules (WebRTC / UI / ML / DB), ADR |
| `/frontend` | Spécialiste frontend — composants React/Next.js, responsive mobile-first, Tailwind, WebRTC UI |
| `/backend` | Spécialiste backend — API Routes Next.js, WebRTC signaling, Prisma, WebSockets, game state |
| `/ml-engineer` | Spécialiste ML — reconnaissance de cartes, TensorFlow.js, pipeline computer vision |

### Skills fallback (génériques)

| Skill | Usage |
|-------|-------|
| `/developer` | Implémenteur générique |
| `/tester` | Écrit et lance les tests |
| `/devops` | CI/CD, Docker, deployment |

---

## Commandes

```bash
# === Développement ===
npm run dev                           # Lancer le serveur de dev Next.js
npm run build                         # Build production
npm run start                         # Lancer le build de prod
npm run lint                          # ESLint
npx tsc --noEmit                      # Type-check sans build
npx prettier --check .                # Vérifier le formatage
npm test                              # Lancer les tests (Vitest)
npm run test:e2e                      # Tests E2E (Playwright)

# === Base de données ===
npx prisma generate                   # Générer le client Prisma
npx prisma db push                    # Appliquer le schema à la DB
npx prisma migrate dev                # Créer une migration
npx prisma studio                     # UI pour explorer la DB
npx tsx scripts/seed-cards.ts         # Seed la base de cartes

# === Stabilité & Workflow ===
bash scripts/stability-check.sh       # Check complet (build + test + lint + types)
bash scripts/pre-merge-check.sh       # Vérification pré-merge
bash scripts/check-us-eligibility.sh --list     # US éligibles
bash scripts/check-us-eligibility.sh <numero>   # Vérifier une US spécifique

# === Multi-Agent tmux (Forge) ===
bash scripts/forge-panes.sh --init             # Lancer l'orchestrateur
bash scripts/forge-add-agents.sh <a1> <a2>     # Ajouter des agents
bash scripts/forge-add-agents.sh --cleanup     # Retirer TOUS les agents
bash scripts/agent-status.sh                   # Dashboard des agents
bash scripts/dispatch.sh <agent> "prompt"      # Envoyer une tâche
bash scripts/collect.sh <agent> --wait         # Lire le résultat

# === GitHub ===
gh issue list                         # Voir les issues
```

---

## Workflow

1. `/init-project` — Analyse le projet, identifie les besoins, génère agents + issues
2. `/forge` — Pour chaque US : analyse, décompose, délègue, feedback loops, stabilize, merge, done
3. Répète 2 jusqu'à ce que toutes les US soient done

---

## Forge — Protocole d'orchestration multi-agents

Le `/forge` est le Team Lead. Il orchestre une équipe d'agents via le système tmux + `.forge/`.

### Architecture `.forge/`

```
.forge/
├── tasks/          # Tâches par agent
│   └── <agent>.md
├── status/         # Statut (idle | working | done | error | offline)
│   └── <agent>
└── results/        # Résultats
    └── <agent>.md
```

### Phase 0 — Sélection de l'US

```bash
bash scripts/check-us-eligibility.sh <numero>
gh issue view <numero> --json number,title,body,labels --jq '.'
```

**YOU MUST NOT** continuer si exit 1.

### Phase 1 — Analyse et décomposition

1. **Comprendre le scope** — critères d'acceptance, dépendances
2. **Analyser le projet existant** — stack, composants, DB, routes
3. **Choisir l'équipe** — agents listés dans l'issue
4. **Créer les agents tmux** :

```bash
bash scripts/forge-add-agents.sh <agent1> <agent2> ...
bash scripts/forge-add-agents.sh --list
```

5. **Décomposer en sous-tâches** (TodoWrite)

**Ordre d'exécution :**
- `architect` → en premier (planification)
- `backend` → API, DB, signaling
- `frontend` → composants UI, intégration WebRTC
- `ml-engineer` → pipeline de reconnaissance
- `reviewer` → revue
- `stabilizer` → toujours en dernier

### Phase 2 — Setup Git

```bash
git checkout main && git pull --rebase origin main
git checkout -b type/scope/description-courte
git push -u origin type/scope/description-courte
gh issue edit <numero> --add-label "in-progress" --remove-label "task"
```

### Phase 3 — Exécution du pipeline

Tous les agents Task() utilisent `model: "sonnet"`.

#### Évaluation par le Team Lead

| Après agent | Check | Si échec |
|------------|-------|----------|
| `backend` | `npx tsc --noEmit && npm test` | → Renvoyer avec erreurs |
| `frontend` | `npm run build && npm run lint` | → Renvoyer avec build log |
| `ml-engineer` | Tests pipeline ML | → Renvoyer |
| `reviewer` | Critiques vs suggestions | → Critiques = renvoyer au dev |
| `stabilizer` | `bash scripts/stability-check.sh` | → Simple = corrige ; Complexe = renvoyer |

#### Feedback loops

| Boucle | Max itérations |
|--------|---------------|
| dev ↔ tester | 3 |
| dev ↔ reviewer | 2 |
| stabilizer retry | 5 |

### Phase 4 — Rebase final + Merge

```bash
git fetch origin main && git rebase origin/main
bash scripts/stability-check.sh
git checkout main && git merge type/scope/description-courte
git push origin main
git branch -d type/scope/description-courte
git push origin --delete type/scope/description-courte
```

### Phase 5 — Clôture

```bash
gh issue edit <numero> --add-label "done" --remove-label "in-progress"
gh issue close <numero>
bash scripts/forge-add-agents.sh --cleanup
git checkout main && git pull --rebase origin main
```

### Gestion des erreurs

| Situation | Décision |
|-----------|----------|
| Build échoue | → Renvoyer au dev concerné avec les erreurs |
| Tests échouent | → Dev corrige → Tester re-vérifie |
| Type errors | → Dev corrige les types |
| Lint errors | → Stabilizer corrige directement |
| Security critique | → Dev corrige → Reviewer re-check |
| Rebase avec conflits | → Résoudre → Stabilizer re-check tout |
| > 3 itérations dev/test | → Alerter l'utilisateur |
| > 5 itérations stabilizer | → Alerter l'utilisateur |
| Dépendance bloquée | → Marquer blocked, passer à une autre US |

### Modèles des agents

| Catégorie | Agents | Modèle |
|-----------|--------|--------|
| Orchestration | forge | **Opus 4.6** (obligatoire) |
| Planification | architect | **Sonnet 4.6** |
| Frontend | frontend | **Sonnet 4.6** |
| Backend | backend | **Sonnet 4.6** |
| Machine Learning | ml-engineer | **Sonnet 4.6** |
| Revue | reviewer | **Sonnet 4.6** |
| Validation | stabilizer | **Sonnet 4.6** |

**IMPORTANT : Tous les agents Task() DOIVENT utiliser `model: "sonnet"`. Le forge reste sur Opus 4.6.**

---

## Stratégie Git

```
main ─────────────────────────────────────────────
  │                                        ↑
  └── feat/scope/feature ──── rebase ──── merge ── delete branch
```

- **Rebase only** : `git fetch origin main && git rebase origin/main`
- **Push feature** : `git push --force-with-lease origin <branch>`
- **Merge** : `git checkout main && git merge <branch>`
- **Après merge** : vérifier que main est stable

---

## Architecture Principles

- **Mobile-first** — Design pour mobile d'abord, enrichir pour desktop
- **TypeScript strict** — `strict: true`, pas de `any`, types explicites
- **App Router** — Utiliser les conventions Next.js 14+ (Server Components par défaut)
- **Composants atomiques** — Petits composants réutilisables, composition over inheritance
- **Séparation of concerns** — UI / logique métier / data layer bien séparés
- **WebRTC P2P** — Connexion directe entre joueurs, signaling server minimal
- **ML pipeline** — Reconnaissance de cartes côté client (TensorFlow.js) pour la latence
- **Responsive** — Toutes les pages doivent fonctionner sur mobile, tablette et desktop
- **Accessibilité** — WCAG AA, touch targets >= 44x44px, contraste suffisant

## Naming Conventions

```
Composants :    PascalCase (GameBoard.tsx, CardZone.tsx)
Hooks :         camelCase avec prefix use (useWebRTC.ts, useGameState.ts)
Utils :         camelCase (formatCardId.ts, parseGameState.ts)
Types :         PascalCase avec suffix (CardType, GameState, PlayerInfo)
API Routes :    kebab-case (api/game-sessions, api/card-search)
CSS classes :   Tailwind utility classes, mobile-first (min-width)
```

## Code rules

- TypeScript strict mode (`strict: true` dans tsconfig.json)
- ESLint + Prettier configurés et respectés
- Pas de `any` — utiliser `unknown` + type guards si nécessaire
- Server Components par défaut, `"use client"` uniquement quand nécessaire
- Pas de secrets dans le code — variables d'environnement via `.env.local`
- Tests unitaires pour la logique métier, E2E pour les parcours critiques
- Imports absolus via `@/` (ex: `@/components/game/GameBoard`)
- Pas de code mort, pas de `console.log` en prod

## Stability

- `npm run build` doit passer après chaque modification
- `npx tsc --noEmit` doit passer (type-check)
- `npm run lint` doit passer (ESLint)
- `npm test` doit passer (tous les tests)
- Ne jamais désactiver un check pour le faire passer
- Chaque US doit être stable AVANT de passer à la suivante
