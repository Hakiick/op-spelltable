---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Clean Code Rules — OP SpellTable

## Fonctions

- Maximum 30 lignes par fonction (indicatif)
- Une fonction = une responsabilité
- Nommage explicite : `calculateDonCost()` pas `calc()`
- Pas de paramètres boolean isolés — utiliser un objet options
- Early return pour réduire l'imbrication

## Composants React

- Maximum ~150 lignes par composant (JSX inclus)
- Extraire la logique dans des hooks custom quand > 50 lignes de logique
- Props destructurées dans la signature
- Pas de logique métier dans le JSX — préparer les données avant le return

```typescript
// Bien
function GameBoard({ playerId, gameState }: GameBoardProps) {
  const activeZones = useActiveZones(gameState);
  const { donCount, addDon } = useDonCounter(playerId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* JSX propre, pas de calculs */}
    </div>
  );
}
```

## Imports

- Imports absolus via `@/` (configuré dans tsconfig.json)
- Ordre : packages externes → `@/lib` → `@/components` → `@/types` → relatifs
- Pas d'imports circulaires
- Pas d'imports wildcard (`import * as`)

## Types

- Types explicites pour les props, retours de fonctions, et state
- `interface` pour les types extensibles (props de composants)
- `type` pour les unions, intersections, mapped types
- Enums Prisma pour les valeurs DB ; `const` objects pour le reste
- Pas de `as` cast sauf après validation (type guard)

## Gestion d'erreurs

- `try/catch` uniquement autour des appels IO (fetch, DB, filesystem)
- Error boundaries React pour les composants qui peuvent crash
- Messages d'erreur explicites pour l'utilisateur
- Logger les erreurs techniques (pas les afficher à l'utilisateur)

## Interdit

- `any` — utiliser `unknown` + type guards
- `console.log` en production — utiliser un logger ou supprimer
- Code mort ou commenté — supprimer
- `// TODO` sans issue associée
- Magic numbers — extraire en constantes nommées
- Mutations directes d'objets/arrays dans le state React
