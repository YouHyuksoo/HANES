# 기준정보검증(Master Data Validation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기준정보 메뉴에 `MST_VALIDATION`(/master/validation)을 추가하고, 마스터 데이터 간 언매칭·잠재 오류를 온디맨드로 전수 검사하는 기능을 구현한다.

**Architecture:** 백엔드 `modules/master/validation/`에 도메인별 규칙 카탈로그(TS 선언형) + 규칙 실행 서비스(DataSource raw SQL) + 단일 API `POST /master/validation/run`. 프론트 `/master/validation` 페이지에서 실행/요약/결과 그리드 + 대상 마스터 화면 이동 링크·키 복사.

**Tech Stack:** NestJS, TypeORM(DataSource raw query, named bind `:company`/`:plantCd`), Oracle(JSHANES), Next.js, react-i18next, DataGrid(`@/components/data-grid/DataGrid`).

**Spec:** `docs/specs/2026-09-03-master-data-validation-design.md` (Approved)

**공통 주의:**
- git commit 단계는 AGENTS.md 규칙상 **사용자 승인 후에만** 실행한다.
- SQL 작성 전 대상 테이블 컬럼을 `oracle-db` connector로 확인한다 — schema-erd.md의 ERD 블록은 일부 테이블이 `more_columns`로 절단돼 있다.
- 규칙 SQL 컨벤션: SELECT 첫 컬럼은 대표 키 `REF_KEY` alias 필수.
- `MAT_LOTS.VENDOR`는 코드가 아니라 공급사명이다 — 벤더 역참조 규칙에 쓰지 않는다(2026-06-21 IQC 리뷰 실수 기록 참조: 변수명으로 타입 추정 금지).
- coordination: 작업 전 `.ai-coordination/TASKS.md` T-MASTER-VALIDATION 확인, 완료 시 JOURNAL/HANDOFF 갱신.

---

### Task 1: 규칙 타입 + 카탈로그 집계 + 무결성 테스트

**Files:**
- Create: `apps/backend/src/modules/master/validation/rules/validation-rule.types.ts`
- Create: `apps/backend/src/modules/master/validation/rules/index.ts`
- Test: `apps/backend/src/modules/master/validation/master-validation.rules.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`master-validation.rules.spec.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { ALL_RULES, RULE_CATEGORIES, RULE_SEVERITIES } from './rules';

