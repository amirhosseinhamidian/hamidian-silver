# @hamidian/contracts

Shared API contracts for the Hamidian Silver frontend applications.

The NestJS API is the source of truth. Run `pnpm contracts:openapi` from the
repository root to rebuild `openapi.json`. The snapshot is generated from the
same Swagger configuration used by the running API.

Do not add handwritten copies of backend DTOs here. Generated TypeScript
exports will be added in the next F1 contract-generation step.
