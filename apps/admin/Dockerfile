# syntax=docker/dockerfile:1
# Build with the repository root as context: docker build -f apps/admin/Dockerfile .
FROM node:24-bookworm-slim AS deps
RUN npm install --global pnpm@11.9.0
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/locale/package.json packages/locale/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ARG NEXT_PUBLIC_STOREFRONT_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
# The admin currently has no public/ directory; keep the runner COPY valid if it stays empty.
RUN mkdir -p apps/admin/public \
    && NEXT_PUBLIC_STOREFRONT_URL="$NEXT_PUBLIC_STOREFRONT_URL" pnpm --filter @hamidian/admin build

FROM node:24-bookworm-slim AS runtime
RUN mkdir -p /app/apps/admin/.next/cache && chown -R node:node /app
WORKDIR /app/apps/admin
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /workspace/apps/admin/.next/standalone/ /app/
COPY --from=builder --chown=node:node /workspace/apps/admin/.next/static/ ./.next/static/
COPY --from=builder --chown=node:node /workspace/apps/admin/public/ ./public/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
