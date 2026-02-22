---
paths:
  - "prisma/**"
  - "src/lib/database/**"
  - "scripts/seed-*.ts"
---

# Règles Prisma / Base de données

## Schema Prisma

- **YOU MUST** inclure `createdAt` et `updatedAt` sur chaque modèle
- **YOU MUST** utiliser `@id @default(cuid())` pour les primary keys
- **YOU MUST** définir les relations explicitement avec `@relation`
- **YOU MUST** utiliser des enums Prisma pour les valeurs fixes (CardType, GameStatus, Color)
- **YOU MUST NOT** stocker de secrets dans la base de données en clair

## Migrations

- `npx prisma migrate dev --name descriptif-du-changement`
- Noms de migration en kebab-case descriptif
- Jamais de `prisma db push` en production — migrations uniquement
- Migrations idempotentes et réversibles quand possible

## Queries

- Utiliser `select` pour limiter les champs retournés
- Utiliser `include` avec parcimonie (éviter les N+1)
- Transactions pour les opérations multi-tables
- Pagination avec `skip` / `take` pour les listes

## Connection

```
# Développement (SQLite)
DATABASE_URL="file:./dev.db"

# Production (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

- Connection string via `DATABASE_URL` dans `.env.local` (gitignored)
- `.env.example` committé avec le template (sans valeurs sensibles)
- Pool de connexions configuré pour la prod

## Seed

- Script `scripts/seed-cards.ts` pour populer la base de cartes One Piece
- Données source en JSON dans `src/data/cards/`
- Seed idempotent (upsert, pas insert)
