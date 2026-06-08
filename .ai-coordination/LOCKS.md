# LOCKS

Before editing, add a lock entry. Remove or mark it released when done.

## Active Locks

- T-MAT-RECV-FIXES (claude, 2026-06-07): 자재입고 프로세스 이슈 일괄 수정.
  완료(검증): #1 PO오류(http-exception.filter/purchase-order.dto/PoFormPanel), #2 배지(globals.css safelist), 작업지시 품목필터(part.dto/part.service/PartSearchModal/JobOrderFormPanel), IQC006 입하실적조회 전체(arrival.controller/service/dto, material/arrival-result/*, menuConfig, PartnerSelect/useMasterOptions, 2026-06-07_iqc006_arrival_result_seed.sql, locales 4).
  잔여(미착수): 라인→공정설비 지정.

## History

- T-MAT-CYCLE-E2E-QA (codex, 2026-06-08): PO-입하-IQC-입고-출고-재고 실데이터 헤드리스 브라우저 QA 완료. 구현 파일 수정 없음. 결함 5건 기록: IQC 성적서 업로드 UI 부재, 자재입고 warehouseCode/warehouseId 계약 불일치, 입고/입하 일자 UTC 표시, 수동출고 체크박스 시각 상태 불일치, 자재재고 검색 matUid 미포함.

- T-LOT-SPLIT-MERGE (claude, 2026-06-08): #4·5·6 자재분할/병합 재설계 구현·검증 완료. 분할=원본 폐기(SPLIT)→신규 2조각 발번(#4 currentQty 누락 해소), 병합=원 시리얼 폐기(MERGED)→통합 1개 발번(바코드 스캔). 입고완료 게이팅(RECEIVE+LOT_SPLIT_IN+LOT_MERGE_IN, 재가공 허용). 채번 NumberingService(nextMatSerial/STOCK_TX). 회귀수정: IQC006 카운트 origin 필터(분할/병합 파생 제외), MAT_LOT_STATUS 공통코드 SPLIT/MERGED 추가. tsc(백/프론트)·jest 16건·API 풀사이클·실DB 검증 통과, 테스트 데이터 원상복구. 파일: lot-split/lot-merge service+dto, lot-merge.controller, arrival.service, lot-split/lot-merge page.tsx, locales 4, 2026-06-08_mat_lot_status_split_merged.sql.

- T-AUDIT-COLUMN-DEFAULT-FIX (claude, 2026-06-04): 감사 컬럼(CREATED_AT/UPDATED_AT) NOT NULL & DEFAULT 누락 33개 테이블/64개 컬럼에 `DEFAULT SYSTIMESTAMP` 일괄 보정(`apps/backend/src/migrations/2026-06-04_fix_audit_column_defaults.sql`). `scripts/gen-live-schema.py`로 `create-hanes-schema.sql`을 실DB 실측 재생성(148 테이블). JSHANES 적용·검증 완료.

- T-BOM-LABEL-CLARIFY (codex, 2026-06-02): BOM 화면 컬럼 라벨을 `유형`→`품목유형`, `공정`→`투입공정`으로 명확화하고 i18n 4개 파일 반영 완료.

- T-ITEM-TYPE-COMCODE-UNIFY (codex, 2026-06-02): `ITEM_MASTERS.ITEM_TYPE` 공통코드 기준을 `ITEM_TYPE`으로 통일하고 JSHANES 컬럼 주석, `PART_TYPE` 활성 코드, 런타임 화면/Swagger/shared 상수, schema SQL/생성 스크립트/ERD 문서 정리 완료.

- T-BOM-PRODUCT-TYPE-SEMANTIC-FIX (codex, 2026-06-02): `PRODUCT_TYPE`을 `2011/2012/2013/2014` 단계 코드에서 `HARNESS/SUB_ASSY/WIRE/TERMINAL/...` 품목군 코드로 재정의하고 JSHANES 데이터, DTO 검증, 프론트 옵션, 재실행 SQL 정정 완료.

- T-BOM-PRODUCT-TYPE-CLEANUP (codex, 2026-06-02): JSHANES `ITEM_MASTERS.PRODUCT_TYPE`를 화면 제품유형 코드 `2011/2012/2013/2014`로 정렬하고 백엔드 DTO 검증 상수 추가 완료.

- T-BOM-PROD-SHEET-SEED (codex, 2026-06-02): `bom-from-production-sheet.html` 기준으로 JSHANES `40/1000`의 BOM/품목/공정/라우팅 기준정보를 삭제 후 재생성 완료. SQL: `tools/generated/bom-from-production-sheet-seed.sql`.

- T-MASTER-ALL-DB-KEY-AUDIT (codex, 2026-05-30): 기준정보 전체 DB 키/테이블명 정합성 정리 완료. `bom`, `label`, `iqc-item`, `part` IQC 설정, `vendor-barcode`, `work-instruction`, SQL 표시 테이블명 정리, 프론트 tsc 및 핵심 API 조회 통과.

- T-MASTER-DB-KEY-CLEANUP (codex, 2026-05-30): 기준정보 회사/사업장 화면의 임의 `id` 의존 제거. `COMPANY_MASTERS` 복합키 기준 호출로 정리, 프론트 tsc 통과.

- T-DB-TYPEORM-SCHEMA-AUDIT (codex, 2026-05-30): MYDBPDB/HNSMES 기준 TypeORM-vs-Oracle 스키마 비교 완료. 마이그레이션 적용, 엔티티 정렬, ERD/감사 문서 갱신, `compare_typeorm_oracle_schema.py` issues 0, 백엔드 tsc 통과.

- T-IQC-ARRIVAL-UNIT (claude, 2026-05-29): IQC 검사 단위를 개별 시리얼 전수검사 → 입하번호+품목 단위 샘플검사로 재설계. 백엔드 GET pending-arrivals / POST arrival 신설, cancel 입하단위 분기 보강, 프론트 목록·모달 전환, i18n 4파일. 백엔드·프론트 빌드 통과.

- T-SQL-QUERY-PROPS (claude, 2026-05-28): DataGrid sqlQuery prop 26개 페이지 일괄 추가 완료
