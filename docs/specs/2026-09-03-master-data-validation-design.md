# 기준정보검증(Master Data Validation) 설계

- 작성일: 2026-09-03
- 작업 ID: T-MASTER-VALIDATION
- 상태: 승인 대기

## 1. 목적

기준정보(마스터) 데이터 간의 언매칭·잠재 오류를 전수 검사해 한 화면에서 보여준다.
운영 중 쌓인 dangling 참조, 비활성 마스터 참조, 마스터 자체 품질 오류, 운영 데이터의 역참조 오류를 조기에 찾아 해당 마스터 화면으로 이동해 수정할 수 있게 한다.

## 2. 확정된 요구사항 (사용자 인터뷰 결과)

| 항목 | 결정 |
|---|---|
| 검증 유형 | 4종 모두: 참조 무결성 / 비활성·삭제 참조 / 마스터 자체 데이터 품질 / 운영 데이터 역참조 |
| 실행 방식 | 온디맨드 즉시 실행 (결과를 DB에 저장하지 않음, 이력 관리 없음) |
| 결과 처리 | 조회 + 해당 마스터 화면 이동 링크 (인라인 수정 없음) |
| 규칙 확장성 | 검증 규칙은 계속 추가된다 — 도메인별 TS 파일에 규칙 1건 append로 확장 |

## 3. 메뉴 등록

- 메뉴 코드: `MST_VALIDATION`, 경로: `/master/validation`, 기준정보(MASTER) 카테고리 하위, `MST_PROCESS_CAPA` 다음 순서
- 변경 파일:
  - `apps/frontend/src/config/menuConfig.ts` — MASTER children에 항목 추가
  - `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts` — 유효 메뉴 코드 목록에 `MST_VALIDATION` 추가
  - `apps/backend/src/migrations/2026-09-03_master_validation_menu_seed.sql` — `MENU_CATEGORY_ITEMS` MERGE + `ROLE_MENU_PERMISSIONS` 부여 (기존 메뉴 seed 패턴 준수, `/` 구분자 포함)
- AGENTS.md 규칙에 따라 `oracle-db` connector로 `JSHANES`에 적용하고 pre-check/post-check 결과를 남긴다.

## 4. 아키텍처

백엔드 규칙 카탈로그 + 단일 검증 API + 프론트 결과 화면.

```
[프론트 /master/validation]
  POST /master/validation/run
    → MasterValidationService
      → rules/*.rules.ts (도메인별 규칙 파일, 순수 선언)
      → 규칙별 raw SQL 실행 (DataSource.query, tenant 바인드)
      → 규칙별 { count, rows[≤200] } 집계
    ← 응답: { runAt, durationMs, results[] }
```

### 4.1 규칙 카탈로그 (확장 구조)

`apps/backend/src/modules/master/validation/` 신규 디렉터리:

```
validation/
  master-validation.controller.ts   # master.module.ts에 직접 등록 (별도 module 파일 없음 — 구조 단순화)
  master-validation.service.ts
  rules/
    validation-rule.types.ts      # ValidationRule 인터페이스
    index.ts                      # 도메인 규칙 집계 (ALL_RULES)
    bom.rules.ts                  # BOM/라우팅 도메인 규칙
    item.rules.ts                 # 품목/공정/설비/거래처 등
    quality-master.rules.ts       # IQC/설비점검 항목 도메인
    warehouse.rules.ts            # 창고/캘린더 도메인
    biz-reverse.rules.ts          # 운영 데이터 역참조
  master-validation.rules.spec.ts # 카탈로그 무결성 테스트
```

규칙 추가 = 해당 도메인 파일에 `ValidationRule` 1건 append. 새 도메인이면 파일 1개 추가 + `index.ts` import 1줄.

### 4.2 ValidationRule 인터페이스

```ts
export type RuleCategory = 'REF_INTEGRITY' | 'INACTIVE_REF' | 'DATA_QUALITY' | 'BIZ_REVERSE_REF';
export type RuleSeverity = 'ERROR' | 'WARN';

export interface ValidationRule {
  id: string;              // 'REF-BOM-001' 등 {CATEGORY}-{DOMAIN}-{NNN}, 전역 유일
  category: RuleCategory;
  severity: RuleSeverity;
  title: string;           // 한글 규칙명
  description: string;     // 무엇이 문제이고 어떻게 고치는지
  targetPath: string;      // 결과 행에서 이동할 마스터 화면 경로 ('/master/bom' 등)
  tenantScoped?: boolean;  // 기본 true. false면 :company/:plantCd 바인드 생략 (LABEL_TEMPLATES 등 비테넌트 테이블용, v1 규칙에는 미사용 — 향후 확장 예약)
  sql: string;             // SELECT ... FROM ... (오류 행만 반환), tenantScoped 시 :company/:plantCd 바인드 필수
}
```

