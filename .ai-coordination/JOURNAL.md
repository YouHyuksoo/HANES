# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

## 2026-05-30 11:10 codex

### T-MASTER-ALL-DB-KEY-AUDIT 완료

**대상:** `apps/frontend/src/app/(authenticated)/master` 기준정보 화면.

**변경 내용:**
- `bom` 화면의 화면용 `id` 의존을 `bomKey`로 바꾸고, DB 복합키 `parentItemCode::childItemCode::revision` 기준으로 수정/삭제 호출을 정리했다.
- `label` 화면의 대상/템플릿 선택키를 `itemKey`, `templateKey`로 분리하고, 실제 PK `templateName::category` 기준 호출로 정리했다.
- `iqc-item`/`part` IQC 설정 화면에서 DB 응답에 없는 `id` 매핑을 제거하고 `inspItemCode`, `groupCode`, `partnerCode` 기준으로 정리했다.
- `vendor-barcode`는 실제 PK `vendorBarcode`, `work-instruction`은 `itemCode::processCode::revision`, `company`는 `companyCode::plant` 기준으로 정리했다.
- 기준정보 DataGrid 표시 SQL의 테이블명을 실제 DB 테이블명으로 정정했다. 주요 정정 대상은 `COM_CODES`, `EQUIP_BOM_ITEMS`, `GAUGE_MASTERS`, `IQC_ITEM_POOL`, `PROCESS_MASTERS`, `PROCESS_EQUIPMENTS`, `VENDOR_BARCODE_MAPPINGS`, `WAREHOUSE_LOCATIONS`, `WAREHOUSE_TRANSFER_RULES`, `WORKER_MASTERS`, `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_INSPECT_ITEM_POOL`이다.

**검증:**
- `rg`로 기준정보 전체 `.id`, API `put/delete/patch`, `sqlQuery` 잔여 사용을 재스캔했다.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.
- 로컬 백엔드 `localhost:3003`에서 `/api/v1/master/companies`, `/api/v1/master/boms/parents`, `/api/v1/master/label-templates`, `/api/v1/master/iqc-item-pool`, `/api/v1/master/iqc-groups`, `/api/v1/master/vendor-barcode-mappings`, `/api/v1/master/work-instructions` 조회가 모두 HTTP 200이다.

**남은 정상 예외:**
- `routing`의 self-inspect 항목은 DB `SELF_INSPECT_ITEMS.ID` 실제 PK가 있어 `row.id` 사용을 유지했다.
- `RoutingGroupManager`, `QualityConditionEditor`, `work-calendar`, `DataGrid` 컬럼 `id`는 화면 로컬 트리/행/컬럼 식별자라 DB 키 잔여물로 보지 않았다.

## 2026-05-30 10:52 codex

### T-MASTER-DB-KEY-CLEANUP 완료

**대상:** 기준정보 회사/사업장 화면.

**변경 내용:**
- `Company`, `Plant` 프론트 타입에서 DB 응답에 없는 임의 `id` 필드 의존을 제거했다.
- 회사 수정/삭제 호출은 `COMPANY_MASTERS` 복합키 기준 `companyCode::plant`를 사용하도록 변경했다.
- 사업장 행 key는 `PLANTS` 복합키 형태로 생성하고, 사업장 삭제 호출은 현재 컨트롤러가 받는 `plantCode`를 사용하도록 변경했다.
- 회사 DataGrid 표시용 SQL 테이블명을 `COMPANIES`에서 실제 기준 테이블 `COMPANY_MASTERS`로 정정했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check -- 'apps/frontend/src/app/(authenticated)/master/company/types.ts' 'apps/frontend/src/app/(authenticated)/master/company/page.tsx' 'apps/frontend/src/app/(authenticated)/master/company/components/CompanyForm.tsx'` 통과.

**남은 위험:**
- 기준정보 전체 화면의 `id` 사용은 아직 전수 정리하지 않았다. 이번 작업은 사용자가 지적한 회사/사업장 잔여물 우선 정리다.

## 2026-05-30 10:11 codex

### T-DB-TYPEORM-SCHEMA-AUDIT 완료

**대상:** `MYDBPDB` / `HNSMES`.

**최종 결과:**
- TypeORM 엔티티 147개와 DB 테이블 147개 비교 완료.
- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB` 결과 `issues=0`.
- type mismatch, PK mismatch, nullable mismatch 모두 해소.

