---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/**/*.spec.ts"
  - "src/**/*.spec.tsx"
  - "e2e/**"
  - "vitest.config.*"
  - "playwright.config.*"
---

# Testing Rules — OP SpellTable

## Framework

- **Unit / Integration** : Vitest + React Testing Library
- **E2E** : Playwright
- **Fichiers test** : co-localisés avec le code (`Component.test.tsx` à côté de `Component.tsx`)

## Conventions de nommage

- `*.test.ts` / `*.test.tsx` pour les tests unitaires et d'intégration
- `e2e/*.spec.ts` pour les tests E2E
- `describe` = nom du module/composant
- `it` / `test` = phrase en anglais décrivant le comportement attendu

## Tests unitaires (Vitest)

### Composants React

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Component } from './Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByText('...')).toBeInTheDocument()
  })
})
```

### Règles

- Tester le **comportement**, pas l'implémentation
- Utiliser `screen.getByRole`, `getByText`, `getByLabelText` — pas `getByTestId` sauf dernier recours
- Mock les dépendances externes (WebRTC, TensorFlow.js, Prisma) avec `vi.mock()`
- Pas de snapshots sauf pour les composants UI stables

### Hooks custom

- Utiliser `renderHook` de `@testing-library/react`
- Tester les states, les side effects, les callbacks

### Logique métier (lib/)

- Tests purs sans DOM
- Couvrir les cas nominaux, limites, et d'erreur
- Game state : tester toutes les transitions de phases

## Tests d'intégration

- Tester les interactions entre composants
- Tester les API Routes avec des requêtes HTTP réelles (via `fetch`)
- Tester les queries Prisma avec une base de test SQLite

## Tests E2E (Playwright)

- Parcours critiques uniquement :
  - Navigation landing → lobby → game
  - Card browser search + filter
  - WebRTC connection flow (avec mock si nécessaire)
- Tester sur mobile viewport (375x667) ET desktop (1280x720)
- Pas de tests E2E pour les composants unitaires

## Coverage

- Objectif : 80% sur `src/lib/` (logique métier)
- Pas d'objectif strict sur les composants UI (tester le comportement, pas le rendu)
- 100% sur les fonctions critiques (game state transitions, card matching)

## Ce qu'on NE teste PAS

- Styles CSS / Tailwind classes
- Composants shadcn/ui (déjà testés par la lib)
- Configuration (next.config, tailwind.config)
- Types TypeScript (vérifiés par le compilateur)
