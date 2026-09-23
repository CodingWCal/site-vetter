# ◆ Site Vetter

**One click: is this site safe?** A Chrome extension that checks the page you're on (domain age, where the
forms really send your data, hidden trackers, hidden text aimed at AI) and gets a plain-English verdict from Claude.

> 🚧 Hackathon starter (Claude Build Day Boston, security track). Each lane builds out its own files. See `AGENTS.md`.

## Join the team
1. Accept the GitHub invite (check your email or github.com/notifications).
2. Read `AGENTS.md` (lanes + rules) and find your packet in `docs/hackathon/TASK_PACKETS.md`.
3. Run these. They work the same in PowerShell, cmd, and macOS/Linux terminals:

```
git clone https://github.com/CodingWCal/site-vetter.git
cd site-vetter
git checkout -b yourname/lane
npm install
npm run setup
npm run check
npm run mock
```

4. Load the extension: open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**,
   click **Load unpacked**, and pick the `extension/` folder.
5. Open http://localhost:8787/test/phish.html and click the Site Vetter icon.

Requires Node 18+ and Chrome or Edge.

## How it works
```
[page] --content.js--> signals + text --popup.js--> localhost:8787 --redact--> Claude --> verdict card
                                                     (domain age via RDAP)
```
The Claude API key stays in the local backend's `.env`, never in the extension. The backend only accepts
requests from browser extensions, so a random website can't spend your credits.
