---
name: init-project
description: Initialise un nouveau projet. Analyse la stack, génère des agents spécialisés, crée les règles clean code/archi, cherche des skills sur SkillsMP/GitHub, crée les issues GitHub. Lance ce skill au démarrage de chaque projet.
user-invocable: true
model: opus
---

Tu initialises le projet. Le setup est **entièrement automatique** — tu analyses le projet et tu configures tout.

**IMPORTANT : Tu tournes sur Opus 4.6.** Les agents que tu génères doivent spécifier `model: sonnet` dans leur SKILL.md. **Tous les agents tournent sur Sonnet 4.6.**

## Contexte du projet
!`cat project.md 2>/dev/null || echo "ERREUR: project.md manquant. Crée-le d'abord."`

---

## Phase 1 — Valider project.md

- Vérifie que toutes les sections obligatoires sont remplies (pas de placeholders)
- Sections obligatoires : Nom, Description, Stack technique, Structure, User Stories
- Si des sections sont incomplètes → demande à l'utilisateur de les remplir
- Vérifie le format des US : `- [US-XX] Titre | Description | Priorité | Dépendances (optionnel)`

---

## Phase 1.5 — Brainstorm : enrichir les US et structurer le projet

**C'est la phase clé.** Tu ne te contentes pas de recopier les US — tu **réfléchis au projet** et tu l'améliores.

### 1.5.1 Analyser la cohérence du projet

- Les US couvrent-elles tous les aspects de la description du projet ?
- Manque-t-il des US évidentes ?
- Y a-t-il des US trop grosses qui devraient être découpées ?
- Y a-t-il des US trop vagues qui méritent d'être précisées ?
- **Mobile-first** : y a-t-il une US dédiée à l'audit responsive et accessibilité ?
- **PWA** : si le projet est une PWA, y a-t-il des US pour le service worker et le manifest ?

**Si des US manquent ou sont mal découpées** → propose des ajouts/modifications à l'utilisateur.

### 1.5.2 Enrichir chaque US

Pour chaque US, génère :

**Critères d'acceptance** — conditions vérifiables pour considérer l'US comme terminée :
```markdown
### Critères d'acceptance
- [ ] Le composant est responsive (mobile, tablette, desktop)
- [ ] Les touch targets font minimum 44x44px
- [ ] Lighthouse mobile > 90
- [ ] Pas de layout shift (CLS < 0.1)
```

**Sous-tâches techniques** — décomposition en tâches concrètes

**Fichiers impactés** — estimation des fichiers à créer/modifier

### 1.5.3 Détecter les dépendances automatiquement

Analyse TOUTES les US entre elles pour détecter les dépendances **même si l'utilisateur ne les a pas spécifiées** :

**Règles de détection automatique :**

| Signal | Type de dépendance |
|--------|--------------------|
| US-B mentionne un modèle/table créé dans US-A | `après:US-A` |
| US-B utilise un endpoint/service de US-A | `après:US-A` |
| US-B a besoin de l'auth et US-A = auth | `après:US-A` |
| US-A et US-B modifient les mêmes fichiers | `partage:US-A` |
| US-B ajoute une fonctionnalité à ce que US-A construit | `enrichit:US-A` |

### 1.5.4 Proposer un US-00 "Setup initial" si nécessaire

Si le projet n'a pas encore de structure de base, propose une US-00.

### 1.5.5 Valider avec l'utilisateur

Présente le brainstorm complet et demande validation.
**YOU MUST** obtenir la validation de l'utilisateur avant de continuer.

---

## Phase 2 — Analyser le projet

### 2.1 Détecter la stack

Lis `project.md` section "Stack technique" et identifie tous les éléments de la stack.

### 2.2 Déterminer le type de projet

| Pattern détecté | Type de projet |
|-----------------|----------------|
| Next.js + App Router | Full-stack SSR |
| Express/Fastify + DB | API Backend |
| React/Vue seul | SPA Frontend |
| Astro/Gatsby | SSG |
| React Native / Flutter | Mobile natif |
| PWA flags dans project.md | Progressive Web App |