describe('master-validation 규칙 카탈로그 무결성', () => {
  it('규칙이 1건 이상 존재한다', () => {
    expect(ALL_RULES.length).toBeGreaterThan(0);
  });

  it('규칙 id는 전역 유일하다', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('category/severity는 정의된 enum 값이다', () => {
    for (const r of ALL_RULES) {
      expect(RULE_CATEGORIES).toContain(r.category);
      expect(RULE_SEVERITIES).toContain(r.severity);
    }
  });

  it('필수 필드(title, description, targetPath, sql)가 비어있지 않다', () => {
    for (const r of ALL_RULES) {
      expect(r.title.trim()).not.toBe('');
      expect(r.description.trim()).not.toBe('');
      expect(r.targetPath.startsWith('/')).toBe(true);
      expect(r.sql.trim()).not.toBe('');
    }
  });

  it('tenantScoped(기본 true) 규칙은 :company/:plantCd 바인드를 포함한다', () => {
    for (const r of ALL_RULES.filter((x) => x.tenantScoped !== false)) {
      expect(r.sql).toContain(':company');
      expect(r.sql).toContain(':plantCd');
    }
  });

  it('SELECT 첫 컬럼 alias는 REF_KEY다', () => {
    for (const r of ALL_RULES) {
      expect(r.sql).toMatch(/SELECT\s+[\w.]+\s+AS\s+REF_KEY/i);
    }
  });

  it('targetPath는 프론트 menuConfig에 존재하는 경로다', () => {
    const menuConfigPath = path.join(
      __dirname, '../../../../../frontend/src/config/menuConfig.ts',
    );
    const menuConfigSrc = fs.readFileSync(menuConfigPath, 'utf8');
    for (const r of ALL_RULES) {
      expect(menuConfigSrc).toContain(`path: "${r.targetPath}"`);
    }
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm.cmd --filter @harness/backend test -- master-validation.rules.spec.ts`
Expected: FAIL (`./rules` 모듈 없음)

- [ ] **Step 3: 타입 + index 구현**

`validation-rule.types.ts`:

```ts
/** 기준정보 검증 규칙 정의 */
export const RULE_CATEGORIES = ['REF_INTEGRITY', 'INACTIVE_REF', 'DATA_QUALITY', 'BIZ_REVERSE_REF'] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_SEVERITIES = ['ERROR', 'WARN'] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export interface ValidationRule {
  /** '{CATEGORY}-{DOMAIN}-{NNN}' 형식, 전역 유일 */
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  /** 한글 규칙명 */
  title: string;
  /** 무엇이 문제이고 어떻게 고치는지 */
  description: string;
  /** 결과 행에서 이동할 마스터 화면 경로 */
  targetPath: string;
  /** 기본 true. false면 :company/:plantCd 바인드 생략 (비테넌트 테이블용, v1 미사용) */
  tenantScoped?: boolean;
  /**
   * 오류 행만 반환하는 SELECT. 컨벤션:
   * - SELECT 첫 컬럼은 대표 키 `AS REF_KEY`
   * - tenantScoped 규칙은 COMPANY = :company AND PLANT_CD = :plantCd 조건 포함
   */
  sql: string;
}
```

`rules/index.ts`:

```ts
import type { ValidationRule } from './validation-rule.types';
export * from './validation-rule.types';
import { BOM_RULES } from './bom.rules';
import { ROUTING_RULES } from './routing.rules';
import { ITEM_RULES } from './item.rules';
import { QUALITY_MASTER_RULES } from './quality-master.rules';
import { WAREHOUSE_RULES } from './warehouse.rules';
import { BIZ_REVERSE_RULES } from './biz-reverse.rules';

/** 전체 검증 규칙 (규칙 추가 = 도메인 파일에 1건 append) */
export const ALL_RULES: ValidationRule[] = [
  ...BOM_RULES,
  ...ROUTING_RULES,
  ...ITEM_RULES,
  ...QUALITY_MASTER_RULES,
  ...WAREHOUSE_RULES,
  ...BIZ_REVERSE_RULES,
];
```

이 시점엔 규칙 파일이 없으므로, 각 도메인 파일은 **빈 배열 export가 기본 경로**다 (`export const BOM_RULES: ValidationRule[] = [];`). 이 상태로 Step 4를 통과시키고 Task 2에서 규칙을 채운다.

- [ ] **Step 4: 테스트 실행 — 빈 규칙으로 통과 확인(구조만)**

Run: `pnpm.cmd --filter @harness/backend test -- master-validation.rules.spec.ts`
Expected: `규칙이 1건 이상`만 FAIL, 나머지 PASS (빈 배열이면 루프 테스트는 자동 통과)

---

### Task 2: 도메인별 검증 규칙 v1 작성

**Files:**
- Create: `apps/backend/src/modules/master/validation/rules/bom.rules.ts`
- Create: `apps/backend/src/modules/master/validation/rules/routing.rules.ts`
- Create: `apps/backend/src/modules/master/validation/rules/item.rules.ts`
- Create: `apps/backend/src/modules/master/validation/rules/quality-master.rules.ts`
- Create: `apps/backend/src/modules/master/validation/rules/warehouse.rules.ts`
- Create: `apps/backend/src/modules/master/validation/rules/biz-reverse.rules.ts`

- [ ] **Step 1: 대상 테이블 컬럼 실측 확인**

Run(oracle-db connector, JSHANES): `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME IN ('BOM_MASTERS','ROUTING_GROUPS','ROUTING_PROCESSES','ROUTING_MATERIALS','PROCESS_EQUIPMENTS','PROCESS_CAPAS','IQC_PART_SPECS','IQC_PART_SPEC_ITEMS','IQC_ITEM_POOL','EQUIP_INSPECT_ITEM_MASTERS','EQUIP_INSPECT_ITEM_POOL','VENDOR_BARCODE_MAPPINGS','WAREHOUSES','WAREHOUSE_LOCATIONS','WAREHOUSE_TRANSFER_RULES','MAT_ARRIVAL_STOCKS','MAT_LOTS','MAT_STOCKS','JOB_ORDERS','PROD_LINE_MASTERS','ITEM_MASTERS','COM_CODES','CONSUMABLE_USAGE_MAP','CONSUMABLE_MASTERS') ORDER BY TABLE_NAME, COLUMN_ID`

특히 확인: `BOM_MASTERS.USE_YN`, `ITEM_MASTERS.USE_YN`, `VENDOR_BARCODE_MAPPINGS`의 COMPANY/PLANT_CD 유무, `JOB_ORDERS`의 PLANT_CD/ROUTING_CODE 유무(있으면 REV-JOB-003 규칙에 사용), ITEM_TYPE 공통코드 GROUP_CODE 값.

- [ ] **Step 2: 규칙 파일 작성**

공통 형식 (bom.rules.ts 예시 — 나머지 파일도 동일 패턴):

```ts
import type { ValidationRule } from './validation-rule.types';

export const BOM_RULES: ValidationRule[] = [
  {
    id: 'REF-BOM-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: 'BOM 모품목 미존재',
    description: 'BOM의 모품목이 품목마스터에 없습니다. /master/part에 품목을 등록하거나 BOM을 정리하세요.',
    targetPath: '/master/bom',
    sql: `SELECT DISTINCT b.PARENT_ITEM_CODE AS REF_KEY, b.PLANT_CD AS PLANT
            FROM BOM_MASTERS b
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = b.COMPANY AND p.PLANT_CD = b.PLANT_CD
                      AND p.ITEM_CODE = b.PARENT_ITEM_CODE)`,
  },
  // ... 나머지 규칙
];
```

규칙 목록 (모두 같은 형식, 아래 SQL 조각의 `/*TENANT*/`는 `x.COMPANY = :company AND x.PLANT_CD = :plantCd` 조건):

**bom.rules.ts** (targetPath 전부 `/master/bom`)
| id | sev | 조건 |
|---|---|---|
| REF-BOM-001 | ERROR | `BOM_MASTERS.PARENT_ITEM_CODE ∉ ITEM_MASTERS` (위 예시) |
| REF-BOM-002 | ERROR | `BOM_MASTERS.CHILD_ITEM_CODE ∉ ITEM_MASTERS` (REF_KEY=CHILD_ITEM_CODE) |
| INA-BOM-001 | WARN | BOM 자품목 조인 ITEM_MASTERS.USE_YN='N' |
| INA-BOM-002 | WARN | BOM 모품목 조인 ITEM_MASTERS.USE_YN='N' |
| DQ-BOM-001 | ERROR | `BOM_MASTERS.QTY_PER IS NULL OR QTY_PER <= 0` (REF_KEY=PARENT_ITEM_CODE\|\|'→'\|\|CHILD_ITEM_CODE) |
| DQ-BOM-002 | ERROR | `VALID_TO IS NOT NULL AND VALID_TO < VALID_FROM` |

**routing.rules.ts** (targetPath `/master/routing`)
| id | sev | 조건 |
|---|---|---|
| REF-RTG-001 | ERROR | `ROUTING_GROUPS.ITEM_CODE ∉ ITEM_MASTERS` (REF_KEY=ROUTING_CODE) |
| REF-RTG-002 | ERROR | `ROUTING_PROCESSES.PROCESS_CODE ∉ PROCESS_MASTERS` |
| REF-RTG-003 | ERROR | `ROUTING_PROCESSES.ROUTING_CODE ∉ ROUTING_GROUPS` (고아 상세) |
| REF-RTG-004 | ERROR | `ROUTING_MATERIALS.CHILD_ITEM_CODE ∉ ITEM_MASTERS` |
| REF-RTG-005 | ERROR | `ROUTING_MATERIALS.ROUTING_CODE ∉ ROUTING_GROUPS` |
| INA-RTG-001 | WARN | ROUTING_PROCESSES가 USE_YN='N' 공정 참조 |
| INA-RTG-002 | WARN | ROUTING_MATERIALS가 USE_YN='N' 품목(ITEM_MASTERS) 참조 |
| DQ-RTG-001 | WARN | ROUTING_GROUPS(USE_YN='Y') 중 활성 ROUTING_PROCESSES 0건 |

**item.rules.ts**
| id | sev | target | 조건 |
|---|---|---|---|
| REF-PRC-001 | ERROR | /master/process | `PROCESS_EQUIPMENTS.PROCESS_CODE ∉ PROCESS_MASTERS` |
| REF-PRC-002 | ERROR | /master/equip | `PROCESS_EQUIPMENTS.EQUIP_CODE ∉ EQUIP_MASTERS` |
| INA-PRC-001 | WARN | /master/equip | PROCESS_EQUIPMENTS가 USE_YN='N' 설비 참조 |
| REF-CAPA-001 | ERROR | /master/process-capa | `PROCESS_CAPAS.PROCESS_CODE ∉ PROCESS_MASTERS` |
| REF-CAPA-002 | ERROR | /master/process-capa | `PROCESS_CAPAS.ITEM_CODE ∉ ITEM_MASTERS` |
| DQ-CAPA-001 | WARN | /master/process-capa | `(STD_UPH IS NULL OR STD_UPH<=0) AND (DAILY_CAPA IS NULL OR DAILY_CAPA<=0)` |
| DQ-ITEM-001 | ERROR | /master/part | `ITEM_MASTERS.ITEM_NAME IS NULL OR TRIM(ITEM_NAME)=''` |
| DQ-ITEM-002 | WARN | /master/part | `ITEM_MASTERS.ITEM_TYPE ∉ COM_CODES(GROUP_CODE=<ITEM_TYPE 그룹>, USE_YN='Y')` — Step 1에서 그룹코드 확정 |
| REF-CNS-001 | ERROR | /master/equip | `CONSUMABLE_USAGE_MAP.PRODUCT_ITEM_CODE ∉ ITEM_MASTERS` |
| REF-CNS-002 | ERROR | /master/equip | `CONSUMABLE_USAGE_MAP.EQUIP_CODE ∉ EQUIP_MASTERS` |
| REF-CNS-003 | ERROR | /master/equip | `CONSUMABLE_USAGE_MAP.CONSUMABLE_CODE ∉ CONSUMABLE_MASTERS` |

**quality-master.rules.ts**
| id | sev | target | 조건 |
|---|---|---|---|
| REF-IQC-001 | ERROR | /master/iqc-part-spec | `IQC_PART_SPECS.ITEM_CODE ∉ ITEM_MASTERS` |
| REF-IQC-002 | ERROR | /master/iqc-part-spec | `IQC_PART_SPEC_ITEMS.INSP_ITEM_CODE ∉ IQC_ITEM_POOL` |
| INA-IQC-001 | WARN | /master/iqc-part-spec | spec items가 USE_YN='N' 풀 항목 참조 |
| INA-IQC-002 | WARN | /master/iqc-part-spec | IQC_PART_SPECS가 USE_YN='N' 품목(ITEM_MASTERS) 참조 |
| REF-EQP-001 | ERROR | /master/equip-inspect-item | `EQUIP_INSPECT_ITEM_POOL.EQUIP_CODE ∉ EQUIP_MASTERS` |
| REF-EQP-002 | ERROR | /master/equip-inspect-item | `EQUIP_INSPECT_ITEM_POOL.ITEM_CODE ∉ EQUIP_INSPECT_ITEM_MASTERS` |

**warehouse.rules.ts**
| id | sev | target | 조건 |
|---|---|---|---|
| REF-VBC-001 | ERROR | /master/vendor-barcode | `VENDOR_BARCODE_MAPPINGS.ITEM_CODE ∉ ITEM_MASTERS` (COMPANY/PLANT_CD 없으면 tenantScoped:false + 아이템 조인은 테넌트 무시) |
| REF-VBC-002 | WARN | /master/vendor-barcode | `VENDOR_BARCODE_MAPPINGS.VENDOR_CODE ∉ VENDOR_MASTERS` |
| INA-VBC-001 | WARN | /master/vendor-barcode | VENDOR_BARCODE_MAPPINGS가 USE_YN='N' 벤더 참조 |
| REF-WH-001 | ERROR | /master/warehouse | `WAREHOUSE_LOCATIONS.WAREHOUSE_CODE ∉ WAREHOUSES` |
| REF-WH-002 | ERROR | /master/warehouse | `WAREHOUSE_TRANSFER_RULES.FROM_WAREHOUSE_ID/TO_WAREHOUSE_ID ∉ WAREHOUSES` |

**biz-reverse.rules.ts** (전부 DISTINCT 코드 집계, targetPath는 해당 마스터 화면)
| id | sev | target | 조건 |
|---|---|---|---|
| REV-STK-001 | ERROR | /master/part | `MAT_ARRIVAL_STOCKS.ITEM_CODE ∉ ITEM_MASTERS` |
| REV-STK-002 | ERROR | /master/part | `MAT_LOTS.ITEM_CODE ∉ ITEM_MASTERS` (MAT_LOTS는 테넌트 컬럼 없음 — ITEM_MASTERS 조인은 company/plantCd 무관 매칭, tenantScoped:false) |
| REV-STK-003 | ERROR | /master/warehouse | `MAT_STOCKS.WAREHOUSE_CODE ∉ WAREHOUSES` |
| REV-JOB-001 | ERROR | /master/part | `JOB_ORDERS.ITEM_CODE ∉ ITEM_MASTERS` (JOB_ORDERS PLANT_CD 유무에 따라 바인드 조정) |
| REV-JOB-002 | WARN | /master/prod-line | `JOB_ORDERS.LINE_CODE ∉ PROD_LINE_MASTERS` |
| REV-JOB-003 | ERROR | /master/routing | `JOB_ORDERS.ROUTING_CODE ∉ ROUTING_GROUPS` — Step 1 실측에서 JOB_ORDERS.ROUTING_CODE 컬럼이 없으면 이 규칙은 생략하고 JOURNAL에 사유 기록 |

- [ ] **Step 3: 카탈로그 테스트 통과 확인**

Run: `pnpm.cmd --filter @harness/backend test -- master-validation.rules.spec.ts`
Expected: PASS (전 항목)

---

### Task 3: 검증 실행 서비스

**Files:**
- Create: `apps/backend/src/modules/master/validation/master-validation.service.ts`
- Test: `apps/backend/src/modules/master/validation/master-validation.service.spec.ts`

- [ ] **Step 1: 실패하는 서비스 테스트 작성**

```ts
import { MasterValidationService } from './master-validation.service';

describe('MasterValidationService', () => {
  const makeService = (queryImpl: jest.Mock) =>
    new MasterValidationService({ query: queryImpl } as any);

  it('규칙 SQL 실패 시 해당 규칙만 ERROR로 격리되고 나머지는 계속 실행된다', async () => {
    const query = jest.fn()
      .mockRejectedValueOnce(new Error('ORA-00942'))   // 첫 규칙 count 실패
      .mockResolvedValue([[{ CNT: 0 }]]);               // 나머지 전부 0건
    const svc = makeService(query);
    const result = await svc.run(undefined, '40', '1000');
    expect(result.summary.failedRules).toBe(1);
    expect(result.results.filter((r) => r.status === 'ERROR')).toHaveLength(1);
    expect(result.results.filter((r) => r.status === 'OK').length)
      .toBe(result.summary.totalRules - 1);
  });

  it('위반 건수가 있는 규칙은 VIOLATION이고 rows는 200건으로 제한된다', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ REF_KEY: `K${i}` }));
    const query = jest.fn()
      .mockResolvedValueOnce([[{ CNT: 500 }]])  // count
      .mockResolvedValueOnce(rows)              // rows
      .mockResolvedValue([[{ CNT: 0 }]]);       // 나머지
    const svc = makeService(query);
    const result = await svc.run(['REF_INTEGRITY'], '40', '1000');
    const v = result.results.find((r) => r.status === 'VIOLATION');
    expect(v?.totalCount).toBe(500);
    expect(v?.rows).toHaveLength(200);
  });

  it('categories 필터가 적용된다', async () => {
    const query = jest.fn().mockResolvedValue([[{ CNT: 0 }]]);
    const svc = makeService(query);
    const result = await svc.run(['DATA_QUALITY'], '40', '1000');
    expect(result.results.every((r) => r.rule.category === 'DATA_QUALITY')).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm.cmd --filter @harness/backend test -- master-validation.service.spec.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 서비스 구현**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ALL_RULES, ValidationRule, RuleCategory } from './rules';

export interface RuleRunResult {
  rule: Omit<ValidationRule, 'sql'>;
  status: 'OK' | 'VIOLATION' | 'ERROR';
  totalCount: number;
  rows: Record<string, unknown>[];
  errorMessage?: string;
}

const ROW_LIMIT = 200;

@Injectable()
export class MasterValidationService {
  private readonly logger = new Logger(MasterValidationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async run(categories: RuleCategory[] | undefined, company: string, plantCd: string) {
    const startedAt = Date.now();
    const rules = categories?.length
      ? ALL_RULES.filter((r) => categories.includes(r.category))
      : ALL_RULES;

    const results: RuleRunResult[] = [];
    for (const rule of rules) {
      results.push(await this.runRule(rule, company, plantCd));
    }

    return {
      runAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: {
        totalRules: rules.length,
        failedRules: results.filter((r) => r.status === 'ERROR').length,
        errorCount: results.filter((r) => r.status === 'VIOLATION' && r.rule.severity === 'ERROR')
          .reduce((a, r) => a + r.totalCount, 0),
        warnCount: results.filter((r) => r.status === 'VIOLATION' && r.rule.severity === 'WARN')
          .reduce((a, r) => a + r.totalCount, 0),
      },
      results,
    };
  }

  private async runRule(rule: ValidationRule, company: string, plantCd: string): Promise<RuleRunResult> {
    const meta = { id: rule.id, category: rule.category, severity: rule.severity,
      title: rule.title, description: rule.description, targetPath: rule.targetPath };
    const params = rule.tenantScoped === false ? {} : { company, plantCd };
    try {
      const countRows = await this.dataSource.query(
        `SELECT COUNT(*) AS CNT FROM (${rule.sql})`, params,
      );
      const totalCount = Number(countRows[0]?.CNT ?? countRows[0]?.cnt ?? 0);
      if (totalCount === 0) return { rule: meta, status: 'OK', totalCount: 0, rows: [] };

      const rows = await this.dataSource.query(
        `SELECT * FROM (${rule.sql}) WHERE ROWNUM <= ${ROW_LIMIT}`, params,
      );
      return { rule: meta, status: 'VIOLATION', totalCount, rows };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`검증 규칙 ${rule.id} 실행 실패: ${msg}`);
      return { rule: meta, status: 'ERROR', totalCount: 0, rows: [], errorMessage: msg };
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm.cmd --filter @harness/backend test -- master-validation`
Expected: PASS (rules + service 전부)

---

### Task 4: 컨트롤러 + 모듈 등록

**Files:**
- Create: `apps/backend/src/modules/master/validation/master-validation.controller.ts`
- Modify: `apps/backend/src/modules/master/master.module.ts` (controllers/providers에 추가)

- [ ] **Step 1: 컨트롤러 작성**

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { MasterValidationService } from './master-validation.service';
import type { RuleCategory } from './rules';

@ApiTags('기준정보 - 기준정보검증')
@Controller('master/validation')
export class MasterValidationController {
  constructor(private readonly validationService: MasterValidationService) {}

  @Post('run')
  @ApiOperation({ summary: '기준정보 검증 실행 (온디맨드)' })
  async run(
    @Body() body: { categories?: RuleCategory[] },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.validationService.run(body?.categories, company, plant);
    return ResponseUtil.success(result);
  }
}
```

- [ ] **Step 2: master.module.ts에 등록**

controllers 배열에 `MasterValidationController`, providers 배열에 `MasterValidationService` 추가 (import 포함). TypeOrmModule.forFeature에는 새 엔티티 없음(DataSource 직접 사용).

- [ ] **Step 3: 백엔드 typecheck**

Run: `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false`
Expected: 0 errors

---

### Task 5: 메뉴 등록 (프론트 config + 백엔드 validator + i18n + DB seed)

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts` (MASTER children, `MST_PROCESS_CAPA` 다음)
- Modify: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts` (MASTER 섹션)
- Modify: `apps/frontend/src/locales/ko.json`, `en.json`, `vi.json`, `zh.json`
- Create: `apps/backend/src/migrations/2026-09-03_master_validation_menu_seed.sql`

- [ ] **Step 1: menuConfig.ts**

`{ code: "MST_PROCESS_CAPA", ... }` 다음 줄에:

```ts
{ code: "MST_VALIDATION", labelKey: "menu.master.validation", path: "/master/validation" },
```

- [ ] **Step 2: menu-code-validator.ts**

MASTER 섹션(19행) `'MST_LABEL','MST_VENDOR_BARCODE','MST_PROCESS_CAPA','SYS_DOCUMENT',` → `'MST_LABEL','MST_VENDOR_BARCODE','MST_PROCESS_CAPA','MST_VALIDATION','SYS_DOCUMENT',`

- [ ] **Step 3: locales 4개 파일**

각 파일의 `"master.processCapa"` 다음 줄에 추가:

| locale | 키 | 값 |
|---|---|---|
| ko | `menu.master.validation` | 기준정보검증 |
| en | `menu.master.validation` | Master Data Validation |
| vi | `menu.master.validation` | Kiểm tra dữ liệu chuẩn |
| zh | `menu.master.validation` | 主数据校验 |

화면 라벨 키(`validation.*`)는 Task 6에서 함께 추가.

- [ ] **Step 4: seed SQL 작성**

`2026-07-03_prod_order_result_menu_seed.sql` 패턴 준수 — `MENU_CATEGORY_ITEMS` MERGE(MENU_CODE='MST_VALIDATION', CATEGORY_CODE='MASTER', SORT_ORDER는 MST_PROCESS_CAPA 다음 값을 pre-check로 확인) + `ROLE_MENU_PERMISSIONS`는 `MST_PROCESS_CAPA` 기준 복제. 각 블록 끝에 `/` 구분자.

- [ ] **Step 5: JSHANES 적용 + 검증**

pre-check: `SELECT MENU_CODE, SORT_ORDER FROM MENU_CATEGORY_ITEMS WHERE CATEGORY_CODE='MASTER' AND COMPANY='40' AND PLANT_CD='1000' ORDER BY SORT_ORDER`
적용: `oracle-db --execute-file` (JSHANES)
post-check: MST_VALIDATION 행 존재 + ROLE_MENU_PERMISSIONS에 역할별 행 존재 확인. 결과를 JOURNAL.md에 기록.

---

### Task 6: 프론트 검증 화면

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/validation/page.tsx`
- Modify: `apps/frontend/src/locales/{ko,en,vi,zh}.json` (`validation.*` 화면 키)

- [ ] **Step 1: 페이지 구현**

구조(process-capa page.tsx 패턴 준수):

```tsx
"use client";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, RefreshCw, Play, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, Button, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
```

화면 구성:
1. 상단: 카테고리 체크박스 4개(참조무결성/비활성참조/데이터품질/운영역참조, 기본 전체 선택) + `검증 실행` 버튼 + 마지막 실행 시각/소요시간
2. 요약 StatCard 4개: ERROR 건수, WARN 건수, 규칙 실패, 위반 규칙 수
3. 규칙 결과 DataGrid: 컬럼 [카테고리, 심각도, 규칙ID, 규칙명, 위반건수, 상태]. VIOLATION/ERROR 행만 기본 표시(토글로 OK 포함 가능)
4. 규칙 행 클릭 → 하단에 위반 상세 DataGrid: 첫 컬럼 REF_KEY + 나머지 컬럼 동적 생성 + 행별 [복사] 버튼(navigator.clipboard로 REF_KEY 복사), [화면이동] 버튼(`router.push(rule.targetPath)`)
5. 실행 전/0건 시 안내 문구, 실행 중 버튼 로딩
6. `alert()` 금지 — 오류는 화면 내 배너/모달

API 호출: `const res = await api.post("/master/validation/run", { categories });` → `res.data.data`

- [ ] **Step 2: locales에 화면 키 추가**

`validation.title/run/running/lastRun/duration/category.REF_INTEGRITY|INACTIVE_REF|DATA_QUALITY|BIZ_REVERSE_REF/severity.ERROR|WARN/summary.errors|warns|failedRules|violatedRules/columns.category|severity|ruleId|ruleName|violationCount|status/status.OK|VIOLATION|ERROR/detail.title/copyKey/copied/goToScreen/noResults/showOkRules` — 4개 언어 모두.

- [ ] **Step 3: 프론트엔드 typecheck**

Run: `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
Expected: 0 errors

---

### Task 7: 통합 검증 + 마무리

- [ ] **Step 1: API smoke (JSHANES)**

백엔드 dev 서버 기동 상태에서 `POST /master/validation/run` 호출(인증 포함). 전 규칙의 status 집계 확인:
- `ERROR` 규칙이 있으면 ORA 오류 메시지 보고 SQL의 컬럼/테이블명을 실측 DB에 맞게 수정 후 재실행
- 최종적으로 ERROR 0건 목표 (VIOLATION은 실제 데이터 문제이므로 정상)

- [ ] **Step 2: 브라우저 확인**

`http://localhost:3002/master/validation` — 사이드바 기준정보에 "기준정보검증" 노출, 실행 → 요약/그리드/복사/이동 동작 확인 (dev 서버 없으면 사용자에게 보고, 임의 포트로 띄우지 않음)

- [ ] **Step 3: coordination 마무리**

- `.ai-coordination/JOURNAL.md`에 결과/검증 기록, `HANDOFF/kimi.md` 갱신, LOCKS.md에서 T-MASTER-VALIDATION lock 제거
- 검토 대기이므로 TASKS.md → REVIEW_QUEUE.md 이동

- [ ] **Step 4: 커밋 (사용자 승인 후)**

변경 범위: backend validation 모듈, master.module.ts, menu-code-validator.ts, migration SQL, menuConfig.ts, locales×4, validation page, spec/plan 문서.
