# 추적성 종합 조회 (Product Traceability) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제품 시리얼 1건을 기준으로 공정·검사·포장/출하·투입자재(PO→IQC)·투입반제품(생산이력+자재)을 데이터 소스별 섹션으로 한 화면에서 전부 역추적하는 신규 추적성 화면을 구축한다.

**Architecture:** 기존 `TraceService`(4M)는 보존하고, 신규 `ProductTraceabilityService` + DTO를 추가한다. 컨트롤러 `GET /quality/trace`의 응답만 신규 서비스로 교체한다. 모든 하위 조회는 `In()` 배치로 N+1을 회피하고, 자재 LOT→PO/IQC 역추적 로직(`resolveMaterialTraces`)을 제품 직접투입·반제품투입에서 공통 재사용한다. 프론트는 `page.tsx`를 세로 스택 섹션으로 전면 재작성하고, 자재 LOT의 PO/IQC 중첩 표시 컴포넌트(`MaterialSection`)를 제품·반제품에서 재사용한다.

**Tech Stack:** NestJS + TypeORM(Oracle), Next.js(App Router) + React + react-i18next, Tailwind, 공통 UI(`@/components/ui`).

## Global Constraints

- 패키지 매니저는 `pnpm`만 사용. dev 서버 실행 중이면 `pnpm build` 금지 → `pnpm --filter @harness/backend exec tsc --noEmit` / `pnpm --filter @harness/frontend exec tsc --noEmit`로 타입체크.
- 모든 DB 조회에 `COMPANY`, `PLANT_CD` 스코프 포함. 기본 사이트 `JSHANES`, company `40`, plant `1000`.
- N+1·컬럼 함수 검색·메모리 집계 금지. 하위 조회는 `In()` 일괄.
- `as any` 금지, `catch (error: unknown)` 유지, 에러를 기본값 문자열로 숨기지 않는다.
- 상태 텍스트/색상 하드코딩 금지(`ComCodeBadge`/공통코드 우선). 카드/배지에 파스텔 배경색(`bg-green-50` 등) 금지 — 텍스트/테두리로 구분.
- UI 변경 시 i18n 4파일(ko/en/zh/vi) 동시 수정. JSON에 UTF-8 BOM 금지.
- flex 스크롤 영역에 `min-h-0`, 최상위 스크롤 컨테이너는 `overflow-y-auto`.
- 검사·타임라인 펼침은 반드시 시리얼 격리: `fgBarcode === serial || serialNo === serial`.
- 신규 작업 시작 전 `.ai-coordination/LOCKS.md`에 본 task의 파일 잠금 등록(trace 모듈·page.tsx). 협업 변경과 기능 변경은 별도 커밋.

## 엔티티 레퍼런스 (실측 프로퍼티 ↔ 컬럼)

| 엔티티 (테이블) | 키/주요 프로퍼티 |
|---|---|
| `FgLabel` (FG_LABELS) | `fgBarcode`(PK), `itemCode`, `orderNo`, `status`, `boxNo`, `issuedAt`, `equipCode`, `workerId` |
| `SgLabel` (SG_LABELS) | `sgBarcode`(PK), `itemCode`, `orderNo`, `resultNo`, `issueProcessCode`, `status`, `remainQty`, `issuedAt` |
| `ProductGenealogy` (PRODUCT_GENEALOGY) | `genealogyId`(PK), `parentType`('FG'\|'SG'), `parentKey`, `childType`('SG'\|'MAT_LOT'), `childKey`, `qty`, `processCode`, `itemCode` |
| `ProdResult` (PROD_RESULTS) | `resultNo`(PK), `orderNo`, `processCode`, `equipCode`, `workerId`, `goodQty`, `defectQty`, `startAt`, `endAt`, `status`, `remark`, `prdUid` |
| `InspectResult` (INSPECT_RESULTS) | `resultNo`(PK), `prodResultNo`, `serialNo`, `fgBarcode`, `inspectType`, `passYn`, `inspectAt`, `inspectorId`, `equipCode`, `errorDetail`, `inspectData`, `circuitLabel` |
| `TraceLog` (TRACE_LOGS) | `traceTime`+`seq`(PK), `serialNo`, `prdUid`, `processCode`, `equipCode`, `workerId`, `eventType`, `eventData` |
| `MatIssue` (MAT_ISSUES) | `issueNo`+`seq`(PK), `orderNo`, `matUid`, `issueQty`, `issueDate`, `prodResultNo` |
| `MatLot` (MAT_LOTS) | `matUid`(PK), `itemCode`, `vendor`, `poNo`, `arrivalNo`, `arrivalSeq`, `iqcStatus`, `recvDate` |
| `PurchaseOrder` (PURCHASE_ORDERS) | `poNo`(PK), `partnerCode`, `partnerName`, `orderDate`, `status` |
| `MatArrival` (MAT_ARRIVALS) | `arrivalNo`+`seq`(PK), `poNo`, `itemCode`, `qty`, `arrivalDate`, `vendorCode`, `vendorName`, `iqcStatus` |
| `IqcLog` (IQC_LOGS) | `inspectDate`+`seq`(PK), `matUid`, `arrivalNo`, `itemCode`, `result`, `inspectType`, `inspectorName`, `certFilePath` |
| `MatReceiving` (MAT_RECEIVINGS) | `receiveNo`+`seq`(PK), `matUid`, `qty`, `receiveDate`, `arrivalNo`, `arrivalSeq` |
| `PartMaster` (ITEM_MASTERS) | `itemCode`+`company`+`plant`(복합PK), `itemName`, `itemNo`, `unit` |
| `BoxMaster` (BOX_MASTERS) | `boxNo`+`company`+`plant`(복합PK), `palletNo`, `closeAt`, `shippedAt`, `status` |
| `PalletMaster` (PALLET_MASTERS) | `palletNo`+`company`+`plant`(복합PK), `closeAt`, `shippedAt`, `status` |
| `EquipMaster` | `equipCode`, `equipName`, `company`, `plant` |
| `WorkerMaster` | `workerCode`, `workerName`, `company`, `plant` |
| `ProcessMaster` | `processCode`, `processName`, `company`, `plant` |

> 자재 LOT 수집: ① `PRODUCT_GENEALOGY`(parentType, childType='MAT_LOT'의 childKey=matUid) ② 보강 `MAT_ISSUES.orderNo`. 두 소스를 matUid로 dedupe. 반제품 자재도 동일(parentType='SG').

