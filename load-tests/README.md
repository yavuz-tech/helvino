Load testing (k6)

Prereqs
- Install k6: https://k6.io/docs/get-started/installation/
- Use a staging or controlled prod window.

Environment variables
- BASE_URL: API base URL (e.g. https://your-domain.com)
- ORG_KEY: organization key for widget endpoints
- ORIGIN: allowed widget origin (e.g. https://your-domain.com)
- PORTAL_COOKIE: optional portal session cookie (for /portal/* reads)

Read-heavy (5k concurrent)
BASE_URL=... ORG_KEY=... ORIGIN=... k6 run load-tests/k6/read-heavy.js

Write-heavy (1k concurrent)
BASE_URL=... ORG_KEY=... ORIGIN=... k6 run load-tests/k6/write-heavy.js

Notes
- If PORTAL_COOKIE is not provided, read-heavy uses public widget reads.
- For prod, run during a maintenance window and watch CPU, memory, DB, and 4xx/5xx rates.

