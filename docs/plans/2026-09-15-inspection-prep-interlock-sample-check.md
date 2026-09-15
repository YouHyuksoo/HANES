# 통전·단자검사 준비 인터락과 양불마스터 대조 구현계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 통전·단자검사 화면에서 작업자 선택과 설비일상점검·작업자설비점검·양불마스터 대조를 끝내야만 합격·불합격 판정을 등록할 수 있게 하고, 대조 결과를 이력으로 보관한다.

**Architecture:** 생산실적에만 있던 설비점검 게이트(`ProdResultService.assertEquipInspectGate`)를 `EquipInspectGateService`로 추출해 생산·검사가 같은 함수를 호출한다. 양불 대조는 기존 `INSPECT_AIDS`(한도견본 마스터)를 후보로 읽어 신규 `INSPECT_SAMPLE_CHECKS`/`INSPECT_SAMPLE_CHECK_ITEMS`에 시도마다 새 기록을 남긴다. 프론트는 실적입력(가공) 키오스크의 작업자 선택·점검 모달을 공용화해 재사용한다.

**Tech Stack:** NestJS 11 + TypeORM(Oracle), Next.js 15(App Router) + React + TanStack Table, Jest(backend), node:test 기반 `.structure.test.mjs`(frontend), i18next 4개 언어.

**Spec:** `docs/specs/2026-09-15-inspection-prep-interlock-sample-check-design.md`

## Global Constraints