---

## Task 1: 신규 DTO + 모듈 엔티티 등록

**Files:**
- Create: `apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts`
- Modify: 추적성 모듈 파일(아래 Step 1에서 경로 확정)

**Interfaces:**
- Produces: `ProductTraceabilityDto`, `ProcessStep`, `InspectionRecord`, `MaterialTrace`, `SemiProductTrace` (Task 2~4가 소비)

- [ ] **Step 1: 추적성 모듈 파일 경로 확인**

Run: `ls apps/backend/src/modules/quality/inspection/*.module.ts`
컨트롤러 `trace.controller.ts`가 등록된 모듈을 연다. 그 모듈의 `TypeOrmModule.forFeature([...])`에 다음 엔티티가 모두 있는지 확인하고, 없는 것을 추가한다:
`ProductGenealogy, SgLabel, MatIssue, MatLot, PurchaseOrder, MatArrival, IqcLog, MatReceiving, BoxMaster, PalletMaster, FgLabel, ProdResult, JobOrder, InspectResult, TraceLog, PartMaster, EquipMaster, WorkerMaster, ProcessMaster`.
provider 배열에 `ProductTraceabilityService`를 추가(Task 2에서 생성).

- [ ] **Step 2: DTO 파일 작성**

```ts
// apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts
export interface ProcessStep {
  process: string;
  processName: string;
  equipmentNo: string;
  equipmentName: string;
  operator: string;
  timestamp: string;
  result: 'PASS' | 'FAIL' | 'WORK';
  goodQty: number | null;
  defectQty: number | null;
  detail: string | null;
}

export interface InspectionRecord {
  inspectType: string;
  result: 'PASS' | 'FAIL';
  inspectorId: string;
  inspectAt: string;
  equipCode: string | null;
  errorDetail: string | null;
}

export interface MaterialTrace {
  matUid: string;
  itemCode: string;
  itemName: string;
  usedQty: number;
  unit: string;
  vendorCode: string | null;
  vendorName: string | null;
  po: { poNo: string; orderDate: string | null; partnerName: string | null } | null;
  arrival: { arrivalNo: string; arrivalDate: string | null; qty: number } | null;
  iqc: { result: string; inspectType: string; inspectorName: string | null; inspectDate: string | null; certFilePath: string | null } | null;
  receiving: { receiveNo: string; receiveDate: string | null } | null;
  issue: { orderNo: string | null; issueQty: number; issueDate: string | null } | null;
}

export interface SemiProductTrace {
  sgBarcode: string;
  itemCode: string;
  itemName: string;
  consumedQty: number;
  status: string;
  issueProcessCode: string | null;
  processHistory: ProcessStep[];
  inspections: InspectionRecord[];
  materials: MaterialTrace[];
}

export interface ProductTraceabilityDto {
  product: {
    serialNo: string;
    itemCode: string;
    itemNo: string;
    itemName: string;
    orderNo: string | null;
    status: string;
    issuedAt: string | null;
    productionDate: string | null;
  };
  processHistory: ProcessStep[];
  inspections: InspectionRecord[];
  packaging: {
    boxNo: string | null;
    boxPackedAt: string | null;
    palletNo: string | null;
    palletPackedAt: string | null;
    shippedAt: string | null;
  };
  materials: MaterialTrace[];
  semiProducts: SemiProductTrace[];
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 신규 DTO 관련 에러 0건 (서비스 미생성이라 모듈 provider 에러가 나면 Step 1의 provider 추가를 Task 2 완료까지 보류).

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts
git commit -F <메시지파일>
# feat(trace): 추적성 종합 조회 DTO 정의
```

---

## Task 2: ProductTraceabilityService — 자재 역추적 헬퍼

**Files:**
- Create: `apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts`

**Interfaces:**
- Consumes: Task 1의 `MaterialTrace`
- Produces:
  - `class ProductTraceabilityService`
  - `private async resolveMaterialTraces(matUidToQty: Map<string,{usedQty:number; orderNo:string|null}>, company, plant): Promise<MaterialTrace[]>`
  - `private fmtDate(d: Date | null | undefined): string | null`

- [ ] **Step 1: 서비스 골격 + 생성자 repo 주입**

```ts
// apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { SgLabel } from '../../../../entities/sg-label.entity';
import { ProductGenealogy } from '../../../../entities/product-genealogy.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { TraceLog } from '../../../../entities/trace-log.entity';
import { MatIssue } from '../../../../entities/mat-issue.entity';
import { MatLot } from '../../../../entities/mat-lot.entity';
import { PurchaseOrder } from '../../../../entities/purchase-order.entity';
import { MatArrival } from '../../../../entities/mat-arrival.entity';
import { IqcLog } from '../../../../entities/iqc-log.entity';
import { MatReceiving } from '../../../../entities/mat-receiving.entity';
import { PartMaster } from '../../../../entities/part-master.entity';
import { BoxMaster } from '../../../../entities/box-master.entity';
import { PalletMaster } from '../../../../entities/pallet-master.entity';
import { EquipMaster } from '../../../../entities/equip-master.entity';
import { WorkerMaster } from '../../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import {
  ProductTraceabilityDto, ProcessStep, InspectionRecord, MaterialTrace, SemiProductTrace,
} from '../dto/product-traceability.dto';

@Injectable()
export class ProductTraceabilityService {
  private readonly logger = new Logger(ProductTraceabilityService.name);

  constructor(
    @InjectRepository(FgLabel) private readonly fgLabelRepo: Repository<FgLabel>,
    @InjectRepository(SgLabel) private readonly sgLabelRepo: Repository<SgLabel>,
    @InjectRepository(ProductGenealogy) private readonly genealogyRepo: Repository<ProductGenealogy>,
    @InjectRepository(ProdResult) private readonly prodResultRepo: Repository<ProdResult>,
    @InjectRepository(JobOrder) private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(InspectResult) private readonly inspectResultRepo: Repository<InspectResult>,
    @InjectRepository(TraceLog) private readonly traceLogRepo: Repository<TraceLog>,
    @InjectRepository(MatIssue) private readonly matIssueRepo: Repository<MatIssue>,
    @InjectRepository(MatLot) private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(PurchaseOrder) private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(MatArrival) private readonly arrivalRepo: Repository<MatArrival>,
    @InjectRepository(IqcLog) private readonly iqcRepo: Repository<IqcLog>,
    @InjectRepository(MatReceiving) private readonly receivingRepo: Repository<MatReceiving>,
    @InjectRepository(PartMaster) private readonly partMasterRepo: Repository<PartMaster>,
    @InjectRepository(BoxMaster) private readonly boxMasterRepo: Repository<BoxMaster>,
    @InjectRepository(PalletMaster) private readonly palletMasterRepo: Repository<PalletMaster>,
    @InjectRepository(EquipMaster) private readonly equipMasterRepo: Repository<EquipMaster>,
    @InjectRepository(WorkerMaster) private readonly workerMasterRepo: Repository<WorkerMaster>,
    @InjectRepository(ProcessMaster) private readonly processMasterRepo: Repository<ProcessMaster>,
  ) {}

  private fmtDate(d: Date | null | undefined): string | null {
    return d instanceof Date ? d.toISOString() : null;
  }
}
```

