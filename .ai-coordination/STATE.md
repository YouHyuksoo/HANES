# STATE

## Current Repo

- Project: HANES MES
- Path: `C:\Project\HANES`
- Stack: NestJS + TypeORM + Oracle + Turborepo
- Oracle site: `JSHANES`

## Current Global Rules

- Generated `SEQ` or ID values must use Oracle `SEQUENCE.NEXTVAL`.
- Do not use `MAX(SEQ)+1`, `NVL(MAX(...))+1`, or date/company/plant reset numbering.
- Multi-tenant business SQL must respect `COMPANY` and `PLANT_CD` unless an explicit shared-scope rule is documented.
- TypeORM CLI is not reliable in this repo; use raw SQL migration files and the Oracle connector workflow.
- Do not revert user or other-agent changes.

## Active Context

- Multiple AI sessions may work in this repo concurrently.
- Coordination state lives in `.ai-coordination/`.
- Before editing, each AI must claim its intended files in `LOCKS.md`.
- `TASKS.md` is active-work-only. Completed work is compacted into `ARCHIVE.md` and details stay in `JOURNAL.md`.
- Use `PROTOCOL.md` for roles, stale locks, conflicts, review gates, and context budgets.