- 패키지 매니저는 `pnpm`만 쓴다. `npm` 금지. 프론트 dev 포트 `3002`, 백엔드 `3003`.
- dev 서버가 떠 있으면 `pnpm build` 금지. 타입검사는 `pnpm.cmd run typecheck:backend` / `typecheck:frontend`.
- 백엔드 단위테스트: `pnpm --dir apps/backend run test:unit`. 특정 파일만: `pnpm --dir apps/backend exec jest <경로> --runInBand`.
- DB 작업은 반드시 `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES ...`로 직접 실행한다. 사용자에게 SQL 실행을 미루지 않는다. 다중 블록 SQL 파일은 `/` 라인으로 구분한다.
- Oracle 신규 테이블은 `COMPANY`, `PLANT_CD`를 PK에 포함하고 `CREATED_AT`/`UPDATED_AT`에 `DEFAULT SYSTIMESTAMP`를 준다.
- TypeORM에서 nullable union 컬럼(`string | null`)은 `@Column({ type: ... })`로 타입을 명시한다. `as any` 금지, `catch (error: unknown)` 유지.
- 채번은 `SeqGeneratorService.getNo(docType)`(= `PKG_SEQ_GENERATOR.GET_NO`)만 쓴다. `SELECT MAX+1` 금지.
- i18n은 `apps/frontend/src/locales/{ko,en,zh,vi}.json` 4개를 동시에 수정하고 BOM을 넣지 않는다.
- 코드성 값은 공통코드 컴포넌트(`ComCodeSelect`, `ComCodeBadge`, `useComCode`)를 쓴다. 자유 입력 금지.
- 바코드 입력은 `@/components/shared` 의 `BarcodeScanInput`만 쓴다. 일반 `Input` + `onKeyDown Enter` 조합 금지.
- `alert()`, `confirm()`, `prompt()` 금지 — 모달 컴포넌트 사용.
- 카드·배지에 파스텔 배경(`bg-green-50` 등) 금지. 텍스트·테두리로 구분한다.
- 커밋은 `main`에 직접 한다. 멀티라인 커밋 메시지는 임시파일 + `git commit -F`. `git add`는 파일 단위. `git push`는 사용자가 명시할 때만.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` 를 넣는다.

---

## 파일 구조

**Backend**

| 파일 | 책임 |
|---|---|
| `apps/backend/src/modules/equipment/services/equip-inspect-gate.service.ts` (신규) | DAILY/WORKER 점검 인터락 판정 단일 출처 |
| `apps/backend/src/modules/production/services/prod-result.service.ts` (수정) | `assertEquipInspectGate`를 게이트 서비스에 위임 |
| `apps/backend/src/entities/inspect-sample-check.entity.ts` (신규) | 대조 헤더 |
| `apps/backend/src/entities/inspect-sample-check-item.entity.ts` (신규) | 대조 샘플별 결과 |
| `apps/backend/src/entities/inspect-aid.entity.ts` (수정) | `inspectType`, `requiredYn`, `sortOrder` 추가 |
| `apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.ts` (신규) | 후보 조회·상태 판정·대조 저장 |
| `apps/backend/src/modules/quality/continuity-inspect/dto/inspect-sample-check.dto.ts` (신규) | 대조 DTO |
| `apps/backend/src/modules/quality/continuity-inspect/controllers/continuity-inspect.controller.ts` (수정) | prep-status·대조 엔드포인트 |
| `apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts` (수정) | `inspect` 등록 전 게이트 호출 |
| `apps/backend/src/modules/master/{dto,services}/inspect-aid.*` (수정) | 신규 3컬럼 반영 |

**Frontend**

| 파일 | 책임 |
|---|---|
| `apps/frontend/src/components/inspect/DailyInspectModal.tsx` (이동+리팩터) | 설비일상점검 모달 (props 기반) |
| `apps/frontend/src/components/inspect/WorkerInspectModal.tsx` (이동+리팩터) | 작업자설비점검 모달 (props 기반) |
| `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx` (수정) | 키오스크용 얇은 래퍼(스토어 → props) |
| `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx` (수정) | 동일 |
| `apps/frontend/src/app/(authenticated)/inspection/result/hooks/useInspectPrepStatus.ts` (신규) | prep 상태 단일 소스 |
| `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectStationBar.tsx` (신규) | 검사기 + 작업자 선택 |
| `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPrepCheckBar.tsx` (신규) | 4단계 체크바 + 양/불체크 시작 |
| `apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckModal.tsx` (신규) | 견본 스캔 + PASS/FAIL 입력 |
| `apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckHistoryModal.tsx` (신규) | 대조 이력 |
| `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectionResultWorkflow.tsx` (수정) | 조립 |
| `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx` (수정) | `prep` 단일 prop 수신 |
| `apps/frontend/src/app/(authenticated)/master/inspect-aid/*` (수정) | 신규 3필드 |

---

### Task 1: DB 스키마 — INSPECT_AIDS 확장 + 대조 테이블 신설

**Files:**
- Create: `tools/sql/2026-09-15-inspect-sample-check.sql`
- Modify: `docs/database/schema-erd.md` (생성기가 갱신)

**Interfaces:**
- Consumes: 없음
- Produces: 테이블 `INSPECT_SAMPLE_CHECKS`, `INSPECT_SAMPLE_CHECK_ITEMS`; 컬럼 `INSPECT_AIDS.INSPECT_TYPE/REQUIRED_YN/SORT_ORDER`; 채번 `docType='SMP_CHK'`; 공통코드 `INSPECT_TYPE.TERMINAL`

- [ ] **Step 1: 적용 전 상태 조회 (pre-check)**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT table_name FROM user_tables WHERE table_name IN ('INSPECT_SAMPLE_CHECKS','INSPECT_SAMPLE_CHECK_ITEMS')"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT column_name FROM user_tab_columns WHERE table_name='INSPECT_AIDS' ORDER BY column_id"
```

기대: 신규 테이블 0건, `INSPECT_AIDS`에 `INSPECT_TYPE`/`REQUIRED_YN`/`SORT_ORDER` 없음. 결과를 작업 로그에 남긴다.

- [ ] **Step 2: SQL 파일 작성**

`tools/sql/2026-09-15-inspect-sample-check.sql`:

```sql
ALTER TABLE INSPECT_AIDS ADD (
  INSPECT_TYPE VARCHAR2(30),
  REQUIRED_YN  VARCHAR2(1) DEFAULT 'Y' NOT NULL,
  SORT_ORDER   NUMBER(5)   DEFAULT 0   NOT NULL
)
/
COMMENT ON COLUMN INSPECT_AIDS.INSPECT_TYPE IS '적용 검사유형 (COM_CODES INSPECT_TYPE: CONTINUITY 도통/TERMINAL 단자. NULL=전 검사유형 공통)'
/
COMMENT ON COLUMN INSPECT_AIDS.REQUIRED_YN IS '검사 전 대조 필수 여부 (Y=필수, N=참고용)'
/
COMMENT ON COLUMN INSPECT_AIDS.SORT_ORDER IS '대조 모달 표시 순서'
/
CREATE TABLE INSPECT_SAMPLE_CHECKS (
  COMPANY        VARCHAR2(50)  NOT NULL,
  PLANT_CD       VARCHAR2(50)  NOT NULL,
  CHECK_NO       VARCHAR2(30)  NOT NULL,
  ORDER_NO       VARCHAR2(50)  NOT NULL,
  INSPECT_TYPE   VARCHAR2(30)  NOT NULL,
  EQUIP_CODE     VARCHAR2(50)  NOT NULL,
  ITEM_CODE      VARCHAR2(50),
  WORK_DATE      DATE          NOT NULL,
  SHIFT_CODE     VARCHAR2(20)  DEFAULT 'NONE' NOT NULL,
  OVERALL_RESULT VARCHAR2(10)  NOT NULL,
  CHECKER_ID     VARCHAR2(50),
  CHECKED_AT     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  REMARK         VARCHAR2(500),
  CREATED_BY     VARCHAR2(50),
  UPDATED_BY     VARCHAR2(50),
  CREATED_AT     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_INSPECT_SAMPLE_CHECKS PRIMARY KEY (COMPANY, PLANT_CD, CHECK_NO)
)
/
CREATE INDEX IX_ISC_KEY ON INSPECT_SAMPLE_CHECKS
  (COMPANY, PLANT_CD, ORDER_NO, INSPECT_TYPE, EQUIP_CODE, WORK_DATE, SHIFT_CODE, CHECKED_AT DESC)
/
COMMENT ON TABLE INSPECT_SAMPLE_CHECKS IS '양불마스터(한도견본) 대조 헤더 — 통전·단자검사 시작 전 검사기 유효성 확인 기록'
/
COMMENT ON COLUMN INSPECT_SAMPLE_CHECKS.OVERALL_RESULT IS '종합판정 (PASS=필수 견본 전부 OK, NG=1건 이상 불일치)'
/
COMMENT ON COLUMN INSPECT_SAMPLE_CHECKS.SHIFT_CODE IS '교대코드 (SHIFT_PATTERNS.SHIFT_CODE, 미판별 시 NONE)'
/
COMMENT ON COLUMN INSPECT_SAMPLE_CHECKS.CHECKER_ID IS '대조 판정자 = 검사기 대표 작업자 (로그인 계정은 CREATED_BY)'
/
CREATE TABLE INSPECT_SAMPLE_CHECK_ITEMS (
  COMPANY         VARCHAR2(50) NOT NULL,
  PLANT_CD        VARCHAR2(50) NOT NULL,
  CHECK_NO        VARCHAR2(30) NOT NULL,
  SEQ_NO          NUMBER(5)    NOT NULL,
  AID_CODE        VARCHAR2(50) NOT NULL,
  AID_TYPE        VARCHAR2(30) NOT NULL,
  EXPECTED_RESULT VARCHAR2(10) NOT NULL,
  ACTUAL_RESULT   VARCHAR2(10) NOT NULL,
  RESULT          VARCHAR2(10) NOT NULL,
  SCANNED_AT      TIMESTAMP,
  REMARK          VARCHAR2(500),
  CREATED_BY      VARCHAR2(50),
  CREATED_AT      TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_INSPECT_SAMPLE_CHECK_ITEMS PRIMARY KEY (COMPANY, PLANT_CD, CHECK_NO, SEQ_NO)
)
/
COMMENT ON TABLE INSPECT_SAMPLE_CHECK_ITEMS IS '양불마스터 대조 샘플별 결과 — 기대결과와 검사기 실제결과 비교'
/
COMMENT ON COLUMN INSPECT_SAMPLE_CHECK_ITEMS.EXPECTED_RESULT IS '기대 결과 (LIMIT_OK=PASS, LIMIT_NG=FAIL)'
/
COMMENT ON COLUMN INSPECT_SAMPLE_CHECK_ITEMS.ACTUAL_RESULT IS '검사기 실제 결과 (PASS/FAIL, 작업자 입력)'
/
COMMENT ON COLUMN INSPECT_SAMPLE_CHECK_ITEMS.RESULT IS '판정 (OK=기대와 일치, NG=불일치) — 서버가 산출'
/
CREATE SEQUENCE SEQ_SMP_CHK START WITH 1 INCREMENT BY 1 NOCACHE
/
MERGE INTO SEQ_RULES t
USING (SELECT 'SMP_CHK' DOC_TYPE, '40' COMPANY, '1000' PLANT_CD FROM DUAL) s
ON (t.DOC_TYPE = s.DOC_TYPE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN INSERT (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, SEPARATOR, DESCRIPTION, USE_YN, COMPANY, PLANT_CD)
VALUES ('SMP_CHK', 'SMC', 'SEQ_SMP_CHK', 4, 'YYYYMMDD', '-', '양불마스터 대조번호', 'Y', '40', '1000')
/
MERGE INTO COM_CODES t
USING (SELECT 'INSPECT_TYPE' GROUP_CODE, 'TERMINAL' DETAIL_CODE, '40' COMPANY, '1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE = s.GROUP_CODE AND t.DETAIL_CODE = s.DETAIL_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN INSERT (GROUP_CODE, DETAIL_CODE, CODE_NAME, CODE_DESC, SORT_ORDER, USE_YN, COMPANY, PLANT_CD)
VALUES ('INSPECT_TYPE', 'TERMINAL', '단자', '단자검사', 7, 'Y', '40', '1000')
/
```

- [ ] **Step 3: 적용**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file tools/sql/2026-09-15-inspect-sample-check.sql
```

ORA-00933 등 실행 형식 오류가 나면 다른 도구로 우회하지 말고 SQL 파일의 `/` 구분을 고쳐 같은 커넥터로 재실행한다.

- [ ] **Step 4: 적용 후 확인 (post-check)**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT table_name FROM user_tables WHERE table_name LIKE 'INSPECT_SAMPLE_CHECK%'"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT column_name, data_type, nullable, data_default FROM user_tab_columns WHERE table_name='INSPECT_AIDS' AND column_name IN ('INSPECT_TYPE','REQUIRED_YN','SORT_ORDER')"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT PKG_SEQ_GENERATOR.GET_NO('SMP_CHK') AS NO FROM DUAL"
```

기대: 테이블 2건, 컬럼 3건, 채번이 `SMC-YYYYMMDD-0001` 형태로 나온다.

- [ ] **Step 5: 의존 PL/SQL 재컴파일 확인**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT object_name, object_type FROM user_objects WHERE status='INVALID'"
```

INVALID가 있으면 `ALTER PACKAGE <이름> COMPILE;`(또는 BODY)을 같은 커넥터로 실행하고 다시 조회해 0건을 확인한다.

- [ ] **Step 6: ERD 갱신**

```bash
ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py
git diff --stat docs/database/schema-erd.md
```

기대: `INSPECT_SAMPLE_CHECKS`, `INSPECT_SAMPLE_CHECK_ITEMS`가 문서에 추가된다.

- [ ] **Step 7: 커밋**

```bash
git add tools/sql/2026-09-15-inspect-sample-check.sql docs/database/schema-erd.md
git commit -F <임시파일>
```

메시지: `feat(quality): 양불마스터 대조 테이블과 검사보조구 검사유형 컬럼을 추가한다`

---

### Task 2: 설비점검 게이트 공용 서비스 추출

**Files:**
- Create: `apps/backend/src/modules/equipment/services/equip-inspect-gate.service.ts`
- Create: `apps/backend/src/modules/equipment/services/equip-inspect-gate.service.spec.ts`
- Modify: `apps/backend/src/modules/equipment/equipment.module.ts` (providers/exports 에 추가)
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts:757-826` (`assertEquipInspectGate` 위임)

**Interfaces:**
- Consumes: `EquipInspectService.getInspectionStatus`, `SysConfigService.getValue`, `EquipInspectItemPool` 리포지토리
- Produces:
  ```ts
  export type InspectGateScope = 'ASSEMBLY' | 'SUBASSEMBLY' | 'INSPECTION';
  export interface InspectGateStatus {
    dailyRequired: boolean;
    dailyDone: boolean;
    dailyResult: string | null;
    dailyInspectedAt: string | null;
    workerRequired: boolean;
    workerDone: boolean;
    workerResult: string | null;
    workerInspectedAt: string | null;
    blocked: boolean;
    blockReason: string | null;
  }
  class EquipInspectGateService {
    getGateStatus(args: { equipCode?: string; orderNo?: string; scope?: InspectGateScope },
                  tenant: { company?: string; plant?: string }): Promise<InspectGateStatus>;
    assertGate(args: { equipCode?: string; orderNo?: string; scope?: InspectGateScope },
               tenant: { company?: string; plant?: string },
               subject?: string): Promise<void>;
  }
  ```
  `subject`는 오류 문구의 대상어(기본 `'실적'`, 검사에서는 `'검사'`)다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/backend/src/modules/equipment/services/equip-inspect-gate.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { EquipInspectGateService } from './equip-inspect-gate.service';
import { EquipInspectService } from './equip-inspect.service';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { SysConfigService } from '../../system/services/sys-config.service';

describe('EquipInspectGateService', () => {
  let service: EquipInspectGateService;
  const poolRepo = { find: jest.fn() };
  const inspectService = { getInspectionStatus: jest.fn() };
  const sysConfig = { getValue: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    sysConfig.getValue.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquipInspectGateService,
        { provide: getRepositoryToken(EquipInspectItemPool), useValue: poolRepo },
        { provide: EquipInspectService, useValue: inspectService },
        { provide: SysConfigService, useValue: sysConfig },
      ],
    }).compile();
    service = moduleRef.get(EquipInspectGateService);
  });

  it('점검항목 매핑이 없으면 통과한다', async () => {
    poolRepo.find.mockResolvedValue([]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).resolves.toBeUndefined();
  });

  it('DAILY 항목이 있고 점검 기록이 없으면 검사를 차단한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    inspectService.getInspectionStatus.mockResolvedValue({ alreadyInspected: false, inspectPassed: false, overallResult: null });
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).rejects.toThrow(new BadRequestException('설비 일상점검을 완료해야 검사를 등록할 수 있습니다: EQ-1'));
  });

  it('DAILY 종합판정이 NG면 차단한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    inspectService.getInspectionStatus.mockResolvedValue({ alreadyInspected: true, inspectPassed: false, overallResult: 'NG' });
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).rejects.toThrow(/불합격\(NG\)/);
  });

  it('WORKER 항목이 있는데 orderNo가 없으면 차단한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'WORKER' }]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).rejects.toThrow(/작업지시번호가 필요합니다/);
  });

  it('EQUIP_INSPECT_INTERLOCK=N 이면 통과한다', async () => {
    sysConfig.getValue.mockImplementation(async (key: string) => (key === 'EQUIP_INSPECT_INTERLOCK' ? 'N' : null));
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }]);
    await expect(
      service.assertGate({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' }, '검사'),
    ).resolves.toBeUndefined();
  });

  it('getGateStatus는 DAILY 완료·WORKER 미완료 상태를 그대로 보고한다', async () => {
    poolRepo.find.mockResolvedValue([{ inspectType: 'DAILY' }, { inspectType: 'WORKER' }]);
    inspectService.getInspectionStatus.mockImplementation(async ({ inspectType }: { inspectType: string }) =>
      inspectType === 'DAILY'
        ? { alreadyInspected: true, inspectPassed: true, overallResult: 'PASS', inspectedAt: '2026-09-15 08:00' }
        : { alreadyInspected: false, inspectPassed: false, overallResult: null, inspectedAt: null },
    );
    const status = await service.getGateStatus({ equipCode: 'EQ-1', orderNo: 'W1', scope: 'INSPECTION' }, { company: 'C1', plant: 'P1' });
    expect(status.dailyDone).toBe(true);
    expect(status.workerDone).toBe(false);
    expect(status.blocked).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/equipment/services/equip-inspect-gate.service.spec.ts --runInBand`
Expected: FAIL — `Cannot find module './equip-inspect-gate.service'`

- [ ] **Step 3: 게이트 서비스 구현**

`equip-inspect-gate.service.ts` — 기존 `prod-result.service.ts:757-826` 로직을 그대로 옮기되 `subject`로 문구를 바꾸고 `INSPECTION` 스코프를 추가한다.

```ts
/**
 * @file equip-inspect-gate.service.ts
 * @description 설비점검(DAILY/WORKER) 인터락 판정 단일 출처 — 생산실적과 검사가 같은 함수를 호출한다.
 *
 * 초보자 가이드:
 * 1. equipCode가 없거나 sys-config EQUIP_INSPECT_INTERLOCK='N' 이면 통과
 * 2. EQUIP_INSPECT_ITEM_POOL 에 해당 설비의 DAILY/WORKER 항목이 없으면 점검 대상이 아니므로 통과
 * 3. DAILY는 조업일 window, WORKER는 작업지시(orderNo) 기준으로 완료 여부를 본다
 * 4. 기록이 있어도 종합판정이 PASS가 아니면 차단한다
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { EquipInspectService } from './equip-inspect.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { formatYmdLocal } from '../../../shared/date.util';

const EQUIP_INSPECT_INTERLOCK_KEY = 'EQUIP_INSPECT_INTERLOCK';

export type InspectGateScope = 'ASSEMBLY' | 'SUBASSEMBLY' | 'INSPECTION';

const SCOPE_CONFIG_KEYS: Record<InspectGateScope, { daily: string; worker: string }> = {
  ASSEMBLY: { daily: 'ASSEMBLY_DAILY_INSPECT_REQUIRED', worker: 'ASSEMBLY_WORKER_INSPECT_REQUIRED' },
  SUBASSEMBLY: { daily: 'SUBASSEMBLY_DAILY_INSPECT_REQUIRED', worker: 'SUBASSEMBLY_WORKER_INSPECT_REQUIRED' },
  INSPECTION: { daily: 'INSPECT_DAILY_INSPECT_REQUIRED', worker: 'INSPECT_WORKER_INSPECT_REQUIRED' },
};

export interface InspectGateStatus {
  dailyRequired: boolean;
  dailyDone: boolean;
  dailyResult: string | null;
  dailyInspectedAt: string | null;
  workerRequired: boolean;
  workerDone: boolean;
  workerResult: string | null;
  workerInspectedAt: string | null;
  blocked: boolean;
  blockReason: string | null;
}

interface GateArgs {
  equipCode?: string;
  orderNo?: string;
  scope?: InspectGateScope;
}

interface TenantArgs {
  company?: string;
  plant?: string;
}

@Injectable()
export class EquipInspectGateService {
  constructor(
    @InjectRepository(EquipInspectItemPool)
    private readonly poolRepository: Repository<EquipInspectItemPool>,
    private readonly equipInspectService: EquipInspectService,
    private readonly sysConfigService: SysConfigService,
  ) {}

  async getGateStatus(args: GateArgs, tenant: TenantArgs, subject = '실적'): Promise<InspectGateStatus> {
    const empty: InspectGateStatus = {
      dailyRequired: false, dailyDone: true, dailyResult: null, dailyInspectedAt: null,
      workerRequired: false, workerDone: true, workerResult: null, workerInspectedAt: null,
      blocked: false, blockReason: null,
    };

    const equipCode = args.equipCode?.trim();
    if (!equipCode) return empty;

    const configValue = await this.sysConfigService.getValue(EQUIP_INSPECT_INTERLOCK_KEY, tenant.company, tenant.plant);
    if (typeof configValue === 'string' && configValue.trim().toUpperCase() === 'N') return empty;

    const requiredKeys = args.scope ? SCOPE_CONFIG_KEYS[args.scope] : undefined;
    const [dailyValue, workerValue] = requiredKeys
      ? await Promise.all([
        this.sysConfigService.getValue(requiredKeys.daily, tenant.company, tenant.plant),
        this.sysConfigService.getValue(requiredKeys.worker, tenant.company, tenant.plant),
      ])
      : [null, null];
    const dailyEnabled = !requiredKeys || dailyValue == null || dailyValue.trim().toUpperCase() !== 'N';
    const workerEnabled = !requiredKeys || workerValue == null || workerValue.trim().toUpperCase() !== 'N';

    const poolItems = await this.poolRepository.find({
      where: {
        equipCode,
        useYn: 'Y',
        inspectType: In(['DAILY', 'WORKER']),
        ...(tenant.company ? { company: tenant.company } : {}),
        ...(tenant.plant ? { plant: tenant.plant } : {}),
      },
    });
    const dailyRequired = dailyEnabled && poolItems.some((item) => item.inspectType === 'DAILY');
    const workerRequired = workerEnabled && poolItems.some((item) => item.inspectType === 'WORKER');
    if (!dailyRequired && !workerRequired) return empty;

    const today = formatYmdLocal(new Date());
    const status: InspectGateStatus = { ...empty, dailyRequired, workerRequired };

    if (dailyRequired) {
      const daily = await this.equipInspectService.getInspectionStatus(
        { equipCode, inspectType: 'DAILY', inspectDate: today },
        { company: tenant.company, plant: tenant.plant },
      );
      status.dailyResult = daily.overallResult ?? null;
      status.dailyInspectedAt = daily.inspectedAt ?? null;
      status.dailyDone = daily.alreadyInspected && daily.inspectPassed;
      if (!daily.alreadyInspected) {
        status.blocked = true;
        status.blockReason = `설비 일상점검을 완료해야 ${subject}을 등록할 수 있습니다: ${equipCode}`;
        return status;
      }
      if (!daily.inspectPassed) {
        status.blocked = true;
        status.blockReason = `설비 일상점검 종합판정이 불합격(${daily.overallResult ?? '미판정'})이므로 ${subject}을 등록할 수 없습니다: ${equipCode} — 조치 후 재점검하세요.`;
        return status;
      }
    }

    if (workerRequired) {
      if (!args.orderNo) {
        status.workerDone = false;
        status.blocked = true;
        status.blockReason = `작업자 설비점검 확인에는 작업지시번호가 필요합니다: ${equipCode}`;
        return status;
      }
      const worker = await this.equipInspectService.getInspectionStatus(
        { equipCode, inspectType: 'WORKER', inspectDate: today, orderNo: args.orderNo },
        { company: tenant.company, plant: tenant.plant },
      );
      status.workerResult = worker.overallResult ?? null;
      status.workerInspectedAt = worker.inspectedAt ?? null;
      status.workerDone = worker.alreadyInspected && worker.inspectPassed;
      if (!worker.alreadyInspected) {
        status.blocked = true;
        status.blockReason = `작업자 설비점검을 완료해야 ${subject}을 등록할 수 있습니다: ${equipCode} (작업지시 ${args.orderNo})`;
        return status;
      }
      if (!worker.inspectPassed) {
        status.blocked = true;
        status.blockReason = `작업자 설비점검 종합판정이 불합격(${worker.overallResult ?? '미판정'})이므로 ${subject}을 등록할 수 없습니다: ${equipCode} (작업지시 ${args.orderNo}) — 조치 후 재점검하세요.`;
        return status;
      }
    }

    return status;
  }

  async assertGate(args: GateArgs, tenant: TenantArgs, subject = '실적'): Promise<void> {
    const status = await this.getGateStatus(args, tenant, subject);
    if (status.blocked && status.blockReason) {
      throw new BadRequestException(status.blockReason);
    }
  }
}
```

`equipment.module.ts`의 `providers`와 `exports`에 `EquipInspectGateService`를 추가한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/equipment/services/equip-inspect-gate.service.spec.ts --runInBand`
Expected: PASS (6 tests)

- [ ] **Step 5: ProdResultService 위임**

`prod-result.service.ts`의 `assertEquipInspectGate` 본문을 다음으로 교체한다. 기존 문구를 유지하려고 `subject`는 기본값(`'실적'`)을 쓴다.

```ts
  async assertEquipInspectGate(
    dto: Pick<CreateProdResultDto, 'equipCode' | 'orderNo'>,
    company?: string,
    plant?: string,
    scope?: ProductionInspectScope,
  ): Promise<void> {
    await this.equipInspectGateService.assertGate(
      { equipCode: dto.equipCode, orderNo: dto.orderNo, scope },
      { company, plant },
    );
  }
```

`ProductionInspectScope`는 `InspectGateScope`에서 재사용하도록 `import type { InspectGateScope } from '../../equipment/services/equip-inspect-gate.service';` 후 `type ProductionInspectScope = Extract<InspectGateScope, 'ASSEMBLY' | 'SUBASSEMBLY'>;`로 바꾸고, 더 이상 쓰지 않는 `INSPECT_REQUIRED_KEYS`, `EQUIP_INSPECT_INTERLOCK_KEY` 상수와 `equipInspectItemPoolRepository` 주입 중 이 게이트 전용 사용처를 정리한다(다른 곳에서 쓰면 남긴다). 생성자에 `private readonly equipInspectGateService: EquipInspectGateService`를 추가한다.

- [ ] **Step 6: 기존 회귀 테스트 통과 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/production/services/prod-result.service.spec.ts src/modules/production/services/subprocess-kitting.service.spec.ts --runInBand`
Expected: PASS — 인터락 관련 기존 케이스(`설비 일상점검을 완료해야`, `종합판정이 불합격`)가 그대로 통과. 테스트가 `ProdResultService`를 직접 구성하므로 `EquipInspectGateService` mock provider를 추가해야 하면 spec의 providers에 `{ provide: EquipInspectGateService, useValue: { assertGate: jest.fn() } }`를 넣고, 인터락 메시지를 검증하는 기존 케이스는 실제 게이트 서비스 인스턴스를 쓰도록 유지한다.

- [ ] **Step 7: 타입검사**

Run: `pnpm.cmd run typecheck:backend`
Expected: 오류 0

- [ ] **Step 8: 커밋**

```bash
git add apps/backend/src/modules/equipment/services/equip-inspect-gate.service.ts apps/backend/src/modules/equipment/services/equip-inspect-gate.service.spec.ts apps/backend/src/modules/equipment/equipment.module.ts apps/backend/src/modules/production/services/prod-result.service.ts
git commit -F <임시파일>
```

메시지: `refactor(equipment): 설비점검 인터락 판정을 EquipInspectGateService로 단일화한다`

---

### Task 3: 양불 대조 엔티티와 서비스

**Files:**
- Create: `apps/backend/src/entities/inspect-sample-check.entity.ts`
- Create: `apps/backend/src/entities/inspect-sample-check-item.entity.ts`
- Modify: `apps/backend/src/entities/inspect-aid.entity.ts`
- Create: `apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.ts`
- Create: `apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.spec.ts`
- Create: `apps/backend/src/modules/quality/continuity-inspect/dto/inspect-sample-check.dto.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/continuity-inspect.module.ts`

**Interfaces:**
- Consumes: `EquipInspectGateService`(Task 2), `SeqGeneratorService.getNo('SMP_CHK')`, `EquipInspectService.getInspectionStatus`(조업일 `workDate`), `ShiftResolver`
- Produces:
  ```ts
  export interface SampleCheckCandidate {
    aidCode: string; aidName: string; aidType: 'LIMIT_OK' | 'LIMIT_NG';
    expectedResult: 'PASS' | 'FAIL'; requiredYn: string; sortOrder: number;
    imageUrl: string | null; defectCode: string | null;
    validTo: string | null; expired: boolean; status: string;
  }
  export interface SampleCheckStatus {
    required: boolean; done: boolean; checkNo: string | null;
    overallResult: string | null; checkedAt: string | null;
    workDate: string; shiftCode: string; blockReason: string | null;
  }
  class InspectSampleCheckService {
    getCandidates(itemCode: string, inspectType: string, tenant): Promise<SampleCheckCandidate[]>;
    getStatus(args: { orderNo: string; inspectType: string; equipCode: string; itemCode: string }, tenant): Promise<SampleCheckStatus>;
    create(dto: CreateSampleCheckDto, actor: { userId: string }, tenant): Promise<{ checkNo: string; overallResult: 'PASS' | 'NG' }>;
    assertReady(args: { orderNo: string; inspectType: string; equipCode: string; itemCode: string }, tenant): Promise<void>;
    findHistory(args: { orderNo: string; inspectType: string }, tenant): Promise<SampleCheckHistoryRow[]>;
  }
  ```

- [ ] **Step 1: 엔티티 작성**

`inspect-sample-check.entity.ts`:

```ts
/**
 * @file inspect-sample-check.entity.ts
 * @description 양불마스터(한도견본) 대조 헤더 — 통전·단자검사 시작 전 검사기 유효성 확인 기록
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + CHECK_NO (채번 docType 'SMP_CHK')
 * 2. 재대조는 갱신이 아니라 새 행. 유효 판정은 같은 키의 최신 CHECKED_AT 1건
 * 3. SHIFT_CODE 미판별 시 'NONE'
 */