**SQL 작성 컨벤션**: 규칙 SQL의 SELECT 첫 번째 컬럼은 대표 키이며 반드시 `REF_KEY`로 alias한다 (예: `SELECT b.CHILD_ITEM_CODE AS REF_KEY, ...`). 프론트의 복사 버튼은 `REF_KEY` 값을 복사하고, 나머지 컬럼은 상세 표시용이다.

### 4.3 실행 서비스

- `DataSource.query(sql, [company, plantCd])`로 규칙별 실행 (repo 표준: TypeORM raw SQL, CLI 미사용)
- 각 규칙은 `try/catch`로 격리 — 한 규칙 실패가 전체 실행을 중단시키지 않고 `error` 상태로 기록
- 행 상한: 규칙당 최대 200행 반환 + `totalCount` 별도 집계 (`COUNT(*)` 서브쿼리 래핑)
- 테넌트 스코프: `@Company() @Plant()` 데코레이터(part.controller 패턴)로 추출, SQL 바인드 `:company/:plantCd`에 주입. 테넌트 컬럼이 없는 테이블(LABEL_TEMPLATES, MOLD_MASTERS 등) 규칙은 인터페이스에 `tenantScoped: false`를 명시해 바인드 생략
- 카테고리 필터 파라미터 지원: `POST /master/validation/run { categories?: RuleCategory[] }`

### 4.4 응답 형태

```ts
{
  runAt: string; durationMs: number;
  summary: { totalRules: number; failedRules: number; errorCount: number; warnCount: number };
  results: Array<{
    rule: ValidationRule 메타(id/category/severity/title/description/targetPath);
    status: 'OK' | 'VIOLATION' | 'ERROR';
    totalCount: number;        // 위반 총건수
    rows: Record<string, unknown>[]; // 최대 200건
    errorMessage?: string;     // status='ERROR'일 때
  }>;
}
```

## 5. 검증 규칙 v1 범위

구현 시 각 SQL의 컬럼명은 `docs/database/schema-erd.md`(verifiedCommit 기준)와 실제 DB를 대조해 확정한다. 아래는 규칙 축이다.

### 5.1 REF_INTEGRITY (참조 무결성) — ERROR

| 규칙 | 내용 | 이동 화면 |
|---|---|---|
| BOM 모품목 | `BOM_MASTERS.PARENT_ITEM_CODE` ∉ `ITEM_MASTERS` | /master/bom |
| BOM 자품목 | `BOM_MASTERS.CHILD_ITEM_CODE` ∉ `ITEM_MASTERS` | /master/bom |
| 라우팅 그룹 품목 | `ROUTING_GROUPS.ITEM_CODE` ∉ `ITEM_MASTERS` | /master/routing |
| 라우팅 공정 | `ROUTING_PROCESSES.PROCESS_CODE` ∉ `PROCESS_MASTERS` | /master/routing |
| 라우팅 투입자재 | `ROUTING_MATERIALS.CHILD_ITEM_CODE` ∉ `ITEM_MASTERS` | /master/routing |
| 라우팅 고아 상세 | `ROUTING_PROCESSES.ROUTING_CODE` ∉ `ROUTING_GROUPS` | /master/routing |
| 공정-설비 매핑 | `PROCESS_EQUIPMENTS`의 PROCESS_CODE ∉ PROCESS_MASTERS 또는 EQUIP_CODE ∉ EQUIP_MASTERS | /master/process |
| 공정 CAPA | `PROCESS_CAPAS`의 PROCESS_CODE/ITEM_CODE 미존재 | /master/process-capa |
| IQC 품목 기준 | `IQC_PART_SPECS.ITEM_CODE` ∉ ITEM_MASTERS, 세부 항목의 검사항목 ∉ `IQC_ITEM_POOL` | /master/iqc-part-spec |
| 설비 점검항목 | `EQUIP_INSPECT_ITEM_POOL`의 EQUIP_CODE/ITEM_CODE ∉ 마스터 | /master/equip-inspect-item |
| 벤더 바코드 | `VENDOR_BARCODE_MAPPINGS`의 VENDOR_CODE/ITEM_CODE 미존재 | /master/vendor-barcode |
| 창고 로케이션 | `WAREHOUSE_LOCATIONS.WAREHOUSE_CODE` ∉ `WAREHOUSES` | /master/warehouse |
| 소모품 사용 정의 | `CONSUMABLE_USAGE_MAP`의 품목/설비/소모품 미존재 | /master/equip |

### 5.2 INACTIVE_REF (비활성 참조) — WARN