- [ ] **Step 2: `resolveMaterialTraces` 헬퍼 구현 (자재 LOT → PO/입하/IQC/입고)**

서비스 클래스에 메서드 추가. matUid 집합을 받아 모든 하위 테이블을 `In()`으로 일괄 조회 후 조립한다.

```ts
  /**
   * 자재 LOT 집합을 PO→입하→IQC→입고까지 역추적해 MaterialTrace[]로 조립한다.
   * @param matUidToCtx matUid → { usedQty, orderNo(투입 작업지시) }
   */
  private async resolveMaterialTraces(
    matUidToCtx: Map<string, { usedQty: number; orderNo: string | null; issueQty: number; issueDate: Date | null }>,
    company: string,
    plant: string,
  ): Promise<MaterialTrace[]> {
    const matUids = [...matUidToCtx.keys()];
    if (matUids.length === 0) return [];

    const lots = await this.matLotRepo.find({ where: { matUid: In(matUids), company, plant } });
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    const itemCodes = [...new Set(lots.map((l) => l.itemCode).filter(Boolean))];
    const parts = itemCodes.length
      ? await this.partMasterRepo.find({ where: { itemCode: In(itemCodes), company, plant } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const poNos = [...new Set(lots.map((l) => l.poNo).filter((v): v is string => !!v))];
    const pos = poNos.length
      ? await this.poRepo.find({ where: { poNo: In(poNos), company, plant } })
      : [];
    const poMap = new Map(pos.map((p) => [p.poNo, p]));

    const arrivalNos = [...new Set(lots.map((l) => l.arrivalNo).filter((v): v is string => !!v))];
    const arrivals = arrivalNos.length
      ? await this.arrivalRepo.find({ where: { arrivalNo: In(arrivalNos), company, plant } })
      : [];
    // arrivalNo+seq 매칭: lot.arrivalSeq 우선, 없으면 첫 행
    const arrivalMap = new Map<string, MatArrival>();
    for (const a of arrivals) arrivalMap.set(`${a.arrivalNo}#${a.seq}`, a);
    const arrivalFirst = new Map<string, MatArrival>();
    for (const a of arrivals) if (!arrivalFirst.has(a.arrivalNo)) arrivalFirst.set(a.arrivalNo, a);

    // IQC: matUid 우선, 없으면 arrivalNo
    const iqcByMat = new Map<string, IqcLog>();
    const iqcByArrival = new Map<string, IqcLog>();
    const iqcs = await this.iqcRepo.find({
      where: [
        { matUid: In(matUids), company, plant },
        ...(arrivalNos.length ? [{ arrivalNo: In(arrivalNos), company, plant }] : []),
      ],
      order: { inspectDate: 'DESC' },
    });
    for (const q of iqcs) {
      if (q.matUid && !iqcByMat.has(q.matUid)) iqcByMat.set(q.matUid, q);
      if (q.arrivalNo && !iqcByArrival.has(q.arrivalNo)) iqcByArrival.set(q.arrivalNo, q);
    }

    const receivings = await this.receivingRepo.find({ where: { matUid: In(matUids), company, plant }, order: { receiveDate: 'ASC' } });
    const recvMap = new Map<string, MatReceiving>();
    for (const r of receivings) if (!recvMap.has(r.matUid)) recvMap.set(r.matUid, r);

    const result: MaterialTrace[] = [];
    for (const matUid of matUids) {
      const lot = lotMap.get(matUid);
      const ctx = matUidToCtx.get(matUid)!;
      const part = lot ? partMap.get(lot.itemCode) : undefined;
      const po = lot?.poNo ? poMap.get(lot.poNo) : undefined;
      const arrival = lot?.arrivalNo
        ? (lot.arrivalSeq != null ? arrivalMap.get(`${lot.arrivalNo}#${lot.arrivalSeq}`) : undefined) ?? arrivalFirst.get(lot.arrivalNo)
        : undefined;
      const iqc = iqcByMat.get(matUid) ?? (lot?.arrivalNo ? iqcByArrival.get(lot.arrivalNo) : undefined);
      const recv = recvMap.get(matUid);

      result.push({
        matUid,
        itemCode: lot?.itemCode ?? '',
        itemName: part?.itemName ?? '',
        usedQty: ctx.usedQty,
        unit: part?.unit ?? 'EA',
        vendorCode: lot?.vendor ?? null,
        vendorName: lot?.vendor ?? null,
        po: po ? { poNo: po.poNo, orderDate: this.fmtDate(po.orderDate), partnerName: po.partnerName } : null,
        arrival: arrival ? { arrivalNo: arrival.arrivalNo, arrivalDate: this.fmtDate(arrival.arrivalDate), qty: arrival.qty } : null,
        iqc: iqc ? { result: iqc.result, inspectType: iqc.inspectType, inspectorName: iqc.inspectorName, inspectDate: this.fmtDate(iqc.inspectDate), certFilePath: iqc.certFilePath } : null,
        receiving: recv ? { receiveNo: recv.receiveNo, receiveDate: this.fmtDate(recv.receiveDate) } : null,
        issue: { orderNo: ctx.orderNo, issueQty: ctx.issueQty, issueDate: this.fmtDate(ctx.issueDate) },
      });
    }
    return result;
  }
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건. (`In()` 다중 where 배열, optional chaining 타입 확인)

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
git commit -F <메시지파일>
# feat(trace): 자재 LOT PO→IQC 역추적 헬퍼
```

---

## Task 3: 공정/검사 헬퍼 + 제품 섹션 조립 (getBySerial)

**Files:**
- Modify: `apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts`

**Interfaces:**
- Consumes: Task 2의 `resolveMaterialTraces`, `fmtDate`
- Produces:
  - `async getBySerial(serial, company, plant): Promise<ProductTraceabilityDto | null>`
  - `private async resolveProcessHistory(orderNo, serial, company, plant): Promise<ProcessStep[]>`
  - `private async resolveInspections(prodResultNos, barcode, company, plant): Promise<InspectionRecord[]>`
  - `private async collectMaterialCtx(orderNo, parentType, parentKey, company, plant): Promise<Map<...>>`

- [ ] **Step 1: 마스터 캐시 + `resolveProcessHistory` 구현**

```ts
  private async loadMasters(processCodes: string[], equipCodes: string[], workerIds: string[], company: string, plant: string) {
    const procMap = new Map<string, string>();
    if (processCodes.length) {
      const rows = await this.processMasterRepo.find({ where: { processCode: In(processCodes), company, plant } });
      for (const p of rows) procMap.set(p.processCode, p.processName);
    }
    const equipMap = new Map<string, string>();
    if (equipCodes.length) {
      const rows = await this.equipMasterRepo.find({ where: { equipCode: In(equipCodes), company, plant } });
      for (const e of rows) equipMap.set(e.equipCode, e.equipName);
    }
    const workerMap = new Map<string, string>();
    if (workerIds.length) {
      const rows = await this.workerMasterRepo.find({ where: { workerCode: In(workerIds), company, plant } });
      for (const w of rows) workerMap.set(w.workerCode, w.workerName);
    }
    return { procMap, equipMap, workerMap };
  }

  private mapEventResult(eventType: string | null): 'PASS' | 'FAIL' | 'WORK' {
    const u = (eventType ?? '').toUpperCase();
    if (u.includes('PASS') || u.includes('OK') || u.includes('ACCEPT')) return 'PASS';
    if (u.includes('FAIL') || u.includes('NG') || u.includes('REJECT')) return 'FAIL';
    return 'WORK';
  }

  /** TRACE_LOGS 우선, 없으면 PROD_RESULTS + INSPECT_RESULTS(시리얼 격리)로 공정 타임라인 */
  private async resolveProcessHistory(orderNo: string | null, serial: string, company: string, plant: string): Promise<ProcessStep[]> {
    const traceLogs = await this.traceLogRepo.find({ where: { serialNo: serial, company, plant }, order: { traceTime: 'ASC', seq: 'ASC' } });
    const prodResults = orderNo
      ? await this.prodResultRepo.find({ where: { orderNo, company, plant }, order: { startAt: 'ASC' } })
      : [];

    const procCodes = new Set<string>();
    const equipCodes = new Set<string>();
    const workerIds = new Set<string>();
    for (const t of traceLogs) { if (t.processCode) procCodes.add(t.processCode); if (t.equipCode) equipCodes.add(t.equipCode); if (t.workerId) workerIds.add(t.workerId); }
    for (const p of prodResults) { if (p.processCode) procCodes.add(p.processCode); if (p.equipCode) equipCodes.add(p.equipCode); if (p.workerId) workerIds.add(p.workerId); }
    const { procMap, equipMap, workerMap } = await this.loadMasters([...procCodes], [...equipCodes], [...workerIds], company, plant);

    const steps: ProcessStep[] = [];
    if (traceLogs.length > 0) {
      for (const t of traceLogs) {
        steps.push({
          process: t.processCode ?? '',
          processName: t.processCode ? (procMap.get(t.processCode) ?? t.processCode) : '',
          equipmentNo: t.equipCode ?? '',
          equipmentName: t.equipCode ? (equipMap.get(t.equipCode) ?? t.equipCode) : '',
          operator: t.workerId ? (workerMap.get(t.workerId) ?? t.workerId) : '',
          timestamp: this.fmtDate(t.traceTime) ?? '',
          result: this.mapEventResult(t.eventType),
          goodQty: null, defectQty: null, detail: t.eventData ?? null,
        });
      }
      return steps;
    }

    const resultNos = prodResults.map((p) => p.resultNo);
    const insp = resultNos.length
      ? await this.inspectResultRepo.find({ where: { prodResultNo: In(resultNos), company, plant }, order: { inspectAt: 'ASC' } })
      : [];
    const inspByResult = new Map<string, InspectResult[]>();
    for (const ir of insp) {
      if (ir.fgBarcode !== serial && ir.serialNo !== serial) continue; // 시리얼 격리
      const k = ir.prodResultNo ?? '';
      (inspByResult.get(k) ?? inspByResult.set(k, []).get(k)!).push(ir);
    }
    for (const p of prodResults) {
      const procName = p.processCode ? (procMap.get(p.processCode) ?? p.processCode) : '';
      const equipName = p.equipCode ? (equipMap.get(p.equipCode) ?? p.equipCode) : '';
      steps.push({
        process: p.processCode ?? '', processName: procName,
        equipmentNo: p.equipCode ?? '', equipmentName: equipName,
        operator: p.workerId ? (workerMap.get(p.workerId) ?? p.workerId) : '',
        timestamp: this.fmtDate(p.startAt ?? p.createdAt) ?? '',
        result: 'WORK', goodQty: p.goodQty, defectQty: p.defectQty, detail: p.remark ?? null,
      });
      for (const ir of inspByResult.get(p.resultNo) ?? []) {
        steps.push({
          process: p.processCode ?? '', processName: `${procName} ${ir.inspectType ?? '검사'}`,
          equipmentNo: ir.equipCode ?? p.equipCode ?? '', equipmentName: equipName,
          operator: ir.inspectorId ?? '',
          timestamp: this.fmtDate(ir.inspectAt) ?? '',
          result: ir.passYn === 'Y' ? 'PASS' : 'FAIL', goodQty: null, defectQty: null, detail: ir.errorDetail ?? null,
        });
      }
    }
    return steps;
  }