import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'INSPECT_SAMPLE_CHECKS' })
@Index(['company', 'plant', 'orderNo', 'inspectType', 'equipCode', 'workDate', 'shiftCode'])
export class InspectSampleCheck {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'CHECK_NO', length: 30 })
  checkNo: string;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ name: 'INSPECT_TYPE', length: 30 })
  inspectType: string;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ name: 'WORK_DATE', type: 'date' })
  workDate: Date;

  @Column({ name: 'SHIFT_CODE', length: 20, default: 'NONE' })
  shiftCode: string;

  @Column({ name: 'OVERALL_RESULT', length: 10 })
  overallResult: string;

  @Column({ type: 'varchar2', name: 'CHECKER_ID', length: 50, nullable: true })
  checkerId: string | null;

  @Column({ name: 'CHECKED_AT', type: 'timestamp' })
  checkedAt: Date;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

`inspect-sample-check-item.entity.ts`:

```ts
/**
 * @file inspect-sample-check-item.entity.ts
 * @description 양불마스터 대조 샘플별 결과 — 기대결과(견본유형)와 검사기 실제결과 비교
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'INSPECT_SAMPLE_CHECK_ITEMS' })
export class InspectSampleCheckItem {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'CHECK_NO', length: 30 })
  checkNo: string;

  @PrimaryColumn({ name: 'SEQ_NO', type: 'number' })
  seqNo: number;

  @Column({ name: 'AID_CODE', length: 50 })
  aidCode: string;

  @Column({ name: 'AID_TYPE', length: 30 })
  aidType: string;

  @Column({ name: 'EXPECTED_RESULT', length: 10 })
  expectedResult: string;

  @Column({ name: 'ACTUAL_RESULT', length: 10 })
  actualResult: string;

  @Column({ name: 'RESULT', length: 10 })
  result: string;

  @Column({ name: 'SCANNED_AT', type: 'timestamp', nullable: true })
  scannedAt: Date | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
```

`inspect-aid.entity.ts`에 컬럼 3개 추가:

```ts
  @Column({ type: 'varchar2', name: 'INSPECT_TYPE', length: 30, nullable: true })
  inspectType: string | null;

  @Column({ name: 'REQUIRED_YN', length: 1, default: 'Y' })
  requiredYn: string;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder: number;
```

- [ ] **Step 2: DTO 작성**

`dto/inspect-sample-check.dto.ts`:

