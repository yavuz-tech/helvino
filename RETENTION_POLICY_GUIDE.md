# Helvino - Data Retention Policy Guide

## Overview

Helvino's data retention system allows organizations to automatically delete or redact old messages based on configurable policies. This guide covers configuration, operation, and best practices.

---

## 🎯 Retention Modes

### Soft Delete (Redact) - DEFAULT

**What happens:**
- Message content replaced with `"[redacted]"`
- Metadata preserved: id, timestamp, role, conversationId
- Message still counted in conversation.messageCount
- Original content **cannot be recovered**

**Use cases:**
- Legal compliance (keep audit trail)
- Analytics (preserve message patterns)
- Conversation context (know when messages existed)

**Example:**
```json
// Before retention
{
  "id": "msg_123",
  "content": "I need help with billing",
  "role": "user",
  "timestamp": "2025-01-01T10:00:00Z"
}

// After retention (soft delete)
{
  "id": "msg_123",
  "content": "[redacted]",
  "role": "user",
  "timestamp": "2025-01-01T10:00:00Z"
}
```

---

### Hard Delete

**What happens:**
- Messages permanently deleted from database
- No recovery possible
- Conversation.messageCount decremented
- Empty conversations may be orphaned

**Use cases:**
- GDPR "right to be forgotten"
- Strict privacy requirements
- Database size optimization

**Example:**
```sql
-- Before retention
SELECT COUNT(*) FROM messages WHERE orgId = 'org_123';
-- Result: 1000

-- After retention (hard delete, 30 days policy)
SELECT COUNT(*) FROM messages WHERE orgId = 'org_123';
-- Result: 950 (50 messages deleted)
```

---

## ⚙️ Configuration

### Organization Settings

**Fields:**
```typescript
{
  messageRetentionDays: number,      // 0 = disabled, >0 = enabled
  hardDeleteOnRetention: boolean,    // false = soft, true = hard
  lastRetentionRunAt: DateTime?      // Timestamp of last run
}
```

**Defaults:**
```json
{
  "messageRetentionDays": 365,
  "hardDeleteOnRetention": false
}
```

---

### Set Retention Policy via API

**Endpoint:** `PATCH /api/org/:key/settings`

**Authentication:** Requires `x-internal-key` header

**Example 1: 90-day soft delete**
```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageRetentionDays": 90,
    "hardDeleteOnRetention": false
  }' \
  http://localhost:4000/api/org/demo/settings
```

**Example 2: 30-day hard delete**
```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageRetentionDays": 30,
    "hardDeleteOnRetention": true
  }' \
  http://localhost:4000/api/org/demo/settings
```

**Example 3: Disable retention**
```bash
curl -X PATCH \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageRetentionDays": 0
  }' \
  http://localhost:4000/api/org/demo/settings
```

---

### View Current Settings

```bash
curl -H "x-internal-key: YOUR_INTERNAL_KEY" \
  http://localhost:4000/api/org/demo/settings | jq .settings
```

**Example Response:**
```json
{
  "widgetEnabled": true,
  "writeEnabled": true,
  "aiEnabled": true,
  "primaryColor": "#0F5C5C",
  "messageRetentionDays": 365,
  "hardDeleteOnRetention": false,
  "lastRetentionRunAt": "2026-02-05T02:00:00.000Z"
}
```

---

## 🚀 Running Retention Jobs

### Manual Execution

**Endpoint:** `POST /internal/retention/run`

**Authentication:** Requires `x-internal-key` header

```bash
curl -X POST \
  -H "x-internal-key: YOUR_INTERNAL_KEY" \
  http://localhost:4000/internal/retention/run
```

**Response:**
```json
{
  "ok": true,
  "orgsProcessed": 3,
  "messagesDeleted": 150,
  "messagesRedacted": 0,
  "duration_ms": 1234,
  "timestamp": "2026-02-05T19:28:35.771Z"
}
```

---

### Automated Execution (Cron)

**Recommended: Run daily at 2 AM UTC**

#### Option 1: System Cron

```bash
# Edit crontab
crontab -e

# Add line (runs daily at 2 AM UTC)
0 2 * * * curl -X POST -H "x-internal-key: YOUR_KEY" http://localhost:4000/internal/retention/run >> /var/log/helvino-retention.log 2>&1
```

#### Option 2: Node-Cron (in API)

```typescript
// apps/api/src/jobs/retention.ts
import cron from 'node-cron';

// Run daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  console.log('🗑️  Running retention job...');
  
  const response = await fetch('http://localhost:4000/internal/retention/run', {
    method: 'POST',
    headers: {
      'x-internal-key': process.env.INTERNAL_API_KEY!,
    },
  });
  
  const result = await response.json();
  console.log('✅ Retention job complete:', result);
});
```

#### Option 3: Cloud Scheduler (Production)

**AWS CloudWatch Events:**
```json
{
  "ScheduleExpression": "cron(0 2 * * ? *)",
  "Target": {
    "Arn": "arn:aws:lambda:us-east-1:123456789:function:helvino-retention",
    "Input": "{\"action\":\"run_retention\"}"
  }
}
```

