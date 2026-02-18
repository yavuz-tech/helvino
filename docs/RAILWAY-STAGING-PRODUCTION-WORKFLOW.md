# Railway Staging + Production Workflow (Approval Gate)

Goal: always review changes on `staging` first, then deploy to `production` only after explicit approval.

## Recommended Setup
- Two Railway environments for the same app stack:
  - `staging`
  - `production`
- Two custom domains:
  - `staging.app.helvion.io` (or `app-staging.helvion.io`)
  - `app.helvion.io`

## Branch Strategy (Simple + Safe)
- `staging` branch → auto-deploy to Railway `staging`
- `main` branch → deploy to Railway `production` only after approval

Approval gate lives in Git workflow:
- Every change goes to `staging` first
- You review the `staging` URL
- Only then merge to `main`

## Railway Config Notes
1) Connect GitHub repo in Railway
2) For each environment/service, set deploy trigger branch:
   - `staging`: branch `staging`
   - `production`: branch `main`

## Environment Variables
Set a deploy environment marker so the UI can display a clear badge.

- In Railway `staging` env:
  - `NEXT_PUBLIC_DEPLOY_ENV=staging`
- In Railway `production` env:
  - `NEXT_PUBLIC_DEPLOY_ENV=production`

Portal UI will show a `STAGING` pill in the header when `NEXT_PUBLIC_DEPLOY_ENV=staging`.

## Suggested Rollout Checklist
- Deploy to `staging`
- Run `docs/PORTAL-REGRESSION-CHECKLIST.md`
- Collect feedback / fixes
- Explicit approval
- Merge to `main` (production deploy)