```ts
/**
 * @file inspect-sample-check.dto.ts
 * @description 양불마스터 대조 DTO — 견본별 검사기 실제결과만 받고 OK/NG는 서버가 산출한다.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export const SAMPLE_CHECK_INSPECT_TYPES = ['CONTINUITY', 'TERMINAL'] as const;
export const SAMPLE_ACTUAL_RESULTS = ['PASS', 'FAIL'] as const;

export class SampleCheckItemDto {
  @ApiProperty({ description: '한도견본 코드 (INSPECT_AIDS.AID_CODE, 바코드 스캔값)' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  aidCode: string;

  @ApiProperty({ description: '검사기 실제 결과', enum: SAMPLE_ACTUAL_RESULTS })
  @IsIn([...SAMPLE_ACTUAL_RESULTS])
  actualResult: string;

  @ApiPropertyOptional({ description: '바코드 스캔 시각 (ISO)' })
  @IsOptional() @IsString()
  scannedAt?: string | null;

  @ApiPropertyOptional({ description: '비고 / NG 사유' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
}

export class CreateSampleCheckDto {
  @ApiProperty({ description: '작업지시번호' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '검사유형', enum: SAMPLE_CHECK_INSPECT_TYPES })
  @IsIn([...SAMPLE_CHECK_INSPECT_TYPES])
  inspectType: string;

  @ApiProperty({ description: '검사기 설비코드' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  equipCode: string;

  @ApiProperty({ description: '품목코드' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '견본별 결과', type: [SampleCheckItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SampleCheckItemDto)
  items: SampleCheckItemDto[];

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
}
```

- [ ] **Step 3: 실패하는 서비스 테스트 작성**

`services/inspect-sample-check.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { InspectSampleCheckService } from './inspect-sample-check.service';
import { InspectAid } from '../../../../entities/inspect-aid.entity';
import { InspectSampleCheck } from '../../../../entities/inspect-sample-check.entity';
import { InspectSampleCheckItem } from '../../../../entities/inspect-sample-check-item.entity';
import { ShiftPattern } from '../../../../entities/shift-pattern.entity';
import { EquipMaster } from '../../../../entities/equip-master.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';

const TENANT = { company: 'C1', plant: 'P1' };

function aid(over: Partial<InspectAid>): InspectAid {
  return {
    company: 'C1', plant: 'P1', aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본',
    itemCode: 'ITEM-1', processCode: null, defectCode: null, imageUrl: null, location: null,
    validFrom: null, validTo: null, approvedBy: null, approvedAt: null, status: 'ACTIVE',
    remark: null, useYn: 'Y', inspectType: 'CONTINUITY', requiredYn: 'Y', sortOrder: 1,
    createdBy: null, updatedBy: null, createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as InspectAid;
}

describe('InspectSampleCheckService', () => {
  let service: InspectSampleCheckService;
  const aidRepo = { find: jest.fn() };
  const checkRepo = { findOne: jest.fn(), find: jest.fn() };
  const itemRepo = { find: jest.fn() };
  const shiftRepo = { find: jest.fn() };
  const equipRepo = { findOne: jest.fn() };
  const seq = { getNo: jest.fn() };
  const savedChecks: InspectSampleCheck[] = [];
  const savedItems: InspectSampleCheckItem[][] = [];
  const manager = {
    save: jest.fn(async (_entity: unknown, value: unknown) => {
      if (Array.isArray(value)) savedItems.push(value as InspectSampleCheckItem[]);
      else savedChecks.push(value as InspectSampleCheck);
      return value;
    }),
  };
  const dataSource = {
    createQueryRunner: () => ({
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), manager,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    savedChecks.length = 0;
    savedItems.length = 0;
    seq.getNo.mockResolvedValue('SMC-20260915-0001');
    shiftRepo.find.mockResolvedValue([{ shiftCode: 'DAY', startTime: '08:00', endTime: '20:00', useYn: 'Y', sortOrder: 1 }]);
    equipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-1', company: 'C1', plant: 'P1' });
    checkRepo.findOne.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        InspectSampleCheckService,
        { provide: getRepositoryToken(InspectAid), useValue: aidRepo },
        { provide: getRepositoryToken(InspectSampleCheck), useValue: checkRepo },
        { provide: getRepositoryToken(InspectSampleCheckItem), useValue: itemRepo },
        { provide: getRepositoryToken(ShiftPattern), useValue: shiftRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: equipRepo },
        { provide: SeqGeneratorService, useValue: seq },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(InspectSampleCheckService);
  });

  it('양품견본은 PASS, 불량견본은 FAIL일 때 종합 PASS로 저장한다', async () => {
    aidRepo.find.mockResolvedValue([aid({}), aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG', sortOrder: 2 })]);
    const res = await service.create(
      {
        orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1',
        items: [
          { aidCode: 'OK-1', actualResult: 'PASS' },
          { aidCode: 'NG-1', actualResult: 'FAIL' },
        ],
      },
      { userId: 'U1', workerId: 'W-100' },
      TENANT,
    );
    expect(res.overallResult).toBe('PASS');
    expect(savedChecks[0].checkerId).toBe('W-100');
    expect(savedChecks[0].createdBy).toBe('U1');
    expect(savedItems[0].map((i) => i.result)).toEqual(['OK', 'OK']);
  });

  it('불량견본이 PASS로 나오면 NG로 판정한다', async () => {
    aidRepo.find.mockResolvedValue([aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG' })]);
    const res = await service.create(
      { orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1', items: [{ aidCode: 'NG-1', actualResult: 'PASS' }] },
      { userId: 'U1', workerId: 'W-100' },
      TENANT,
    );
    expect(res.overallResult).toBe('NG');
    expect(savedItems[0][0].result).toBe('NG');
  });

  it('필수 견본이 빠지면 저장을 거부한다', async () => {
    aidRepo.find.mockResolvedValue([aid({}), aid({ aidCode: 'NG-1', aidType: 'LIMIT_NG' })]);
    await expect(service.create(
      { orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1', items: [{ aidCode: 'OK-1', actualResult: 'PASS' }] },
      { userId: 'U1', workerId: 'W-100' }, TENANT,
    )).rejects.toThrow(/필수 한도견본/);
  });

  it('후보에 없는 코드를 스캔하면 거부한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    await expect(service.create(
      { orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1', items: [{ aidCode: 'UNKNOWN', actualResult: 'PASS' }] },
      { userId: 'U1', workerId: 'W-100' }, TENANT,
    )).rejects.toThrow(/등록되지 않은 한도견본/);
  });

  it('유효기간이 지난 필수 견본이 있으면 거부한다', async () => {
    aidRepo.find.mockResolvedValue([aid({ validTo: new Date('2020-01-01') })]);
    await expect(service.create(
      { orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1', items: [{ aidCode: 'OK-1', actualResult: 'PASS' }] },
      { userId: 'U1', workerId: 'W-100' }, TENANT,
    )).rejects.toThrow(/유효기간/);
  });

  it('필수 견본이 0건이면 대조 없이 통과 상태를 돌려준다', async () => {
    aidRepo.find.mockResolvedValue([]);
    const status = await service.getStatus({ orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' }, TENANT);
    expect(status.required).toBe(false);
    expect(status.done).toBe(true);
    await expect(service.assertReady({ orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' }, TENANT)).resolves.toBeUndefined();
  });

  it('대조 기록이 없으면 검사를 차단한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    checkRepo.findOne.mockResolvedValue(null);
    await expect(service.assertReady({ orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' }, TENANT))
      .rejects.toThrow(BadRequestException);
  });

  it('최신 대조가 NG면 검사를 차단한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    checkRepo.findOne.mockResolvedValue({ checkNo: 'SMC-1', overallResult: 'NG', checkedAt: new Date() });
    await expect(service.assertReady({ orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' }, TENANT))
      .rejects.toThrow(/대조 결과가 불합격/);
  });

  it('최신 대조가 PASS면 통과한다', async () => {
    aidRepo.find.mockResolvedValue([aid({})]);
    checkRepo.findOne.mockResolvedValue({ checkNo: 'SMC-1', overallResult: 'PASS', checkedAt: new Date() });
    await expect(service.assertReady({ orderNo: 'W1', inspectType: 'CONTINUITY', equipCode: 'EQ-1', itemCode: 'ITEM-1' }, TENANT))
      .resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/quality/continuity-inspect/services/inspect-sample-check.service.spec.ts --runInBand`
Expected: FAIL — 모듈 없음

- [ ] **Step 5: 서비스 구현**

`services/inspect-sample-check.service.ts` 구현 요건:

1. `getCandidates(itemCode, inspectType, tenant)`
   - `aidRepo.find({ where: [...] })`로 `useYn='Y'`, `aidType IN ('LIMIT_OK','LIMIT_NG')`, (`itemCode` 일치 OR `itemCode IS NULL`), (`inspectType` 일치 OR `inspectType IS NULL`) 조회.
   - 정렬은 `sortOrder ASC, aidCode ASC`.
   - 각 행을 `SampleCheckCandidate`로 변환한다. `expectedResult = aidType === 'LIMIT_OK' ? 'PASS' : 'FAIL'`, `expired = (validTo != null && validTo < 오늘) || status !== 'ACTIVE'`.
2. 조업일·교대 산출 `resolveWindow(equipCode, tenant)`
   - 조업일: `EquipInspectService.getInspectionStatus({ equipCode, inspectType: 'DAILY', inspectDate: formatYmdLocal(new Date()) }, tenant)`의 `workDate`. null이면 `formatYmdLocal(new Date())`.
   - 교대: `new ShiftResolver(shiftRepo).resolve(new Date(), company, plant) ?? 'NONE'`.
3. `getStatus(...)`
   - 후보 중 `requiredYn === 'Y' && !expired`가 0건이면 `{ required: false, done: true, ... }`.
   - 필수 후보 중 `expired`가 1건이라도 있으면 `{ required: true, done: false, blockReason: '한도견본 유효기간이 만료되어 대조할 수 없습니다: <코드> (만료 <일자>)' }`.
   - 그 외에는 `checkRepo.findOne({ where: { company, plant, orderNo, inspectType, equipCode, workDate, shiftCode }, order: { checkedAt: 'DESC' } })`로 최신 1건을 읽어 `done = overallResult === 'PASS'`.
4. `assertReady(...)` — `getStatus`가 `required && !done`이면 `BadRequestException(status.blockReason ?? 기본 문구)`.
   - 기록 없음: `양불마스터 대조를 완료해야 검사를 등록할 수 있습니다: <equipCode> (<workDate> <shiftCode>)`
   - 최신 NG: `양불마스터 대조 결과가 불합격입니다 — 검사기 점검 후 재대조하세요: <checkNo>`
5. `create(dto, actor, tenant)`
   - 후보를 다시 조회한다. 요청 항목 중 후보에 없는 `aidCode`가 있으면 `BadRequestException('등록되지 않은 한도견본입니다: <코드>')`.
   - 필수 후보 중 요청에 없는 것이 있으면 `BadRequestException('필수 한도견본 대조가 누락되었습니다: <코드>')`.
   - 요청 항목의 견본이 만료면 `BadRequestException('한도견본 유효기간이 만료되어 대조할 수 없습니다: <코드> (만료 <일자>)')`.
   - `result = actualResult === expectedResult ? 'OK' : 'NG'`, `overallResult = 필수 항목 전부 OK ? 'PASS' : 'NG'`.
   - `checkNo = await seq.getNo('SMP_CHK', queryRunner)`.
   - `queryRunner` 트랜잭션으로 헤더 1건 + 아이템 N건 저장. `checkerId = actor.workerId ?? actor.userId`, `createdBy = actor.userId`.
   - 실패 시 `rollbackTransaction`, `finally`에서 `release`.
6. `findHistory({ orderNo, inspectType }, tenant)` — 헤더를 `checkedAt DESC`로 최대 50건, 각 헤더의 아이템을 `itemRepo.find`로 묶어 반환.

