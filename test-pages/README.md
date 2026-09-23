# Test pages (OWNER: Lane 5)

Served by the backend at `http://localhost:8787/test/...` (not `file://`, so the extension can read
them without extra permissions). They're plain http on purpose: a login form over http is one of the signals.

Rules: fictional brands only, IPs only from RFC 5737 (192.0.2.x, 198.51.100.x, 203.0.113.x), and no real
tracker scripts. Real-site comparisons are done live in the browser.

| Page | Expected verdict | Signals it should trigger |
|---|---|---|
| phish.html | danger, 85+ | offsite form, password over http, card + SSN fields, urgency, mismatched link, hidden AI note |
| safe.html | safe, 40 or less | no forms, no third parties, links stay on-site (over http and localhost, so it may land on caution) |
| store.html | caution or danger, 60+ | 80% off big-name goods, Zelle or gift-card only, countdown timer, no phone, address, or returns |
| wikipedia.org (live) | safe | domain from 2001, no credential form |

## End-to-end check

`node test-pages/e2e.mjs` starts the backend, sends each page above to `/api/vet`, and checks the report.
With no API key it runs in mock mode and skips the verdict checks (the mock always answers "danger").
It does not run `extension/content.js`; that needs a real browser.
