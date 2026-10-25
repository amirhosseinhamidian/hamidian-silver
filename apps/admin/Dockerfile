# Build with the repository root as context: docker build -f apps/admin/Dockerfile .
FROM public.ecr.aws/docker/library/node:24-bookworm-slim AS deps
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV npm_config_registry=$NPM_REGISTRY \
    PNPM_CONFIG_REGISTRY=$NPM_REGISTRY
RUN npm install --global pnpm@11.9.0 \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=300000
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

FROM public.ecr.aws/docker/library/node:24-bookworm-slim AS runtime
RUN mkdir -p /app/apps/admin/.next/cache && chown -R node:node /app
WORKDIR /app/apps/admin
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /workspace/apps/admin/.next/standalone/ /app/
COPY --from=builder --chown=node:node /workspace/apps/admin/.next/static/ ./.next/static/
COPY --from=builder --chown=node:node /workspace/apps/admin/public/ ./public/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