모든 예외는 `catch (error: unknown)` 규칙을 지키고 `as any`를 쓰지 않는다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/quality/continuity-inspect/services/inspect-sample-check.service.spec.ts --runInBand`
Expected: PASS (9 tests)

- [ ] **Step 7: 모듈 등록**

`continuity-inspect.module.ts`의 `TypeOrmModule.forFeature([...])`에 `InspectAid`, `InspectSampleCheck`, `InspectSampleCheckItem`, `ShiftPattern`, `EquipMaster`를 추가하고, `imports`에 `EquipmentModule`을, `providers`/`exports`에 `InspectSampleCheckService`를 추가한다. 순환참조가 생기면 `forwardRef(() => EquipmentModule)`를 쓴다.

- [ ] **Step 8: 타입검사 후 커밋**

```bash
pnpm.cmd run typecheck:backend
git add apps/backend/src/entities/inspect-sample-check.entity.ts apps/backend/src/entities/inspect-sample-check-item.entity.ts apps/backend/src/entities/inspect-aid.entity.ts apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.ts apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.spec.ts apps/backend/src/modules/quality/continuity-inspect/dto/inspect-sample-check.dto.ts apps/backend/src/modules/quality/continuity-inspect/continuity-inspect.module.ts
git commit -F <임시파일>
```

메시지: `feat(quality): 양불마스터 대조 기록 서비스를 추가한다`

---

### Task 4: 검사 API — prep-status·대조 엔드포인트와 등록 차단

**Files:**
- Modify: `apps/backend/src/modules/quality/continuity-inspect/controllers/continuity-inspect.controller.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts` (`ContinuityInspectDto`에 `workerId` 추가)
- Create: `apps/backend/src/modules/quality/continuity-inspect/services/inspect-gate-integration.spec.ts`

**Interfaces:**
- Consumes: `EquipInspectGateService.getGateStatus/assertGate`(Task 2), `InspectSampleCheckService`(Task 3)
- Produces:
  ```ts
  // GET /quality/continuity-inspect/prep-status
  interface InspectPrepStatusResponse {
    equipCode: string | null;
    gate: InspectGateStatus;
    sampleCheck: SampleCheckStatus;
    ready: boolean;
    blockReason: string | null;
  }
  ```

- [ ] **Step 1: 통합 테스트 작성 (실패)**

`services/inspect-gate-integration.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { ContinuityInspectService } from './continuity-inspect.service';