```

- [ ] **Step 2: `resolveInspections` + `collectMaterialCtx` 구현**

```ts
  /** 바코드(FG/SG) 격리된 검사 기록 — 통전/외관 등 */
  private async resolveInspections(barcode: string, company: string, plant: string): Promise<InspectionRecord[]> {
    const rows = await this.inspectResultRepo.find({
      where: [
        { fgBarcode: barcode, company, plant },
        { serialNo: barcode, company, plant },
      ],
      order: { inspectAt: 'ASC' },
    });
    return rows.map((ir) => ({
      inspectType: ir.inspectType ?? '',
      result: ir.passYn === 'Y' ? 'PASS' : 'FAIL',
      inspectorId: ir.inspectorId ?? '',
      inspectAt: this.fmtDate(ir.inspectAt) ?? '',
      equipCode: ir.equipCode ?? null,
      errorDetail: ir.errorDetail ?? null,
    }));
  }

  /** genealogy(parent→MAT_LOT) + MAT_ISSUES(orderNo) 합집합으로 투입 자재 matUid 컨텍스트 수집 */
  private async collectMaterialCtx(orderNo: string | null, parentType: 'FG' | 'SG', parentKey: string, company: string, plant: string) {
    const ctx = new Map<string, { usedQty: number; orderNo: string | null; issueQty: number; issueDate: Date | null }>();

    const gens = await this.genealogyRepo.find({ where: { parentType, parentKey, childType: 'MAT_LOT', company, plant } });
    for (const g of gens) {
      ctx.set(g.childKey, { usedQty: g.qty, orderNo, issueQty: g.qty, issueDate: null });
    }
    if (orderNo) {
      const issues = await this.matIssueRepo.find({ where: { orderNo, company, plant }, order: { issueDate: 'ASC' } });
      for (const mi of issues) {
        const prev = ctx.get(mi.matUid);
        if (prev) { prev.issueQty = mi.issueQty; prev.issueDate = mi.issueDate; if (!prev.usedQty) prev.usedQty = mi.issueQty; }
        else ctx.set(mi.matUid, { usedQty: mi.issueQty, orderNo, issueQty: mi.issueQty, issueDate: mi.issueDate });
      }
    }
    return ctx;
  }
