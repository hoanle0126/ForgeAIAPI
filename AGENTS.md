# ForgeAI Backend — NestJS Agent Guidance

This file guides AI agents working inside `backend/`.

## Role in the product

The backend supports ForgeAI, a mobile-first fitness app for beginners. It should provide APIs and server-side capabilities for user profiles, workout plans, nutrition plans, saved items, AI orchestration, and future commercial features.

Read the root `PRODUCT_CONTEXT.md` before making product or API decisions.

## Tech stack

- Framework: NestJS.
- Language: TypeScript.
- Package manager: npm.
- Database direction: PostgreSQL.

PostgreSQL is the intended SQL database for the backend. Do not add ORM, migration tooling, authentication, payment, queue, or AI provider dependencies without user approval.

## Suggested module direction

Prefer clear NestJS modules as the backend grows:

- `auth`: authentication and sessions when the auth strategy is chosen.
- `users`: user profile, goals, settings, and preferences.
- `workouts`: exercises, workout plans, substitutions, and workout history.
- `nutrition`: meals, meal plans, dietary preferences, and saved meals.
- `plans`: generated weekly plans that combine training and nutrition.
- `ai`: AI prompt orchestration, model calls, safety constraints, and generated recommendations.

Keep module boundaries product-oriented and avoid placing unrelated logic in `AppModule`.

## API design principles

- Design APIs around mobile workflows, not database tables.
- Keep beginner safety in mind for workouts and nutrition.
- Validate external input at API boundaries.
- Avoid medical claims, unsafe diet advice, or dangerous workout recommendations.
- Keep generated AI output auditable and tied to user context when possible.

## Commands

Run commands from `backend/` or use npm prefix from the repository root.

```bash
npm run start:dev
npm run build
npm test
npm run lint
```

Before reporting backend work as done, run the relevant test or build command.
