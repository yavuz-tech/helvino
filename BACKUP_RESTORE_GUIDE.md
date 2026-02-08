# Helvino - Backup & Restore Guide

## Overview

This guide covers production backup strategies, restore procedures, and disaster recovery for Helvino's PostgreSQL database.

---

## 🎯 RPO/RTO Targets

### Recovery Point Objective (RPO)
**Target: < 24 hours**

- **Meaning:** Maximum acceptable data loss
- **Strategy:** Daily automated backups at 2 AM UTC
- **For critical deployments:** Consider continuous replication (RPO < 1 minute)

### Recovery Time Objective (RTO)
**Target: < 4 hours**

- **Meaning:** Maximum acceptable downtime
- **Components:**
  - Backup restoration: ~30 minutes (depends on database size)
  - Application restart: ~2 minutes
  - Verification: ~30 minutes
  - DNS/routing update: Variable (0-60 minutes)

---

## 📋 Production Backup Strategy (Recommended)

### Option 1: Managed Database Backups (RECOMMENDED)

Use your cloud provider's built-in backup solution:

#### AWS RDS PostgreSQL
```bash
# Automated backups are enabled by default
# Retention: 7-35 days
# Point-in-time recovery: Yes
# Manual snapshots: Unlimited retention
```

**Configuration:**
- Enable automated backups (retention: 30 days minimum)
- Enable point-in-time recovery
- Create manual snapshots before major deployments
- Cross-region replication for disaster recovery

**Restore Procedure:**
1. Go to AWS RDS Console
2. Select your database instance
3. Click "Actions" → "Restore to point in time"
4. Choose restore point (specific time or snapshot)
5. Create new database instance
6. Update `DATABASE_URL` in your application
7. Restart application

**Advantages:**
- ✅ Automated, no maintenance
- ✅ Point-in-time recovery
- ✅ Cross-region replication
- ✅ Tested and reliable

---

#### DigitalOcean Managed Databases
```bash
# Daily automated backups (7 days retention)
# Manual snapshots available
```

**Configuration:**
- Enable daily backups (automatic)
- Create manual snapshots before deployments
- Enable standby node for high availability

**Restore Procedure:**
1. Go to DigitalOcean Control Panel
2. Select your database cluster
3. Navigate to "Backups & Restore"
4. Select backup to restore
5. Click "Create New Cluster from Backup"
6. Update `DATABASE_URL` in your application
7. Restart application

---

#### Heroku Postgres
```bash
# Automated backups with Postgres plans
# pg:backups for manual control
```

**Configuration:**
```bash
# Enable continuous protection (Standard+ plans)
heroku pg:backups:schedule DATABASE_URL --at '02:00 UTC' --app helvino-api

# Create manual backup
heroku pg:backups:capture --app helvino-api
```

**Restore Procedure:**
```bash
# Restore from backup
heroku pg:backups:restore <backup_id> DATABASE_URL --app helvino-api

# Or restore from URL
heroku pg:backups:restore 'https://s3.amazonaws.com/...' DATABASE_URL --app helvino-api
```

---

### Option 2: Self-Managed Backups (pg_dump)

For self-hosted PostgreSQL or additional backup layer.

#### Automated Daily Backups

**Script:** `scripts/backup-db.sh`
```bash
#!/bin/bash
# Daily database backup script

# Configuration
DB_NAME="helvino_prod"
DB_USER="helvino"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/var/backups/helvino/postgres"
RETENTION_DAYS=30

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/helvino_backup_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "🗄️  Starting backup: $BACKUP_FILE"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "$BACKUP_FILE"

# Check if backup succeeded
if [ $? -eq 0 ]; then
  echo "✅ Backup completed: $BACKUP_FILE"
  
  # Calculate size
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "   Size: $SIZE"
  
  # Upload to S3 (optional)
  if command -v aws &> /dev/null; then
    aws s3 cp "$BACKUP_FILE" "s3://helvino-backups/postgres/" --storage-class STANDARD_IA
    echo "☁️  Uploaded to S3"
  fi
else
  echo "❌ Backup failed!"
  exit 1
fi

# Cleanup old backups (keep last 30 days)
echo "🗑️  Cleaning up old backups..."
find "$BACKUP_DIR" -name "helvino_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "✅ Cleanup complete"
```