```

- [ ] **Step 3: `getBySerial` 메인 (제품 ①②③④⑤, ⑥은 Task 4에서 채움)**

```ts
  async getBySerial(serial: string, company: string, plant: string): Promise<ProductTraceabilityDto | null> {
    const fg = await this.fgLabelRepo.findOne({ where: { fgBarcode: serial, company, plant } });
    if (!fg) { this.logger.debug(`FgLabel not found: ${serial}`); return null; }

    const part = await this.partMasterRepo.findOne({ where: { itemCode: fg.itemCode, company, plant } });
    const jobOrder = fg.orderNo ? await this.jobOrderRepo.findOne({ where: { orderNo: fg.orderNo, company, plant } }) : null;

    const processHistory = await this.resolveProcessHistory(fg.orderNo, serial, company, plant);
    const inspections = await this.resolveInspections(serial, company, plant);

    // 포장/출하
    const box = fg.boxNo ? await this.boxMasterRepo.findOne({ where: { boxNo: fg.boxNo, company, plant } }) : null;
    const pallet = box?.palletNo ? await this.palletMasterRepo.findOne({ where: { palletNo: box.palletNo, company, plant } }) : null;

    // 직접투입 자재
    const matCtx = await this.collectMaterialCtx(fg.orderNo, 'FG', serial, company, plant);
    const materials = await this.resolveMaterialTraces(matCtx, company, plant);

    // 반제품 (Task 4)
    const semiProducts = await this.resolveSemiProducts(serial, company, plant);

    const productionDate = this.fmtDate(jobOrder?.planDate ?? null) ?? this.fmtDate(fg.issuedAt);

    return {
      product: {
        serialNo: fg.fgBarcode, itemCode: fg.itemCode,
        itemNo: part?.itemNo ?? fg.itemCode, itemName: part?.itemName ?? '',
        orderNo: fg.orderNo, status: fg.status, issuedAt: this.fmtDate(fg.issuedAt),
        productionDate,
      },
      processHistory, inspections,
      packaging: {
        boxNo: fg.boxNo ?? null, boxPackedAt: this.fmtDate(box?.closeAt),
        palletNo: box?.palletNo ?? null, palletPackedAt: this.fmtDate(pallet?.closeAt),
        shippedAt: this.fmtDate(box?.shippedAt ?? pallet?.shippedAt),
      },
      materials, semiProducts,
    };
  }
```

> 주의: `jobOrder?.planDate` 프로퍼티명은 `job-order.entity.ts`에서 확인 후 사용(없으면 prodResults[0].startAt로 대체).

- [ ] **Step 4: 타입체크 (resolveSemiProducts 미구현 → 임시 스텁)**

`resolveSemiProducts`를 임시로 `private async resolveSemiProducts(...) { return []; }` 추가 후:
Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
git commit -F <메시지파일>
# feat(trace): 제품 공정/검사/포장/자재 섹션 조립
```

---

## Task 4: 반제품 역추적 (⑥ resolveSemiProducts)

**Files:**
- Modify: `apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts`

**Interfaces:**
- Consumes: Task 2~3의 `resolveProcessHistory`, `resolveInspections`, `collectMaterialCtx`, `resolveMaterialTraces`
- Produces: `private async resolveSemiProducts(serial, company, plant): Promise<SemiProductTrace[]>` (Task 3 스텁 교체)

- [ ] **Step 1: 스텁을 실제 구현으로 교체**

