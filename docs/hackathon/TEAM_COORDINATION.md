# Team coordination: Site Vetter

**Finish line:** See `docs/PRD.md`. Lanes and rules are in `AGENTS.md`.

## Clock
| Time | What |
|---|---|
| now–7:10 | Accept invite, clone, `npm install`, `npm run check`, post CLAIM |
| 7:10–7:35 | Build in your lane. 7:20: push whatever runs |
| **7:35** | **Scope freeze.** Open PRs |
| 7:35–7:45 | Calvin merges: 4 → 7 → 3 → 2 → 5 → 6, running `npm run check` after each |
| 7:45–7:55 | Full run on the demo laptop + 2 rehearsals |
| 8:00 | Lightning demo |

## Messages (post in the team chat only when state changes)
```
CLAIM   | name | lane | files | done when: …
HANDOFF | name | branch | PR link | checks: npm run check PASS | limits: …
BLOCKED | name | issue | tried | need: one question
REQUEST | from lane → to lane | what you need | why | by when
```

**Contingent work:** never prompt your agent to edit another lane's file. Post a `REQUEST`; the owner pastes
it into *their* agent. When their PR merges, sync your branch: `git fetch origin` then `git merge origin/main`
(merge, not rebase).

**Pin in WhatsApp:** the lane → name list. That's the live board. Don't keep status in a repo file,
because 7 people editing one file is the merge conflict you're trying to avoid.

## Credit ledger
| Person | GitHub | Lane | Authored | Other contributions |
|---|---|---|---|---|
| Calvin | @CodingWCal | 1 Captain/backend | scaffold, backend, docs | coordination |
| Rachel | @Rachelgonsalves821 | 2 Popup UI | | |
| | @17-jd | 7 Threat checks (lookalike domains) | | |
| Hamini | @hap4114 | 3 Page signals | | |
| Kerline | @TikeDev | 4 AI analyst + plain language | | |
| Siddharth | @t-siddharth | 5 Test pages + QA | | |
| Brenda | @bmiao10 | 6 Pitch + demo | | |
