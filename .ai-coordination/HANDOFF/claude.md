# Claude Handoff

## Last Update

2026-05-26 T-011 Phase A completed (Claude Opus 4.7 1M context)

## Recent Tasks

- **T-011 IQC005 자재 입하관리 정렬 — Phase A** — Done. 5 마이그 JSHANES 적용, 백엔드 + 프론트 + i18n 모두 완료, 빌드 0 error, spec 59/59 PASS. PURCHASE_ORDER_ITEMS 행 0건이라 UI 시나리오는 사용자 PO 등록 후 검증 필요.
- **T-010 Apply T-008 SQL migrations to JSHANES (operator)** — Done. UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS 인덱스를 JSHANES 에 적용.
- **T-008 Fix 13 potential bugs from second-pass review** — Done in commit `aa11ca9`, board closed in `b768099`.

## T-011 Phase A 결과

### DB 변경 (JSHANES 적용 완료)
| 마이그 | 결과 |
|---|---|
| MAT_LOTS.MFG_PARTNER_CODE + IX | 적용 ✅ |
| SEQ_MAT_SERIAL_DAILY / SEQ_ARRIVAL_NO_DAILY | 적용 ✅ |
| JOB_RESET_*_DAILY (DBMS_SCHEDULER) | ENABLED ✅ |
| PARTNER_MASTERS MFG 5건 시드 | 적용 ✅ |
| ITEM_MASTERS RAW_MATERIAL LOT_UNIT_QTY 백필 | 16건 ✅ |
| PURCHASE_ORDER_ITEMS LINE_NO/REV_NO/LINE_STATUS + PURCHASE_ORDERS USE_TYPE | 적용 (행 0건) ✅ |

### 백엔드 (commit `94029dc`, `1244932`)
- `NumberingService.nextMatSerial` / `nextArrivalNoV2` 신규 (PKG_SEQ_GENERATOR가 SEPARATOR를 양쪽에 적용해 PDF 형식 불가 → application-level 포맷으로 우회)
- `ArrivalService.receivePoLine` (PO 라인 → N 시리얼 발급), `listPoLines`
- `GET /material/arrivals/po-lines`, `POST /material/arrivals/po-line`
- 기존 `createPoArrival` / `ArrivalHistoryTable` `@deprecated` 처리

### 프론트
- `/material/arrival` PO 라인 메인 그리드로 재구조화, 4단계 행 배경, 잔량 RoyalBlue Bold, L/N/R/N
- 신규 컴포넌트: `PoLineGrid`, `PoLineReceiptModal`, `SerialIssueConfirmModal`, `MatLabelPreviewModal`, 공용 `MfgPartnerSelect`
- jsbarcode CODE128 라벨 미리보기 + `window.print`
- i18n ko/en/zh/vi 19개 신규 키, BOM 없음

## 사용자 액션 필요

- 끝. PO 시드 9 라인 + 공통코드 6건 + receivePoLine 단위 spec 5/5 PASS 까지 완료.
- 남은 건 dev 서버 띄우고 브라우저에서 한 사이클 돌려보는 시연용 검증뿐 (선택). 시나리오:
  1. `/material/arrival` 접속 → PO 라인 9건 그리드 표시 (4단계 행 색상 확인)
  2. PO-26-001 / L1 [자재입하] → 수량 200, 제조사 M001, 창고 선택 → 저장
  3. "4건의 시리얼을 발급합니다" → 확인 → 라벨 4건 + 바코드 표시 → 인쇄 다이얼로그
  4. oracle-db로 `SELECT MAT_UID, INIT_QTY, ARRIVAL_NO, MFG_PARTNER_CODE FROM MAT_LOTS WHERE ARRIVAL_NO LIKE 'R%' ORDER BY ARRIVAL_NO DESC FETCH FIRST 4 ROWS ONLY` 확인

## Phase B/C/D 후속 작업

- **Phase B**: IQC006 입하실적조회 (`/material/receive-history`), 시리얼 상세 그리드, 입하 취소, 자투리 정책
- **Phase C**: 라벨 백엔드/프린터 연동, 재인쇄 흐름
- **Phase D**: 자재 분할/병합 화면, parent/root 트리

## 마이그 sql 수정 사항 (T-010 작업 중 발견 — T-011에서도 동일 패턴 사용)

1. 컬럼명 `PLANT` → `PLANT_CD` (실제 스키마 컬럼).
2. PL/SQL 익명 블록의 `RETURN` 제거 → IF/ELSE 구조로 변경.
3. 헤더 코멘트를 BEGIN 안쪽 `/* ... */` 블록 코멘트로 이동. oracle_connector `--execute-file` 의 split regex (`^\s*(DECLARE|BEGIN)\b`) 가 SQL 시작 부분의 `-- ...` 줄 코멘트를 인식하지 못해 PL/SQL 블록의 trailing `;` 를 silent strip 하던 결함 우회.

## 향후 작업 후보

- oracle_connector `execute_file` 의 PL/SQL 시작 검출 regex 를 코멘트 skip 가능하게 보강 (스킬 자체 변경 — 별도 task).
- 다음 환경 deploy 시 `2026-05-26_create_log_sequences.sql` 의 IQC_TEMPLATES USER_TABLES 가드 효과 확인 (신규 환경).
- per-tenant T#### 채번 비즈니스 결정.

## Next AI Should

1. `AGENTS.md` + `.ai-coordination/*` 먼저 읽기.
2. broad edit / DB change / review handoff 시 `PROTOCOL.md` 확인.
3. 편집 전 `LOCKS.md` 에 task ID 기록.
4. DB 변경은 oracle-db 스킬로 직접 적용 후 post-check 결과를 JOURNAL 에 기록.
5. 종료 전 본 핸드오프 갱신.