```ts
  /** 제품(FG)이 소비한 반제품(SG)을 genealogy로 찾아 각 SG의 생산이력·검사·투입자재까지 조립 */
  private async resolveSemiProducts(serial: string, company: string, plant: string): Promise<SemiProductTrace[]> {
    const sgLinks = await this.genealogyRepo.find({
      where: { parentType: 'FG', parentKey: serial, childType: 'SG', company, plant },
    });
    if (sgLinks.length === 0) return [];

    const sgBarcodes = [...new Set(sgLinks.map((g) => g.childKey))];
    const sgLabels = await this.sgLabelRepo.find({ where: { sgBarcode: In(sgBarcodes), company, plant } });
    const sgMap = new Map(sgLabels.map((s) => [s.sgBarcode, s]));

    const itemCodes = [...new Set(sgLabels.map((s) => s.itemCode))];
    const parts = itemCodes.length
      ? await this.partMasterRepo.find({ where: { itemCode: In(itemCodes), company, plant } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 소비량: 동일 SG 여러 링크 합산
    const consumedBySg = new Map<string, number>();
    for (const g of sgLinks) consumedBySg.set(g.childKey, (consumedBySg.get(g.childKey) ?? 0) + g.qty);

    const result: SemiProductTrace[] = [];
    for (const sgBarcode of sgBarcodes) {
      const sg = sgMap.get(sgBarcode);
      const part = sg ? partMap.get(sg.itemCode) : undefined;
      const processHistory = await this.resolveProcessHistory(sg?.orderNo ?? null, sgBarcode, company, plant);
      const inspections = await this.resolveInspections(sgBarcode, company, plant);
      const matCtx = await this.collectMaterialCtx(sg?.orderNo ?? null, 'SG', sgBarcode, company, plant);
      const materials = await this.resolveMaterialTraces(matCtx, company, plant);

      result.push({
        sgBarcode,
        itemCode: sg?.itemCode ?? '',
        itemName: part?.itemName ?? '',
        consumedQty: consumedBySg.get(sgBarcode) ?? 0,
        status: sg?.status ?? '',
        issueProcessCode: sg?.issueProcessCode ?? null,
        processHistory, inspections, materials,
      });
    }
    return result;
  }
```

- [ ] **Step 2: 타입체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
git commit -F <메시지파일>
# feat(trace): 반제품 SG 생산이력·검사·투입자재 역추적
```

---

## Task 5: 컨트롤러 교체 + 실DB 검증

**Files:**
- Modify: `apps/backend/src/modules/quality/inspection/controllers/trace.controller.ts`
- Modify: 추적성 모듈 파일 (provider에 `ProductTraceabilityService` 등록 — Task 1 Step 1에서 보류했으면 지금 확정)

- [ ] **Step 1: 컨트롤러가 신규 서비스를 호출하도록 교체**

`trace.controller.ts`의 생성자에 `private readonly traceabilityService: ProductTraceabilityService` 주입, `getTrace`에서:

```ts
const data = await this.traceabilityService.getBySerial(serial, company, plant);
return ResponseUtil.success(data);
```

기존 `TraceService` 주입은 다른 사용처가 없으면 제거, 있으면 유지.

- [ ] **Step 2: 모듈 provider/exports 확정 + 타입체크**

모듈 providers에 `ProductTraceabilityService` 포함, `forFeature`에 Task 1 엔티티 전부 포함 확인.
Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 3: 백엔드 기동 확인 (dev 서버 떠있으면 생략)**

dev 서버가 떠있지 않으면 `pnpm --filter @harness/backend dev`로 기동 후 `/health` 200 확인. 떠있으면 자동 리로드 대기.

- [ ] **Step 4: 실DB API 검증 (시리얼 FG26062300301)**

로그인 토큰으로 호출하거나, 서비스 메서드를 직접 호출하는 임시 스크립트로 검증. 최소 기준:
- `product.serialNo === 'FG26062300301'`, `itemName` 채워짐
- `inspections`는 본인 검사만(시리얼 격리 — 90건이 아니라 소수)
- `materials[].po`/`iqc`가 LOT에 PO/IQC 있으면 채워짐
- `semiProducts`: 반제품 있으면 각 항목에 `processHistory`/`materials` 존재

Run(예): `curl -s 'http://localhost:3002/api/v1/quality/trace?serial=FG26062300301' -H 'Authorization: Bearer <token>' | jq '{serial:.data.product.serialNo, insp:(.data.inspections|length), mats:(.data.materials|length), semi:(.data.semiProducts|length)}'`
Expected: serial 일치, insp 소수, mats/semi는 데이터에 따라.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/quality/inspection/controllers/trace.controller.ts <모듈파일>
git commit -F <메시지파일>
# feat(trace): 추적성 컨트롤러 신규 종합 서비스로 교체
```

---

## Task 6: 프론트 공통 컴포넌트 — MaterialSection (LOT 아코디언 + PO/IQC 중첩)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/trace/types.ts`
- Create: `apps/frontend/src/app/(authenticated)/quality/trace/components/MaterialSection.tsx`

**Interfaces:**
- Produces: `types.ts`(백엔드 DTO 미러), `MaterialSection({ materials, title }: { materials: MaterialTrace[]; title?: string })`

- [ ] **Step 1: 프론트 타입 미러 작성**

`types.ts`에 백엔드 `ProductTraceabilityDto`와 동일한 인터페이스(`ProcessStep`, `InspectionRecord`, `MaterialTrace`, `SemiProductTrace`, `ProductTraceabilityDto`)를 복사한다(Task 1의 DTO와 1:1 동일 필드).

- [ ] **Step 2: MaterialSection 컴포넌트 (각 LOT 펼침 시 발주·입하·IQC·입고)**

```tsx
"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MaterialTrace } from "../types";

export default function MaterialSection({ materials }: { materials: MaterialTrace[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (materials.length === 0) return <div className="text-sm text-text-muted py-4">{t("quality.trace.noMaterials", "투입 자재 없음")}</div>;

  return (
    <div className="space-y-2">
      {materials.map((m) => {
        const id = m.matUid;
        const expanded = open.has(id);
        return (
          <div key={id} className="border border-border rounded-lg">
            <button onClick={() => toggle(id)} className="w-full flex items-center gap-2 p-3 text-left">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-mono text-primary">{m.matUid}</span>
              <span className="text-text">{m.itemName || m.itemCode}</span>
              <span className="ml-auto text-sm text-text-muted">{m.usedQty.toLocaleString()} {m.unit} · {m.vendorName ?? "-"}</span>
            </button>
            {expanded && (
              <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <NestedRow label={t("quality.trace.po", "발주(PO)")} value={m.po ? `${m.po.poNo} / ${fmtDate(m.po.orderDate)} / ${m.po.partnerName ?? "-"}` : "-"} />
                <NestedRow label={t("quality.trace.arrival", "입하")} value={m.arrival ? `${m.arrival.arrivalNo} / ${fmtDate(m.arrival.arrivalDate)} / ${m.arrival.qty}` : "-"} />
                <NestedRow label={t("quality.trace.iqc", "수입검사(IQC)")} value={m.iqc ? `${m.iqc.result} / ${m.iqc.inspectType} / ${m.iqc.inspectorName ?? "-"}` : "-"} />
                <NestedRow label={t("quality.trace.receiving", "입고")} value={m.receiving ? `${m.receiving.receiveNo} / ${fmtDate(m.receiving.receiveDate)}` : "-"} />
                <NestedRow label={t("quality.trace.issue", "투입")} value={m.issue ? `${m.issue.orderNo ?? "-"} / ${m.issue.issueQty} / ${fmtDate(m.issue.issueDate)}` : "-"} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NestedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-text-muted min-w-[96px]">{label}</span>
      <span className="text-text font-mono">{value}</span>
    </div>
  );
}

function fmtDate(s: string | null): string {
  if (!s) return "-";
  return s.length >= 10 ? s.slice(0, 19).replace("T", " ") : s;
}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/quality/trace/types.ts apps/frontend/src/app/(authenticated)/quality/trace/components/MaterialSection.tsx
git commit -F <메시지파일>
# feat(trace): 자재 LOT PO/IQC 중첩 컴포넌트
```