**Cron Job (runs daily at 2 AM):**
```bash
# Edit crontab
crontab -e

# Add line:
0 2 * * * /opt/helvino/scripts/backup-db.sh >> /var/log/helvino-backup.log 2>&1
```

---

#### Restore from pg_dump Backup

**Procedure:**
```bash
# 1. Stop application (prevent new writes)
systemctl stop helvino-api

# 2. Drop existing database (CAREFUL!)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS helvino_prod;"

# 3. Create fresh database
sudo -u postgres psql -c "CREATE DATABASE helvino_prod OWNER helvino;"

# 4. Restore from backup
gunzip -c /var/backups/helvino/postgres/helvino_backup_20260205_020000.sql.gz | \
  sudo -u postgres psql -d helvino_prod

# 5. Verify restoration
sudo -u postgres psql -d helvino_prod -c "SELECT COUNT(*) FROM organizations;"
sudo -u postgres psql -d helvino_prod -c "SELECT COUNT(*) FROM conversations;"
sudo -u postgres psql -d helvino_prod -c "SELECT COUNT(*) FROM messages;"

# 6. Run migrations (if needed)
cd /opt/helvino/apps/api
npx prisma migrate deploy

# 7. Restart application
systemctl start helvino-api

# 8. Verify application
curl http://localhost:4000/health
```

---

## 🐳 Development: Docker Volume Backups

For local development and testing.

### Backup Docker PostgreSQL Volume

```bash
# 1. Find container and volume
docker ps | grep postgres
docker volume ls | grep postgres

# 2. Stop container (optional, but safer)
docker compose stop postgres

# 3. Create volume backup
docker run --rm \
  -v helvino_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  ubuntu \
  tar czf /backup/postgres_volume_$(date +%Y%m%d_%H%M%S).tar.gz /data

# 4. Start container again
docker compose start postgres

# Verify backup created
ls -lh backups/
```

### Restore Docker Volume

```bash
# 1. Stop and remove old container
docker compose down

# 2. Remove old volume (CAREFUL!)
docker volume rm helvino_postgres_data

# 3. Create new empty volume
docker volume create helvino_postgres_data

# 4. Restore from backup
docker run --rm \
  -v helvino_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  ubuntu \
  bash -c "cd / && tar xzf /backup/postgres_volume_20260205_020000.tar.gz"

# 5. Start containers
docker compose up -d

# 6. Verify data
docker exec helvino-postgres psql -U helvino -d helvino_dev -c "SELECT COUNT(*) FROM organizations;"
```

---

## 🧪 Testing Backups (Disaster Drill)

**Run this monthly to ensure backups work.**

### Drill Checklist

- [ ] **Preparation** (5 minutes)
  - [ ] Choose a recent backup to test
  - [ ] Prepare clean test environment
  - [ ] Document start time

- [ ] **Restore Process** (30 minutes)
  - [ ] Create new database instance (if managed service)
  - [ ] Restore backup to new instance
  - [ ] Update DATABASE_URL in test environment
  - [ ] Run migrations: `npx prisma migrate deploy`
  - [ ] Verify schema: `npx prisma db pull`

- [ ] **Verification** (15 minutes)
  - [ ] Start API: `npx pnpm dev`
  - [ ] Health check: `curl http://localhost:4000/health`
  - [ ] Verify data:
    ```bash
    curl -H "x-internal-key: KEY" http://localhost:4000/api/org/demo/settings
    curl -H "x-org-key: demo" http://localhost:4000/conversations
    ```
  - [ ] Check record counts match expectations

- [ ] **Cleanup** (5 minutes)
  - [ ] Stop test environment
  - [ ] Delete test database instance
  - [ ] Document results and duration

- [ ] **Documentation** (5 minutes)
  - [ ] Record actual RTO (time to restore)
  - [ ] Note any issues encountered
  - [ ] Update procedures if needed

**Expected RTO:** < 1 hour (for test environment)

---

## 🔄 Point-in-Time Recovery (PITR)

### When to Use PITR

**Scenarios:**
- Accidental data deletion (e.g., wrong conversation deleted)
- Application bug corrupted data
- Need to recover to specific moment before incident

**Requirements:**
- Managed database with PITR enabled (AWS RDS, DigitalOcean, etc.)
- OR continuous WAL archiving for self-hosted

### PITR Procedure (AWS RDS Example)

