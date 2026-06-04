# claude Handoff

## Last Update

2026-06-04

## Completed

- **감사 컬럼 DEFAULT 누락 systemic 수정 (T-AUDIT-COLUMN-DEFAULT-FIX)**: `POST /master/parts` ORA-01400 해결
  - 근본원인: TypeORM 0.3.28 Oracle 드라이버는 `@CreateDateColumn`/`@UpdateDateColumn`을 JS에서 안 채우고 DB 컬럼 `DEFAULT`에 의존(`SubjectExecutor`의 `new Date()`는 mongodb 전용 분기). DB DEFAULT 없으면 `DEFAULT`→NULL→NOT NULL 위반.
  - 실측 범위: NOT NULL & DEFAULT 없는 감사 컬럼 33개 테이블/64개 컬럼
  - `apps/backend/src/migrations/2026-06-04_fix_audit_column_defaults.sql`(멱등) JSHANES·HNSMES(MYDBPDB) 적용, 재스캔 0건·INSERT 검증 완료 (환경 2개가 전부)
  - `scripts/gen-live-schema.py` 신규 + `create-hanes-schema.sql` 실DB 실측 재생성(148 테이블) — 기존은 구 PART_MASTERS 구조로 stale
  - 원칙 메모: DB 스키마는 문서 참조 말고 항상 실측

- **DataGrid sqlQuery prop 일괄 추가 (T-SQL-QUERY-PROPS)**: 전체 24개 페이지/컴포넌트 완료
  - material/*: stock, lot, lot-merge, lot-split, hold, iqc-history, scrap, shelf-life, physical-inv, physical-inv-history, receipt-cancel, arrival-stock (12개)
  - master/*: part, partner, worker, warehouse(WarehouseList), gauge, company (6개)
  - production/*: order, progress, result, result-summary (4개)
  - quality/*: inspect, oqc, oqc-history (3개)
  - inventory/*: material-stock, stock, transaction (3개)
  - 기존 완료 파일(po, po-status) 포함 총 26개
  - TypeScript noEmit 에러 0건 확인

- **IQC005 ERP 3-key 입하 플로우**: PO/PO Line/Release Number 개념 반영 완료
  - `PurchaseOrderItem.lineNo` NOT NULL, `revNo` DEFAULT 1 마이그레이션 완료
  - `PoLineReceiptDto` + `receivePoLine` 서비스: `poSeq` → `lineNo + revNo` 대응
  - 품목 마스터 미등록(ERP 인터페이스 전) → 단일 LOT fallback 처리
  - `suppressErrorModal` 패턴: LOT_UNIT_QTY 조회 404 모달 억제
  - UI: 필터 툴바 인라인, + 수동입하 버튼 primary(pink)
  - E2E 검증: PO 5000000022, L1/R1, LDWX00017NA, 100EA → 시리얼 VH1-RM260527-00001 ✅

## Next

- **ERD 문서 갱신**: `python tools/generate_db_schema_doc.py` 실행 필요 (PO_ITEMS 스키마 변경)
- **T-011 Phase B**: IQC006 입하 이력 조회, 시리얼 상세 그리드, 입하 취소 기능
- **T-011 Phase C**: 라벨 프린터 백엔드/인쇄 통합
- **T-015**: ERP PO Interface Procedure (IF_PO) — 품목 마스터 인터페이스 포함
- **notifications unread-count 500 에러**: 가끔 500 반환, 조사 필요
