---
name: wrapup
description: Use at the end of a session after the user merges a PR to delete the local git branch and the stale Supabase preview branch.
---

1. Confirm which branch was just merged (check with `git branch -a` or ask the user).

2. Clean up git:
   ```bash
   git checkout main && git pull && git branch -d <branch>
   ```

3. Delete the Supabase preview branch via MCP:
   - `list_branches` on project `knwdjeicyisqsfiisaic`
   - Find the entry whose `git_branch` matches the merged branch name
   - `delete_branch` with that entry's `id`

4. Report what was cleaned up. If no preview branch exists (already paused/deleted by Supabase), just say so — nothing to do.

## Notes

- Every PR gets a Supabase preview branch automatically, even frontend-only ones — always check.
- Never delete a preview branch for a PR that isn't merged yet — it's still being used.
- If multiple stale branches exist (old undeleted previews), offer to clean them all.
