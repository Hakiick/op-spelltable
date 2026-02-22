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

- **Vitest** pour les tests unitaires et d'intégration
- **React Testing Library** pour les tests de composants
- **Playwright** pour les tests E2E (Phase 2+)
- **MSW** (Mock Service Worker) pour mocker les API

## Conventions de nommage

```
src/components/game/GameBoard.tsx       → src/components/game/GameBoard.test.tsx
src/lib/game-state/turnPhase.ts         → src/lib/game-state/turnPhase.test.ts
src/hooks/useWebRTC.ts                  → src/hooks/useWebRTC.test.ts
e2e/                                    → Tests E2E Playwright
```

- Fichier de test à côté du fichier source (co-location)
- Extension `.test.ts` ou `.test.tsx`

## Structure d'un test

```typescript
describe('GameBoard', () => {
  it('should render all player zones', () => {
    // Arrange
    // Act
    // Assert
  });

  it('should display DON!! counter with initial value', () => {
    // ...
  });
});
```

- Pattern **Arrange-Act-Assert**
- Un `describe` par module/composant
- Noms de tests lisibles en anglais : `should + comportement attendu`

## Quoi tester

| Type | Cible | Exemples |
|------|-------|----------|
| Unitaire | Logique métier pure | Calcul DON!!, validation de cartes, game state |
| Composant | Rendu + interactions | GameBoard zones, CardDetail overlay, DonCounter |
| Hook | Hooks custom | useWebRTC states, useGameState transitions |
| API | API Routes | POST /api/game, GET /api/cards, signaling |
| E2E | Parcours complets | Créer partie → jouer un tour → fin de partie |

## Quoi NE PAS tester

- Les détails d'implémentation internes
- Les librairies tierces (Prisma, PeerJS, TensorFlow.js)
- Les composants shadcn/ui (testés par leur auteur)
- Les CSS/styles visuels (sauf les classes conditionnelles)

## Mocks

- **WebRTC** : mocker `navigator.mediaDevices.getUserMedia`, `RTCPeerConnection`
- **Prisma** : mocker le client Prisma (pas de DB réelle dans les tests unitaires)
- **TensorFlow.js** : mocker le modèle et les prédictions
- **Next.js** : mocker `useRouter`, `useSearchParams`

## Couverture

- Viser 80% sur la logique métier (`src/lib/`)
- Viser 70% sur les hooks (`src/hooks/`)
- Pas d'objectif de couverture sur les pages et layouts
- Pas de `istanbul ignore` sans justification

## Commandes

```bash
npm test                    # Vitest (tous les tests)
npm test -- --run           # Mode CI (pas de watch)
npm test -- --coverage      # Avec couverture
npm run test:e2e            # Playwright (E2E)
```
