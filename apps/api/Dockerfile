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
COPY packages/shared/package.json packages/shared/package.json

# Install ALL dependencies (dev included — needed for tsc build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Build shared package (API depends on it)
RUN pnpm --filter @helvino/shared build

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API (tsc → dist/)
RUN pnpm --filter @helvino/api build

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

# Copy Prisma schema + migrations (for migrate deploy)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Copy API-level node_modules (contains generated .prisma client)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api
ENV NODE_ENV=production

# Railway injects PORT automatically
EXPOSE ${PORT:-4000}

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
