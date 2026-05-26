# ARCHIVE

Completed tasks are compacted here to save context. Keep each item to one line.

Format:

```md
- T-000 | YYYY-MM-DD | owner | short result | evidence: JOURNAL heading or commit
```

## Completed

- T-007 | 2026-05-26 | codex | Fixed BOM left product/semi-product filter alias mismatch for FG/CM item types | evidence: JOURNAL 2026-05-26 Codex
- T-006 | 2026-05-26 | codex | Seeded IQC specs from ITEM_MASTERS and reset receiving, stock, issue, IQC log flow tables on JSHANES | evidence: JOURNAL 2026-05-26 Codex
- T-005 | 2026-05-26 | codex | Reset JSHANES ITEM_MASTERS/BOM_MASTERS and seeded 10 HANES harness FG models, 10 CM subassemblies, 16 RM components, 92 BOM rows | evidence: JOURNAL 2026-05-26 Codex
- T-004 | 2026-05-26 | codex | Committed backend functional/test changes as c79b4c6 and prepared coordination/tooling commit | evidence: JOURNAL 2026-05-26 Codex
- T-003 | 2026-05-26 | codex | Added deeper roles, review, stale lock, conflict, DB gate, and context-budget process | evidence: JOURNAL 2026-05-26 Codex
- T-002 | 2026-05-26 | codex | Added context-saving lifecycle for completed tasks | evidence: JOURNAL 2026-05-26 Codex
- T-001 | 2026-05-26 | codex | Created shared AI coordination workflow and onboarding prompt | evidence: JOURNAL 2026-05-26 Codex
- T-009 | 2026-05-26 | kimi | Built cyberpunk AI Command Center dashboard (/ai-command) with 6 HUD panels reading live .ai-coordination files | evidence: JOURNAL 2026-05-26 Kimi
- T-008 | 2026-05-26 | claude | Fixed 13 backend bugs from second-pass review (SQL exec sanitization, SCRAP cross-tenant, physical-inv race, retryLog NULL+precision, iqc-template overflow, training worker fallback, KST TZ, migration guard/README) | evidence: JOURNAL 2026-05-26 Claude (T-008)
- T-010 | 2026-05-26 | claude | Applied UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS partial unique index on JSHANES; rewrote sql to use BEGIN/EXCEPTION + PLANT_CD column + ORA-00955 idempotent catch | evidence: JOURNAL 2026-05-26 Claude (T-010)