```bash
# 1. Identify the exact recovery point
# Example: Incident happened at 2026-02-05 15:30:00 UTC
# Choose recovery point: 2026-02-05 15:29:00 UTC (1 minute before)

# 2. Restore to point in time (AWS RDS Console or CLI)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier helvino-prod \
  --target-db-instance-identifier helvino-prod-pitr-recovery \
  --restore-time "2026-02-05T15:29:00Z" \
  --db-subnet-group-name default \
  --publicly-accessible

# 3. Wait for restoration (10-30 minutes)
aws rds describe-db-instances \
  --db-instance-identifier helvino-prod-pitr-recovery \
  --query 'DBInstances[0].DBInstanceStatus'

# 4. Get new database endpoint
aws rds describe-db-instances \
  --db-instance-identifier helvino-prod-pitr-recovery \
  --query 'DBInstances[0].Endpoint.Address'

# 5. Update DATABASE_URL and restart application
# Or: Verify data and promote as new primary if needed
```

---

## 🚨 Disaster Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:** Data inconsistencies, foreign key violations, corrupted indexes

**Procedure:**
1. **Immediate:** Enable read-only mode (set `writeEnabled=false`)
2. **Assess:** Check database logs, identify corruption extent
3. **Restore:** Use PITR to moment before corruption
4. **Verify:** Run data integrity checks
5. **Resume:** Re-enable writes after verification

**Prevention:**
- Regular backups (daily minimum)
- Database integrity checks (monthly)
- Transaction logs for audit trail

---

### Scenario 2: Accidental Mass Deletion

**Example:** Admin accidentally deletes all conversations for an org

**Procedure:**
1. **Immediate:** Don't panic, data is in backups
2. **Identify:** Find exact deletion time from logs
3. **PITR:** Restore to 1 minute before deletion
4. **Export:** Export affected org's data from restored DB
5. **Import:** Import data back to production (or use restored DB as new primary)
6. **Verify:** Check data integrity with customer

**Timeline:** 1-2 hours

---

### Scenario 3: Complete Database Loss

**Example:** Database instance terminated, no standby available

**Procedure:**
1. **Alert:** Notify team, set status page to "major outage"
2. **Create:** Provision new database instance (10-20 minutes)
3. **Restore:** Restore from most recent automated backup (20-40 minutes)
4. **Migrate:** Run Prisma migrations to ensure schema current
5. **Configure:** Update DATABASE_URL in all environments
6. **Deploy:** Restart all API instances
7. **Verify:** Run health checks, test critical paths
8. **Monitor:** Watch for issues, verify data integrity

**Expected RTO:** 1-2 hours

---

### Scenario 4: Region-Wide Outage

**Example:** AWS us-east-1 outage, primary database unavailable

**Procedure (if cross-region replication enabled):**
1. **Failover:** Promote read replica in secondary region to primary
2. **DNS:** Update DNS to point to secondary region API
3. **Verify:** Run health checks in secondary region
4. **Monitor:** Watch for replication lag issues

**Expected RTO:** 15-30 minutes

**Procedure (if no replication):**
1. **Create:** Provision database in alternate region
2. **Restore:** Use most recent cross-region backup
3. **Deploy:** Deploy API to alternate region
4. **DNS:** Update DNS to new region
5. **Verify:** Test critical functionality

**Expected RTO:** 2-4 hours

---

## 📊 Backup Monitoring

### What to Monitor

**Daily:**
- ✅ Backup completed successfully
- ✅ Backup file size is reasonable (not 0 bytes)
- ✅ Backup uploaded to remote storage (S3, etc.)

**Weekly:**
- ✅ Test restore process (drill)
- ✅ Verify backup integrity (restore to test environment)

**Monthly:**
- ✅ Full disaster recovery drill
- ✅ Review and update retention policies
- ✅ Audit backup access logs

### Backup Health Check Script

