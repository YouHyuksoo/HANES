# LOCKS

Before editing, add a lock entry. Remove or mark it released when done.

## Active Locks

```md
- owner:
  task:
  status: active | released | stale
  files:
  started:
  last_seen:
  expires:
  notes:
```

## History

- owner: codex
  task: T-004 Commit current worktree
  status: released
  files:
    - repository commit/staging state
    - .ai-coordination/*
  started: 2026-05-26T12:28:50+09:00
  last_seen: 2026-05-26T12:28:50+09:00
  expires: 2026-05-26T13:28:50+09:00
  notes: User requested commit; split functional changes from coordination/tooling changes per CLAUDE.md.

- owner: codex
  task: T-001 AI coordination rules
  status: released
  files:
    - AGENTS.md
    - .ai-coordination/*
  started: 2026-05-26
  notes: Created shared coordination rules.