---

## Task 7: 프론트 page.tsx 전면 재작성 (섹션 + 반제품)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/trace/components/SemiProductSection.tsx`
- Modify(전면 재작성): `apps/frontend/src/app/(authenticated)/quality/trace/page.tsx`

**Interfaces:**
- Consumes: `MaterialSection`, `types.ts`
- Produces: `SemiProductSection({ semiProducts })`

- [ ] **Step 1: SemiProductSection (반제품 아코디언 → 생산이력+검사+자재)**

```tsx
"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { SemiProductTrace } from "../types";
import MaterialSection from "./MaterialSection";

export default function SemiProductSection({ semiProducts }: { semiProducts: SemiProductTrace[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (semiProducts.length === 0) return <div className="text-sm text-text-muted py-4">{t("quality.trace.noSemiProducts", "투입 반제품 없음")}</div>;

  return (
    <div className="space-y-2">
      {semiProducts.map((sp) => {
        const expanded = open.has(sp.sgBarcode);
        return (
          <div key={sp.sgBarcode} className="border border-border rounded-lg">
            <button onClick={() => toggle(sp.sgBarcode)} className="w-full flex items-center gap-2 p-3 text-left">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-mono text-primary">{sp.sgBarcode}</span>
              <span className="text-text">{sp.itemName || sp.itemCode}</span>
              <span className="ml-auto text-sm text-text-muted">{sp.consumedQty.toLocaleString()} · {sp.status}</span>
            </button>
            {expanded && (
              <div className="px-4 pb-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-text mb-2">{t("quality.trace.processTimeline", "공정 생산이력")}</div>
                  <ul className="text-sm space-y-1">
                    {sp.processHistory.map((s, i) => (
                      <li key={i} className="flex gap-2 text-text-muted">
                        <span className="font-mono">{s.timestamp.slice(0, 19).replace("T", " ")}</span>
                        <span className="text-text">{s.processName}</span>
                        <span>{s.equipmentName} / {s.operator}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium text-text mb-2">{t("quality.trace.semiMaterials", "반제품 투입 자재")}</div>
                  <MaterialSection materials={sp.materials} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: page.tsx 재작성 (세로 스택 섹션)**

기존 `page.tsx`를 전면 교체한다. 핵심 구조:

```tsx
"use client";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, History } from "lucide-react";
import { Card, CardHeader, CardContent, Button, Input } from "@/components/ui";
import api from "@/services/api";
import type { ProductTraceabilityDto } from "./types";
import MaterialSection from "./components/MaterialSection";
import SemiProductSection from "./components/SemiProductSection";