```bash
#!/bin/bash
# Check last backup health

BACKUP_DIR="/var/backups/helvino/postgres"
MAX_AGE_HOURS=36  # Alert if backup older than 36 hours

# Find most recent backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/helvino_backup_*.sql.gz | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ ERROR: No backups found!"
  exit 1
fi

# Check backup age
BACKUP_TIME=$(stat -f "%m" "$LATEST_BACKUP")
NOW=$(date +%s)
AGE_HOURS=$(( (NOW - BACKUP_TIME) / 3600 ))

echo "📦 Latest backup: $LATEST_BACKUP"
echo "📅 Age: $AGE_HOURS hours"

if [ $AGE_HOURS -gt $MAX_AGE_HOURS ]; then
  echo "❌ WARNING: Backup is older than $MAX_AGE_HOURS hours!"
  exit 1
fi

# Check backup size
SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
echo "💾 Size: $SIZE"

if [ $(du -k "$LATEST_BACKUP" | cut -f1) -lt 1024 ]; then
  echo "❌ WARNING: Backup file suspiciously small (<1MB)"
  exit 1
fi

echo "✅ Backup health check passed"
```

---

## 🔐 Backup Security

### Encryption

**Encrypt backups at rest:**
```bash
# Using GPG
pg_dump ... | gzip | gpg --encrypt --recipient ops@helvion.io > backup.sql.gz.gpg

# Decrypt when restoring
gpg --decrypt backup.sql.gz.gpg | gunzip | psql ...
```

**S3 Server-Side Encryption:**
```bash
aws s3 cp backup.sql.gz s3://helvino-backups/ --sse AES256
```

### Access Control

**Principle of least privilege:**
- ✅ Backup storage: Read/write for backup service only
- ✅ Restore operations: Separate credentials, MFA required
- ✅ Audit all backup access
- ✅ Rotate credentials quarterly

---

## 📝 Backup Retention Policy

### Recommended Retention

| Backup Type | Retention | Purpose |
|-------------|-----------|---------|
| Automated Daily | 30 days | Recent recovery |
| Weekly Snapshot | 12 weeks | Medium-term recovery |
| Monthly Snapshot | 12 months | Long-term compliance |
| Pre-Deployment | Until next deployment | Rollback safety |
| Annual Archive | 7 years | Legal/compliance |

### Storage Cost Optimization

**AWS S3 Lifecycle:**
```json
{
  "Rules": [
    {
      "Id": "MoveToGlacier",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ]
    }
  ]
}
```

---

## ✅ Pre-Production Checklist

Before going live:

- [ ] **Backup Strategy**
  - [ ] Automated daily backups configured
  - [ ] Cross-region replication enabled (for critical deployments)
  - [ ] Backup monitoring and alerts set up
  - [ ] Retention policy documented

- [ ] **Disaster Recovery**
  - [ ] Restore procedure documented and tested
  - [ ] RTO/RPO targets defined
  - [ ] Disaster recovery drill completed successfully
  - [ ] On-call team trained on restore procedures

- [ ] **Security**
  - [ ] Backups encrypted at rest
  - [ ] Access controls implemented
  - [ ] Audit logging enabled

- [ ] **Monitoring**
  - [ ] Backup health checks automated
  - [ ] Alerts configured for backup failures
  - [ ] Dashboard shows last backup time

---

## 🆘 Emergency Contacts

**Backup/Restore Issues:**
- Database Admin: [Your team contact]
- Cloud Provider Support: [AWS/DO/Heroku support]
- On-Call Engineer: [PagerDuty/OpsGenie]

**Escalation Path:**
1. Check backup health check logs
2. Verify last successful backup
3. If restore needed, follow procedures above
4. Escalate to senior engineer if RTO exceeded

---

## 📚 Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS RDS Backup Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)
- [Prisma Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

## 🎯 Summary

### Quick Reference

**Daily Backups:** ✅ Automated at 2 AM UTC  
**Retention:** 30 days (daily), 12 months (monthly)  
**RPO:** < 24 hours  
**RTO:** < 4 hours  
**Test Frequency:** Monthly disaster drills

### Key Commands

```bash
# Create manual backup
pg_dump -h localhost -U helvino -d helvino_prod | gzip > backup.sql.gz

# Restore from backup
gunzip -c backup.sql.gz | psql -h localhost -U helvino -d helvino_prod

# Verify restore
curl http://localhost:4000/health
```

### Emergency: "Database is gone, I need to restore NOW!"

1. **Don't panic** - Your data is backed up
2. **Check** latest backup availability
3. **Follow** restore procedure for your database provider (see above)
4. **Verify** data integrity after restore
5. **Document** incident for post-mortem

**Expected time:** 1-2 hours

---

**Your data is safe. Backups are tested. Recovery is practiced. 🛡️**
