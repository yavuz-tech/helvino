Load testing (pre‑prod)

Requirements
- Install k6: https://k6.io/docs/get-started/installation/
- Use staging or local API URLs, not production.

Environment variables
- API_URL (default: http://localhost:4000)
- BASE_URL (default: http://localhost:3000)
- ORG_KEY (widget tests)
- SITE_ID (widget tests, optional)
- PORTAL_EMAIL / PORTAL_PASSWORD (portal tests)

Portal read test
1) k6 run load-tests/k6/portal.js

Widget read/write test
1) k6 run load-tests/k6/widget.js

Target metrics
- p95 latency < 500ms (reads), < 900ms (writes)
- error rate < 1%
- CPU < 70%, memory < 75%, DB connections stable

