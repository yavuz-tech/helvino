# PostgreSQL Migration - Quick Start

## ✅ What Was Done

Migrated from **in-memory storage** → **PostgreSQL + Prisma** without changing any external API behavior.

## 📦 Files Created/Modified

### New Files (7)
1. `apps/api/prisma/schema.prisma` - Database schema
2. `apps/api/src/prisma.ts` - Prisma client singleton
3. `apps/api/prisma/seed.ts` - Seed demo organization
4. `apps/api/scripts/db_smoke_test.mjs` - Automated test suite
5. `docker-compose.yml` - PostgreSQL container
6. `apps/api/.env.example` - Environment template
7. `POSTGRES_MIGRATION_GUIDE.md` - Full documentation

### Modified Files (3)
1. `apps/api/src/store.ts` - Rewritten to use Prisma (all methods now async)
2. `apps/api/src/index.ts` - Added `await` to store calls (minimal diff)
3. `apps/api/package.json` - Added Prisma scripts

## 🚀 Quick Start (3 Steps)

### Step 1: Start PostgreSQL

```bash
cd /Users/yavuz/Desktop/helvino

# Start PostgreSQL with Docker
docker compose up -d

# Verify it's running
docker compose ps
```

**Don't have Docker?** See `POSTGRES_MIGRATION_GUIDE.md` for alternatives.

### Step 2: Setup Database

```bash
cd apps/api

# Generate Prisma Client
npx prisma generate

# Run migration (creates tables)
npx pnpm db:migrate
# When prompted, enter: "init"

# Seed demo organization
npx pnpm db:seed
```

Expected output:
```
✅ Created/verified organization: demo (clxxxxx...)
```

### Step 3: Test Everything

```bash
# Run automated smoke test
npx pnpm db:smoke-test

# Should show:
# ✅ PASSED: 6
# ❌ FAILED: 0
```

## ✅ Verification

### Test API with curl

```bash
# Create conversation
curl -X POST -H "x-org-key: demo" http://localhost:4000/conversations

# Save the returned ID, then add a message
CONV_ID="<paste-id-here>"
curl -X POST -H "x-org-key: demo" -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello from Postgres!"}' \
  http://localhost:4000/conversations/$CONV_ID/messages

# List conversations (should show the one you created)
curl -H "x-org-key: demo" http://localhost:4000/conversations

# Get conversation detail (should show the message)
curl -H "x-org-key: demo" http://localhost:4000/conversations/$CONV_ID
```

### View Data in GUI

```bash
cd apps/api
npx pnpm db:studio
# Opens browser at http://localhost:5555
```

## 🔄 Restart API Server

```bash
# Kill old server
kill $(lsof -ti:4000)

# Start with Prisma
cd apps/api
npx pnpm dev
```

## 🎯 What Changed (from user perspective)

**NOTHING!** 🎉

- ✅ Same API endpoints
- ✅ Same request/response format
- ✅ Same authentication (x-org-key)
- ✅ Same multi-tenant isolation
- ✅ Same Socket.IO behavior
- ✅ Same error codes

**The only difference:** Data now persists across server restarts!

## 📊 Database Schema

```
organizations
├── id (PK)
├── key (unique) ← "demo"
├── name
└── createdAt

conversations
├── id (PK)
├── orgId (FK → organizations)
├── createdAt
├── updatedAt
└── messageCount

messages
├── id (PK)
├── conversationId (FK → conversations)
├── orgId (FK → organizations)
├── role ("user" | "assistant")
├── content
└── timestamp
```

## 🛠️ Useful Commands

```bash
# View database in GUI
npx pnpm db:studio

# Reset database (DANGER: deletes all data)
npx pnpm db:reset

# Re-run seed
npx pnpm db:seed

# Run smoke test
npx pnpm db:smoke-test

# Stop PostgreSQL
docker compose down
```

## ❓ Troubleshooting

**"Can't reach database server"**
→ Start PostgreSQL: `docker compose up -d`

**"relation 'organizations' does not exist"**
→ Run migration: `npx pnpm db:migrate`

**"No organization with key 'demo'"**
→ Run seed: `npx pnpm db:seed`

**API still using old in-memory data?**
→ Restart API server (it caches Prisma client)

## 📝 Complete Documentation

See `POSTGRES_MIGRATION_GUIDE.md` for:
- Alternative PostgreSQL setup methods
- Detailed schema documentation
- Production considerations
- Advanced troubleshooting

## 🎉 Summary

- **9 files** changed/created
- **0 breaking changes** to API
- **3 commands** to get running
- **6 automated tests** verify correctness

Migration is complete and ready to use!
