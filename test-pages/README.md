# Test pages (OWNER: Lane 5)

Served by the backend at `http://localhost:8787/test/...` (not `file://`, so the extension can read
them without extra permissions). They're plain http on purpose: a login form over http is one of the signals.

Rules: fictional brands only, IPs only from RFC 5737 (192.0.2.x, 198.51.100.x, 203.0.113.x), and no real
tracker scripts. Real-site comparisons are done live in the browser.

| Page | Expected verdict | Signals it should trigger |
|---|---|---|
| phish.html | danger, 85+ | offsite form, password over http, card + SSN fields, urgency, mismatched link, hidden AI note |
| wikipedia.org (live) | safe | domain from 2001, no credential form |
