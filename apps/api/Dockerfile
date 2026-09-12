# syntax=docker/dockerfile:1
# Build with the repository root as context: docker build -f apps/api/Dockerfile .
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.9.0
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/locale/package.json packages/locale/package.json
RUN pnpm install --frozen-lockfile

# Explicit, one-shot target for VPS-002. The API entrypoint never runs migrations.
# The DATABASE_URL is supplied only when this target is executed, not at build time.
FROM deps AS migrate
COPY prisma.config.ts ./prisma.config.ts
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/prisma/migrations apps/api/prisma/migrations
ENV NODE_ENV=production
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM deps AS builder
COPY . .
# Prisma 7 reads DATABASE_URL while loading prisma.config.ts; this URL is never used
# to connect to a database and no production credentials enter the build.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate \
    && pnpm api:build \
    && pnpm --filter api deploy --legacy --prod /deploy/api

# Explicit staging-only one-shot seed: same generated client, no production
# entrypoint change. Never include demo data in the runtime API image.
FROM builder AS staging-seed
USER node
CMD ["./node_modules/.bin/prisma", "db", "seed"]

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /deploy/api/ ./
# pnpm deploy respects .gitignore (which excludes dist), so copy the Nest output explicitly.
COPY --from=builder --chown=node:node /workspace/apps/api/dist/ ./dist/
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
