---
name: release
description: Cut a release of the current Shopwise repo via release-please.
disable-model-invocation: true
---
# Release

1. Confirm `main` CI is green: `gh run list --branch main --limit 1`.
2. Find the open release-please PR: `gh pr list --label "autorelease: pending"`. Show the user its CHANGELOG diff.
3. On the user's go-ahead, `gh pr merge <n> --squash`. release-please tags `vX.Y.Z` and creates the GitHub release.
4. For `shopwise-contracts` / `shopwise-laravel-kit`, confirm the dispatch workflow opened bump PRs in consumers: `gh run list --workflow dispatch-consumers.yml --limit 1`.
