# Règles de style de code (OP SpellTable)

## TypeScript / React

- TypeScript strict mode (`strict: true`)
- Pas de `any` — utiliser `unknown` + type guards
- Composants fonctionnels uniquement (pas de classes)
- Props typées avec `interface` ou `type` (pas inline)
- Imports absolus via `@/` (ex: `@/components/game/GameBoard`)
- Nommage PascalCase pour les composants, camelCase pour les fonctions/variables
- Hooks custom avec prefix `use` (ex: `useWebRTC`, `useGameState`)

## Next.js (App Router)

- Server Components par défaut
- `"use client"` uniquement quand nécessaire (interactions, WebRTC, state)
- Layouts pour le markup partagé
- Loading states avec `loading.tsx`
- Error boundaries avec `error.tsx`
- Metadata dans chaque page

## Tailwind CSS

- Mobile-first : styles de base = mobile, enrichir avec `md:`, `lg:`, `xl:`
- Pas de CSS custom sauf cas exceptionnel — utiliser les utility classes
- Composants shadcn/ui pour les éléments UI standard
- Touch targets >= 44x44px (`min-h-11 min-w-11`)

## Prisma

- Schema propre avec types explicites
- Relations bien définies avec `@relation`
- Migrations nommées clairement
- Timestamps `createdAt` et `updatedAt` sur chaque modèle

## Général

- Pas de secrets en dur dans le code
- Pas de code commenté — supprimer ou créer une issue
- Nommage explicite, pas d'abréviations cryptiques
- Fichiers organisés logiquement par scope/feature
- Un fichier = une responsabilité principale
