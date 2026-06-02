# ARCHIVE

Completed tasks are compacted here to save context. Keep each item to one line.

Format:

```md
- T-000 | YYYY-MM-DD | owner | short result | evidence: JOURNAL heading or commit
```

## Completed

- T-BOM-PRODUCT-TYPE-SEMANTIC-FIX | 2026-06-02 | codex | `PRODUCT_TYPE`을 품목군 코드로 재정의해 `ITEM_TYPE`과 의미 중복 제거, JSHANES 데이터/DTO/프론트 옵션/시드 SQL 정정 | evidence: JOURNAL 2026-06-02 12:52 codex
- T-BOM-PRODUCT-TYPE-CLEANUP | 2026-06-02 | codex | `ITEM_TYPE`은 수불/생산 분류, `PRODUCT_TYPE`은 화면 제품유형 코드로 분리되도록 JSHANES 데이터와 DTO 검증 정렬 | evidence: JOURNAL 2026-06-02 12:35 codex
- T-BOM-PROD-SHEET-SEED | 2026-06-02 | codex | JSHANES `40/1000` BOM/품목/공정/라우팅 기준정보를 기존 데이터 삭제 후 `bom-from-production-sheet.html` 기준으로 재생성 | evidence: JOURNAL 2026-06-02 12:12 codex
- T-MASTER-ALL-DB-KEY-AUDIT | 2026-05-30 | codex | 기준정보 전체의 DB 키 기준 정리 완료, 임의 id 잔여 제거와 실제 DB 테이블명 표시 정정, 프론트 tsc 및 핵심 API 조회 통과 | evidence: JOURNAL 2026-05-30 11:10 codex
- T-MASTER-DB-KEY-CLEANUP | 2026-05-30 | codex | 기준정보 회사/사업장 화면에서 DB 응답에 없는 임의 id 의존 제거, 회사 복합키 `companyCode::plant` 기준 수정/삭제 호출로 정리 | evidence: JOURNAL 2026-05-30 10:52 codex
- T-DB-TYPEORM-SCHEMA-AUDIT | 2026-05-30 | codex | MYDBPDB/HNSMES 기준 TypeORM 엔티티 147개와 DB 테이블 147개 비교 완료, 모든 mismatch 0건으로 정리 및 ERD/감사 문서 갱신 | evidence: JOURNAL 2026-05-30 10:11 codex
- T-IQC-ARRIVAL-UNIT | 2026-05-29 | claude | IQC를 개별 시리얼 전수검사 → 입하번호+품목 단위 샘플검사로 재설계 (백엔드 pending-arrivals/arrival 엔드포인트 + 일괄판정/취소, 프론트 목록·모달, i18n 4파일) | evidence: 백엔드·프론트 빌드 통과
