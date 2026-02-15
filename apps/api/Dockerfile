# ═══════════════════════════════════════════════════════════
# Helvino API — Production Dockerfile (Railway)
# 2-stage build: builder + runner
# Build context: monorepo root (/)
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate
# argon2 requires native build tools; openssl for Prisma
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Copy workspace config + package.json files for install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/widget/package.json apps/widget/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install ALL dependencies (dev included — needed for tsc build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
COPY apps/widget/ apps/widget/

# Build shared package (API depends on it)
RUN pnpm --filter @helvino/shared build

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API (tsc → dist/)
RUN pnpm --filter @helvino/api build

# Build widget embed.js so API can serve it.
# VITE_API_URL must point to the production API origin — the widget makes
# fetch/WebSocket calls to this URL from customer websites.
ENV VITE_API_URL=https://api.helvion.io
RUN pnpm --filter @helvino/widget build

# ── Stage 2: Runner ───────────────────────────────────────
FROM node:20-alpine AS runner

# openssl required by Prisma at runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Copy root node_modules (pnpm resolves symlinks during COPY)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy shared package (built)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Copy API build output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy Prisma schema + migrations + seed (for migrate deploy + seed)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Copy source (needed by prisma/seed.ts which imports from ../src/utils/)
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json

# Copy API-level node_modules (contains generated .prisma client)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy widget build output (embed.js)
COPY --from=builder /app/apps/widget/dist ./apps/widget/dist

WORKDIR /app/apps/api
ENV NODE_ENV=production

# Railway injects PORT automatically
EXPOSE ${PORT:-4000}

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/index.js"]
