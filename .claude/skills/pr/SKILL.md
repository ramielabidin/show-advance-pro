---
name: pr
description: Create PR and clean up local branches safely
---

1. Run `git branch --show-current` and confirm it's the intended branch
2. Run `git status` and `git log main..HEAD --oneline` — show the user what will be pushed
3. If commits look entangled with another branch, STOP and ask
4. Push with `git push -u origin <branch>`
5. Open PR with `gh pr create --fill`
6. After merge, run: `git checkout main && git pull && git branch -d <branch>`
