---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "prisma/**"
  - ".github/workflows/*.yml"
---

# Règles de stabilité

- IMPORTANT : Après toute modification de code, lance /stabilizer ou vérifie manuellement build + test + lint + types
- Ne désactive jamais un check existant pour "faire passer" une feature
- Ne supprime jamais une règle de validation sans justification documentée
- Chaque feature doit être stable AVANT de passer à la suivante
- `npm run build` doit passer après chaque modification
- `npx tsc --noEmit` doit passer (type-check)
- `npm run lint` doit passer (ESLint)
- `npm test` doit passer (tous les tests)
- Les workflows GitHub Actions doivent être syntaxiquement valides
