# Règles de branches

- **YOU MUST** nommer les branches avec le format : `type/scope/description-courte`
  - `feat/game/gameboard-layout`
  - `feat/webrtc/peer-connection`
  - `feat/ml/card-recognition-pipeline`
  - `fix/video/webcam-mirror`
  - `refactor/ui/card-detail-overlay`
  - `test/game/don-counter-tests`
- Le **scope** dans le nom de branche doit correspondre au scope des commits
- Description en kebab-case (mots séparés par des tirets)
- Pas de majuscules, pas d'espaces, pas de caractères spéciaux

# Stratégie Git : Rebase Only

- **YOU MUST** utiliser `rebase` au lieu de `merge` — historique linéaire obligatoire
- **YOU MUST NOT** utiliser `git merge` pour intégrer des changements de `main` dans une branche feature
- **YOU MUST** rebase ta branche feature sur `main` avant de merger

## Workflow rebase pour chaque feature

```bash
# 1. Créer la branche depuis main à jour
git checkout main
git pull --rebase origin main
git checkout -b type/scope/description-courte

# 2. Pendant le développement — garder la branche à jour
git fetch origin main
git rebase origin/main

# 3. Avant de push — toujours rebase sur main
git fetch origin main
git rebase origin/main
git push --force-with-lease origin type/scope/description-courte
```

## Résolution de conflits pendant le rebase

```bash
# Si des conflits apparaissent :
# 1. Résoudre les conflits dans les fichiers marqués
# 2. Ajouter les fichiers résolus
git add <fichiers-résolus>
# 3. Continuer le rebase
git rebase --continue
# 4. Si la situation est irrécupérable, annuler
git rebase --abort
```

## Règles strictes

- **JAMAIS** de `git merge main` dans une branche feature
- **JAMAIS** de `git push --force` — utilise `--force-with-lease` uniquement
- **JAMAIS** de rebase sur `main` directement (rebase seulement les branches feature)
- Si le rebase cause des conflits complexes, **demander à l'utilisateur** avant de continuer

# Cycle de vie d'une branche

```
main ─────────────────────────────────────────────
  │                                        ↑
  └── feat/scope/feature ──── rebase ──── merge ── delete branch
```

1. **Créer** la branche depuis `main` à jour
2. **Développer** avec des commits atomiques
3. **Rebase** sur `main` avant le merge
4. **Push** la branche sur le remote (`git push -u origin <branch>`)
5. **Stability check** — `bash scripts/stability-check.sh` doit passer
6. **Merge** dans main : `git checkout main && git merge <branch>`
7. **Push** main : `git push origin main`
8. **Supprimer** la branche après merge (local + remote)

# Protection contre les merges cassés

- **YOU MUST** lancer `bash scripts/stability-check.sh` AVANT de merger
- **YOU MUST** vérifier que la branche est rebasée sur `main` (pas de conflits)
- **YOU MUST** re-lancer les tests après chaque rebase
- Si le stability check échoue, la branche ne doit PAS être mergée dans main
- Après le merge, vérifier que `main` est toujours stable