**추가 적용:**
- `2026-05-30_semantic_type_alignment_mydbpdb.sql`
- `2026-05-30_typeorm_not_null_safe_mydbpdb.sql`
- `2026-05-30_remaining_not_null_data_fix_mydbpdb.sql`
- `2026-05-30_tenant_not_null_remaining_mydbpdb.sql`
- 테넌트 컬럼 엔티티 nullable 메타데이터를 DB `NOT NULL`과 맞춤.
- Oracle 빈 문자열은 NULL로 저장되는 점을 반영해 `MAT_ARRIVALS.INVOICE_NO`, `MAT_LOTS.INVOICE_NO`, `SEQ_RULES.SEPARATOR` 엔티티는 nullable로 정렬.

**검증:**
- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB` 통과, issues 0.
- `python tools/generate_db_schema_doc.py` 통과, `docs/reports/db-schema-erd.md` 갱신.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.

## 2026-05-30 09:56 codex

### T-DB-TYPEORM-SCHEMA-AUDIT 진행 기록

**대상:** `MYDBPDB` / `HNSMES`.

**변경 내용:**
1. TypeORM 런타임 메타데이터 추출 도구 `tools/export_typeorm_metadata.js` 추가.
2. Oracle `USER_*` 스키마 비교 도구 `tools/compare_typeorm_oracle_schema.py` 추가.
3. PK 불일치 보정 마이그레이션 적용: `2026-05-30_typeorm_pk_alignment_mydbpdb.sql`.
4. 안전한 `VARCHAR2` 확장 123건 적용: `2026-05-30_typeorm_varchar_widen_mydbpdb.sql`.
5. 숫자 scale 확장 4건 적용: `2026-05-30_typeorm_number_scale_mydbpdb.sql`.
6. 빈 `REWORK_*` 테이블의 문자열 타입 정렬 적용: `2026-05-30_rework_type_alignment_mydbpdb.sql`.
7. tenant-first 복합 PK 엔티티 선언 순서와 `REPAIR_USED_PARTS.ITEM_CODE` PK 정렬.
8. `tools/generate_db_schema_doc.py` 기본 사이트를 `MYDBPDB`로 바꾸고 `docs/reports/db-schema-erd.md` 재생성.
9. 감사 보고서 `docs/reports/typeorm-oracle-schema-audit-2026-05-30.md` 작성.

**검증:**
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB` 결과: entities 147, DB tables 147, ERROR 0, WARN 632.
- `python tools/generate_db_schema_doc.py` 결과: tables 148, columns 2393, fk 12, inferred 186.

**남은 작업:**
- `nullable_mismatch` 621건은 DB NOT NULL/엔티티 nullable 의미를 서비스 단위로 검토해야 한다.
- `type_mismatch` 11건은 기존 데이터가 있는 품질/PM/SPC/trace 테이블의 자연키 문자열 vs 숫자/RAW 의미 차이라 무작정 DB 변경 금지.

## 2026-05-27 16:10 claude

### 입하 플로우 E2E 검증 완료 (IQC005 ERP 3-key 대응)

**변경 내용:**
1. `PurchaseOrderItem.lineNo` NOT NULL / `revNo` DEFAULT 1 — DB 마이그레이션 완료 (JSHANES)
2. `PoLineReceiptDto`: `poSeq` → `lineNo + revNo` (ERP L/N, R/N 대응)
3. `arrival.service.receivePoLine`: PO 라인 조회를 `lineNo + revNo` 비즈니스 키 기준으로 변경
4. `arrival.service.receivePoLine`: 품목 마스터 미등록 시 단일 LOT fallback (404 에러 제거)
5. `api.ts`: `suppressErrorModal` 옵션 추가 — LOT_UNIT_QTY 조회 404 모달 억제
6. `arrival/page.tsx`: 필터 툴바 인라인 이동, + 수동입하 버튼 primary(pink) 변경

**검증 결과 (2026-05-27 브라우저 테스트):**
- PO 5000000022 조회 → 90건, L/N + R/N 컬럼 표시 ✅
- L1/R1 클릭 → 입하 모달 `5000000022 / L1 / R1` 정상 ✅
- LOT_UNIT_QTY 404 에러 모달 없음 ✅
- 입하 100개, 제조사 M001 → 저장 → 시리얼 발급 확인 모달 ✅
- 시리얼 `VH1-RM260527-00001` 채번, 라벨 미리보기 ✅
- 잔량 35,380 → 35,280 실시간 반영 ✅
