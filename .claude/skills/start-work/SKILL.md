---
name: start-work
description: Safe pre-flight to begin a fresh task on a clean branch off latest main. Use at the start of any new task to avoid committing onto someone else's branch or onto a dirty tree.
---

Goal: every new task begins on a fresh branch off the latest `main`, with a clean working tree, and no entanglement with another agent's in-flight work.

## Steps

1. **Snapshot current state.** Run:
   ```
   git branch --show-current
   git status -s
   git log main..HEAD --oneline 2>/dev/null
   ```
   Show the user the output before doing anything else.

2. **If the working tree is dirty:** STOP. Do not stash or commit unilaterally — the changes might belong to a parallel session. Tell the user what's modified and ask whether to:
   - Stash with a labeled message (`git stash push -u -m "<reason>"`),
   - Commit on the current branch (only if it's clearly the right place),
   - Or move the changes to a new branch.

3. **If on `main`:** ask the user for a branch name (or propose one based on the task), then:
   ```
   git pull --ff-only
   git checkout -b claude/<branch-name>
   ```

4. **If on an existing `claude/*` branch:**
   - If the branch is the user's stated target for this task, confirm explicitly and continue.
   - Otherwise: assume it's wrong. Switch to `main`, pull, and create a fresh branch (per step 3).

5. **Verify isolation before any commit:** before each `git commit`, re-run `git log main..HEAD --oneline` and confirm every line is yours. If not, stop and ask.

6. **Hand off to /pr** when work is complete — that skill handles push/PR/cleanup with its own branch verification.

## Why

Multiple Claude sessions share this working directory. The harness can route a session back to a branch it didn't expect mid-task. Branch entanglement (commits landing on someone else's PR branch) has historically been the single biggest source of cleanup work on this repo. This skill keeps that from happening.
