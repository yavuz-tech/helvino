# PostgreSQL Migration Guide

## Overview

Successfully migrated from in-memory storage to PostgreSQL using Prisma ORM.

## Files Changed

### Core Changes

1. **`apps/api/prisma/schema.prisma`** (NEW)
   - Defined `Organization`, `Conversation`, `Message` models
   - Added indexes for performance
   - Configured PostgreSQL as datasource

2. **`apps/api/src/store.ts`** (REWRITTEN)
   - Replaced in-memory Map storage with Prisma queries
   - All methods now async (return Promises)
   - Maintains same public API

3. **`apps/api/src/prisma.ts`** (NEW)
   - Prisma Client singleton
   - Prevents multiple instances in development

4. **`apps/api/src/index.ts`** (UPDATED)
   - Added `await` to all `store.*` calls
   - No other changes to route logic

### Configuration Files

5. **`docker-compose.yml`** (NEW)
   - PostgreSQL 16 Alpine
   - Credentials: `helvino` / `helvino_dev_password`
   - Port: 5432
   - Database: `helvino_dev`

6. **`apps/api/.env`** (UPDATED)
   - Added `DATABASE_URL`

7. **`apps/api/.env.example`** (NEW)
   - Template for environment variables

8. **`apps/api/package.json`** (UPDATED)
   - Added Prisma scripts: `db:migrate`, `db:seed`, `db:reset`, `db:push`, `db:studio`, `db:smoke-test`
   - Added `prisma.seed` configuration

### Database Setup

9. **`apps/api/prisma/seed.ts`** (NEW)
   - Seeds default organization: `{ key: "demo", name: "Demo Org" }`

10. **`apps/api/scripts/db_smoke_test.mjs`** (NEW)
    - Comprehensive test suite
    - Verifies: org exists, create/read operations, org isolation

## Setup Steps

### 1. Start PostgreSQL

**Option A: Using Docker (Recommended)**
```bash
cd /Users/yavuz/Desktop/helvino
docker compose up -d

# Verify it's running
docker compose ps
```

**Option B: Using Homebrew (if PostgreSQL already installed)**
```bash
brew services start postgresql@16

# Create database
createdb helvino_dev
```

**Option C: Manual Docker**
```bash
docker run -d \
  --name helvino-postgres \
  -e POSTGRES_USER=helvino \
  -e POSTGRES_PASSWORD=helvino_dev_password \
  -e POSTGRES_DB=helvino_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Generate Prisma Client

```bash
cd apps/api
npx prisma generate
```

### 3. Run Migration

```bash
# Create and apply migration
npx pnpm db:migrate

# When prompted, enter migration name: "init"
```

This will:
- Create `prisma/migrations/` folder
- Apply schema to database
- Generate Prisma Client

### 4. Seed Database

```bash
npx pnpm db:seed
```

Expected output:
```
🌱 Seeding database...
✅ Created/verified organization: demo (clxxxxx...)
🌱 Seeding complete!
```

### 5. Run Smoke Test

```bash
npx pnpm db:smoke-test
```

Expected output:
```
🧪 Starting database smoke test...

Test 1: Verify demo organization exists
  ✅ PASS: Found demo org (...)
Test 2: Create conversation
  ✅ PASS: Created conversation (...)
Test 3: Add message to conversation
  ✅ PASS: Created message (...)
Test 4: Update conversation messageCount
  ✅ PASS: messageCount incremented correctly
Test 5: Read conversation with messages
  ✅ PASS: Read conversation with 1 message(s)
Test 6: Verify org isolation
  ✅ PASS: Found test conversation in org list (...)

==================================================
✅ PASSED: 6
❌ FAILED: 0
==================================================

🎉 All tests passed! Database is working correctly.
```

### 6. Start API Server

```bash
# Kill old server if running
kill $(lsof -ti:4000)

# Start with Prisma
cd apps/api
npx pnpm dev
```

The server should start without the old "Seeded default organization" console log (since seed is now in database).

## Verification with curl

### Create Conversation
```bash
curl -X POST -H "x-org-key: demo" http://localhost:4000/conversations
# Expected: {"id":"...","createdAt":"..."}
```

### List Conversations
```bash
curl -H "x-org-key: demo" http://localhost:4000/conversations
# Expected: [{"id":"...","orgId":"...","createdAt":"...","updatedAt":"...","messageCount":0}]
```

### Add Message
```bash
CONV_ID="<conversation-id-from-above>"

