# LOCKS

Before editing, add a lock entry. Remove or mark it released when done.

## Active Locks

(없음)

## History

- T-MASTER-ALL-DB-KEY-AUDIT (codex, 2026-05-30): 기준정보 전체 DB 키/테이블명 정합성 정리 완료. `bom`, `label`, `iqc-item`, `part` IQC 설정, `vendor-barcode`, `work-instruction`, SQL 표시 테이블명 정리, 프론트 tsc 및 핵심 API 조회 통과.

- T-MASTER-DB-KEY-CLEANUP (codex, 2026-05-30): 기준정보 회사/사업장 화면의 임의 `id` 의존 제거. `COMPANY_MASTERS` 복합키 기준 호출로 정리, 프론트 tsc 통과.

- T-DB-TYPEORM-SCHEMA-AUDIT (codex, 2026-05-30): MYDBPDB/HNSMES 기준 TypeORM-vs-Oracle 스키마 비교 완료. 마이그레이션 적용, 엔티티 정렬, ERD/감사 문서 갱신, `compare_typeorm_oracle_schema.py` issues 0, 백엔드 tsc 통과.

- T-IQC-ARRIVAL-UNIT (claude, 2026-05-29): IQC 검사 단위를 개별 시리얼 전수검사 → 입하번호+품목 단위 샘플검사로 재설계. 백엔드 GET pending-arrivals / POST arrival 신설, cancel 입하단위 분기 보강, 프론트 목록·모달 전환, i18n 4파일. 백엔드·프론트 빌드 통과.

- T-SQL-QUERY-PROPS (claude, 2026-05-28): DataGrid sqlQuery prop 26개 페이지 일괄 추가 완료
