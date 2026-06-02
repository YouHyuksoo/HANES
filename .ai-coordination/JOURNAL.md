# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

## 2026-06-02 12:52 codex

### T-BOM-PRODUCT-TYPE-SEMANTIC-FIX 완료

**원인:**
- 직전 정정에서 `PRODUCT_TYPE`을 `2011=하네스`, `2012=반제품`, `2013=원자재`, `2014=부자재`로 바꿨으나, 이는 `ITEM_TYPE`의 `FINISHED/SEMI_PRODUCT/RAW_MATERIAL`와 의미가 겹쳤다.
- 기존 HANES seed/IQC 로직은 `PRODUCT_TYPE`을 `HARNESS`, `SUB_ASSY`, `WIRE`, `TERMINAL`, `CONNECTOR`, `SEAL`, `TAPE`, `TUBE` 같은 품목군으로 사용하고 있었다.

**정의:**
- `ITEM_TYPE`: 재고/생산 흐름 분류. `FINISHED`, `SEMI_PRODUCT`, `RAW_MATERIAL`, `CONSUMABLE`.
- `PRODUCT_TYPE`: 품목군/물성 분류. `HARNESS`, `MODEL`, `SUB_ASSY`, `WIRE`, `TERMINAL`, `CONNECTOR`, `HOLDER`, `SEAL`, `SHIELD`, `TAPE`, `TUBE`, `HOUSING`, `LABEL`, `CLIP`, `ELECTRIC`, `GROMMET`.

**조치:**
- JSHANES `40/1000` `ITEM_MASTERS.PRODUCT_TYPE` 18건을 품목군 코드로 정정했다.
- `tools/generated/bom-from-production-sheet-seed.sql` 재실행 기준도 같은 값으로 수정했다.
- `packages/shared/src/constants/com-code-values.ts`의 `PRODUCT_TYPE_VALUES`를 품목군 코드로 수정했다.
- `apps/frontend/src/app/(authenticated)/master/part/types.ts`의 `PRODUCT_TYPE_OPTIONS`를 품목군 라벨로 수정했다.
- `apps/backend/src/modules/master/dto/part.dto.ts`의 Swagger 예시를 `HARNESS`로 수정했다.

**검증:**
- JSHANES 분포: `FINISHED/HARNESS=1`, `FINISHED/MODEL=1`, `SEMI_PRODUCT/SUB_ASSY=2`, `RAW_MATERIAL`은 `WIRE/TERMINAL/CONNECTOR/HOLDER/SEAL/SHIELD/TAPE/TUBE/HOUSING`으로 분산.
- invalid count query 결과: `0`.
- `pnpm --filter @harness/shared build` 통과.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.

## 2026-06-02 12:35 codex

### T-BOM-PRODUCT-TYPE-CLEANUP 완료

**확인 결과:**
- `ITEM_TYPE`은 코드 상수 기준 `RAW_MATERIAL`, `SEMI_PRODUCT`, `FINISHED`, `CONSUMABLE`이며 수불/생산 흐름 분류로 쓰인다.
- `PRODUCT_TYPE`은 품목 화면의 제품유형 코드이며 현재 옵션은 `2011=하네스`, `2012=반제품`, `2013=원자재`, `2014=부자재`, `7011=김산K`이다.
- 최초 HTML 시드에서 `PRODUCT_TYPE`에 `RAW_MATERIAL`, `PURCHASED_PART`, `MODEL`, `CIRCUIT` 같은 설명성 값을 넣어 화면 코드 체계와 맞지 않았다.

**조치:**
- JSHANES `40/1000` `ITEM_MASTERS.PRODUCT_TYPE` 18건을 화면 코드 체계로 정정했다.
  - `FINISHED` 품목 `HNS001`, `HNS01`: `2011`
  - `SEMI_PRODUCT` 품목 `HNS01-C1`, `HNS01-C2`: `2012`
  - 원자재성 `RAW_MATERIAL` 품목 `CBL-A`, `CBL-B`, `TUB-A`, `TP0001`: `2013`
  - 구매/부자재성 `RAW_MATERIAL` 품목 10건: `2014`
- 재실행용 SQL `tools/generated/bom-from-production-sheet-seed.sql`도 같은 코드값으로 수정했다.
- `packages/shared/src/constants/com-code-values.ts`에 `PRODUCT_TYPE_VALUES`를 추가했다.
- `apps/backend/src/modules/master/dto/part.dto.ts`에서 `productType`을 `PRODUCT_TYPE_VALUES`로 검증하도록 추가했다.

**검증:**
- `python C:\Users\hsyou\.codex\skills\oracle-db\scripts\oracle_connector.py --site JSHANES --query "... GROUP BY item_type, product_type ..."` 결과: `FINISHED/2011=2`, `SEMI_PRODUCT/2012=2`, `RAW_MATERIAL/2013=4`, `RAW_MATERIAL/2014=10`.
- invalid count query 결과: `0`.
- `pnpm --filter @harness/shared build` 통과.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.

## 2026-06-02 12:12 codex

### T-BOM-PROD-SHEET-SEED 완료

**대상:** `JSHANES` / `40` / `1000`.

**원천 파일:**
- `C:\Users\hsyou\Desktop\bom-from-production-sheet.html`

**실행 파일:**
- `tools/generated/bom-from-production-sheet-seed.sql`

**처리 내용:**
- 기존 `PROCESS_QUALITY_CONDITIONS`, `ROUTING_MATERIALS`, `ROUTING_PROCESSES`, `ROUTING_GROUPS`, `BOM_MASTERS`, `PROD_PLANS`, `PROCESS_MASTERS`, `ITEM_MASTERS`의 `40/1000` 데이터를 삭제했다.
- HTML 기준으로 품목 18건, BOM 16건, 공정 16건, 라우팅 그룹 3건, 라우팅 공정 18건, 라우팅 자재 17건을 생성했다.
- `HNS001`은 HTML 설명대로 `HNS01`의 판매/모델 관리 코드로 품목마스터에만 등록하고 BOM 레벨에는 넣지 않았다.
- `TP0001`은 `BOM_MASTERS` PK가 `PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION`이라 동일 부모/자식 2행을 둘 수 없어 BOM에는 800MM로 합산하고, `ROUTING_MATERIALS`에는 `TAPPN` 500MM + `MASSY` 300MM로 분리했다.
- HTML의 `구매품`은 코드 상수에 별도 `PURCHASED` 타입이 없어 `ITEM_TYPE=RAW_MATERIAL`, `PRODUCT_TYPE=PURCHASED_PART`로 기록했다.

**검증:**
- 실행 명령: `python C:\Users\hsyou\.codex\skills\oracle-db\scripts\oracle_connector.py --site JSHANES --execute-file tools\generated\bom-from-production-sheet-seed.sql`
- 실행 결과: `success=true`, `blocks_executed=1`.
- 후속 건수: `ITEM_MASTERS=18`, `BOM_MASTERS=16`, `PROCESS_MASTERS=16`, `ROUTING_GROUPS=3`, `ROUTING_PROCESSES=18`, `ROUTING_MATERIALS=17`.
- 무결성 확인: BOM 부모 누락 0, BOM 자식 누락 0, 라우팅 품목 누락 0, 라우팅 자재 누락 0.

**남은 위험:**
- 기존 `40/1000` 품목마스터 21,561건과 BOM/라우팅 기준정보는 사용자 요청대로 삭제했다. 운영성 주문/재고성 테이블까지 전체 정리한 것은 아니다.

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
