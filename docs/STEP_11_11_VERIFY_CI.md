# Step 11.11 — Verification CI Readiness

## Overview

Step 11.11 makes the verification suite CI-ready by:

1. Creating a strict single-source-of-truth runner (`VERIFY_ALL.sh`)
2. Deprecating legacy scripts that no longer work with current auth flows
3. Updating remaining scripts to use admin cookie auth + orgToken
4. Eliminating false-positive FAIL/WARN text from all active scripts

## What VERIFY_ALL.sh Runs

```
VERIFY_ALL.sh
├── 1. API Build     (cd apps/api && pnpm build)
├── 2. Web Build     (cd apps/web && NEXT_BUILD_DIR=.next-verify pnpm build)
└── 3. All VERIFY_*.sh at repo root (alphabetical order)
    ├── VERIFY_KILL_SWITCH.sh
    ├── VERIFY_ORG_TOKEN.sh
    ├── VERIFY_STEP_10_8.sh
    ├── VERIFY_STEP_10_9.sh
    ├── VERIFY_STEP_11_1_UI.sh
    ├── VERIFY_STEP_11_10.sh
    ├── VERIFY_STEP_11_4.sh
    ├── VERIFY_STEP_11_5.sh
    ├── VERIFY_STEP_11_6.sh
    ├── VERIFY_STEP_11_6_5.sh
    ├── VERIFY_STEP_11_7.sh
    ├── VERIFY_STEP_11_8.sh
    ├── VERIFY_STEP_11_9.sh
    └── VERIFY_VISITOR_SESSION.sh
```

Scripts in `verify/legacy/` are **NOT** run.

## Failure Detection

VERIFY_ALL.sh uses strict failure detection:

- **Exit code != 0** → FAIL
- **❌ emoji in output** → FAIL (universal test failure marker)
- **`FAIL:` prefix in output** → FAIL (from `fail()` helper functions)
- **`NOT PASSING` in output** → FAIL (summary indicator)

No fuzzy matching. No allowlisting. Scripts must produce clean output.

## Legacy / Deprecated Scripts

Located in `verify/legacy/`:

| Script | Reason | Superseded By |
|--------|--------|---------------|
| `VERIFY_ABUSE_PROTECTION.sh` | Tests POST without orgToken (required since Step 10.5) | `VERIFY_ORG_TOKEN.sh`, `VERIFY_STEP_11_4.sh` |
| `VERIFY_PRODUCTION_HARDENING.sh` | Tests POST without orgToken + 65s sleep | `VERIFY_ORG_TOKEN.sh`, `VERIFY_STEP_11_1_UI.sh` |
| `VERIFY_MULTI_TENANT.sh` | Tests POST without orgToken, uses failure markers in descriptions | `VERIFY_ORG_TOKEN.sh`, `VERIFY_STEP_11_4.sh` |

These can still be run manually: `bash verify/legacy/VERIFY_ABUSE_PROTECTION.sh`

## Running Locally

```bash
# Full suite
bash VERIFY_ALL.sh

# Single script
bash VERIFY_STEP_11_7.sh

# View logs after VERIFY_ALL
ls .verify-logs/
cat .verify-logs/VERIFY_STEP_11_7.log
```

## Running in CI

```yaml
# GitHub Actions example
- name: Verify
  run: |
    cd apps/api && npx prisma generate
    bash VERIFY_ALL.sh
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    REDIS_URL: ${{ secrets.REDIS_URL }}
```

**Prerequisites**: API server running on port 4000, PostgreSQL, Redis.

For CI without a running API server, builds will still be verified. Live endpoint tests will be skipped gracefully (scripts check API availability before making requests).

## Web Build Isolation

`VERIFY_ALL.sh` builds `apps/web` with `NEXT_BUILD_DIR=.next-verify` to avoid corrupting a running `next dev` server's `.next` cache. The `.next-verify` directory is cleaned up after the build.

## Script Conventions

All active scripts follow these rules:

1. Use `set -euo pipefail` for strict bash execution
2. Use `pass()` / `fail()` / `skip()` helper functions
3. Never print "fail" or "FAIL" in passing output (no false positives)
4. Exit 0 on success, exit 1 on any test failure
5. Use admin cookie auth (not deprecated `x-internal-key`)
6. Use orgToken for widget-facing POST endpoints
7. No redundant builds (VERIFY_ALL.sh builds once)
