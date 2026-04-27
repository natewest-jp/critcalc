# Autonomous Curation Run — Prompt Template

The text in the fenced block below is the **literal prompt** to give an
autonomous Claude Code run. Everything outside the block is documentation
for the human operator.

---

## Operator preflight (do once per run, or once per session for repeated runs)

1. Confirm `docs/curation/queue.txt` has at least one `[ ]` entry at the
   top of its block. If not, the run will exit on the stop condition
   "queue empty."
2. Confirm `git status` is clean and you're on `main`.
3. Confirm `/Users/producer/Code/gcsim/internal/characters/` is present
   (so the run can read source).
4. (Optional) Pull latest `main` if you've been working in another branch.

## The prompt

```
You are running an autonomous character curation pass per
docs/curation/recipe.md.

PROCEDURE:
1. Read docs/curation/recipe.md end-to-end.
2. Read docs/curation/queue.md to confirm tier classifications.
3. Read docs/curation/queue.txt. Find the first line starting with `[ ]`.
   - That character ID is your target.
   - If no `[ ]` line exists, exit immediately: nothing to do.
4. Confirm the target is Tier A in queue.md. If not, exit and report.
5. Create branch `draft/<id>` off main. Mark queue.txt entry `[~]` and
   commit + push that change as the first commit on the branch.
6. Draft the character JSON per the recipe. Stop on any condition listed
   in the recipe's "Stop conditions" section.
7. Commit the character file change with message:
   `draft(<id>): first-pass curation from gcsim`
8. Push and open a PR with the recipe's output checklist in the body.
   Title: `draft(<id>): first-pass curation`
9. Mark queue.txt entry `[x]`. Commit and push.
10. Exit. Do NOT pick a second character. Do NOT merge the PR.

HARD CONSTRAINTS (do not violate):
- Tier A only. Tier B/C → exit.
- One character per run. After step 10, exit.
- Never merge. Never push to main. Never force-push.
- Never edit files outside src/lib/data/characters/<id>.json and
  docs/curation/queue.txt during this run.
- KQM data is out of scope. Use gcsim only. Do not WebFetch.
- Never invent effects. Skeletons + _curatorNotes flags only.

If you encounter an unfamiliar mechanic the recipe doesn't cover:
- Stop drafting.
- Add a _curatorNotes entry on the affected ability describing what you
  saw and why you stopped.
- Commit + push what you have.
- Open the PR with title `draft(<id>): BLOCKED — needs reviewer attention`
  and the same output checklist (filled in for what you completed).
- Mark queue.txt entry `[x]`. Exit.

When done with step 10, output a one-line summary:
"Drafted <id> at PR #<n>. Flagged: <count> _curatorNotes."
```

---

## What the operator does after a run

1. Open the PR. Walk through the output checklist.
2. Cross-check frame data against KQM.
3. Resolve `_curatorNotes` — model the flagged effects, or leave them
   skipped with explanatory notes if they meet the "don't model" criteria.
4. Add `meta.curatedAt` and remove `meta.draftedBy`.
5. Merge.
6. If something was wrong in a way the recipe should have prevented:
   amend the recipe before the next run.

## Scaling up to N characters per run

The default is one character per run for calibration. Once you have
confidence the recipe holds and want to fill a larger time window:

- Replace step 10 with: "Repeat from step 3 until you have processed N
  characters OR the queue has no more `[ ]` entries OR a stop condition
  fires."
- Each character still gets its own branch + PR.
- Each character starts from a clean `main` checkout (so PRs don't
  accidentally stack).
- Use a separate prompt variant (this doc grows a §"Multi-character
  variant" section when we get there).
