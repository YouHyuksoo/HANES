// apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, Like } from 'typeorm';
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
import { ItemMaster } from '../../../../entities/item-master.entity';
import { BoxMaster } from '../../../../entities/box-master.entity';
import { PalletMaster } from '../../../../entities/pallet-master.entity';
import { EquipMaster } from '../../../../entities/equip-master.entity';
import { WorkerMaster } from '../../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { PartnerMaster } from '../../../../entities/partner-master.entity';
import { ShipmentOrder } from '../../../../entities/shipment-order.entity';
import { StockTransaction } from '../../../../entities/stock-transaction.entity';
import { EquipInspectLog } from '../../../../entities/equip-inspect-log.entity';
import { ConsumableMountLog } from '../../../../entities/consumable-mount-log.entity';
import { ConsumableMaster } from '../../../../entities/consumable-master.entity';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { RepairOrder } from '../../../../entities/repair-order.entity';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { Warehouse } from '../../../../entities/warehouse.entity';
import {
  MaterialTrace,
  ProcessStep,
  InspectionRecord,
  SemiProductTrace,
  ProductTraceabilityDto,
  StockMove,
  EquipInspection,
  EquipInspectionItem,
  EquipConsumable,
  DefectRecord,
  RepairRecord,
  TraceCandidate,
  TraceCandidatesResult,
  TraceSearchMode,
} from '../dto/product-traceability.dto';

