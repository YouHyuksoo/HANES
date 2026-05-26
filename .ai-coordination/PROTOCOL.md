# PROTOCOL

Read this only when work is non-trivial, touches shared files, needs review, changes DB behavior, or hits a conflict.

## Roles

- implementer: edits code and focused tests.
- reviewer: reviews diff, risks, missing tests, and regressions.
- operator: handles DB, migrations, environment, deployment, and runtime verification.

One AI may hold multiple roles only for small tasks. For risky changes, split roles across agents.

## Task Lifecycle

TODO -> IN_PROGRESS -> REVIEW -> DONE
TODO -> IN_PROGRESS -> BLOCKED

- `TASKS.md` keeps TODO, IN_PROGRESS, REVIEW, BLOCKED.
- DONE tasks move to `ARCHIVE.md` and detailed evidence goes to `JOURNAL.md`.
- REVIEW means implementation is done but another agent or the user should inspect it before commit/deploy.

## Lock Lifecycle

- A lock must include owner, task, files/modules, started, last_seen, expires, and status.
- Refresh `last_seen` during long work.
- Agent presence는 증거 기반으로 표시한다. fresh heartbeat 또는 최근 `last_seen`이 있을 때만 `online`으로 보고, fresh 신호가 없으면 `offline`, 만료됐거나 오래된 active lock은 `stale`로 본다.
- If `expires` has passed, mark the lock `stale` in `LOCKS.md` before taking over.
- Never overwrite another active lock silently.

## Conflict Protocol

1. Stop editing the contested files.
2. Mark the task BLOCKED in `TASKS.md`.
3. Add the conflict and exact files to `JOURNAL.md`.
4. Ask the user or wait for the lock owner handoff.

## Review Gate

For non-trivial code changes, record in `TASKS.md`:

- changed files
- verification commands
- known risk
- reviewer or `needs-review`

The reviewer should lead with findings, not summaries.

## DB And Migration Gate

For DB changes:

- record target DB/site
- record SQL file or connector command
- record pre-check query and post-check query
- never mix schema changes into unrelated code cleanup

## Context Budget

- Keep `STATE.md` under 80 lines.
- Keep each active task under 25 lines.
- Keep each handoff under 80 lines.
- Keep archive entries one line each.
- Move old details to `JOURNAL.md`; search by task ID when needed.
