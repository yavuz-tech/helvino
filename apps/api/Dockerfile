# ═══════════════════════════════════════════════════════════
# Helvino API — Production Dockerfile (Railway)
# Multi-stage build for minimal image size
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Base ──────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
# argon2 and prisma require native build tools
RUN apk add --no-cache python3 make g++ openssl

# ── Stage 2: Dependencies ─────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for dependency resolution
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ── Stage 3: Builder ──────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy everything from deps
COPY --from=deps /app/ ./

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Build shared package first (API depends on it)
RUN pnpm --filter @helvino/shared build

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN pnpm --filter @helvino/api build

# ── Stage 4: Production dependencies ─────────────────────
FROM base AS prod-deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# ── Stage 5: Runner ───────────────────────────────────────
FROM node:20-alpine AS runner
# openssl is required by Prisma at runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Copy production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy built shared package
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Copy built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy Prisma schema + generated client + migrations
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

# Set working directory to API
WORKDIR /app/apps/api

ENV NODE_ENV=production

# Railway injects PORT env var
EXPOSE ${PORT:-4000}

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
