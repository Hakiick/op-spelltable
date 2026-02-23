---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "prisma/**"
  - "package.json"
  - "tsconfig.json"
  - "next.config.*"
---

# Stability Rules — OP SpellTable

## Checks obligatoires

Tous ces checks DOIVENT passer avant tout push ou merge :

```bash
bash scripts/stability-check.sh
```

Ce script exécute dans l'ordre :

1. `npm run build` — Build Next.js production
2. `npx tsc --noEmit` — Type-check complet
3. `npm run lint` — ESLint
4. `npm test` — Vitest (tous les tests unitaires)

## Règles strictes

- **YOU MUST** lancer `bash scripts/stability-check.sh` AVANT tout push
- **YOU MUST** re-lancer le stability check APRÈS chaque rebase
- **YOU MUST NOT** merger dans main si le stability check échoue
- **YOU MUST NOT** désactiver un check pour le faire passer
- **YOU MUST NOT** ajouter `// @ts-ignore` ou `// eslint-disable` sans justification

## Workflow par agent

| Agent       | Check après son travail                     |
| ----------- | ------------------------------------------- |
| backend     | `npx tsc --noEmit && npm test`              |
| frontend    | `npm run build && npm run lint`             |
| ml-engineer | `npx tsc --noEmit && npm test`              |
| stabilizer  | `bash scripts/stability-check.sh` (complet) |

## Résolution des erreurs

| Type d'erreur    | Responsable  | Action                              |
| ---------------- | ------------ | ----------------------------------- |
| Type errors      | Dev concerné | Corriger les types                  |
| Build errors     | Dev concerné | Corriger le code                    |
| Lint errors      | Stabilizer   | Corriger directement (auto-fixable) |
| Test failures    | Dev concerné | Corriger le test ou le code         |
| Lint non-fixable | Dev concerné | Corriger manuellement               |
