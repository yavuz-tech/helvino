# Helvion — Railway Deploy Guide

## Servis Mimarisi

```
Railway Project: helvion
├── helvion-api        (Fastify + Prisma + Socket.IO)
│   ├── Dockerfile     apps/api/Dockerfile
│   ├── Health check   GET /health
│   └── Port           $PORT (Railway assigns)
├── helvion-web        (Next.js 15 standalone)
│   ├── Dockerfile     apps/web/Dockerfile
│   ├── Health check   GET /
│   └── Port           $PORT (Railway assigns)
├── PostgreSQL         (Railway plugin)
│   └── Auto-env       $PGDATABASE_URL
└── Redis              (Railway plugin)
    └── Auto-env       $REDIS_URL
```

Widget (`embed.js`) is built during the web service Docker build and served as a static file from `apps/web/public/embed.js`. No separate service needed.

## Servis Detayları

| Servis | Kaynak | Root Directory | Dockerfile | Port |
|--------|--------|----------------|------------|------|
| helvion-api | GitHub monorepo | `/` (root) | `apps/api/Dockerfile` | $PORT |
| helvion-web | GitHub monorepo | `/` (root) | `apps/web/Dockerfile` | $PORT |
| PostgreSQL | Railway plugin | — | — | 5432 |
| Redis | Railway plugin | — | — | 6379 |

> **Important:** Both Dockerfiles use the monorepo root as build context. In Railway, set `Root Directory` to `/` (or leave empty) and specify the Dockerfile path under Build settings.

## Railway Dashboard Setup (Step by Step)

### 1. Create Project
1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo** → choose `yavuz-tech/helvino`
3. This creates the first service

### 2. Add Database Plugins
1. Click **+ New** → **Database** → **PostgreSQL** → Add
2. Click **+ New** → **Database** → **Redis** → Add
3. Both will auto-create connection strings as reference variables

### 3. Configure API Service
1. Click on the first service → **Settings**:
   - **Service Name:** `helvion-api`
   - **Root Directory:** (leave empty — Dockerfile handles paths)
   - **Builder:** Dockerfile
   - **Dockerfile Path:** `apps/api/Dockerfile`
   - **Watch Paths:** `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml`
2. Go to **Variables** → **Raw Editor** → paste from `railway-env-template.txt` (API section)
3. For `DATABASE_URL`: click **Add Reference** → select PostgreSQL → `DATABASE_URL`
4. For `REDIS_URL`: click **Add Reference** → select Redis → `REDIS_URL`
5. Generate and fill all `[REQUIRED]` secrets

### 4. Configure Web Service
1. Click **+ New** → **GitHub Repo** → same repo
2. **Settings:**
   - **Service Name:** `helvion-web`
   - **Builder:** Dockerfile
   - **Dockerfile Path:** `apps/web/Dockerfile`
   - **Watch Paths:** `apps/web/**`, `apps/widget/**`, `packages/shared/**`, `pnpm-lock.yaml`
3. **Variables:**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://api.helvion.io
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<your-site-key>
   NEXT_PUBLIC_DEFAULT_ORG_KEY=<default-org>
   NEXT_PUBLIC_DEFAULT_WIDGET_SITE_ID=<site-id>
   NEXT_PUBLIC_DEFAULT_WIDGET_ORG_KEY=<org-key>
   ```

### 5. Custom Domains
1. API service → **Settings** → **Custom Domain** → `api.helvion.io`
2. Web service → **Settings** → **Custom Domain** → `app.helvion.io`
3. Railway will provide CNAME targets

### 6. DNS Records (Cloudflare/Namecheap)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | api | `<railway-api-cname>.up.railway.app` | DNS only |
| CNAME | app | `<railway-web-cname>.up.railway.app` | DNS only |

> **Note:** If using Cloudflare, you can proxy (orange cloud) but make sure to configure SSL mode to "Full (strict)".

## Environment Variables

All environment variables are documented in `railway-env-template.txt` at the project root. Key points:

- **DATABASE_URL** and **REDIS_URL** are auto-populated by Railway plugins — use reference variables (`${PGDATABASE_URL}`, `${REDIS_URL}`)
- Generate unique secrets for each `*_SECRET` variable:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `MFA_ENCRYPTION_KEY` requires a 32-byte hex key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## Build Process

### API Build (apps/api/Dockerfile)
1. Install pnpm + native build tools (python3, make, g++ for argon2)
2. `pnpm install --frozen-lockfile`
3. Build `@helvino/shared` package
4. `npx prisma generate` (Prisma client)
5. `tsc` (TypeScript compile)
6. Copy only production deps + dist + prisma to runner stage
7. On start: `prisma migrate deploy && node dist/index.js`

### Web Build (apps/web/Dockerfile)
1. Install pnpm
2. `pnpm install --frozen-lockfile`
3. Build `@helvino/shared` package
4. Build widget → `embed.js` → copy to `apps/web/public/`
5. `next build` (produces standalone output)
6. Copy standalone server + static to runner stage
7. On start: `node apps/web/server.js`

## Post-Deploy Checklist

- [ ] API returns 200: `curl https://api.helvion.io/health`
- [ ] Web loads: `curl -s https://app.helvion.io/ | head -1`
- [ ] DB connected: health check shows `"db":"ok"`
- [ ] Redis connected: health check shows `"redis":"ok"`
- [ ] Login works: try login at `https://app.helvion.io/portal/login`
- [ ] Widget loads: check `https://app.helvion.io/embed.js` returns JS
- [ ] Socket.IO connects: check browser console for WS connection
- [ ] Stripe webhook: send test event from Stripe dashboard
- [ ] Email: trigger a password reset to verify Resend is working

## Troubleshooting

### Container won't start
- Check logs in Railway dashboard → service → **Deployments** → click latest → **Logs**
- Common issues: missing env vars (check for `CRITICAL:` errors in logs)

### Database migration fails
- Railway PostgreSQL might not be ready yet on first deploy
- Redeploy the API service after PostgreSQL is green

### CORS errors in browser
- Ensure `APP_PUBLIC_URL` matches the frontend domain exactly (including `https://`)
- Check `ALLOWED_ORIGINS` includes all needed frontend origins

### argon2 build fails
- The API Dockerfile includes build tools (python3, make, g++) specifically for argon2
- If issues persist, try `FROM node:20-slim` instead of `node:20-alpine`

### Socket.IO not connecting
- Ensure the web service has `NEXT_PUBLIC_API_URL` pointing to the API domain
- Socket.IO CORS uses `APP_PUBLIC_URL` — must be set correctly

### "standalone" output missing
- Verify `next.config.ts` has `output: "standalone"`
- This was added as part of the Railway deploy prep

## Rollback

Railway supports instant rollback:
1. Go to service → **Deployments**
2. Find the last working deployment
3. Click **Redeploy** on that deployment

## Monitoring

- Railway dashboard provides CPU, memory, and network metrics
- API `/health` endpoint returns DB + Redis status
- Set up Railway **Healthcheck** in service settings for automatic restart on failure