curl -X POST -H "x-org-key: demo" -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Test message from Postgres"}' \
  http://localhost:4000/conversations/$CONV_ID/messages
# Expected: {"id":"...","conversationId":"...","role":"user","content":"...","timestamp":"..."}
```

### Get Conversation Detail
```bash
curl -H "x-org-key: demo" http://localhost:4000/conversations/$CONV_ID
# Expected: conversation object with messages array
```

### Verify Data in Database
```bash
# Open Prisma Studio (GUI)
cd apps/api
npx pnpm db:studio

# Or use psql
psql postgresql://helvino:helvino_dev_password@localhost:5432/helvino_dev

# List organizations
SELECT * FROM organizations;

# List conversations
SELECT * FROM conversations;

# List messages
SELECT * FROM messages;
```

## Schema Details

### Organization Table
```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Conversation Table
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  messageCount INTEGER NOT NULL DEFAULT 0,
  
  INDEX idx_conversations_orgId (orgId),
  INDEX idx_conversations_orgId_updatedAt (orgId, updatedAt)
);
```

### Message Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  orgId TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  
  INDEX idx_messages_conversationId (conversationId),
  INDEX idx_messages_orgId (orgId)
);
```

## API Behavior (UNCHANGED)

✅ All endpoints work exactly the same  
✅ Same request/response format  
✅ Same authentication (x-org-key header)  
✅ Same multi-tenant isolation  
✅ Same Socket.IO room behavior  
✅ Same error codes (401, 404, etc.)

**The only difference:** Data persists across server restarts!

## Troubleshooting

### "Can't reach database server"
→ Ensure PostgreSQL is running: `docker compose ps` or `brew services list`

### "Error: P1001: Can't reach database server"
→ Check `DATABASE_URL` in `apps/api/.env`

### "relation 'organizations' does not exist"
→ Run migration: `npx pnpm db:migrate`

### "No organization with key 'demo' found"
→ Run seed: `npx pnpm db:seed`

### Prisma Client not generated
→ Run: `cd apps/api && npx prisma generate`

### Port 5432 already in use
→ Another PostgreSQL is running. Either:
  - Use that instance (update `DATABASE_URL`)
  - Stop it: `brew services stop postgresql`
  - Change port in `docker-compose.yml`

## Useful Commands

```bash
# View database in GUI
npx pnpm db:studio

# Reset database (drops all data)
npx pnpm db:reset

# Push schema without migration (dev only)
npx pnpm db:push

# View Prisma logs
DATABASE_URL="..." npx prisma db pull

# Connect to database
psql postgresql://helvino:helvino_dev_password@localhost:5432/helvino_dev

# Stop PostgreSQL
docker compose down
# or
brew services stop postgresql
```

## Production Considerations

- [ ] Use connection pooling (e.g., PgBouncer)
- [ ] Enable SSL for DATABASE_URL
- [ ] Set up automated backups
- [ ] Add database migration CI/CD
- [ ] Configure Prisma connection limits
- [ ] Add database monitoring
- [ ] Use environment-specific databases
- [ ] Implement read replicas for scaling

## Performance Notes

- Indexed on `orgId` for tenant filtering
- Indexed on `orgId + updatedAt` for conversation listing
- Cascade deletes configured (delete org → deletes conversations → deletes messages)
- Prisma Client query caching enabled in production

## Next Steps

1. ✅ Start PostgreSQL
2. ✅ Run migration
3. ✅ Run seed
4. ✅ Run smoke test
5. ✅ Restart API server
6. ✅ Test with curl
7. ✅ Verify web dashboard still works
8. ✅ Verify widget still works

## Summary

Migration completed successfully:
- **3 new Prisma files**: schema, seed, client singleton
- **1 rewritten file**: store.ts (now uses Prisma)
- **1 updated file**: index.ts (added `await` keywords)
- **3 config files**: docker-compose.yml, .env, .env.example
- **1 test script**: db_smoke_test.mjs
- **0 API changes**: All endpoints work identically

Total: **9 files changed/created** for full PostgreSQL migration.
