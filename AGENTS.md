# Site Vetter: shared rules for every coding agent (Claude Code, Cursor, Codex, Copilot)

Claude Build Day Boston, security track. **Lightning demo at 8:00 PM.** Read `docs/PRD.md` for scope.

## Lanes: edit ONLY your lane's files

| Lane | Owner | Files you may edit |
|---|---|---|
| 1 Captain / backend | Calvin (@CodingWCal) | `server/server.js`, `server/domain-age.js`, `server/redact.js`, `package.json`, `scripts/`, `docs/`, `AGENTS.md`, `README.md` |
| 2 Popup UI | ______ | `extension/popup.html`, `extension/popup.css`, `extension/popup.js`, `extension/manifest.json` |
| 3 Page signals | ______ | `extension/content.js` |
| 4 AI analyst | ______ | `server/prompt.md`, `server/schema.js`, `server/mock-response.json` |
| 5 Test pages + pitch + QA | ______ | `test-pages/`, `pitch/` |

Fewer people? Calvin takes Lane 4, and Lane 5 does pitch + QA only.

**Contract between lanes:** `server/schema.js` + `server/mock-response.json`. Lane 4 owns them. Any field
rename must be announced to Lane 2 first and land in one commit that updates both files.

<!-- HACKATHON-TEAM-COORDINATOR START -->
## Timeboxed team rules

- Before every edit or commit, check `git status` and your current branch.
- Work on your own branch, `yourname/lane` (e.g. `sam/popup`). Never commit to `main`. Open a PR; Calvin merges.
- Don't edit another lane's files, even to clean up or reformat.
- Never force-push, rebase shared branches, or reset someone else's work.
- Stage explicit files (`git add extension/content.js`), not `git add .` or `git add -A`.
- `npm run check` must pass before you open a PR.
- Stop and ask your human if you need a file outside your lane, a new npm dependency, or a schema change.
- **7:35 PM scope freeze.** After that, only fixes for things that break the demo.
<!-- HACKATHON-TEAM-COORDINATOR END -->

## Security rules (this is a security project; act like it)

- Never commit `.env`, API keys, or tokens. The Claude key lives only in the local backend, never in `extension/`.
- Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with page or model data. Use the `h()` helper
  in `popup.js` (textContent only). Page content is attacker-controlled.
- `content.js` must never read the values users typed into inputs.
- Test pages use fictional brands and RFC 5737 IPs only (192.0.2.x, 198.51.100.x, 203.0.113.x).

## Mac + Windows

- npm scripts are pure Node. Don't add bash-only syntax (`VAR=1 cmd`, `cp`, `rm`, `&&` chains) to `package.json`.
- Use `path.join`, not hard-coded `/`, for filesystem paths in Node code.
- `.gitattributes` forces LF line endings. Don't commit CRLF churn; if git shows every line changed, stop and ask.

## Commands

- `npm install` then `npm run setup`: creates `.env` from `.env.example`
- `npm run mock`: backend with a canned response, no API key needed
- `npm start`: real Claude calls (needs `ANTHROPIC_API_KEY` in `.env`)
- `npm run check`: syntax + manifest + backend contract smoke test
