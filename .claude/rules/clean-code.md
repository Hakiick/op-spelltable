---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Clean Code Rules — OP SpellTable

## Fonctions

- Une fonction = une responsabilité
- Max ~30 lignes par fonction (hors JSX template)
- Nommage explicite : `getActiveCards()` pas `getData()`
- Extraire la logique complexe dans `src/lib/` — les composants orchestrent, ils ne calculent pas

## Composants React

- Un composant = un fichier
- Props typées avec `interface` nommée (`interface GameBoardProps`)
- Pas de logique métier dans le JSX — extraire dans des hooks ou fonctions
- Composition over inheritance — assembler des composants petits et réutilisables
- Pas de props drilling profond (> 3 niveaux) — utiliser Context ou hooks

## Types

- Définir les types partagés dans `src/types/`
- Types locaux au fichier si utilisés uniquement là
- Préférer `interface` pour les objets extensibles, `type` pour les unions et intersections
- Pas de `any` — utiliser `unknown` + type guards
- Pas de type assertions (`as`) sauf pour les tests ou les libs mal typées

## Error handling

- Valider aux frontières (input utilisateur, API externe, WebRTC events)
- Utiliser des types union pour les résultats (`Result<T, Error>` pattern)
- `try/catch` uniquement pour les opérations async qui peuvent échouer (fetch, DB, WebRTC)
- Pas de `try/catch` autour de code synchrone prévisible

## Imports

- Pas d'imports circulaires
- Pas de re-exports inutiles (barrel files) sauf pour les composants UI publics
- Imports absolus `@/` toujours

## Naming

| Élément           | Convention        | Exemple                           |
| ----------------- | ----------------- | --------------------------------- |
| Composant         | PascalCase        | `GameBoard`, `CardZone`           |
| Hook              | camelCase + `use` | `useGameState`, `useWebRTC`       |
| Fonction          | camelCase         | `formatCardId`, `calculateDamage` |
| Constante         | SCREAMING_SNAKE   | `MAX_DON_COUNT`, `TURN_PHASES`    |
| Type/Interface    | PascalCase        | `CardType`, `GameState`           |
| Fichier composant | PascalCase        | `GameBoard.tsx`                   |
| Fichier util      | camelCase         | `formatCardId.ts`                 |
| API route         | kebab-case        | `api/game-sessions/route.ts`      |

## Interdits

- `console.log` en production (utiliser un logger si nécessaire)
- Code commenté — supprimer ou créer une issue
- Variables inutilisées
- Imports inutilisés
- `eslint-disable` sans justification
- Secrets en dur dans le code