export default function TracePage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [data, setData] = useState<ProductTraceabilityDto | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchValue.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const res = await api.get("/quality/trace", { params: { serial: searchValue.trim() } });
      setData(res.data?.data ?? null);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [searchValue]);

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6 gap-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2"><History className="w-7 h-7 text-primary" />{t("quality.trace.title")}</h1>
        <p className="text-text-muted mt-1">{t("quality.trace.description")}</p>
      </div>

      <Card><CardContent>
        <div className="flex gap-4">
          <Input className="flex-1" placeholder={t("quality.trace.searchPlaceholder")} value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            leftIcon={<Search className="w-4 h-4" />} fullWidth />
          <Button onClick={handleSearch} disabled={loading}><Search className="w-4 h-4 mr-1" />{t("common.search")}</Button>
        </div>
      </CardContent></Card>

      {searched && !data && !loading && (
        <Card><CardContent><div className="text-center py-12 text-text-muted">{t("quality.trace.noResults")}</div></CardContent></Card>
      )}

      {data && (
        <>
          {/* ① 기본정보 */}
          <Card>
            <CardHeader title={t("quality.trace.productInfo")} />
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Field label={t("quality.trace.serialNo")} value={data.product.serialNo} mono />
                <Field label={t("quality.trace.partNo")} value={data.product.itemNo} />
                <Field label={t("quality.trace.partName")} value={data.product.itemName} />
                <Field label={t("quality.trace.workOrderNo")} value={data.product.orderNo ?? "-"} />
                <Field label={t("quality.trace.statusCol")} value={data.product.status} />
                <Field label={t("quality.trace.productionDate")} value={fmt(data.product.productionDate)} />
              </div>
            </CardContent>
          </Card>

          {/* ② 공정 생산이력 */}
          <Card>
            <CardHeader title={t("quality.trace.processTimeline")} />
            <CardContent>
              <ul className="space-y-2">
                {data.processHistory.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm border-b border-border last:border-0 py-2">
                    <span className="font-mono text-text-muted">{s.timestamp.slice(0, 19).replace("T", " ")}</span>
                    <span className="font-medium text-text">{s.processName}</span>
                    <span className="text-text-muted">{s.equipmentName} / {s.operator}</span>
                    <span className="ml-auto">{badge(s.result)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ③ 검사 기록 */}
          <Card>
            <CardHeader title={t("quality.trace.inspections")} />
            <CardContent>
              {data.inspections.length === 0 ? <div className="text-sm text-text-muted">{t("quality.trace.noInspections", "검사 기록 없음")}</div> :
                <ul className="space-y-2">
                  {data.inspections.map((ir, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm border-b border-border last:border-0 py-2">
                      <span className="font-mono text-text-muted">{ir.inspectAt.slice(0, 19).replace("T", " ")}</span>
                      <span className="font-medium text-text">{ir.inspectType}</span>
                      <span className="text-text-muted">{ir.inspectorId}</span>
                      <span className="ml-auto">{badge(ir.result)}</span>
                    </li>
                  ))}
                </ul>}
            </CardContent>
          </Card>

          {/* ④ 포장·입고·출하 */}
          <Card>
            <CardHeader title={t("quality.trace.packaging")} />
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <Field label={t("quality.trace.boxNo")} value={data.packaging.boxNo ?? "-"} mono />
                <Field label={t("quality.trace.boxPackedAt")} value={fmt(data.packaging.boxPackedAt)} />
                <Field label={t("quality.trace.palletNo")} value={data.packaging.palletNo ?? "-"} mono />
                <Field label={t("quality.trace.palletPackedAt")} value={fmt(data.packaging.palletPackedAt)} />
                <Field label={t("quality.trace.shippedAt")} value={fmt(data.packaging.shippedAt)} />
              </div>
            </CardContent>
          </Card>

          {/* ⑤ 투입 자재 */}
          <Card>
            <CardHeader title={t("quality.trace.materials")} />
            <CardContent><MaterialSection materials={data.materials} /></CardContent>
          </Card>

          {/* ⑥ 투입 반제품 */}
          <Card>
            <CardHeader title={t("quality.trace.semiProducts")} />
            <CardContent><SemiProductSection semiProducts={data.semiProducts} /></CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-sm text-text-muted mb-1">{label}</div>
      <div className={mono ? "font-mono text-text" : "text-text"}>{value}</div>
    </div>
  );
}
function fmt(s: string | null): string { return s ? s.slice(0, 19).replace("T", " ") : "-"; }
function badge(r: "PASS" | "FAIL" | "WORK") {
  const cls = r === "PASS" ? "text-green-600 border-green-600" : r === "FAIL" ? "text-red-600 border-red-600" : "text-blue-600 border-blue-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>{r}</span>;
}
```

> 배지는 파스텔 배경 없이 텍스트/테두리만 사용(Global Constraints 준수).

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/quality/trace/components/SemiProductSection.tsx apps/frontend/src/app/(authenticated)/quality/trace/page.tsx
git commit -F <메시지파일>
# feat(trace): 추적성 화면 섹션형 전면 재작성
```

---

## Task 8: i18n 4파일 + 최종 검증

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json`

**Interfaces:**
- Consumes: Task 6~7에서 사용한 `quality.trace.*` 키

- [ ] **Step 1: 신규 i18n 키 추가 (4파일 동시)**

`quality.trace` 네임스페이스에 다음 키를 4개 언어 파일에 동일 구조로 추가(누락 0). 기존 `title/description/searchPlaceholder/productInfo/processTimeline/serialNo/partNo/partName/workOrderNo/productionDate/materials/noResults`는 재사용, 신규는:
`statusCol, inspections, noInspections, packaging, boxNo, boxPackedAt, palletNo, palletPackedAt, shippedAt, semiProducts, noSemiProducts, semiMaterials, noMaterials, po, arrival, iqc, receiving, issue`

ko 예시:
```json
"statusCol": "상태",
"inspections": "검사 기록",
"noInspections": "검사 기록 없음",
"packaging": "포장·입고·출하",
"boxNo": "박스번호",
"boxPackedAt": "박스 포장일시",
"palletNo": "팔레트번호",
"palletPackedAt": "팔레트 포장일시",
"shippedAt": "출하일시",
"semiProducts": "투입 반제품",
"noSemiProducts": "투입 반제품 없음",
"semiMaterials": "반제품 투입 자재",
"noMaterials": "투입 자재 없음",
"po": "발주(PO)",
"arrival": "입하",
"iqc": "수입검사(IQC)",
"receiving": "입고",
"issue": "투입"
```
en/zh/vi도 동일 키로 번역 추가. JSON BOM 금지.

- [ ] **Step 2: 누락 키 검증**

Run: `node scripts/find_missing_i18n.js` (있으면) 또는 Grep으로 `quality.trace.semiProducts`가 4파일 모두에 있는지 확인.
Expected: 4파일 모두 존재.

- [ ] **Step 3: 최종 타입체크 (프론트+백)**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 둘 다 에러 0건.

- [ ] **Step 4: 실DB 통합 확인 (FG26062300301)**

화면(`http://localhost:3002/quality/trace`)에서 `FG26062300301` 검색 → ①~⑥ 섹션 표시, 검사 기록 본인 것만, 자재 LOT 펼침 시 PO/IQC 노출, 반제품 있으면 ⑥ 펼침 동작. 스크롤 정상.

- [ ] **Step 5: 커밋 + 협업 보드 정리**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F <메시지파일>
# feat(trace): 추적성 화면 i18n 4파일
```
`.ai-coordination/LOCKS.md`에서 본 task 잠금 제거, `JOURNAL.md`/`ARCHIVE.md` 한 줄 기록(별도 커밋).

---

## Self-Review (스펙 대비)

- ✅ 6개 섹션(①제품 ②공정 ③검사 ④포장/출하 ⑤자재 ⑥반제품) — Task 3·4·7 커버
- ✅ 자재 LOT PO→입하→IQC→입고 중첩 — Task 2 `resolveMaterialTraces`, Task 6 `MaterialSection`
- ✅ 반제품 재귀(생산이력+검사+투입자재) — Task 4 `resolveSemiProducts`, Task 7 `SemiProductSection`(MaterialSection 재사용)
- ✅ 단일 종합 API / `/quality/trace` 교체 — Task 5
- ✅ 시리얼 격리 — Task 3 `resolveProcessHistory`/`resolveInspections`
- ✅ N+1 회피 `In()` 배치 — Task 2·3·4
- ✅ genealogy SG→MAT_LOT 경로 반영(스펙 보강) — Task 3 `collectMaterialCtx`
- ✅ 멀티테넌시 스코프, 파스텔 금지, overflow-y-auto, i18n 4파일 — Global Constraints
- 비범위: SG→SG 재귀, 정방향 추적, 출하 거래처 상세 — 계획에서 제외(스펙 §9 일치)

**확인 필요(구현 중 1회):** `job-order.entity.ts`의 생산일 프로퍼티명(`planDate` 가정) — Task 3 Step 3 주석대로 실제 확인.
