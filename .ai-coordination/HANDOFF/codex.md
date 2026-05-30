# codex Handoff

## Last Update

2026-05-30 11:10

## Completed

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
- `routing` self-inspect의 `id`는 DB 실제 PK라 유지했다. `RoutingGroupManager`, `QualityConditionEditor`, `work-calendar`, DataGrid 컬럼 `id`는 화면 로컬 식별자라 유지했다.
- 커밋은 사용자 요청이 있을 때만 수행한다.
