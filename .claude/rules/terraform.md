---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Règles TypeScript / Next.js

## TypeScript

- **YOU MUST** activer `strict: true` dans tsconfig.json
- **YOU MUST** typer explicitement les props, state, et retours de fonctions
- **YOU MUST NOT** utiliser `any` — utilise `unknown` + type guards
- **YOU MUST NOT** utiliser `@ts-ignore` ou `@ts-expect-error` sans justification
- **YOU MUST** utiliser des imports absolus via `@/` prefix

## Next.js App Router

- Server Components par défaut (pas de `"use client"` sauf nécessité)
- `"use client"` requis pour : event handlers, hooks (useState, useEffect), WebRTC, refs
- Utiliser `metadata` export pour le SEO dans chaque page
- `loading.tsx` pour les loading states
- `error.tsx` pour les error boundaries
- `layout.tsx` pour le markup partagé entre pages

## Structure des fichiers

```
src/app/                    # Pages et API routes
src/components/             # Composants React
  ├── ui/                   # Composants génériques (shadcn/ui)
  ├── game/                 # Composants spécifiques au jeu
  └── video/                # Composants webcam/vidéo
src/lib/                    # Logique métier, utilitaires
src/types/                  # Types TypeScript partagés
src/data/                   # Données statiques (cartes JSON)
```

## Conventions de nommage

```
Composants :    PascalCase.tsx (GameBoard.tsx)
Hooks :         use*.ts (useWebRTC.ts)
Utils :         camelCase.ts (formatCardId.ts)
Types :         PascalCase (CardType, GameState)
API routes :    route.ts dans le dossier correspondant
```

## Performance

- `React.memo()` pour les composants qui re-render souvent
- `useMemo()` et `useCallback()` pour les calculs et callbacks coûteux
- Lazy loading avec `next/dynamic` pour les composants lourds (WebRTC, TensorFlow.js)
- Images optimisées avec `next/image`
