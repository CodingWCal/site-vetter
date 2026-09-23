# Task packets: paste yours into your agent

All packets share the rules in `AGENTS.md`. Start with:

```
git clone https://github.com/CodingWCal/site-vetter.git
cd site-vetter
git checkout -b yourname/lane
npm install
npm run setup
npm run mock
```

**Kickoff prompt: paste this as the first message to your agent** (swap in your lane number):

```
I'm on Lane N of a 60-minute hackathon team. Read AGENTS.md, docs/PRD.md, and my
Lane N packet in docs/hackathon/TASK_PACKETS.md. Only edit the files AGENTS.md
assigns to Lane N. Build against the contract files on main (server/schema.js,
server/mock-response.json) and don't change them unless you're Lane 4. Keep
changes small, run `npm run check` after each one, and stop and tell me if you
need any other file, a new dependency, or a contract change. Start by telling
me your plan in 3 bullets.
```

**Handoff (by 7:35):** push your branch, open a PR, and use the PR template. **Stop and ask** if you need a
file outside your lane, a new dependency, or a schema change, or if `npm run check` fails for a reason you can't explain.

---

## Lane 2: Popup UI (`extension/popup.*`, `extension/manifest.json`)
**Objective:** A popup a non-technical person understands in 3 seconds.
- Load it: `chrome://extensions` → Developer mode → Load unpacked → pick the `extension/` folder. Run `npm run mock`, then open `http://localhost:8787/test/phish.html` and click the extension.
- Priorities: a big verdict and score, a better loading state, clear errors, an icon (add `icons` to the manifest).
- Keep the `h()` helper. No `innerHTML`.
- **Done when:** someone who didn't build it reads the phish verdict and says "don't use this site."

## Lane 3: Page signals (`extension/content.js`)
**Objective:** Collect the evidence that makes the verdict trustworthy.
- Test fast: open the phish page, paste `content.js` into the DevTools console, and inspect the returned object.
- Ideas: brand-vs-domain mismatch (title/logo text says "Bank" but the domain doesn't match), lookalike domains (`paypa1`), `data:`/`blob:` form actions, a count of cookies set by third parties.
- Never read input values. Keep the returned object small (<200 KB).
- **Done when:** the phish page triggers every signal in `test-pages/README.md`, and Wikipedia triggers none of the red ones.

## Lane 4: AI analyst + plain language (`server/prompt.md`, `server/schema.js`, `server/mock-response.json`)
**Objective:** Verdicts that are correct *and* that a non-technical or older person understands on first read.
Most of the words in the popup (headline, reasons, advice) come from Claude, so this lane owns the product's voice.
- Needs a key: put `ANTHROPIC_API_KEY` in `.env`, then run `npm start`. (`npm run mock` always shows the same canned text, so you won't see prompt changes there.) Test with the phish page, Wikipedia, and one news site (heavy trackers, but still safe).
- **Voice rules to build into `prompt.md`:**
  - Short sentences, everyday words, about a 6th-grade reading level. Calm, not scary.
  - No jargon: "fake website," not "phishing." "Website address," not "domain." "Companies tracking what you do," not "third-party trackers." "Not encrypted," not "HTTP."
  - Every reason explains why it matters to *them* ("your card number would go to a stranger").
  - Always end with one concrete step they can take ("Close this tab. Call your bank using the number on the back of your card.").
- Use the `description` fields in `schema.js` to steer tone per field (e.g. `headline`: "under 15 words, no jargon").
- Rewrite `mock-response.json` in the same voice so the mock demo matches.
- Fixed popup labels ("Dangerous," "Be careful," loading and error text) belong to Lane 2. Send them a `REQUEST` with your wording.
- Accuracy still wins: phish = danger with the injection quoted, Wikipedia = safe, news site = safe + heavy tracking.
- **Done when:** 3 runs in a row give the expected verdicts, and someone outside the team reads the phish result aloud without stumbling on a word.

## Lane 5: Test pages + QA (`test-pages/`)
**Objective:** Evidence the demo runs on, plus proof that it works.
- Add a second fake page (e.g. a fake "package delivery fee" page) and a "caution" example (legit but sketchy: new domain, no login).
- Keep `test-pages/README.md` current: each page, the expected verdict, and the signals it should trigger. Lanes 3 and 4 test against it.
- 7:35: QA pass on Calvin's laptop across every page plus 2 real sites. Post failures as `REQUEST`s to the owning lane.
- **Done when:** every page has an expected verdict and the QA pass is posted in WhatsApp.

## Lane 6: Pitch + demo (`pitch/`)
**Objective:** 3 minutes, one idea, landed.
- Rewrite `pitch/DEMO.md`: the hook, who says what, and the exact clicks. Optional: 1–2 slides.
- Plan a backup: a second browser window with the result already loaded, plus `npm run mock` if Wi-Fi dies.
- 7:45–7:55: rehearse twice on the demo laptop with a timer.
- **Done when:** the run-through takes under 2:45.

## Lane 7: Threat checks (`server/lookalike.js`)
**Objective:** Catch impersonation that plain page signals miss: `paypa1.com`, `chase.com.verify-login.io`.
- Implement `lookalikeChecks(host, title)` (stub + TODOs in the file). It's already wired into `server.js`, and its findings go to Claude as `lookalike`.
- No network calls, no dependencies. A hard-coded list of ~20 commonly phished brands is fine.
- Test quickly: `node -e "import('./server/lookalike.js').then(m => console.log(m.lookalikeChecks('paypa1-secure.com', 'PayPal Login')))"`
- **Done when:** 5 lookalike examples get flagged and `wikipedia.org` / `github.com` get none.
