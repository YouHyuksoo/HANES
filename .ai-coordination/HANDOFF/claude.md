# Claude Handoff

## Last Update

2026-05-26 T-010 closed (Claude Opus 4.7 1M context)

## Recent Tasks

- **T-010 Apply T-008 SQL migrations to JSHANES (operator)** — Done. UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS 인덱스를 JSHANES 에 적용 (UNIQUE/VALID). create_log_sequences.sql 은 이미 적용된 환경이라 rerun 불필요. 마이그 sql 자체에 컬럼명/RETURN/oracle_connector regex 호환성 3개 결함이 있어 함께 수정.
- **T-008 Fix 13 potential bugs from second-pass review** — Done in commit `aa11ca9`, board closed in `b768099`.

## T-010 결과

| 항목 | 결과 |
|---|---|
| JSHANES UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS | 생성 — UNIQUE / VALID |
| 표현식 | `CASE "STATUS" WHEN 'IN_PROGRESS' THEN NVL("COMPANY",'')||'||'||NVL("PLANT_CD",'') END` |
| Idempotent rerun | 성공 (ORA-00955 catch 동작 확인) |
| create_log_sequences.sql JSHANES 재실행 | 불필요 (이미 모든 시퀀스 존재) |

## 마이그 sql 수정 사항 (T-010 작업 중 발견)

1. 컬럼명 `PLANT` → `PLANT_CD` (실제 스키마 컬럼).
2. PL/SQL 익명 블록의 `RETURN` 제거 → IF/ELSE 구조로 변경.
3. 헤더 코멘트를 BEGIN 안쪽 `/* ... */` 블록 코멘트로 이동. oracle_connector `--execute-file` 의 split regex (`^\s*(DECLARE|BEGIN)\b`) 가 SQL 시작 부분의 `-- ...` 줄 코멘트를 인식하지 못해 PL/SQL 블록의 trailing `;` 를 silent strip 하던 결함 우회.

## 향후 작업 후보 (시간 날 때)

- oracle_connector `execute_file` 의 PL/SQL 시작 검출 regex 를 코멘트 skip 가능하게 보강 (스킬 자체 변경 — 별도 task).
- 다음 환경 deploy 시 `2026-05-26_create_log_sequences.sql` 의 IQC_TEMPLATES USER_TABLES 가드 효과 확인 (신규 환경).
- per-tenant T#### 채번 비즈니스 결정.

## Next AI Should

1. `AGENTS.md` + `.ai-coordination/*` 먼저 읽기.
2. broad edit / DB change / review handoff 시 `PROTOCOL.md` 확인.
3. 편집 전 `LOCKS.md` 에 task ID 기록.
4. DB 변경은 oracle-db 스킬로 직접 적용 후 post-check 결과를 JOURNAL 에 기록.
5. 종료 전 본 핸드오프 갱신.
