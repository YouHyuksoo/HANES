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
import { PartnerMaster } from '../../../../entities/partner-master.entity';
import {
  MaterialTrace,
  ProcessStep,
  InspectionRecord,
  SemiProductTrace,
  ProductTraceabilityDto,
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
    @InjectRepository(PartnerMaster) private readonly partnerMasterRepo: Repository<PartnerMaster>,
  ) {}

  private fmtDate(d: Date | null | undefined): string | null {
    return d instanceof Date ? d.toISOString() : null;
  }

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

    // 공급사 코드 → 거래처명 매핑 (vendor는 PARTNER_MASTERS.partnerCode)
    const vendorCodes = [...new Set(lots.map((l) => l.vendor).filter(Boolean))];
    const partners = vendorCodes.length
      ? await this.partnerMasterRepo.find({ where: { partnerCode: In(vendorCodes), company, plant } })
      : [];
    const partnerNameMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

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
        vendorName: lot?.vendor ? (partnerNameMap.get(lot.vendor) ?? lot.vendor) : null,
        po: po ? { poNo: po.poNo, orderDate: this.fmtDate(po.orderDate), partnerName: po.partnerName } : null,
        arrival: arrival ? { arrivalNo: arrival.arrivalNo, arrivalDate: this.fmtDate(arrival.arrivalDate), qty: arrival.qty } : null,
        iqc: iqc ? { result: iqc.result, inspectType: iqc.inspectType, inspectorName: iqc.inspectorName, inspectDate: this.fmtDate(iqc.inspectDate), certFilePath: iqc.certFilePath } : null,
        receiving: recv ? { receiveNo: recv.receiveNo, receiveDate: this.fmtDate(recv.receiveDate) } : null,
        issue: { orderNo: ctx.orderNo, issueQty: ctx.issueQty, issueDate: this.fmtDate(ctx.issueDate) },
      });
    }
    return result;
  }

  // ─── Step 1: 마스터 캐시 + 헬퍼 ────────────────────────────────────────────

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
    const steps: ProcessStep[] = [];

    // TRACE_LOGS가 있으면 그 경로만 사용 — PROD_RESULTS는 조회하지 않는다(불필요한 왕복 제거).
    if (traceLogs.length > 0) {
      const procCodes = new Set<string>();
      const equipCodes = new Set<string>();
      const workerIds = new Set<string>();
      for (const t of traceLogs) { if (t.processCode) procCodes.add(t.processCode); if (t.equipCode) equipCodes.add(t.equipCode); if (t.workerId) workerIds.add(t.workerId); }
      const { procMap, equipMap, workerMap } = await this.loadMasters([...procCodes], [...equipCodes], [...workerIds], company, plant);
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

    // TRACE_LOGS 없음 → PROD_RESULTS + INSPECT_RESULTS(시리얼 격리) fallback
    const prodResults = orderNo
      ? await this.prodResultRepo.find({ where: { orderNo, company, plant }, order: { startAt: 'ASC' } })
      : [];
    const procCodes = new Set<string>();
    const equipCodes = new Set<string>();
    const workerIds = new Set<string>();
    for (const p of prodResults) { if (p.processCode) procCodes.add(p.processCode); if (p.equipCode) equipCodes.add(p.equipCode); if (p.workerId) workerIds.add(p.workerId); }
    const { procMap, equipMap, workerMap } = await this.loadMasters([...procCodes], [...equipCodes], [...workerIds], company, plant);

    const resultNos = prodResults.map((p) => p.resultNo);
    const insp = resultNos.length
      ? await this.inspectResultRepo.find({ where: { prodResultNo: In(resultNos), company, plant }, order: { inspectAt: 'ASC' } })
      : [];
    const inspByResult = new Map<string, InspectResult[]>();
    for (const ir of insp) {
      if (ir.fgBarcode !== serial && ir.serialNo !== serial) continue; // 시리얼 격리
      const k = ir.prodResultNo ?? '';
      let bucket = inspByResult.get(k);
      if (!bucket) {
        bucket = [];
        inspByResult.set(k, bucket);
      }
      bucket.push(ir);
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

  // ─── Step 2: resolveInspections + collectMaterialCtx ───────────────────────

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
      result: ir.passYn === 'Y' ? 'PASS' : ('FAIL' as const),
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

  // ─── Step 3: getBySerial 메인 (제품 섹션 ①②③④⑤) ─────────────────────────

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

    // jobOrder.planDate 존재 확인: job-order.entity.ts 실측 결과 planDate: Date | null 존재함
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

  // ─── Step 4: resolveSemiProducts ─────────────────────────────────────────

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

    // SG별 추적은 서로 독립적이므로 병렬 실행한다(순차 await로 인한 O(N) 직렬 왕복 회피).
    return Promise.all(
      sgBarcodes.map(async (sgBarcode) => {
        const sg = sgMap.get(sgBarcode);
        const part = sg ? partMap.get(sg.itemCode) : undefined;
        const [processHistory, inspections, matCtx] = await Promise.all([
          this.resolveProcessHistory(sg?.orderNo ?? null, sgBarcode, company, plant),
          this.resolveInspections(sgBarcode, company, plant),
          this.collectMaterialCtx(sg?.orderNo ?? null, 'SG', sgBarcode, company, plant),
        ]);
        const materials = await this.resolveMaterialTraces(matCtx, company, plant);

        return {
          sgBarcode,
          itemCode: sg?.itemCode ?? '',
          itemName: part?.itemName ?? '',
          consumedQty: consumedBySg.get(sgBarcode) ?? 0,
          status: sg?.status ?? '',
          issueProcessCode: sg?.issueProcessCode ?? null,
          processHistory, inspections, materials,
        };
      }),
    );
  }
}
