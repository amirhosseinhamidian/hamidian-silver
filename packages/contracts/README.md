# @hamidian/contracts

Shared API contracts for the Hamidian Silver frontend applications.

The NestJS API is the source of truth. Run `pnpm contracts:generate` from the
repository root to rebuild both `openapi.json` and the generated TypeScript
schema at `src/schema.ts`.

`openapi.json` and `src/schema.ts` are generated artifacts and should be
committed so contract changes are reviewable. Do not edit `src/schema.ts`
directly and do not add handwritten copies of backend DTOs to this package.

Frontend applications should import contract types from `@hamidian/contracts`
instead of defining duplicate API response or request types.
