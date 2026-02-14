# ═══════════════════════════════════════════════════════════
# Helvino Web — Production Dockerfile (Railway)
# Next.js 15 standalone output for minimal image
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Base ──────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

# ── Stage 2: Dependencies ─────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for dependency resolution
COPY apps/web/package.json apps/web/package.json
COPY apps/widget/package.json apps/widget/package.json
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
COPY apps/web/ apps/web/
COPY apps/widget/ apps/widget/

# Build shared package first (web + widget depend on it)
RUN pnpm --filter @helvino/shared build

# Build widget embed.js and copy to web public dir
RUN pnpm --filter @helvino/widget build
RUN cp apps/widget/dist/embed.js apps/web/public/embed.js

# Build Next.js app with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @helvino/web build

# ── Stage 4: Runner ───────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/web/public ./public

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

# Railway injects PORT env var
EXPOSE ${PORT:-3000}

# Next.js standalone server reads PORT and HOSTNAME env vars
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
