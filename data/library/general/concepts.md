# Undo the last git commit
Keep the changes: `git reset --soft HEAD~1`. Already pushed? Use `git revert HEAD` instead.

# Merge vs rebase
Merge keeps history as it happened and adds a merge commit. Rebase replays your commits on
top of the target for a straight line. Don't rebase branches other people already pulled.

# Dynamic programming
Break a problem into overlapping subproblems, solve each once and store it (memoize or
fill a table). Example: fewest coins for amount n = 1 + min(dp[n - c]) over coins c.
