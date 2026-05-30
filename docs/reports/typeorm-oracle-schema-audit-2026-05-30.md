# TypeORM / Oracle Schema Audit - 2026-05-30

## Target

- Oracle site: `MYDBPDB`
- Schema user: `HNSMES`
- Source scope: `apps/backend/src/entities/*.entity.ts`

## Current Result

- TypeORM entities scanned: 147
- Matching DB tables found: 147
- Missing table count: 0
- Missing column count: 0
- Primary-key ERROR count after remediation: 0
- Remaining issue count after current remediation: 0

## Applied Remediation

- Added `tools/export_typeorm_metadata.js` to extract TypeORM runtime metadata.
- Added `tools/compare_typeorm_oracle_schema.py` to compare TypeORM metadata with Oracle `USER_*` schema views.
- Applied `apps/backend/src/migrations/2026-05-30_typeorm_pk_alignment_mydbpdb.sql` to `MYDBPDB/HNSMES`.
- Applied `apps/backend/src/migrations/2026-05-30_typeorm_varchar_widen_mydbpdb.sql` to widen 123 safe `VARCHAR2` columns.
- Applied `apps/backend/src/migrations/2026-05-30_typeorm_number_scale_mydbpdb.sql` to widen 4 numeric scale columns.
- Applied `apps/backend/src/migrations/2026-05-30_rework_type_alignment_mydbpdb.sql` because `REWORK_*` tables were empty and the active code uses string rework numbers and string company values.
- Applied `apps/backend/src/migrations/2026-05-30_semantic_type_alignment_mydbpdb.sql` to convert remaining semantic type columns while preserving existing values as strings where needed.
- Applied `apps/backend/src/migrations/2026-05-30_typeorm_not_null_safe_mydbpdb.sql` to enforce 467 safe `NOT NULL` columns that had no existing NULL values.
- Applied `apps/backend/src/migrations/2026-05-30_remaining_not_null_data_fix_mydbpdb.sql` to fill remaining defaultable NULL values and enforce `NOT NULL`.
- Applied `apps/backend/src/migrations/2026-05-30_tenant_not_null_remaining_mydbpdb.sql` to enforce tenant columns after entity tenant metadata was aligned.
- Added missing DB primary keys:
  - `DEFECT_LOGS(OCCUR_TIME, SEQ)`
  - `LABEL_PRINT_LOGS(PRINTED_AT, SEQ)`
  - `PROD_PLANS(PLAN_NO)`
  - `TRACE_LOGS(TRACE_TIME, SEQ)`
  - `VENDOR_MASTERS(VENDOR_CODE)`
- Aligned TypeORM primary-key metadata for tenant-first composite keys and `REPAIR_USED_PARTS`.

## Final Verification

- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB`
  - entities: 147
  - matching DB tables: 147
  - issues: 0
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`: passed.
- `python tools/generate_db_schema_doc.py`: regenerated `docs/reports/db-schema-erd.md`.
