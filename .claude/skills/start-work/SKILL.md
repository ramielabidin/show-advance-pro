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

5. **Remember the intended branch name.** Whatever branch you create in step 3 is the canonical session branch. Treat that name as load-bearing — quote it back to the user, and refer to it explicitly before every commit/push. Do not trust "I just ran `git checkout -b X`" as proof you're still on X two tool calls later.

6. **Verify branch + isolation before any commit OR push:** immediately before each `git commit` and each `git push`, run:
   ```
   git branch --show-current
   git log main..HEAD --oneline
   ```
   The branch must equal the name you remembered in step 5, and every commit line must be yours. A `PreToolUse` hook in `.claude/settings.json` already injects this reminder automatically — treat it as a hard checkpoint, not a notification. If anything is off (wrong branch, unfamiliar commit), STOP and ask.

7. **Don't bundle parallel-session work.** If `git status` shows files you didn't edit, they belong to another session. Stash with a labeled message (`git stash push -m "parallel-session: <hint>" -- <files>`), push your work, then `git stash pop` to restore them. One PR per task.

8. **Hand off to /pr** when work is complete — that skill handles push/PR/cleanup with its own branch verification.

## Why

Multiple Claude sessions share this working directory. The harness can — and demonstrably does — route a session to a different branch silently between tool calls, even after a successful `git checkout -b`. Branch entanglement (commits landing on someone else's PR branch) has historically been the single biggest source of cleanup work on this repo. The combination of the SessionStart hook (entry-time check), the PreToolUse hook (per-commit/push check), and this skill's procedural rules keeps that from happening.