### 2.3 Identifier les domaines fonctionnels

Analyse les US pour détecter les domaines.

---

## Phase 3 — Générer les règles clean code & architecture

**Crée des fichiers de règles spécifiques au projet dans `.claude/rules/`.**

### 3.1 Architecture (`.claude/rules/architecture.md`)

Génère des règles d'architecture **spécifiques à la stack détectée**. Sois opinionated, pas générique.
**Inclure les patterns mobile-first** : responsive layout, viewport management, touch handling.

### 3.2 Clean Code (`.claude/rules/clean-code.md`)

Génère des règles clean code **adaptées au langage et framework**.

### 3.3 Testing (`.claude/rules/testing.md`)

Génère des conventions de test **adaptées au framework de test**.
**Inclure les tests responsive** : viewport testing, touch event testing.

### 3.4 Mettre à jour le stabilizer

Mets à jour `.claude/rules/stability.md` avec les commandes spécifiques au projet.

---

## Phase 4 — Chercher des skills communautaires

```bash
bash scripts/search-skills.sh --stack
```

Évalue et propose les résultats à l'utilisateur.

---

## Phase 5 — Générer les agents spécialisés

### 5.1 Déterminer les rôles nécessaires

Analyse la stack et les US pour créer les bons agents.

**Agents mobile-first pré-configurés** (déjà présents dans le template) :
- `mobile-dev` — Développeur mobile-first (responsive, touch, viewport)
- `responsive-tester` — Testeur responsive (breakpoints, viewports, accessibility)
- `pwa-dev` — Spécialiste PWA (service worker, manifest, offline)

**Agents supplémentaires à générer selon la stack** :

| Stack / Besoin | Agent à générer | Modèle recommandé |
|----------------|-----------------|-------------------|
| Framework frontend (Next.js, React...) | `frontend-dev` | sonnet |
| Framework backend (Express, Fastify...) | `api-dev` | sonnet |
| Base de données + ORM | `db-architect` | sonnet |
| Tests E2E (Playwright, Cypress) | `e2e-tester` | sonnet |
| UI complexe | `ui-dev` | sonnet |
| DevOps/CI | `devops` | sonnet |

**Règle** : ne génère PAS d'agents inutiles.

### 5.2 Créer les SKILL.md pour chaque agent

Chaque agent DOIT inclure le champ `model:` dans son frontmatter YAML.

### 5.3 Mettre à jour team.md

Réécris `.claude/team.md` avec les agents réels du projet.

---

## Phase 6 — Auto-assigner les agents aux US

Pour chaque US, assigne les agents pertinents.

---

## Phase 7 — Analyser les dépendances entre US

Détecte les dépendances et vérifie qu'il n'y a pas de cycles.

---

## Phase 8 — Créer les labels et issues GitHub

### Labels
```bash
gh label create "task" --description "US créée, pas encore commencée" --color "0075ca" --force
gh label create "in-progress" --description "US en cours de développement" --color "e4e669" --force
gh label create "done" --description "US terminée et stabilisée" --color "0e8a16" --force
gh label create "bug" --description "Bug détecté" --color "d73a4a" --force
gh label create "blocked" --description "US bloquée par une dépendance" --color "b60205" --force
gh label create "haute" --description "Priorité haute" --color "d93f0b" --force
gh label create "moyenne" --description "Priorité moyenne" --color "fbca04" --force
gh label create "basse" --description "Priorité basse" --color "c5def5" --force
```

### Issues

Pour chaque US, crée une issue avec description, dépendances, équipe agentique, et priorité.

---

## Phase 9 — Résumé

Affiche un rapport complet avec :
- Stack détectée
- Règles générées
- Agents spécialisés créés (avec modèle)
- Skills communautaires
- US créées
- Graphe de dépendances
- Ordre d'exécution recommandé

```
═══════════════════════════════════════════════
  Prochaine étape : /forge
═══════════════════════════════════════════════
```