**Heroku Scheduler:**
```bash
# Add scheduled job in Heroku dashboard
curl -X POST \
  -H "x-internal-key: $INTERNAL_API_KEY" \
  https://api.helvino.io/internal/retention/run
```

---

## 📊 Monitoring

### Check Last Run

**Dashboard:** View in System Status section
- Retention Period: Shows configured days
- Delete Mode: Shows soft/hard delete
- Last Run: Shows timestamp

**API:**
```bash
curl -H "x-internal-key: KEY" \
  http://localhost:4000/api/org/demo/settings | \
  jq '{retention: .settings.messageRetentionDays, lastRun: .settings.lastRetentionRunAt}'
```

---

### Retention Job Logs

**What to monitor:**
- ✅ Job completion status
- ✅ Duration (should be consistent)
- ✅ Messages processed/deleted/redacted
- ✅ Any errors

**Example log entry:**
```json
{
  "level": "info",
  "msg": "✅ Retention policy run completed",
  "ok": true,
  "orgsProcessed": 3,
  "messagesDeleted": 0,
  "messagesRedacted": 120,
  "duration_ms": 1542,
  "timestamp": "2026-02-05T02:00:15.000Z"
}
```

**Alert on:**
- 🚨 Job fails (ok: false)
- 🚨 Job doesn't run for 48 hours
- ⚠️ Duration > 5 minutes (may indicate performance issue)

---

## 🔒 Safety Features

### What Prevents Accidental Data Loss

1. **Explicit configuration required**
   - Retention only runs if `messageRetentionDays > 0`
   - Default: 365 days (safe for most use cases)

2. **Per-organization control**
   - Each org has independent retention policy
   - One org's policy doesn't affect others

3. **Batched processing**
   - Processes 1000 messages at a time
   - Prevents memory issues and timeouts

4. **Audit logging**
   - All retention operations logged
   - Includes org, message count, mode

5. **Manual testing**
   - Test with short retention period first
   - Verify behavior before production

---

## ✅ Pre-Production Checklist

Before enabling retention in production:

- [ ] **Test retention job**
  - [ ] Create test org with short retention (7 days)
  - [ ] Create old messages (backdated)
  - [ ] Run retention job manually
  - [ ] Verify soft delete works correctly
  - [ ] Verify hard delete works correctly

- [ ] **Configure production retention**
  - [ ] Set appropriate retention days for each org
  - [ ] Choose soft vs hard delete mode
  - [ ] Document decision rationale

- [ ] **Schedule automated job**
  - [ ] Set up cron or cloud scheduler
  - [ ] Test scheduled execution
  - [ ] Verify logs are captured

- [ ] **Set up monitoring**
  - [ ] Configure alerts for job failures
  - [ ] Monitor job execution logs
  - [ ] Track retention metrics

- [ ] **Document policy**
  - [ ] Add to privacy policy / terms of service
  - [ ] Inform customers of retention period
  - [ ] Comply with legal requirements (GDPR, etc.)

---

## 🧪 Testing Retention

### Test Scenario 1: Soft Delete

```bash
# 1. Create test org with 7-day retention, soft delete
curl -X PATCH \
  -H "x-internal-key: KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageRetentionDays": 7,
    "hardDeleteOnRetention": false
  }' \
  http://localhost:4000/api/org/test/settings

# 2. Create old message (via SQL for testing)
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "
  INSERT INTO messages (id, \"conversationId\", \"orgId\", role, content, timestamp)
  VALUES (
    'test_old_msg',
    'test_conv',
    (SELECT id FROM organizations WHERE key='test'),
    'user',
    'This should be redacted',
    NOW() - INTERVAL '30 days'
  );
"

# 3. Verify message exists
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "
  SELECT id, content FROM messages WHERE id='test_old_msg';
"
# Expected: content = "This should be redacted"

# 4. Run retention job
curl -X POST -H "x-internal-key: KEY" \
  http://localhost:4000/internal/retention/run

# 5. Verify message was redacted
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "
  SELECT id, content FROM messages WHERE id='test_old_msg';
"
# Expected: content = "[redacted]"
```

---

### Test Scenario 2: Hard Delete

```bash
# 1. Create test org with 7-day retention, hard delete
curl -X PATCH \
  -H "x-internal-key: KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageRetentionDays": 7,
    "hardDeleteOnRetention": true
  }' \
  http://localhost:4000/api/org/test/settings

# 2. Create old message
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "
  INSERT INTO messages (id, \"conversationId\", \"orgId\", role, content, timestamp)
  VALUES (
    'test_delete_msg',
    'test_conv',
    (SELECT id FROM organizations WHERE key='test'),
    'user',
    'This should be deleted',
    NOW() - INTERVAL '30 days'
  );
"

# 3. Verify message exists
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "
  SELECT COUNT(*) FROM messages WHERE id='test_delete_msg';
"
# Expected: 1

# 4. Run retention job
curl -X POST -H "x-internal-key: KEY" \
  http://localhost:4000/internal/retention/run

# 5. Verify message was deleted
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "
  SELECT COUNT(*) FROM messages WHERE id='test_delete_msg';
"
# Expected: 0
```

