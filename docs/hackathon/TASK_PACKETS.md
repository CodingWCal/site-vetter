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

## Lane 4: AI analyst (`server/prompt.md`, `server/schema.js`, `server/mock-response.json`)
**Objective:** Correct, calm verdicts that can't be talked out of a finding.
- Needs a key: put `ANTHROPIC_API_KEY` in `.env`, then run `npm start`. Test with the phish page, Wikipedia, and one news site (heavy trackers, but still safe).
- Tune until: phish = danger with the injection quoted, Wikipedia = safe, news site = safe + heavy tracking.
- **Done when:** 3 runs in a row give the expected verdicts.

## Lane 5: Test pages + pitch + QA (`test-pages/`, `pitch/`)
**Objective:** The demo lands in under 3 minutes.
- Optional: a second fake page (a fake package-delivery fee page), a "caution" example.
- Write `pitch/DEMO.md`: who says what, and the exact clicks.
- 7:35: QA pass on Calvin's laptop across every page. File issues to the owning lane.
- 7:45–7:55: rehearse twice with a timer.
- **Done when:** the run-through takes under 2:45.
