# codex Handoff

## Last Update

2026-06-08 11:08

## Latest

- `T-MAT-CYCLE-E2E-QA` 완료. 테스트 데이터는 `PO-260608-013`, `R26060800001`, `VH1-RM260608-00004`, `RCV20260608-0001`, `ISS20260608-0001`.
- 헤드리스 브라우저와 JSHANES DB/API로 PO 등록, 입하, IQC PASS, 성적서 업로드, 입고, 출고, 재고 0/LOT DEPLETED까지 확인했다.
- 화면 입고 버튼은 실패한다. 원인: 프론트 `warehouseCode` 전송, 백엔드 DTO는 `warehouseId` 요구. 실제 오류: `items.0.property warehouseCode should not exist`, `items.0.warehouseId must be a string`.
- IQC 성적서 업로드는 API만 있고 화면 버튼이 없어 성적서 필수 품목은 UI 단독으로 입고 단계까지 못 간다.
- 추가 UI 결함: 입하/IQC 날짜 UTC 표시, 수동출고 체크박스 시각 상태 불일치, 자재재고 검색 `matUid` 미포함.
- 구현 파일은 수정하지 않았다. Claude의 `T-MAT-RECV-FIXES` 잠금 영역과 충돌하지 않게 QA 기록만 남겼다.

## Completed

- BOM 화면 컬럼 라벨을 `유형`에서 `품목유형`, `공정`에서 `투입공정`으로 명확화했다.
- `ko/en/vi/zh` locale에 반영했고 프론트 `tsc --noEmit` 통과했다.
- `ITEM_MASTERS.ITEM_TYPE` 품목유형 기준을 `ITEM_TYPE` 공통코드로 통일했다.
- JSHANES 컬럼 주석은 `공통코드:ITEM_TYPE`, `COM_CODES.PART_TYPE` 활성 행은 `N`으로 정리했다.
- 런타임 화면/Swagger/shared 상수와 schema SQL/생성 스크립트/ERD 문서의 품목유형 `PART_TYPE` 혼용을 정리했다.
- 검증: focused Jest, backend build, frontend `tsc --noEmit`, JSHANES migration execute-file, Oracle post-query 통과.
- `PRODUCT_TYPE`을 `2011/2012/2013/2014` 단계 코드에서 `HARNESS/SUB_ASSY/WIRE/TERMINAL/...` 품목군 코드로 재정의했다.
- 현재 기준: `ITEM_TYPE`은 재고/생산 흐름 분류, `PRODUCT_TYPE`은 품목군/물성 분류다.
- JSHANES `40/1000` 품목 18건, 재실행 SQL, 공유 상수, 프론트 옵션, 백엔드 DTO 예시를 모두 같은 기준으로 정정했다.
- `ITEM_TYPE`/`PRODUCT_TYPE` 구분을 검증하고 정정했다. `ITEM_TYPE`은 수불/생산 분류, `PRODUCT_TYPE`은 품목 화면 제품유형 코드로 분리한다.
- JSHANES `40/1000`의 `PRODUCT_TYPE`은 `2011=하네스`, `2012=반제품`, `2013=원자재`, `2014=부자재`로 정렬됐다.
- `PRODUCT_TYPE_VALUES` 공용 상수를 추가하고, 품목 DTO에서 `productType`을 해당 값으로 검증하도록 했다.
- `C:\Users\hsyou\Desktop\bom-from-production-sheet.html` 기준으로 JSHANES `40/1000`의 BOM/품목/공정/라우팅 기준정보를 재생성했다.
- 실행 SQL은 `tools/generated/bom-from-production-sheet-seed.sql`이다.
- 최종 건수는 `ITEM_MASTERS=18`, `BOM_MASTERS=16`, `PROCESS_MASTERS=16`, `ROUTING_GROUPS=3`, `ROUTING_PROCESSES=18`, `ROUTING_MATERIALS=17`이다.
- `TP0001`은 BOM PK 제약 때문에 `BOM_MASTERS`에는 800MM 합산, `ROUTING_MATERIALS`에는 500MM/300MM 분리로 반영했다.
- 기준정보 전체에서 DB 응답에 없는 임의 `id` 잔여를 정리했다.
- `bom`, `label`, `iqc-item`, `part` IQC 설정, `vendor-barcode`, `work-instruction`, `company`는 실제 DB PK 또는 복합키 기준으로 수정/삭제/선택키를 맞췄다.
- 기준정보 DataGrid 표시 SQL 테이블명을 실제 DB 테이블명으로 정정했다.
- 프론트 타입체크, diff 공백 검사, 핵심 기준정보 API 조회 7건이 통과했다.
- 기준정보 회사/사업장 화면에서 DB 응답에 없는 임의 `id` 의존을 제거했다.
- 회사 수정/삭제 호출은 `COMPANY_MASTERS` 복합키인 `companyCode::plant` 기준으로 정리했다.
- 회사 DataGrid 표시용 SQL 테이블명을 실제 테이블 `COMPANY_MASTERS`로 정정했다.
- `MYDBPDB` / `HNSMES` 기준 TypeORM-vs-Oracle 비교 도구를 추가했다.
- PK/type/nullable mismatch를 모두 정리했고 최종 비교 결과는 issues 0이다.
- 적용한 마이그레이션과 엔티티 수정 내역은 `docs/reports/typeorm-oracle-schema-audit-2026-05-30.md`와 `JOURNAL.md`에 기록했다.
- `docs/reports/db-schema-erd.md`를 `MYDBPDB/HNSMES` 기준으로 갱신했다.

## Next

- active lock은 없다.
- 이번 기준정보 재생성은 운영성 주문/재고성 테이블 전체 삭제가 아니라 BOM/품목/공정/라우팅 중심 삭제/재생성이다.
- `routing` self-inspect의 `id`는 DB 실제 PK라 유지했다. `RoutingGroupManager`, `QualityConditionEditor`, `work-calendar`, DataGrid 컬럼 `id`는 화면 로컬 식별자라 유지했다.
- 커밋은 사용자 요청이 있을 때만 수행한다.
