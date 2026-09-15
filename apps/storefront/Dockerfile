# syntax=docker/dockerfile:1
# Build with the repository root as context: docker build -f apps/storefront/Dockerfile .
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
ARG MEDIA_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js embeds image remotePatterns and NEXT_PUBLIC_* values in its build output.
# Only public configuration belongs in build arguments; never pass secrets here.
RUN test -n "$MEDIA_PUBLIC_BASE_URL" \
    && MEDIA_PUBLIC_BASE_URL="$MEDIA_PUBLIC_BASE_URL" \
       NEXT_PUBLIC_GA_MEASUREMENT_ID="$NEXT_PUBLIC_GA_MEASUREMENT_ID" \
       pnpm --filter @hamidian/storefront build

FROM node:24-bookworm-slim AS runtime
RUN mkdir -p /app/apps/storefront/.next/cache && chown -R node:node /app
WORKDIR /app/apps/storefront
ARG MEDIA_PUBLIC_BASE_URL
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 MEDIA_PUBLIC_BASE_URL=$MEDIA_PUBLIC_BASE_URL
COPY --from=builder --chown=node:node /workspace/apps/storefront/.next/standalone/ /app/
COPY --from=builder --chown=node:node /workspace/apps/storefront/.next/static/ ./.next/static/
COPY --from=builder --chown=node:node /workspace/apps/storefront/public/ ./public/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