- BOM이 `USE_YN='N'`인 품목을 참조
- 라우팅이 `USE_YN='N'`인 공정/품목을 참조
- 공정-설비 매핑이 `USE_YN='N'`인 설비를 참조
- IQC 품목 기준이 `USE_YN='N'`인 품목/검사항목을 참조
- 벤더 바코드 매핑이 `USE_YN='N'`인 벤더를 참조

### 5.3 DATA_QUALITY (마스터 자체 품질) — ERROR/WARN

- BOM 수량(`QTY`) NULL 또는 ≤ 0 (ERROR)
- BOM 유효기간 역전 `VALID_FROM > VALID_TO` (ERROR)
- `ITEM_MASTERS` 필수값 누락: ITEM_NAME NULL/공백 (ERROR), ITEM_TYPE이 공통코드 그룹 밖 값 (WARN) — 별도 규칙 2건으로 분리
- 공정 CAPA 생산능력 0/NULL (WARN)
- `COM_CODES` 그룹 내 비활성 코드를 마스터 코드성 컬럼이 참조 (WARN)
- 라우팅 그룹에 공정 순서(`ROUTING_PROCESSES`)가 0건 (WARN)

### 5.4 BIZ_REVERSE_REF (운영 데이터 역참조) — ERROR

- `MAT_ARRIVAL_STOCKS.ITEM_CODE` ∉ ITEM_MASTERS
- `MAT_LOTS`의 품목/벤더 코드 ∉ 마스터
- `JOB_ORDERS`의 ITEM_CODE/ROUTING_CODE ∉ 마스터
- 재고/수불 테이블의 WAREHOUSE_CODE ∉ `WAREHOUSES`(창고 마스터, PK: COMPANY/PLANT_CD/WAREHOUSE_CODE — 세부위치인 WAREHOUSE_LOCATIONS가 아님)
- 운영 테이블은 건수가 크므로 규칙당 `DISTINCT 코드` 집계 방식으로 반환 (전건 나열 금지)

## 6. 프론트엔드

`apps/frontend/src/app/(authenticated)/master/validation/page.tsx`:

- 상단: `검증 실행` 버튼 + 카테고리 체크 필터 + 마지막 실행 시각
- 요약 카드: ERROR 건수 / WARN 건수 / 규칙 실패 건수 / 총 위반 건수
- 결과 그리드: 카테고리, 심각도(ComCodeBadge 계열 우선, 없으면 일반 Badge), 규칙명, 위반 건수, 설명. 행 확장 시 위반 샘플 행(최대 200건) 표시
- 각 위반 행에 `targetPath` 이동 링크 + 대표 키값 복사 버튼 제공. 기존 마스터 화면들은 `useSearchParams`를 읽지 않으므로 v1에서는 화면 이동까지만 하고, 사용자가 해당 화면 검색창에 키를 붙여넣어 수정한다(자동 필터는 후속 개선, Non-goals 참조)
- 실행 중 로딩 상태, 규칙 단위 실패(status='ERROR')는 화면에 사유 표시
- `alert()`/`confirm()` 사용 금지, 모달 컴포넌트 사용 (AGENTS.md)
- i18n: `menu.master.validation` + 화면 라벨 키를 `apps/frontend/src/locales/{ko,en,vi,zh}.json` 4개 파일에 추가

## 7. 테스트/검증

1. `master-validation.rules.spec.ts` — 카탈로그 무결성: 규칙 ID 유일, 필수 필드 존재, category/severity enum 일치, tenantScoped 규칙의 SQL에 `:company`/`:plantCd` 바인드 포함, SELECT 첫 컬럼 alias가 `REF_KEY`인지, targetPath가 menuConfig에 존재하는 경로인지
2. 서비스 단위 테스트 — 규칙 1건 실패 시 나머지 결과는 정상 반환(status='ERROR' 격리)
3. 백엔드 typecheck: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
4. 프론트엔드 typecheck: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
5. JSHANES 대상 API smoke: `POST /master/validation/run` 실행 후 규칙 전건 OK/VIOLATION/ERROR 집계 확인, ERROR 규칙은 SQL 수정
6. 브라우저 확인: `http://localhost:3002/master/validation` (실행/요약/이동 링크)

## 8. Non-goals

- 검증 결과 DB 저장/이력 관리/스케줄 실행
- 검증 화면에서의 인라인 수정, 자동 보정
- 물리 FK 생성 등 DB 스키마 변경 (메뉴 seed DML 제외)
- 운영 데이터 전건 나열 (역참조는 DISTINCT 코드 집계까지)
- 검증 결과에서 마스터 화면으로의 쿼리파라미터 자동 필터(딥링크) — 대상 마스터 화면들이 `searchParams`를 읽지 않으므로 후속 개선 (각 마스터 화면에 searchParams 초기 검색어 적용이 선행돼야 함)