const TRACE_CANDIDATE_CONFIRM_LIMIT = 500;

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
    @InjectRepository(ItemMaster) private readonly itemMasterRepo: Repository<ItemMaster>,
    @InjectRepository(BoxMaster) private readonly boxMasterRepo: Repository<BoxMaster>,
    @InjectRepository(PalletMaster) private readonly palletMasterRepo: Repository<PalletMaster>,
    @InjectRepository(EquipMaster) private readonly equipMasterRepo: Repository<EquipMaster>,
    @InjectRepository(WorkerMaster) private readonly workerMasterRepo: Repository<WorkerMaster>,
    @InjectRepository(ProcessMaster) private readonly processMasterRepo: Repository<ProcessMaster>,
    @InjectRepository(PartnerMaster) private readonly partnerMasterRepo: Repository<PartnerMaster>,
    @InjectRepository(ShipmentOrder) private readonly shipmentOrderRepo: Repository<ShipmentOrder>,
    @InjectRepository(StockTransaction) private readonly stockTransactionRepo: Repository<StockTransaction>,
    @InjectRepository(EquipInspectLog) private readonly equipInspectLogRepo: Repository<EquipInspectLog>,
    @InjectRepository(ConsumableMountLog) private readonly consumableMountLogRepo: Repository<ConsumableMountLog>,
    @InjectRepository(ConsumableMaster) private readonly consumableMasterRepo: Repository<ConsumableMaster>,
    @InjectRepository(DefectLog) private readonly defectLogRepo: Repository<DefectLog>,
    @InjectRepository(RepairOrder) private readonly repairOrderRepo: Repository<RepairOrder>,
    @InjectRepository(ReworkOrder) private readonly reworkOrderRepo: Repository<ReworkOrder>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
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
      ? await this.itemMasterRepo.find({ where: { itemCode: In(itemCodes), company, plant } })
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

    // 수불이력: matUids 일괄 조회 → matUid별 그룹 Map
    const stockTx = matUids.length
      ? await this.stockTransactionRepo.find({ where: { matUid: In(matUids), company, plant }, order: { transDate: 'ASC' } })
      : [];
    // 창고 코드 → 창고명 매핑 (수불 from/to 창고)
    const whCodes = [...new Set(stockTx.flatMap((tx) => [tx.fromWarehouseId, tx.toWarehouseId]).filter((v): v is string => !!v))];
    const warehouses = whCodes.length
      ? await this.warehouseRepo.find({ where: { warehouseCode: In(whCodes), company, plant } })
      : [];
    const whNameMap = new Map(warehouses.map((w) => [w.warehouseCode, w.warehouseName]));
    const stockByMat = new Map<string, StockMove[]>();
    for (const tx of stockTx) {
      if (!tx.matUid) continue; // nullable matUid는 건너뜀
      const arr = stockByMat.get(tx.matUid) ?? [];
      arr.push({
        transNo: tx.transNo,
        transType: tx.transType,
        transDate: this.fmtDate(tx.transDate) ?? '',
        qty: tx.qty,
        fromWarehouse: tx.fromWarehouseId ?? null,
        fromWarehouseName: tx.fromWarehouseId ? (whNameMap.get(tx.fromWarehouseId) ?? null) : null,
        toWarehouse: tx.toWarehouseId ?? null,
        toWarehouseName: tx.toWarehouseId ? (whNameMap.get(tx.toWarehouseId) ?? null) : null,
        refType: tx.refType ?? null,
        refId: tx.refId ?? null,
        remark: tx.remark ?? null,
      });
      stockByMat.set(tx.matUid, arr);
    }

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
        stockHistory: stockByMat.get(matUid) ?? [],
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

  // ─── 신규 헬퍼 ──────────────────────────────────────────────────────────────

  /**
   * 설비점검 이력 조회 (WORKER 점검: orderNos 기준 / DAILY 점검: equipCodes + productionDate 기준)
   */
  private async resolveEquipInspections(
    orderNos: string[],
    equipCodes: string[],
    productionDate: string | null,
    company: string,
    plant: string,
  ): Promise<EquipInspection[]> {
    if (orderNos.length === 0 && equipCodes.length === 0) return [];

    // WORKER 점검: 작업지시 기준
    const workerLogs = orderNos.length
      ? await this.equipInspectLogRepo.find({
          where: { orderNo: In(orderNos), inspectType: 'WORKER', company, plant },
        })
      : [];

    // DAILY 점검: 설비 기준, productionDate 있으면 workDate 메모리 필터
    let dailyLogs = equipCodes.length
      ? await this.equipInspectLogRepo.find({
          where: { equipCode: In(equipCodes), inspectType: 'DAILY', company, plant },
        })
      : [];
    if (productionDate) {
      dailyLogs = dailyLogs.filter((log) => {
        if (!log.workDate) return false;
        const wd = log.workDate instanceof Date ? log.workDate.toISOString().slice(0, 10) : String(log.workDate).slice(0, 10);
        return wd === productionDate.slice(0, 10);
      });
    }

    const allLogs = [...workerLogs, ...dailyLogs];
    if (allLogs.length === 0) return [];

    // EquipMaster 일괄 조회 → equipCode → equipName Map
    const allEquipCodes = [...new Set(allLogs.map((l) => l.equipCode).filter(Boolean))];
    const equipRows = allEquipCodes.length
      ? await this.equipMasterRepo.find({ where: { equipCode: In(allEquipCodes), company, plant } })
      : [];
    const equipNameMap = new Map(equipRows.map((e) => [e.equipCode, e.equipName]));

    // inspectAt ASC 정렬
    allLogs.sort((a, b) => {
      const at = a.inspectAt?.getTime() ?? 0;
      const bt = b.inspectAt?.getTime() ?? 0;
      return at - bt;
    });

    return allLogs.map((log) => ({
      equipCode: log.equipCode,
      equipName: equipNameMap.get(log.equipCode) ?? log.equipCode,
      inspectType: log.inspectType,
      inspectDate: this.fmtDate(log.inspectDate),
      inspectAt: this.fmtDate(log.inspectAt),
      inspectorName: log.inspectorName ?? null,
      overallResult: log.overallResult,
      remark: log.remark ?? null,
      items: this.parseInspectItems(log.details),
    }));
  }

  /**
   * 설비점검 DETAILS(JSON) → 항목별 결과. 운영 형식({items:[{itemName,result,remark}]})과
   * 단순 key-value({lubrication:"OK"}) 양쪽을 모두 지원한다.
   */
  private parseInspectItems(details: string | null): EquipInspectionItem[] {
    if (!details) return [];
    const toItem = (it: Record<string, unknown>): EquipInspectionItem => ({
      name: String(it.itemName ?? it.name ?? it.itemCode ?? it.itemId ?? ''),
      result: String(it.result ?? ''),
      remark: it.remark != null && it.remark !== '' ? String(it.remark) : null,
    });
    try {
      const d: unknown = JSON.parse(details);
      if (d && typeof d === 'object' && Array.isArray((d as { items?: unknown }).items)) {
        return (d as { items: unknown[] }).items.map((it) => toItem(it as Record<string, unknown>));
      }
      if (Array.isArray(d)) {
        return d.map((it) => toItem(it as Record<string, unknown>));
      }
      if (d && typeof d === 'object') {
        return Object.entries(d as Record<string, unknown>).map(([k, v]) => ({ name: k, result: String(v), remark: null }));
      }
    } catch {
      // DETAILS 파싱 실패 — 항목 없음으로 처리
    }
    return [];
  }

  /**
   * 설비 장착 소모품 이력 조회
   */
  private async resolveEquipConsumables(
    equipCodes: string[],
    company: string,
    plant: string,
  ): Promise<EquipConsumable[]> {
    if (equipCodes.length === 0) return [];

    const logs = await this.consumableMountLogRepo.find({
      where: { equipCode: In(equipCodes), company, plant },
      order: { mountDate: 'DESC', seq: 'DESC' },
    });
    if (logs.length === 0) return [];

    // ConsumableMaster 일괄 조회 → code→name Map
    const consumableCodes = [...new Set(logs.map((l) => l.consumableCode).filter(Boolean))];
    const masters = consumableCodes.length
      ? await this.consumableMasterRepo.find({ where: { consumableCode: In(consumableCodes), company, plant } })
      : [];
    const masterMap = new Map(masters.map((m) => [m.consumableCode, m]));

    return logs.map((log) => {
      const m = masterMap.get(log.consumableCode);
      return {
        consumableCode: log.consumableCode,
        consumableName: m?.consumableName ?? log.consumableCode,
        equipCode: log.equipCode,
        action: log.action,
        mountAt: this.fmtDate(log.mountDate) ?? this.fmtDate(log.createdAt),
        workerId: log.workerId ?? null,
        remark: log.remark ?? null,
        expectedLife: m?.expectedLife ?? null,
        currentCount: m?.currentCount ?? null,
        warningCount: m?.warningCount ?? null,
        lifeStatus: m?.status ?? null,
      };
    });
  }

  /**
   * 불량/수리 이력 조회 (DefectLog + RepairOrder + ReworkOrder)
   */
  private async resolveDefectsAndRepairs(
    prodResultNos: string[],
    serial: string,
    prdUid: string,
    company: string,
    plant: string,
  ): Promise<{ defects: DefectRecord[]; repairs: RepairRecord[] }> {
    // 불량 이력
    const defectRows = prodResultNos.length
      ? await this.defectLogRepo.find({ where: { prodResultNo: In(prodResultNos), company, plant } })
      : [];
    const defects: DefectRecord[] = defectRows.map((d) => ({
      defectCode: d.defectCode,
      defectName: d.defectName ?? d.defectCode,
      qty: d.qty,
      status: d.status,
      cause: d.cause ?? null,
      occurAt: this.fmtDate(d.occurAt),
    }));

    // 수리 이력: RepairOrder (fgBarcode 또는 prdUid 기준)
    const repairConditions: FindOptionsWhere<RepairOrder>[] = [{ fgBarcode: serial, company, plant }];
    if (prdUid) repairConditions.push({ prdUid, company, plant });
    const repairRows = await this.repairOrderRepo.find({ where: repairConditions });

    const repairRecords: RepairRecord[] = repairRows.map((r) => {
      const repairDateStr = r.repairDate instanceof Date ? r.repairDate.toISOString().slice(0, 10) : String(r.repairDate).slice(0, 10);
      return {
        source: 'REPAIR' as const,
        refNo: `${repairDateStr}-${r.seq}`,
        status: r.status,
        result: r.repairResult ?? null,
        defectType: r.defectType ?? null,
        workerId: r.workerId ?? null,
        startAt: this.fmtDate(r.receivedAt),
        endAt: this.fmtDate(r.completedAt),
        remark: r.remark ?? null,
      };
    });

    // 재작업 이력: ReworkOrder (prdUid 기준)
    const reworkRows = prdUid
      ? await this.reworkOrderRepo.find({ where: { prdUid, company, plant } })
      : [];
    const reworkRecords: RepairRecord[] = reworkRows.map((r) => ({
      source: 'REWORK' as const,
      refNo: r.reworkNo,
      status: r.status,
      result: r.status ?? null,
      defectType: r.defectType ?? null,
      workerId: r.workerId ?? null,
      startAt: this.fmtDate(r.startAt),
      endAt: this.fmtDate(r.endAt),
      remark: r.remark ?? null,
    }));

    return { defects, repairs: [...repairRecords, ...reworkRecords] };
  }

  async findCandidates(
    mode: TraceSearchMode,
    input: { value?: string; equipCode?: string; dateFrom?: string; dateTo?: string; confirmLarge?: boolean },
    company: string,
    plant: string,
  ): Promise<TraceCandidatesResult> {
    const value = input.value?.trim() ?? '';
    if (mode !== 'equipment' && !value) return this.toCandidateResult([]);

    switch (mode) {
      case 'product':
        return this.toCandidateResult(await this.resolveProductCandidates(value, company, plant));
      case 'material':
        return this.resolveMaterialCandidates(value, company, plant, input.confirmLarge === true);
      case 'supplierLot':
        return this.resolveSupplierLotCandidates(value, company, plant, input.confirmLarge === true);
      case 'box':
        return this.toCandidateResult(await this.resolveBoxCandidates(value, company, plant));
      case 'pallet':
        return this.toCandidateResult(await this.resolvePalletCandidates(value, company, plant));
      case 'shipOrder':
        return this.toCandidateResult(await this.resolveShipOrderCandidates(value, company, plant));
      case 'equipment':
        return this.toCandidateResult(await this.resolveEquipmentCandidates(input.equipCode?.trim() ?? '', input.dateFrom ?? '', input.dateTo ?? '', company, plant));
      case 'operator':
        return this.toCandidateResult(await this.resolveOperatorCandidates(value, input.dateFrom ?? '', input.dateTo ?? '', company, plant));
      case 'workOrder':
        return this.toCandidateResult(await this.resolveWorkOrderCandidates(value, company, plant));
      case 'sg':
        return this.toCandidateResult(await this.resolveSgCandidates(value, company, plant));
      default:
        return this.toCandidateResult([]);
    }
  }

  private toCandidateResult(candidates: TraceCandidate[]): TraceCandidatesResult {
    return {
      candidates,
      requiresConfirmation: false,
      total: candidates.length,
      limit: TRACE_CANDIDATE_CONFIRM_LIMIT,
      message: null,
    };
  }

  private async resolveProductCandidates(value: string, company: string, plant: string): Promise<TraceCandidate[]> {
    const rows = await this.fgLabelRepo.find({
      where: [
        { fgBarcode: value, company, plant },
        { customerBarcode: value, company, plant },
      ],
      take: 500,
      order: { issuedAt: 'DESC' },
    });
    return this.fgRowsToCandidates(rows, '제품 바코드', value, company, plant);
  }

  private async resolveMaterialCandidates(value: string, company: string, plant: string, confirmLarge: boolean): Promise<TraceCandidatesResult> {
    const lot = await this.matLotRepo.findOne({ where: { matUid: value, company, plant } });
    if (!lot) return this.toCandidateResult([]);
    return this.resolveFgCandidatesByMatUids([lot.matUid], '자재 UID', value, company, plant, confirmLarge);
  }

  /** 원자재 업체 LOT(= MAT_LOTS.INVOICE_NO 송장번호) 기준으로 투입 제품을 역추적 */
  private async resolveSupplierLotCandidates(value: string, company: string, plant: string, confirmLarge: boolean): Promise<TraceCandidatesResult> {
    const lotRows = await this.matLotRepo.find({
      where: [
        { invoiceNo: value, company, plant },
        { invoiceNo: Like(`%${value}%`), company, plant },
      ],
      take: 200,
    });
    const matUids = [...new Set(lotRows.map((lot) => lot.matUid).filter(Boolean))];
    return this.resolveFgCandidatesByMatUids(matUids, '원자재 업체 LOT', value, company, plant, confirmLarge);
  }

  /** 자재 UID 집합 → 계보(genealogy)·투입이력으로 연결된 FG 후보로 변환 (자재/업체LOT 공통) */
  private async resolveFgCandidatesByMatUids(
    matUidsInput: string[],
    sourceLabel: string,
    sourceValue: string,
    company: string,
    plant: string,
    confirmLarge: boolean,
  ): Promise<TraceCandidatesResult> {
    const matUids = [...new Set(matUidsInput.filter(Boolean))];
    if (matUids.length === 0) return this.toCandidateResult([]);

    const fgKeys = new Set<string>();
    const fgLinks = await this.genealogyRepo.find({
      where: { childType: 'MAT_LOT', childKey: In(matUids), parentType: 'FG', company, plant },
    });
    for (const link of fgLinks) fgKeys.add(link.parentKey);

    const sgLinks = await this.genealogyRepo.find({
      where: { childType: 'MAT_LOT', childKey: In(matUids), parentType: 'SG', company, plant },
    });
    const sgKeys = [...new Set(sgLinks.map((link) => link.parentKey))];
    if (sgKeys.length > 0) {
      const parentFgLinks = await this.genealogyRepo.find({
        where: { parentType: 'FG', childType: 'SG', childKey: In(sgKeys), company, plant },
      });
      for (const link of parentFgLinks) fgKeys.add(link.parentKey);
    }

    const matIssues = await this.matIssueRepo.find({
      where: { matUid: In(matUids), company, plant },
      order: { issueDate: 'DESC' },
    });
    const orderNos = [...new Set(matIssues.map((issue) => issue.orderNo).filter((v): v is string => !!v))];
    const byOrder = orderNos.length
      ? await this.fgLabelRepo.find({ where: { orderNo: In(orderNos), company, plant }, order: { issuedAt: 'DESC' } })
      : [];
    for (const fg of byOrder) fgKeys.add(fg.fgBarcode);

    if (fgKeys.size > TRACE_CANDIDATE_CONFIRM_LIMIT && !confirmLarge) {
      return {
        candidates: [],
        requiresConfirmation: true,
        total: fgKeys.size,
        limit: TRACE_CANDIDATE_CONFIRM_LIMIT,
        message: `연결 제품 후보가 ${fgKeys.size}건입니다. 조회 시간이 길어질 수 있습니다. 계속 조회할지 확인이 필요합니다.`,
      };
    }

    const fgs = fgKeys.size
      ? await this.fgLabelRepo.find({ where: { fgBarcode: In([...fgKeys]), company, plant }, order: { issuedAt: 'DESC' } })
      : [];
    return this.toCandidateResult(await this.fgRowsToCandidates(fgs, sourceLabel, sourceValue, company, plant));
  }

  private async resolveBoxCandidates(value: string, company: string, plant: string): Promise<TraceCandidate[]> {
    const fgs = await this.fgLabelRepo.find({ where: { boxNo: value, company, plant }, take: 500, order: { issuedAt: 'DESC' } });
    return this.fgRowsToCandidates(fgs, '박스번호', value, company, plant);
  }

  private async resolvePalletCandidates(value: string, company: string, plant: string): Promise<TraceCandidate[]> {
    const boxes = await this.boxMasterRepo.find({ where: { palletNo: value, company, plant }, take: 500 });
    const boxNos = boxes.map((box) => box.boxNo);
    const fgs = boxNos.length
      ? await this.fgLabelRepo.find({ where: { boxNo: In(boxNos), company, plant }, take: 500, order: { issuedAt: 'DESC' } })
      : [];
    return this.fgRowsToCandidates(fgs, '팔레트번호', value, company, plant);
  }

  private async resolveShipOrderCandidates(value: string, company: string, plant: string): Promise<TraceCandidate[]> {
    const directBoxes = await this.boxMasterRepo.find({ where: { shipOrderNo: value, company, plant }, take: 500 });
    const pallets = await this.palletMasterRepo.find({ where: { shipOrderNo: value, company, plant }, take: 500 });
    const palletNos = pallets.map((pallet) => pallet.palletNo);
    const palletBoxes = palletNos.length
      ? await this.boxMasterRepo.find({ where: { palletNo: In(palletNos), company, plant }, take: 500 })
      : [];
    const boxNos = [...new Set([...directBoxes, ...palletBoxes].map((box) => box.boxNo))];
    const fgs = boxNos.length
      ? await this.fgLabelRepo.find({ where: { boxNo: In(boxNos), company, plant }, take: 500, order: { issuedAt: 'DESC' } })
      : [];
    return this.fgRowsToCandidates(fgs, '출하지시번호', value, company, plant);
  }

  private async resolveEquipmentCandidates(
    equipCode: string,
    dateFrom: string,
    dateTo: string,
    company: string,
    plant: string,
  ): Promise<TraceCandidate[]> {
    if (!equipCode) return [];
    const prodResults = await this.prodResultRepo.find({
      where: { equipCode, company, plant },
      take: 500,
      order: { startAt: 'DESC' },
    });
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const orderNos = [
      ...new Set(
        prodResults
          .filter((result) => {
            const at = result.startAt ?? result.createdAt;
            const time = at instanceof Date ? at.getTime() : 0;
            return time >= fromTime && time <= toTime;
          })
          .map((result) => result.orderNo),
      ),
    ];
    const byOrder = orderNos.length
      ? await this.fgLabelRepo.find({ where: { orderNo: In(orderNos), company, plant }, take: 500, order: { issuedAt: 'DESC' } })
      : [];
    const direct = await this.fgLabelRepo.find({ where: { equipCode, company, plant }, take: 500, order: { issuedAt: 'DESC' } });
    return this.fgRowsToCandidates([...byOrder, ...direct], '설비 + 기간', equipCode, company, plant);
  }

  /** 작업자코드 + 기간 기준으로 해당 작업자가 생산실적을 남긴 제품을 조회 */
  private async resolveOperatorCandidates(
    workerCode: string,
    dateFrom: string,
    dateTo: string,
    company: string,
    plant: string,
  ): Promise<TraceCandidate[]> {
    if (!workerCode) return [];
    const prodResults = await this.prodResultRepo.find({
      where: { workerId: workerCode, company, plant },
      take: 500,
      order: { startAt: 'DESC' },
    });
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const orderNos = [
      ...new Set(
        prodResults
          .filter((result) => {
            const at = result.startAt ?? result.createdAt;
            const time = at instanceof Date ? at.getTime() : 0;
            return time >= fromTime && time <= toTime;
          })
          .map((result) => result.orderNo),
      ),
    ];
    const byOrder = orderNos.length
      ? await this.fgLabelRepo.find({ where: { orderNo: In(orderNos), company, plant }, take: 500, order: { issuedAt: 'DESC' } })
      : [];
    return this.fgRowsToCandidates(byOrder, '작업자 + 기간', workerCode, company, plant);
  }

  private async resolveWorkOrderCandidates(value: string, company: string, plant: string): Promise<TraceCandidate[]> {
    const fgs = await this.fgLabelRepo.find({ where: { orderNo: value, company, plant }, take: 500, order: { issuedAt: 'DESC' } });
    return this.fgRowsToCandidates(fgs, '작업지시번호', value, company, plant);
  }

  private async resolveSgCandidates(value: string, company: string, plant: string): Promise<TraceCandidate[]> {
    const parentLinks = await this.genealogyRepo.find({
      where: { parentType: 'FG', childType: 'SG', childKey: value, company, plant },
      take: 500,
    });
    const fgKeys = [...new Set(parentLinks.map((link) => link.parentKey))];
    const fgs = fgKeys.length
      ? await this.fgLabelRepo.find({ where: { fgBarcode: In(fgKeys), company, plant }, take: 500, order: { issuedAt: 'DESC' } })
      : [];
    const fgCandidates = await this.fgRowsToCandidates(fgs, 'SG 바코드', value, company, plant);
    if (fgCandidates.length > 0) return fgCandidates;

    const sg = await this.sgLabelRepo.findOne({ where: { sgBarcode: value, company, plant } });
    if (!sg) return [];
    const part = await this.itemMasterRepo.findOne({ where: { itemCode: sg.itemCode, company, plant } });
    return [{
      traceKey: sg.sgBarcode,
      traceType: 'SG',
      itemCode: sg.itemCode,
      itemName: part?.itemName ?? null,
      orderNo: sg.orderNo,
      status: sg.status,
      eventDate: this.fmtDate(sg.issuedAt),
      sourceLabel: 'SG 바코드',
      sourceValue: value,
    }];
  }

  private async fgRowsToCandidates(
    rows: FgLabel[],
    sourceLabel: string,
    sourceValue: string,
    company: string,
    plant: string,
  ): Promise<TraceCandidate[]> {
    const deduped = new Map<string, FgLabel>();
    for (const row of rows) if (!deduped.has(row.fgBarcode)) deduped.set(row.fgBarcode, row);
    const fgs = [...deduped.values()].slice(0, 500);
    const itemCodes = [...new Set(fgs.map((fg) => fg.itemCode).filter(Boolean))];
    const parts = itemCodes.length
      ? await this.itemMasterRepo.find({ where: { itemCode: In(itemCodes), company, plant } })
      : [];
    const partMap = new Map(parts.map((part) => [part.itemCode, part]));

    return fgs.map((fg) => {
      const part = partMap.get(fg.itemCode);
      return {
        traceKey: fg.fgBarcode,
        traceType: 'FG' as const,
        itemCode: fg.itemCode,
        itemName: part?.itemName ?? null,
        orderNo: fg.orderNo,
        status: fg.status,
        eventDate: this.fmtDate(fg.issuedAt),
        sourceLabel,
        sourceValue,
      };
    });
  }

  // ─── Step 3: getBySerial 메인 (제품 섹션 ①②③④⑤) ─────────────────────────

  async getBySerial(serial: string, company: string, plant: string): Promise<ProductTraceabilityDto | null> {
    const fg = await this.fgLabelRepo.findOne({ where: { fgBarcode: serial, company, plant } });
    if (!fg) { this.logger.debug(`FgLabel not found: ${serial}`); return null; }

    const part = await this.itemMasterRepo.findOne({ where: { itemCode: fg.itemCode, company, plant } });
    const jobOrder = fg.orderNo ? await this.jobOrderRepo.findOne({ where: { orderNo: fg.orderNo, company, plant } }) : null;

    const processHistory = await this.resolveProcessHistory(fg.orderNo, serial, company, plant);
    const inspections = await this.resolveInspections(serial, company, plant);

    // 포장/출하
    const box = fg.boxNo ? await this.boxMasterRepo.findOne({ where: { boxNo: fg.boxNo, company, plant } }) : null;
    const pallet = box?.palletNo ? await this.palletMasterRepo.findOne({ where: { palletNo: box.palletNo, company, plant } }) : null;

    // 출하지시 조회
    const shipOrderNo = box?.shipOrderNo ?? pallet?.shipOrderNo ?? null;
    const shipOrder = shipOrderNo
      ? await this.shipmentOrderRepo.findOne({ where: { shipOrderNo, company, plant } })
      : null;

    // 직접투입 자재
    const matCtx = await this.collectMaterialCtx(fg.orderNo, 'FG', serial, company, plant);
    const materials = await this.resolveMaterialTraces(matCtx, company, plant);

    // 반제품 (Task 4)
    const semiProducts = await this.resolveSemiProducts(serial, company, plant);

    // jobOrder.planDate 존재 확인: job-order.entity.ts 실측 결과 planDate: Date | null 존재함
    const productionDate = this.fmtDate(jobOrder?.planDate ?? null) ?? this.fmtDate(fg.issuedAt);

    // 제품 생산에 사용된 작업지시 + 설비 코드 수집
    const prodResults = fg.orderNo
      ? await this.prodResultRepo.find({ where: { orderNo: fg.orderNo, company, plant } })
      : [];
    const prdUid = prodResults.find((p) => p.prdUid)?.prdUid ?? '';
    const prodOrderNos = [...new Set([fg.orderNo, ...prodResults.map((p) => p.orderNo)].filter((v): v is string => !!v))];
    const prodEquipCodes = [...new Set([fg.equipCode, ...prodResults.map((p) => p.equipCode)].filter((v): v is string => !!v))];
    const prodResultNos = prodResults.map((p) => p.resultNo);

    const [equipInspections, equipConsumables, defectRepair] = await Promise.all([
      this.resolveEquipInspections(prodOrderNos, prodEquipCodes, productionDate, company, plant),
      this.resolveEquipConsumables(prodEquipCodes, company, plant),
      this.resolveDefectsAndRepairs(prodResultNos, serial, prdUid, company, plant),
    ]);

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
        shipOrderNo: shipOrderNo,
        customerPoNo: shipOrder?.customerPoNo ?? null,
        customerName: shipOrder?.customerName ?? null,
      },
      materials, semiProducts,
      equipInspections,
      equipConsumables,
      defects: defectRepair.defects,
      repairs: defectRepair.repairs,
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
      ? await this.itemMasterRepo.find({ where: { itemCode: In(itemCodes), company, plant } })
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
          warehouseCode: sg?.warehouseCode ?? null,
          issueProcessCode: sg?.issueProcessCode ?? null,
          processHistory, inspections, materials,
        };
      }),
    );
  }
}