describe('ContinuityInspectService 검사 등록 게이트', () => {
  it('설비점검 게이트가 막으면 검사를 등록하지 않는다', async () => {
    const gate = { assertGate: jest.fn().mockRejectedValue(new BadRequestException('설비 일상점검을 완료해야 검사를 등록할 수 있습니다: EQ-1')) };
    const sample = { assertReady: jest.fn() };
    const service = Object.create(ContinuityInspectService.prototype) as ContinuityInspectService;
    Object.assign(service, { equipInspectGateService: gate, inspectSampleCheckService: sample });

    await expect(
      (service as unknown as { assertInspectPrepGate: (dto: unknown, c: string, p: string) => Promise<void> })
        .assertInspectPrepGate({ equipCode: 'EQ-1', orderNo: 'W1', inspectType: 'CONTINUITY', itemCode: 'ITEM-1' }, 'C1', 'P1'),
    ).rejects.toThrow('설비 일상점검을 완료해야 검사를 등록할 수 있습니다: EQ-1');
    expect(sample.assertReady).not.toHaveBeenCalled();
  });

  it('설비점검이 통과하면 양불 대조까지 확인한다', async () => {
    const gate = { assertGate: jest.fn().mockResolvedValue(undefined) };
    const sample = { assertReady: jest.fn().mockRejectedValue(new BadRequestException('양불마스터 대조를 완료해야 검사를 등록할 수 있습니다: EQ-1 (2026-09-15 DAY)')) };
    const service = Object.create(ContinuityInspectService.prototype) as ContinuityInspectService;
    Object.assign(service, { equipInspectGateService: gate, inspectSampleCheckService: sample });

    await expect(
      (service as unknown as { assertInspectPrepGate: (dto: unknown, c: string, p: string) => Promise<void> })
        .assertInspectPrepGate({ equipCode: 'EQ-1', orderNo: 'W1', inspectType: 'CONTINUITY', itemCode: 'ITEM-1' }, 'C1', 'P1'),
    ).rejects.toThrow(/양불마스터 대조를 완료해야/);
    expect(gate.assertGate).toHaveBeenCalled();
  });

  it('equipCode가 없으면 게이트를 호출하지 않는다', async () => {
    const gate = { assertGate: jest.fn() };
    const sample = { assertReady: jest.fn() };
    const service = Object.create(ContinuityInspectService.prototype) as ContinuityInspectService;
    Object.assign(service, { equipInspectGateService: gate, inspectSampleCheckService: sample });

    await (service as unknown as { assertInspectPrepGate: (dto: unknown, c: string, p: string) => Promise<void> })
      .assertInspectPrepGate({ orderNo: 'W1', inspectType: 'CONTINUITY', itemCode: 'ITEM-1' }, 'C1', 'P1');
    expect(gate.assertGate).not.toHaveBeenCalled();
    expect(sample.assertReady).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/quality/continuity-inspect/services/inspect-gate-integration.spec.ts --runInBand`
Expected: FAIL — `assertInspectPrepGate is not a function`

- [ ] **Step 3: 서비스에 게이트 메서드 추가**

`continuity-inspect.service.ts` 생성자에 `private readonly equipInspectGateService: EquipInspectGateService`, `private readonly inspectSampleCheckService: InspectSampleCheckService`를 주입하고 다음을 추가한다.

```ts
  /**
   * 검사 등록 준비 게이트 — 화면 우회 호출도 같은 규칙으로 막는다.
   * equipCode가 없으면(검사기 미선택 경로) 게이트를 적용하지 않는다.
   */
  async assertInspectPrepGate(
    dto: { equipCode?: string | null; orderNo?: string | null; inspectType?: string | null; itemCode?: string | null },
    company: string,
    plant: string,
  ): Promise<void> {
    const equipCode = dto.equipCode?.trim();
    if (!equipCode) return;
    const orderNo = dto.orderNo ?? undefined;
    await this.equipInspectGateService.assertGate(
      { equipCode, orderNo, scope: 'INSPECTION' },
      { company, plant },
      '검사',
    );
    if (dto.orderNo && dto.itemCode && dto.inspectType) {
      await this.inspectSampleCheckService.assertReady(
        { orderNo: dto.orderNo, inspectType: dto.inspectType, equipCode, itemCode: dto.itemCode },
        { company, plant },
      );
    }
  }
```

검사 등록 진입점(`inspect` 계열 public 메서드 — 단건 등록과 일괄 등록 모두)에서 저장 직전에 이 메서드를 호출한다. 호출 위치는 기존 검증들과 같은 순서 구역(작업지시·라벨 검증 뒤, 저장 앞)이다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/quality/continuity-inspect/services/inspect-gate-integration.spec.ts --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: 검사자 기록**

`ContinuityInspectDto`에 다음을 추가한다.

```ts
  @ApiPropertyOptional({ description: '대표 작업자 ID (검사자로 기록)' })
  @IsOptional() @IsString() @MaxLength(50)
  workerId?: string | null;
```

검사 등록 시 `INSPECT_RESULTS.INSPECTOR_ID`에 `dto.workerId ?? null`을 넣는다(기존 `inspectorId` 경로 재사용). 서버는 `PATCH /equipment/equips/{equipCode}/workers`로 저장된 현재 작업자 목록을 조회해, `workerId`가 그 목록에 없으면 `BadRequestException('선택된 작업자가 검사기의 현재 작업자가 아닙니다: <workerId>')`로 거부한다. 현재 작업자가 0명이면 `BadRequestException('작업자를 1명 이상 선택해야 검사를 등록할 수 있습니다: <equipCode>')`.

- [ ] **Step 6: 컨트롤러 엔드포인트 추가**

`continuity-inspect.controller.ts`에 추가한다.

```ts
  @Get('prep-status')
  @ApiOperation({ summary: '검사 준비 상태(설비점검 + 양불대조) 조회' })
  @ApiQuery({ name: 'orderNo', required: true })
  @ApiQuery({ name: 'inspectType', required: true })
  @ApiQuery({ name: 'equipCode', required: false })
  @ApiQuery({ name: 'itemCode', required: true })
  async getPrepStatus(
    @Company() company: string,
    @Plant() plant: string,
    @Query('orderNo') orderNo: string,
    @Query('inspectType') inspectType: string,
    @Query('itemCode') itemCode: string,
    @Query('equipCode') equipCode?: string,
  ) {
    const data = await this.continuityInspectService.getPrepStatus(
      { orderNo, inspectType, itemCode, equipCode },
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  @Get('sample-check/candidates')
  @ApiOperation({ summary: '양불마스터 대조 대상 한도견본 조회' })
  async getSampleCheckCandidates(
    @Company() company: string,
    @Plant() plant: string,
    @Query('itemCode') itemCode: string,
    @Query('inspectType') inspectType: string,
  ) {
    const data = await this.inspectSampleCheckService.getCandidates(itemCode, inspectType, { company, plant });
    return ResponseUtil.success(data);
  }

  @Post('sample-check')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '양불마스터 대조 결과 등록' })
  async createSampleCheck(
    @Company() company: string,
    @Plant() plant: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateSampleCheckDto,
  ) {
    const data = await this.inspectSampleCheckService.create(dto, { userId: user.userId }, { company, plant });
    return ResponseUtil.success(data, '양불마스터 대조가 등록되었습니다.');
  }

  @Get('sample-check/history')
  @ApiOperation({ summary: '양불마스터 대조 이력 조회' })
  async getSampleCheckHistory(
    @Company() company: string,
    @Plant() plant: string,
    @Query('orderNo') orderNo: string,
    @Query('inspectType') inspectType: string,
  ) {
    const data = await this.inspectSampleCheckService.findHistory({ orderNo, inspectType }, { company, plant });
    return ResponseUtil.success(data);
  }
```

`@CurrentUser()` 데코레이터는 이 컨트롤러에서 이미 쓰는 사용자 주입 방식과 동일한 것을 쓴다(없으면 다른 컨트롤러에서 쓰는 방식을 그대로 따른다). `getPrepStatus`는 `ContinuityInspectService`에 다음으로 구현한다.

```ts
  async getPrepStatus(
    args: { orderNo: string; inspectType: string; itemCode: string; equipCode?: string },
    company: string,
    plant: string,
  ) {
    const equipCode = args.equipCode?.trim() || null;
    const gate = await this.equipInspectGateService.getGateStatus(
      { equipCode: equipCode ?? undefined, orderNo: args.orderNo, scope: 'INSPECTION' },
      { company, plant },
      '검사',
    );
    const sampleCheck = equipCode
      ? await this.inspectSampleCheckService.getStatus(
        { orderNo: args.orderNo, inspectType: args.inspectType, equipCode, itemCode: args.itemCode },
        { company, plant },
      )
      : null;
    const blockReason = gate.blockReason ?? sampleCheck?.blockReason ?? null;
    return {
      equipCode,
      gate,
      sampleCheck,
      ready: Boolean(equipCode) && !gate.blocked && (sampleCheck?.done ?? false),
      blockReason,
    };
  }
```

- [ ] **Step 7: 백엔드 전체 단위테스트와 타입검사**

Run: `pnpm --dir apps/backend run test:unit`
Expected: 기존 통과 스위트가 계속 통과

Run: `pnpm.cmd run typecheck:backend`
Expected: 오류 0

- [ ] **Step 8: 커밋**

```bash
git add apps/backend/src/modules/quality/continuity-inspect/controllers/continuity-inspect.controller.ts apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts apps/backend/src/modules/quality/continuity-inspect/services/inspect-gate-integration.spec.ts apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts
git commit -F <임시파일>
```

메시지: `feat(quality): 검사 등록 전 설비점검·양불대조 게이트를 서버에서 강제한다`

---

### Task 5: 검사보조구 마스터 API 3필드 반영

**Files:**
- Modify: `apps/backend/src/modules/master/dto/inspect-aid.dto.ts`
- Modify: `apps/backend/src/modules/master/services/inspect-aid.service.ts`
- Create: `apps/backend/src/modules/master/services/inspect-aid-inspect-type.spec.ts`

**Interfaces:**
- Consumes: `InspectAid` 엔티티(Task 3에서 확장)
- Produces: `CreateInspectAidDto.inspectType/requiredYn/sortOrder`, 목록 필터 `inspectType`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInspectAidDto } from '../dto/inspect-aid.dto';

describe('CreateInspectAidDto 검사유형 필드', () => {
  it('CONTINUITY / TERMINAL 을 허용한다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, {
      aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본', inspectType: 'TERMINAL', requiredYn: 'Y', sortOrder: 3,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('알 수 없는 검사유형은 거부한다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, {
      aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본', inspectType: 'XRAY',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'inspectType')).toBe(true);
  });

  it('requiredYn 기본값은 Y다', async () => {
    const dto = plainToInstance(CreateInspectAidDto, { aidCode: 'OK-1', aidType: 'LIMIT_OK', aidName: '양품견본' });
    expect(dto.requiredYn ?? 'Y').toBe('Y');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/master/services/inspect-aid-inspect-type.spec.ts --runInBand`
Expected: FAIL — `inspectType`이 DTO에 없어 unknown 값이 통과

- [ ] **Step 3: DTO·서비스 구현**

`inspect-aid.dto.ts`:

```ts
export const INSPECT_AID_INSPECT_TYPES = ['CONTINUITY', 'TERMINAL'] as const;
```

`CreateInspectAidDto`에 추가:

```ts
  @ApiPropertyOptional({ description: '적용 검사유형 (NULL=전 검사유형 공통)', enum: INSPECT_AID_INSPECT_TYPES })
  @IsOptional() @IsIn([...INSPECT_AID_INSPECT_TYPES])
  inspectType?: string | null;

  @ApiPropertyOptional({ description: '대조 필수 여부', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  requiredYn?: string;

  @ApiPropertyOptional({ description: '대조 표시 순서', default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
```

`InspectAidQueryDto`에 `inspectType` 선택 필터를 추가한다(`@IsOptional() @IsIn([...INSPECT_AID_INSPECT_TYPES])`).

`inspect-aid.service.ts`:
- `create`/`update`에서 세 필드를 매핑한다. `requiredYn` 기본 `'Y'`, `sortOrder` 기본 `0`.
- `aidType === 'HOLDER'`면 `requiredYn`을 `'N'`으로 강제한다(홀더는 대조 대상이 아니다).
- 목록 조회에 `inspectType` 필터를 적용하고 정렬에 `sortOrder ASC`를 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --dir apps/backend exec jest src/modules/master/services/inspect-aid-inspect-type.spec.ts --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/master/dto/inspect-aid.dto.ts apps/backend/src/modules/master/services/inspect-aid.service.ts apps/backend/src/modules/master/services/inspect-aid-inspect-type.spec.ts
git commit -F <임시파일>
```

메시지: `feat(master): 검사보조구에 검사유형·대조필수·표시순서를 추가한다`

---

### Task 6: 기준정보 화면에 3필드 노출

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/InspectAidFormPanel.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/inspectAidColumns.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/page.tsx` (타입·기본값)
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

**Interfaces:**
- Consumes: Task 5의 API 필드
- Produces: 화면에서 `inspectType`, `requiredYn`, `sortOrder` 입력·표시

- [ ] **Step 1: i18n 키 추가 (4개 파일 동시)**

`master.inspectAid` 블록에 추가한다.

```json
"inspectType": "적용 검사유형",
"inspectTypeAll": "전 검사유형 공통",
"requiredYn": "대조 필수",
"sortOrder": "표시순서",
"requiredHint": "대조 필수인 견본은 검사 시작 전 반드시 대조해야 합니다."
```

en: `"Inspection Type" / "All inspection types" / "Comparison Required" / "Sort Order" / "Required samples must be verified before inspection starts."`
zh: `"适用检查类型" / "所有检查类型通用" / "必须比对" / "显示顺序" / "必须比对的样品在检查开始前必须完成比对。"`
vi: `"Loại kiểm tra áp dụng" / "Dùng chung cho mọi loại kiểm tra" / "Bắt buộc đối chiếu" / "Thứ tự hiển thị" / "Mẫu bắt buộc phải được đối chiếu trước khi bắt đầu kiểm tra."`

BOM 없이 저장한다.

- [ ] **Step 2: 폼 필드 추가**

`InspectAidFormPanel.tsx`에 세 필드를 추가한다.
- 검사유형: `ComCodeSelect`(groupCode `INSPECT_TYPE`), 빈 값 옵션 라벨은 `master.inspectAid.inspectTypeAll`. 자유 입력 금지.
- 대조 필수: `Y/N` 토글(기존 `useYn` 컨트롤과 같은 컴포넌트 사용). `aidType === 'HOLDER'`면 비활성 + `N` 고정.
- 표시순서: 숫자 입력(0 이상).
- 액션 버튼(저장/취소)은 기존대로 패널 상단에 둔다.

- [ ] **Step 3: 목록 컬럼 추가**

`inspectAidColumns.tsx`에 검사유형(`ComCodeBadge` groupCode `INSPECT_TYPE`, 값 없으면 `전 검사유형 공통` 텍스트), 대조 필수(Y/N 텍스트 배지), 표시순서 컬럼을 추가한다. 파스텔 배경을 쓰지 않는다.

- [ ] **Step 4: i18n 누락 검증**

```bash
node scripts/find_missing_i18n.js | grep inspectAid
```

Expected: 신규 키 누락 0건. (`grep -c "inspectTypeAll" apps/frontend/src/locales/*.json` 으로 4개 파일 모두 1 이상인지 확인)

- [ ] **Step 5: 타입검사와 구조 테스트**

```bash
pnpm.cmd run typecheck:frontend
node --test "apps/frontend/src/app/(authenticated)/master/inspect-aid/inspect-aid.structure.test.mjs"
```

Expected: 통과. 기존 구조 테스트가 필드 목록을 검사해 실패하면 신규 필드를 그 목록에 반영한다.

- [ ] **Step 6: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/master/inspect-aid/InspectAidFormPanel.tsx" "apps/frontend/src/app/(authenticated)/master/inspect-aid/inspectAidColumns.tsx" "apps/frontend/src/app/(authenticated)/master/inspect-aid/page.tsx" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F <임시파일>
```

메시지: `feat(master): 검사보조구 화면에 검사유형·대조필수·표시순서를 노출한다`

---

### Task 7: 점검 모달 공용화

**Files:**
- Create: `apps/frontend/src/components/inspect/DailyInspectModal.tsx` (기존 키오스크 파일에서 이동)
- Create: `apps/frontend/src/components/inspect/WorkerInspectModal.tsx` (동일)
- Create: `apps/frontend/src/components/inspect/index.ts`
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx` (래퍼로 축소)
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx` (래퍼로 축소)
- Create: `apps/frontend/src/components/inspect/inspect-modal-props.structure.test.mjs`

**Interfaces:**
- Consumes: 없음(기존 모달 로직 이동)
- Produces:
  ```ts
  interface SharedInspectContext {
    equipCode: string;
    equipName?: string;
    orderNo?: string | null;
    workers: { id: string; workerName: string }[];
  }
  // 공용 모달 props
  interface SharedDailyInspectModalProps { isOpen: boolean; onClose: () => void; onDone: () => void; context: SharedInspectContext; }
  interface SharedWorkerInspectModalProps { isOpen: boolean; onClose: () => void; onDone: () => void; context: SharedInspectContext; }
  ```
  공용 모달은 `useKioskStore`를 import 하지 않는다. 점검 완료 후 인터락 갱신은 `onDone()` 콜백으로 호출자가 처리한다.

- [ ] **Step 1: 구조 테스트 작성 (실패)**

`apps/frontend/src/components/inspect/inspect-modal-props.structure.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'apps/frontend/src/components/inspect/DailyInspectModal.tsx',
  'apps/frontend/src/components/inspect/WorkerInspectModal.tsx',
];

test('공용 점검 모달은 키오스크 스토어에 의존하지 않는다', () => {
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!src.includes('kioskStore'), `${file} 가 kioskStore를 참조하면 안 된다`);
    assert.ok(src.includes('context'), `${file} 는 context prop을 받아야 한다`);
  }
});

test('키오스크 모달은 공용 모달을 감싸기만 한다', () => {
  for (const file of [
    'apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx',
    'apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx',
  ]) {
    const src = readFileSync(file, 'utf8');
    assert.ok(src.includes('@/components/inspect'), `${file} 는 공용 모달을 import 해야 한다`);
    assert.ok(src.split('\n').length < 60, `${file} 는 얇은 래퍼여야 한다`);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test apps/frontend/src/components/inspect/inspect-modal-props.structure.test.mjs`
Expected: FAIL — 파일 없음

- [ ] **Step 3: 모달 이동과 props 전환**

1. 기존 `input-kiosk/components/DailyInspectModal.tsx`(570줄), `WorkerInspectModal.tsx`(424줄)를 `apps/frontend/src/components/inspect/`로 복사한다.
2. 복사본에서 `useKioskStore` import와 구조분해를 제거하고, 다음으로 대체한다.

```tsx
const { equipCode, equipName, orderNo, workers } = props.context;
```

3. 기존에 `setInterlock(...)`을 호출하던 자리는 삭제하고 `onDone()`만 호출한다.
4. 점검자 드롭다운은 `props.context.workers`를 원본으로 쓴다.
5. 나머지 로직(측정형/판정형 판정, QR 스캔 매칭, `POST /equipment/daily-inspect` 호출, 이미지 표시)은 그대로 둔다.
6. `apps/frontend/src/components/inspect/index.ts`에서 두 모달을 재수출한다.

- [ ] **Step 4: 키오스크 래퍼로 축소**

`input-kiosk/components/DailyInspectModal.tsx`:

```tsx
"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 키오스크용 설비 일일점검 모달 래퍼 — 스토어 값을 공용 모달에 전달한다.
 */
import { DailyInspectModal as SharedDailyInspectModal } from '@/components/inspect';
import { useKioskStore } from '@/stores/kioskStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function DailyInspectModal({ isOpen, onClose, onDone }: Props) {
  const { selectedEquip, selectedJobOrder, selectedWorkers, setInterlock } = useKioskStore();
  if (!selectedEquip) return null;
  return (
    <SharedDailyInspectModal
      isOpen={isOpen}
      onClose={onClose}
      onDone={() => { setInterlock({ dailyInspectDone: true }); onDone(); }}
      context={{
        equipCode: selectedEquip.equipCode,
        equipName: selectedEquip.equipName,
        orderNo: selectedJobOrder?.orderNo ?? null,
        workers: selectedWorkers.map((w) => ({ id: w.id, workerName: w.workerName })),
      }}
    />
  );
}
```

`WorkerInspectModal.tsx` 래퍼도 같은 형태로 만들되 `setInterlock({ workerInspectDone: true })`를 쓴다. `setInterlock`의 실제 시그니처가 다르면 기존 모달이 호출하던 형태를 그대로 옮긴다.

- [ ] **Step 5: 구조 테스트와 기존 키오스크 테스트 통과 확인**

```bash
node --test apps/frontend/src/components/inspect/inspect-modal-props.structure.test.mjs
node --test "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/daily-inspect-modal.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/daily-inspect-row-key.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/worker-inspect-modal.structure.test.mjs"
pnpm.cmd run typecheck:frontend
```

Expected: 모두 통과. 기존 구조 테스트가 키오스크 경로의 파일 내용을 검사한다면, 검사 대상 경로를 공용 모듈로 옮겨 테스트를 갱신한다(삭제하지 않는다).

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/components/inspect/DailyInspectModal.tsx apps/frontend/src/components/inspect/WorkerInspectModal.tsx apps/frontend/src/components/inspect/index.ts apps/frontend/src/components/inspect/inspect-modal-props.structure.test.mjs "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx"
git commit -F <임시파일>
```

메시지: `refactor(frontend): 설비·작업자 점검 모달을 공용 컴포넌트로 분리한다`

---

### Task 8: 검사화면 작업자 선택과 준비 체크바

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/hooks/useInspectPrepStatus.ts`
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectStationBar.tsx`
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPrepCheckBar.tsx`
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/inspect-prep-gate.structure.test.mjs`
- Modify: `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectionResultWorkflow.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/inspection/result/types.ts`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

**Interfaces:**
- Consumes: `GET /quality/continuity-inspect/prep-status`(Task 4), 공용 점검 모달(Task 7), 공용 `@/components/worker/WorkerSelectModal`
- Produces:
  ```ts
  export interface InspectPrepState {
    dailyDone: boolean; dailyRequired: boolean; dailyResult: string | null;
    workerDone: boolean; workerRequired: boolean; workerResult: string | null;
    sampleCheckDone: boolean; sampleCheckRequired: boolean; sampleCheckResult: string | null;
    consumablesReady: boolean; unmountedConsumCount: number;
    workers: { id: string; workerName: string }[];
    ready: boolean; blockReason: string | null;
    refresh: () => Promise<void>;
    setConsumableStatus: (allMounted: boolean, unmounted: number) => void;
  }
  export function useInspectPrepStatus(args: {
    orderNo?: string; itemCode?: string; inspectType: 'CONTINUITY' | 'TERMINAL'; equipCode?: string;
  }): InspectPrepState;
  ```
  `InspectPanel`은 `prep: InspectPrepState` 하나만 받는다. 기존 `consumablesReady`, `unmountedConsumCount` prop은 제거한다.

- [ ] **Step 1: 구조 테스트 작성 (실패)**

`inspect-prep-gate.structure.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = 'apps/frontend/src/app/(authenticated)/inspection/result';

test('InspectPanel은 prep 단일 prop을 받고 준비 미완료면 판정 버튼을 막는다', () => {
  const src = readFileSync(`${base}/components/InspectPanel.tsx`, 'utf8');
  assert.ok(src.includes('prep: InspectPrepState'), 'prep 단일 prop을 받아야 한다');
  assert.ok(!src.includes('consumablesReady?:'), '소모품 상태는 prep로 흡수해야 한다');
  assert.ok(/disabled=\{[^}]*!prep\.ready/.test(src), 'PASS/FAIL 버튼이 prep.ready로 막혀야 한다');
});

test('검사 화면은 공용 작업자 선택 모달을 쓴다', () => {
  const src = readFileSync(`${base}/components/InspectStationBar.tsx`, 'utf8');
  assert.ok(src.includes('@/components/worker/WorkerSelectModal'), '공용 WorkerSelectModal을 써야 한다');
  assert.ok(src.includes('/workers'), '현재 작업자 배정 API를 호출해야 한다');
});

test('준비 체크바는 4단계와 양/불체크 시작 버튼을 제공한다', () => {
  const src = readFileSync(`${base}/components/InspectPrepCheckBar.tsx`, 'utf8');
  for (const key of ['dailyInspect', 'workerInspect', 'sampleCheck', 'consumable']) {
    assert.ok(src.includes(key), `${key} 단계가 있어야 한다`);
  }
  assert.ok(src.includes('sampleCheckStart'), '양/불체크 시작 버튼 라벨 키가 있어야 한다');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/inspection/result/inspect-prep-gate.structure.test.mjs"`
Expected: FAIL — 파일 없음

- [ ] **Step 3: i18n 키 추가 (4개 파일)**

`inspection.result` 블록에 추가한다.

```json
"prep": {
  "dailyInspect": "설비일상점검",
  "workerInspect": "작업자설비점검",
  "sampleCheck": "양불마스터 대조",
  "consumable": "소모품 장착",
  "sampleCheckStart": "양/불체크 시작",
  "sampleCheckHistory": "대조 이력",
  "selectEquipFirst": "검사기를 먼저 선택하세요.",
  "selectWorkerFirst": "작업자를 1명 이상 선택하세요.",
  "selectOrderFirst": "작업지시를 먼저 선택하세요.",
  "notReady": "검사 준비가 끝나지 않았습니다.",
  "addWorker": "작업자 추가",
  "workerRequired": "작업자 필요",
  "workerAssignError": "현재 작업자 저장에 실패했습니다."
}
```

en/zh/vi에도 같은 키 구조로 번역을 넣는다.
en: `Daily Equipment Check / Worker Equipment Check / Master Sample Verification / Consumables Mounted / Start Sample Check / Verification History / Select a tester first. / Select at least one worker. / Select a job order first. / Inspection preparation is not complete. / Add Worker / Worker required / Failed to save current workers.`
zh: `设备日常点检 / 作业者设备点检 / 良品不良样品比对 / 耗材装配 / 开始良否比对 / 比对履历 / 请先选择检查机。 / 请至少选择一名作业者。 / 请先选择工单。 / 检查准备尚未完成。 / 添加作业者 / 需要作业者 / 保存当前作业者失败。`
vi: `Kiểm tra thiết bị hằng ngày / Kiểm tra thiết bị của công nhân / Đối chiếu mẫu tốt/xấu / Lắp vật tư tiêu hao / Bắt đầu đối chiếu / Lịch sử đối chiếu / Hãy chọn máy kiểm tra trước. / Hãy chọn ít nhất một công nhân. / Hãy chọn lệnh sản xuất trước. / Chưa hoàn tất chuẩn bị kiểm tra. / Thêm công nhân / Cần công nhân / Lưu công nhân hiện tại thất bại.`

- [ ] **Step 4: `useInspectPrepStatus` 구현**

```ts
/**
 * @file hooks/useInspectPrepStatus.ts
 * @description 통전·단자검사 준비 상태 단일 소스 — 설비점검·양불대조는 서버가 판정하고, 소모품은 화면이 보고한다.
 */
```

구현 요건:
- `orderNo`, `itemCode`, `equipCode`가 모두 있을 때 `GET /quality/continuity-inspect/prep-status`를 호출한다. 없으면 미완료 상태를 그대로 둔다.
- 응답의 `gate`, `sampleCheck`, `ready`, `blockReason`을 상태로 보관한다.
- `consumablesReady`/`unmountedConsumCount`는 `setConsumableStatus`로 `ConsumablePanel`이 보고한 값을 쓴다.
- 최종 `ready`는 `서버 ready && consumablesReady && workers.length > 0`.
- `workers`는 `GET /equipment/equips/{equipCode}`의 현재 작업자에서 복원하고, 변경 시 `InspectStationBar`가 갱신한다.
- `refresh()`는 점검·대조 저장 후 호출한다.
- 요청 실패 시 상태를 미완료로 두고 `blockReason`에 서버 메시지를 담는다. 임의 통과 처리 금지.

- [ ] **Step 5: `InspectStationBar` 구현**

- 왼쪽: 기존 검사기(TESTER) `Select`를 이 컴포넌트로 옮긴다(선택값 localStorage 유지 로직 포함).
- 오른쪽: 작업자 칩 목록 + `[작업자 추가]` 버튼. 공용 `WorkerSelectModal`을 쓴다.
- 작업자 추가·삭제 시 `api.patch('/equipment/equips/{equipCode}/workers', { workerCodes })` 호출. 실패하면 이전 목록으로 되돌리고 `toast.error(t('inspection.result.prep.workerAssignError'))`.
- 작업자 0명이면 왼쪽 굵은 빨강 보더 + `workerRequired` 경고 문구. 파스텔 배경 금지.
- 검사기 미선택이면 작업자 추가 버튼 비활성 + `selectEquipFirst` 툴팁.

- [ ] **Step 6: `InspectPrepCheckBar` 구현**

- 4칸: `dailyInspect`, `workerInspect`, `sampleCheck`, `consumable`. 완료/미완료/비활성 3상태를 키오스크 `PrepCheckBar`와 같은 의미로 표시하되, 배경 파스텔 대신 테두리·텍스트로 구분한다.
- ① 클릭 → 공용 `DailyInspectModal` 열기. ② 클릭 → 공용 `WorkerInspectModal` 열기(작업지시·작업자 필요).
- ③ 칸에는 `[양/불체크 시작]` 버튼과 `[대조 이력]` 버튼을 둔다(Task 9에서 모달 연결).
- ④ 칸은 기존 `ConsumablePanel` 상태를 표시하고 클릭 시 해당 패널로 스크롤 포커스를 준다.
- 각 칸 비활성 사유는 `title`로 노출한다.

- [ ] **Step 7: `InspectionResultWorkflow`·`InspectPanel` 배선**

- `InspectionResultWorkflow`에서 검사기 `Select` 블록을 `InspectStationBar`로 교체하고, `useInspectPrepStatus`를 호출해 `prep`을 만든 뒤 `InspectPrepCheckBar`와 `InspectPanel`에 전달한다.
- `ConsumablePanel`의 `onStatus` 콜백은 `prep.setConsumableStatus`로 연결한다.
- `InspectPanel`의 props를 `{ order: JobOrderRow; inspectType?: 'CONTINUITY' | 'TERMINAL'; equipCode?: string; prep: InspectPrepState }`로 바꾸고, PASS/FAIL 버튼에 `disabled={!prep.ready || inspecting}`와 `title={prep.blockReason ?? ''}`를 준다.
- PASS/FAIL 등록 payload에 `workerId: prep.workers[0]?.id`를 추가한다.
- 등록 성공 후 `prep.refresh()`를 호출한다.

- [ ] **Step 8: 테스트와 타입검사**

```bash
node --test "apps/frontend/src/app/(authenticated)/inspection/result/inspect-prep-gate.structure.test.mjs"
node --test "apps/frontend/src/app/(authenticated)/inspection/result/inspection-result-no-info-cards.structure.test.mjs"
pnpm.cmd run typecheck:frontend
node scripts/find_missing_i18n.js | grep "inspection.result.prep" || echo "i18n 누락 없음"
```

Expected: 전부 통과, i18n 누락 없음

- [ ] **Step 9: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/inspection/result/hooks/useInspectPrepStatus.ts" "apps/frontend/src/app/(authenticated)/inspection/result/components/InspectStationBar.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPrepCheckBar.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/components/InspectionResultWorkflow.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/types.ts" "apps/frontend/src/app/(authenticated)/inspection/result/inspect-prep-gate.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F <임시파일>
```

메시지: `feat(inspection): 통전·단자검사에 작업자 선택과 준비 인터락 체크바를 추가한다`

---

### Task 9: 양불 대조 모달과 이력 모달

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckModal.tsx`
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckHistoryModal.tsx`
- Create: `apps/frontend/src/app/(authenticated)/inspection/result/sample-check-modal.structure.test.mjs`
- Modify: `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPrepCheckBar.tsx`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

**Interfaces:**
- Consumes: `GET /quality/continuity-inspect/sample-check/candidates`, `POST /quality/continuity-inspect/sample-check`, `GET /quality/continuity-inspect/sample-check/history`, `prep.refresh()`(Task 8)
- Produces: 없음(화면 종단)

- [ ] **Step 1: 구조 테스트 작성 (실패)**

`sample-check-modal.structure.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckModal.tsx';

test('견본 스캔은 공용 BarcodeScanInput을 쓴다', () => {
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('BarcodeScanInput'), 'BarcodeScanInput을 써야 한다');
  assert.ok(!/onKeyDown=\{[^}]*Enter/.test(src), '일반 Input + Enter 조합을 쓰면 안 된다');
  assert.ok(src.includes('maintainFocus'), '연속 스캔을 위해 maintainFocus를 써야 한다');
});

test('스캔하지 않은 견본은 결과 입력이 막힌다', () => {
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('scannedCodes'), '스캔된 코드 집합을 추적해야 한다');
  assert.ok(/disabled=\{[^}]*scannedCodes/.test(src), 'PASS/FAIL 버튼이 스캔 여부로 막혀야 한다');
});

test('만료 견본이 있으면 저장이 막힌다', () => {
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('expired'), '만료 여부를 표시해야 한다');
  assert.ok(!src.includes('window.confirm') && !src.includes('alert('), 'alert/confirm 금지');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/inspection/result/sample-check-modal.structure.test.mjs"`
Expected: FAIL — 파일 없음

- [ ] **Step 3: i18n 키 추가 (4개 파일)**

`inspection.result.sampleCheck` 블록:

```json
"title": "양불마스터 대조",
"subtitle": "한도견본을 스캔하고 검사기 결과를 입력하세요.",
"scanPlaceholder": "한도견본 바코드를 스캔하세요",
"expectedPass": "합격이어야 함",
"expectedFail": "불합격이어야 함",
"actualPass": "합격",
"actualFail": "불합격",
"resultOk": "일치",
"resultNg": "불일치",
"required": "필수",
"expired": "유효기간 만료",
"unknownCode": "등록되지 않은 한도견본입니다: {{code}}",
"notScanned": "먼저 견본 바코드를 스캔하세요.",
"expiredBlocked": "유효기간이 만료된 필수 견본이 있어 대조할 수 없습니다. 기준정보에서 갱신하세요.",
"noCandidates": "이 품목·검사유형에 등록된 한도견본이 없습니다.",
"saved": "양불마스터 대조가 등록되었습니다.",
"savedNg": "대조 결과가 불합격입니다 — 검사기 점검 후 재대조하세요.",
"historyTitle": "양불마스터 대조 이력",
"historyEmpty": "대조 이력이 없습니다."
```

en/zh/vi 동일 구조로 번역 추가.

- [ ] **Step 4: `SampleCheckModal` 구현**

- 열릴 때 후보를 조회한다: `api.get('/quality/continuity-inspect/sample-check/candidates', { params: { itemCode, inspectType } })`.
- 상단 `BarcodeScanInput`(`maintainFocus`, `refocusAfterScan`)으로 스캔. 스캔값을 `trim().toUpperCase()`로 정규화해 후보의 `aidCode`와 비교한다.
- 일치하면 `scannedCodes`(Set)에 추가하고 해당 행으로 스크롤·강조, 스캔 시각을 기록한다. 불일치면 `toast.error(t('...unknownCode', { code }))`.
- 각 행: 사진 썸네일(`imageUrl`), 견본코드, 명칭, 유형 배지(`ComCodeBadge` groupCode `INSPECT_AID_TYPE`), 기대결과 문구, 필수 배지, 만료 배지.
- 각 행의 `[합격]`/`[불합격]` 버튼은 `disabled={!scannedCodes.has(aidCode)}`.
- 필수 견본 중 하나라도 `expired`면 저장 버튼 비활성 + `expiredBlocked` 안내와 `/master/inspect-aid` 링크.
- 후보 0건이면 `noCandidates` 안내만 표시하고 저장 버튼을 숨긴다.
- 저장: `POST /quality/continuity-inspect/sample-check` with `{ orderNo, inspectType, equipCode, itemCode, items: [{ aidCode, actualResult, scannedAt, remark }] }`.
- 응답 `overallResult === 'PASS'`면 `toast.success(saved)` 후 닫고 `prep.refresh()`, `NG`면 `toast.error(savedNg)`를 띄우고 모달을 열어 둔 채 재입력을 허용한다(기록은 이미 남았다).
- `alert`/`confirm` 금지, 공용 `Modal` 사용. 모달 크기는 `xl`.

- [ ] **Step 5: `SampleCheckHistoryModal` 구현**

- `GET /quality/continuity-inspect/sample-check/history?orderNo&inspectType` 조회.
- 상단 목록: 대조시각, 조업일·교대, 검사기, 종합판정(`StatusBadge`), 판정자.
- 행 클릭 시 하단에 샘플별 상세(견본코드·유형·기대·실제·OK/NG·비고) 표시.
- 비어 있으면 `historyEmpty`.

- [ ] **Step 6: 체크바 연결**

`InspectPrepCheckBar`의 ③ 칸에서 `[양/불체크 시작]` → `SampleCheckModal`, `[대조 이력]` → `SampleCheckHistoryModal`을 연다. 검사기·작업지시 미선택 시 버튼 비활성과 사유 툴팁.

- [ ] **Step 7: 테스트와 타입검사**

```bash
node --test "apps/frontend/src/app/(authenticated)/inspection/result/sample-check-modal.structure.test.mjs" "apps/frontend/src/app/(authenticated)/inspection/result/inspect-prep-gate.structure.test.mjs"
pnpm.cmd run typecheck:frontend
node scripts/find_missing_i18n.js | grep "sampleCheck" || echo "i18n 누락 없음"
```

Expected: 전부 통과

- [ ] **Step 8: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckModal.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckHistoryModal.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPrepCheckBar.tsx" "apps/frontend/src/app/(authenticated)/inspection/result/sample-check-modal.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F <임시파일>
```

메시지: `feat(inspection): 양불마스터 대조 모달과 대조 이력 조회를 추가한다`

---

### Task 10: 시드 데이터·실사용 검증·문서 갱신

**Files:**
- Create: `tools/sql/2026-09-15-inspect-aid-seed.sql`
- Modify: `apps/frontend/public/help/user/ko/QC_INSPECT_AID.md`
- Modify: `apps/frontend/public/help/operator/ko/QC_INSPECT_AID.md`
- Modify: `apps/frontend/public/help/user/ko/INSP_RESULT.md`, `apps/frontend/public/help/operator/ko/INSP_RESULT.md`
- Modify: `docs/database/schema-erd.md` (재생성)

**Interfaces:**
- Consumes: Task 1~9 전체
- Produces: 검증 완료 상태

- [ ] **Step 1: 검증용 한도견본 시드**

`tools/sql/2026-09-15-inspect-aid-seed.sql` — 실제 사용 중인 품목코드와 검사기로 채운다. 품목은 다음으로 확인한다.

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT j.ORDER_NO, j.ITEM_CODE FROM JOB_ORDERS j WHERE j.STATUS IN ('WAITING','RUNNING') AND ROWNUM <= 5"
```

```sql
MERGE INTO INSPECT_AIDS t
USING (SELECT '40' COMPANY, '1000' PLANT_CD, 'LS-OK-0001' AID_CODE FROM DUAL) s
ON (t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD AND t.AID_CODE = s.AID_CODE)
WHEN NOT MATCHED THEN INSERT (COMPANY, PLANT_CD, AID_CODE, AID_TYPE, AID_NAME, ITEM_CODE, INSPECT_TYPE, REQUIRED_YN, SORT_ORDER, VALID_FROM, VALID_TO, STATUS, USE_YN)
VALUES ('40', '1000', 'LS-OK-0001', 'LIMIT_OK', '양품 한도견본 #1', '<확인한 품목코드>', 'CONTINUITY', 'Y', 1, SYSDATE, ADD_MONTHS(SYSDATE, 12), 'ACTIVE', 'Y')
/
MERGE INTO INSPECT_AIDS t
USING (SELECT '40' COMPANY, '1000' PLANT_CD, 'LS-NG-0001' AID_CODE FROM DUAL) s
ON (t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD AND t.AID_CODE = s.AID_CODE)
WHEN NOT MATCHED THEN INSERT (COMPANY, PLANT_CD, AID_CODE, AID_TYPE, AID_NAME, ITEM_CODE, INSPECT_TYPE, REQUIRED_YN, SORT_ORDER, VALID_FROM, VALID_TO, STATUS, USE_YN)
VALUES ('40', '1000', 'LS-NG-0001', 'LIMIT_NG', '불량 한도견본 #1', '<확인한 품목코드>', 'CONTINUITY', 'Y', 2, SYSDATE, ADD_MONTHS(SYSDATE, 12), 'ACTIVE', 'Y')
/
```

적용:

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file tools/sql/2026-09-15-inspect-aid-seed.sql
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT AID_CODE, AID_TYPE, ITEM_CODE, INSPECT_TYPE, REQUIRED_YN, VALID_TO FROM INSPECT_AIDS ORDER BY SORT_ORDER"
```

- [ ] **Step 2: 브라우저 실사용 검증 (포트 3002)**

`claude-in-chrome`으로 `http://localhost:3002/inspection/result`를 열고 spec §9.4의 10단계를 순서대로 수행한다. 각 단계에서 기대와 다르면 원인을 고치고 해당 Task로 돌아간다. 포트나 사이트가 예상과 다르면 우회하지 말고 실패로 보고한다.

확인 항목:
1. 검사기 선택 전 작업자 추가 버튼 비활성
2. 작업자 미선택 시 합격·불합격 버튼 비활성 + 사유 툴팁
3. 작업자 추가 후 새로고침 시 복원
4. 설비일상점검·작업자설비점검 모달이 키오스크와 동일하게 동작
5. `[양/불체크 시작]` → 미등록 코드 스캔 거부 → 정상 스캔 후에만 판정 버튼 활성
6. 불량 견본에 합격 입력 → NG, 검사 버튼 계속 비활성
7. 재대조 정상 입력 → 준비 완료, 합격·불합격 버튼 활성
8. 대조 이력에 NG·PASS 두 건 모두 표시
9. `/inspection/terminal-result`에서 동일 동작
10. API 직접 호출(`POST /quality/continuity-inspect/inspect`, 준비 미완료 상태)이 400으로 막히는지 확인

- [ ] **Step 3: DB 결과 확인**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT CHECK_NO, ORDER_NO, INSPECT_TYPE, EQUIP_CODE, TO_CHAR(WORK_DATE,'YYYY-MM-DD') WORK_DATE, SHIFT_CODE, OVERALL_RESULT, CHECKER_ID, CREATED_BY FROM INSPECT_SAMPLE_CHECKS ORDER BY CHECKED_AT DESC FETCH FIRST 10 ROWS ONLY"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT CHECK_NO, SEQ_NO, AID_CODE, EXPECTED_RESULT, ACTUAL_RESULT, RESULT FROM INSPECT_SAMPLE_CHECK_ITEMS ORDER BY CHECK_NO DESC, SEQ_NO FETCH FIRST 20 ROWS ONLY"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT RESULT_NO, INSPECT_TYPE, PASS_YN, INSPECTOR_ID FROM INSPECT_RESULTS ORDER BY INSPECT_AT DESC FETCH FIRST 5 ROWS ONLY"
```

기대: NG 시도와 PASS 재대조가 각각 별도 `CHECK_NO`로 남고, 검사 실적의 `INSPECTOR_ID`가 대표 작업자로 채워진다.

- [ ] **Step 4: 도움말 갱신**

- `QC_INSPECT_AID.md`(user/operator): "검사 화면에서 한도견본을 참조하는 연동은 후속 범위입니다" 문장을 실제 동작 설명으로 교체하고, 신규 필드(적용 검사유형·대조 필수·표시순서)와 통전·단자검사 대조 흐름을 추가한다. `AID_CODE`를 바코드로 부착한다는 점을 명시한다.
- `INSP_RESULT.md`(user/operator): 작업자 선택, 4단계 준비 체크바, 양/불체크 시작, 대조 이력, 차단 메시지를 추가한다.
- frontmatter의 `keywords`에 `INSPECT_SAMPLE_CHECKS`, `양불마스터`, `한도견본 대조`, `준비 인터락`을 추가한다.

```bash
node tools/help-frontmatter-audit.mjs
```

Expected: 통과

- [ ] **Step 5: 전체 검증**

```bash
pnpm --dir apps/backend run test:unit
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
```

Expected: 전부 통과. 실패하면 실패 내용을 그대로 보고하고 고친 뒤 재실행한다.

- [ ] **Step 6: 커밋**

```bash
git add tools/sql/2026-09-15-inspect-aid-seed.sql apps/frontend/public/help/user/ko/QC_INSPECT_AID.md apps/frontend/public/help/operator/ko/QC_INSPECT_AID.md apps/frontend/public/help/user/ko/INSP_RESULT.md apps/frontend/public/help/operator/ko/INSP_RESULT.md docs/database/schema-erd.md
git commit -F <임시파일>
```

메시지: `docs(quality): 양불마스터 대조 도움말과 검증 시드를 정리한다`

---

## 미완료 시 기록

작업이 중간에 멈추거나 검증·데이터 정리가 끝나지 않으면 `docs/standards/unfinished-work-record.md` 기준으로 `docs/reports/unfinished-work/`에 기록하고, 최종 응답에 그 경로를 포함한다.
