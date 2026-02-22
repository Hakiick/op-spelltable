---
name: next-feature
description: Prends la prochaine US et exécute le workflow complet (branch → assign team → implement → stabilize → merge main → done → clean context). Utilise ce skill pour dépiler les features une par une.
user-invocable: true
model: opus
---

Tu dépiles la prochaine feature. Suis le workflow séquentiel.

**IMPORTANT : Tu tournes sur Opus 4.6.** Quand tu lances des subagents via Task(), utilise `model: "sonnet"` pour **tous** les agents.

## État actuel
!`gh issue list --label "in-progress" --json number,title --jq '.[] | "[#\(.number)] \(.title) — EN COURS"' 2>/dev/null || echo "Aucune US en cours"`
!`bash scripts/check-us-eligibility.sh --list 2>/dev/null || echo "Script check-us-eligibility.sh non trouvé"`
!`git branch --show-current 2>/dev/null`

## Équipe agentique
@.claude/skills/architect/SKILL.md
@.claude/skills/developer/SKILL.md
@.claude/skills/tester/SKILL.md
@.claude/skills/reviewer/SKILL.md
@.claude/skills/stabilizer/SKILL.md

## Workflow pour la prochaine feature

### 1. Sélectionner la prochaine US (sélection intelligente)

**Reprendre une US en cours :**
- S'il y a une issue `in-progress`, reprends-la d'abord

**Sinon, choisir la prochaine US éligible :**

**YOU MUST** lancer le script de vérification AVANT de prendre une US :

```bash
bash scripts/check-us-eligibility.sh --list
```

Prends la **première US recommandée** par le script.

```bash
bash scripts/check-us-eligibility.sh <numero-issue>
```

**YOU MUST NOT** démarrer une US si ce script retourne un code d'erreur (exit 1).

### 2. Créer la branche feature

```bash
git checkout main
git pull --rebase origin main
git checkout -b type/scope/description-courte
git push -u origin type/scope/description-courte
```

### 3. Démarrer la feature
```bash
gh issue edit <numero> --add-label "in-progress" --remove-label "task"
```

### 4. Identifier l'équipe
- Lis le body de l'issue pour trouver l'équipe assignée
- Exécute chaque agent dans l'ordre défini

### 5. Exécuter le pipeline d'agents

**Si architect assigné :**
- Analyse la US, propose un plan d'implémentation (model: sonnet)

**developer / mobile-dev / pwa-dev (toujours) :**
- Implémente selon le plan (model: sonnet)
- Commits atomiques
- **Rebase régulier** sur main

**Si tester / responsive-tester assigné :**
- Écris et lance les tests (model: sonnet)
- Corrige si des tests échouent

**Si reviewer assigné :**
- Revue de code (model: sonnet)
- Corrections si nécessaire

**stabilizer (toujours) :**
- Build + Tests + Lint + Type check (model: sonnet)
- Corrige jusqu'à ce que tout passe

### 6. Rebase final + Merge main

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

### 7. Terminer la feature
```bash
gh issue edit <numero> --add-label "done" --remove-label "in-progress"
gh issue close <numero>
```

### 8. Résumé de la feature
```
## US-XX — [Titre] ✓
- Branche : type/scope/description
- Merge : branche mergée dans main
- Fichiers modifiés : [liste]
- Tests ajoutés : [liste]
- Stability : STABLE ✓
- Points d'attention : [notes]
```

### 9. Nettoyer le contexte

```bash
git checkout main
git pull --rebase origin main
```

Utilise `/compact` avec ce résumé pour nettoyer le contexte avant la prochaine feature.
