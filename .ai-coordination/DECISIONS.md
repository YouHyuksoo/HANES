# DECISIONS

## D-001 Use file-based coordination for AI sessions

Status: Accepted

Decision:
- Use `.ai-coordination/` as the shared state area for multiple AI sessions.
- Do not rely on hidden session memory for cross-agent coordination.
- Every AI reads the shared files before work and writes a handoff before stopping.

Reason:
- Different AI sessions do not share live context.
- Repo files are visible to all agents and can be reviewed, diffed, and committed.

## D-002 Oracle numbering must use sequences

Status: Accepted

Decision:
- Generated `SEQ` and ID values in Oracle-backed code must use `SEQUENCE.NEXTVAL`.
- `MAX+1`, `NVL(MAX(...))+1`, and date reset numbering are prohibited for generated keys.

Reason:
- `MAX+1` is race-prone and fails under concurrent sessions.
- Oracle sequences are the database-native mechanism for concurrent key generation.

## D-003 Keep active coordination context small

Status: Accepted

Decision:
- `TASKS.md` is active-work-only and may include TODO, IN_PROGRESS, REVIEW, and BLOCKED.
- DONE work moves to `ARCHIVE.md` as one compact line.
- Details and verification stay in `JOURNAL.md`.
- Risky work uses roles: implementer, reviewer, operator.

Reason:
- Multiple AI sessions need enough shared state to coordinate, but not a growing transcript that wastes context.
