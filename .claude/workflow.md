# Workflow de travail — OP SpellTable

## Vue d'ensemble

```
[Initialisation] → [Feature Loop] → [Finalisation]
                        ↓
              ┌───────────────────────────┐
              │  1. Pick next US          │
              │  2. Assign team           │
              │  3. Create branch         │
              │  4. Move → In Prog        │
              │  5. Implement             │
              │  6. Stabilize             │
              │  7. Rebase + Merge main   │
              │  8. Move → Done           │
              │  9. Clean context         │
              └───────────┬───────────────┘
                          ↓
                    [Next US or End]
```

## Modèles des agents

| Phase | Agent | Modèle |
|-------|-------|--------|
| Orchestration | forge | **Opus 4.6** |
| Planification | architect | **Sonnet 4.6** |
| Frontend | frontend | **Sonnet 4.6** |
| Backend | backend | **Sonnet 4.6** |
| Machine Learning | ml-engineer | **Sonnet 4.6** |
| Revue | reviewer | **Sonnet 4.6** |
| Stabilisation | stabilizer | **Sonnet 4.6** |

## Stratégie Git : Rebase Only

**Règle fondamentale** : on utilise TOUJOURS `rebase` — JAMAIS `merge` pour intégrer les changements de `main` dans une branche feature.

## Détail de chaque étape

### 1. Pick next US (sélection intelligente)

- S'il y a une US `in-progress`, reprends-la en priorité
- Sinon, sélectionne la prochaine US éligible :
  1. Liste les issues avec label `task`
  2. Pour chaque issue, lis la section **Dépendances** dans le body
  3. Vérifie que toutes les dépendances sont satisfaites
  4. Prends la première US éligible par priorité (haute → moyenne → basse)

### 2. Assign team

- Consulte `project.md` > Équipe agentique par feature
- Charge les agents depuis `team.md`
- L'ordre d'exécution des agents est important

### 3. Create branch

```bash
git checkout main
git pull --rebase origin main
git checkout -b type/scope/description-courte
git push -u origin type/scope/description-courte
```

### 4. Move → In Progress

```bash
gh issue edit <numero> --add-label "in-progress" --remove-label "task"
```

### 5. Implement

Chaque agent intervient dans l'ordre :

**architect (si assigné) → model: sonnet :**
- Analyse l'US, propose un plan d'architecture

**backend → model: sonnet :**
- Implémente les API routes, schemas Prisma, signaling
- Commits atomiques
- Rebase régulier sur main

**frontend → model: sonnet :**
- Crée les composants React/Next.js
- Design responsive mobile-first
- Intégration WebRTC UI

**ml-engineer (si assigné) → model: sonnet :**
- Pipeline de reconnaissance de cartes
- Intégration avec le flux webcam

**reviewer (si assigné) → model: sonnet :**
- Revue du code produit
- Le dev corrige si nécessaire

### 6. Stabilize

**stabilizer (toujours en dernier) → model: sonnet :**

```bash
bash scripts/stability-check.sh
```

### 7. Rebase + Merge main

```bash
git fetch origin main
git rebase origin/main
bash scripts/stability-check.sh
git checkout main
git merge type/scope/description-courte
git push origin main
git branch -d type/scope/description-courte
git push origin --delete type/scope/description-courte
```

### 8. Move → Done

```bash
gh issue edit <numero> --add-label "done" --remove-label "in-progress"
gh issue close <numero>
```

### 9. Clean context

```bash
git checkout main
git pull --rebase origin main
```

Utilise `/compact` pour nettoyer le contexte.

## Gestion des erreurs

- **Build échoue** → Le stabilizer corrige ou renvoie au dev concerné
- **Tests échouent** → Dev corrige → Tester re-vérifie
- **Type errors** → Dev corrige les types
- **Régression** → Stop tout, corrige d'abord
- **US bloquée** → Crée une issue `blocked`, passe à la suivante
- **Conflit de rebase** → `git rebase --abort`, demander à l'utilisateur