---

## 📋 Retention Policy Examples

### Example 1: Standard B2B SaaS (365 days, soft)

**Configuration:**
```json
{
  "messageRetentionDays": 365,
  "hardDeleteOnRetention": false
}
```

**Rationale:**
- Keep full year of data for analytics
- Soft delete maintains audit trail
- Compliant with most enterprise requirements

---

### Example 2: Healthcare/HIPAA (90 days, hard)

**Configuration:**
```json
{
  "messageRetentionDays": 90,
  "hardDeleteOnRetention": true
}
```

**Rationale:**
- Minimize PHI storage duration
- Hard delete for data security
- Compliant with privacy regulations

---

### Example 3: Financial Services (2555 days / 7 years, soft)

**Configuration:**
```json
{
  "messageRetentionDays": 2555,
  "hardDeleteOnRetention": false
}
```

**Rationale:**
- Legal requirement to retain records 7 years
- Soft delete for audit compliance
- Searchable history for investigations

---

### Example 4: Demo/Trial Accounts (30 days, hard)

**Configuration:**
```json
{
  "messageRetentionDays": 30,
  "hardDeleteOnRetention": true
}
```

**Rationale:**
- Short retention for trial accounts
- Hard delete to keep database clean
- Prevents abandoned trial data bloat

---

## 🔧 Troubleshooting

### Issue: Retention job not processing messages

**Check 1:** Verify retention is enabled
```bash
curl -H "x-internal-key: KEY" \
  http://localhost:4000/api/org/demo/settings | \
  jq .settings.messageRetentionDays

# Should be > 0
```

**Check 2:** Verify messages are old enough
```sql
-- Check oldest messages
SELECT 
  orgId, 
  MIN(timestamp) as oldest_message,
  NOW() - MIN(timestamp) as age
FROM messages
GROUP BY orgId;
```

**Check 3:** Run job manually and check logs
```bash
curl -X POST -H "x-internal-key: KEY" \
  http://localhost:4000/internal/retention/run | jq
```

---

### Issue: Job running too slowly

**Symptom:** Duration > 10 seconds per 1000 messages

**Solutions:**
1. **Check database indexes**
   ```sql
   -- Verify message indexes exist
   \d messages
   ```

2. **Reduce batch size** (if needed)
   - Edit `apps/api/src/routes/internal-admin.ts`
   - Reduce `batchSize` from 1000 to 500

3. **Run during low-traffic hours**
   - Schedule at 2-4 AM when traffic is low

---

### Issue: Messages not being redacted/deleted

**Check:** Verify job ran successfully
```bash
curl -X POST -H "x-internal-key: KEY" \
  http://localhost:4000/internal/retention/run | jq

# Check: ok = true, duration > 0, messages processed > 0
```

**Debug:** Check database directly
```sql
-- Find old messages that should have been processed
SELECT id, content, timestamp, NOW() - timestamp as age
FROM messages
WHERE orgId = (SELECT id FROM organizations WHERE key='demo')
  AND timestamp < NOW() - INTERVAL '365 days'
LIMIT 10;
```

---

## 📚 Additional Resources

- **BACKUP_RESTORE_GUIDE.md** - Backup procedures (covers data recovery)
- **STEP_10_8_SUMMARY.md** - Implementation details
- **OBSERVABILITY_GUIDE.md** - Monitoring and alerting

---

## 🎯 Quick Reference

### Common Commands

```bash
# View retention settings
curl -H "x-internal-key: KEY" http://localhost:4000/api/org/demo/settings | jq .settings

# Run retention job
curl -X POST -H "x-internal-key: KEY" http://localhost:4000/internal/retention/run | jq

# Set 90-day soft delete
curl -X PATCH -H "x-internal-key: KEY" -H "Content-Type: application/json" \
  -d '{"messageRetentionDays":90,"hardDeleteOnRetention":false}' \
  http://localhost:4000/api/org/demo/settings

# Disable retention
curl -X PATCH -H "x-internal-key: KEY" -H "Content-Type: application/json" \
  -d '{"messageRetentionDays":0}' \
  http://localhost:4000/api/org/demo/settings

# Check messages age
docker exec helvino-postgres psql -U helvino -d helvino_dev -c \
  "SELECT orgId, COUNT(*), MIN(timestamp) FROM messages GROUP BY orgId;"
```

---

## ✅ Summary

**Retention Modes:**
- Soft delete (redact): Default, keeps metadata
- Hard delete: Permanent removal

**Configuration:**
- Per-organization settings
- Configurable retention days
- Manual or automated execution

**Safety:**
- Explicit opt-in (messageRetentionDays > 0)
- Batched processing
- Full audit logging

**Monitoring:**
- Dashboard visibility
- API health checks
- Structured logs

**Your data retention system is production-ready! 🗑️✅**
