/**
 * @file carrier-flow.service.ts
 * @description 대차 흐름 서비스 — 내용 조회(3테이블 UNION), 상태 도출, 출력 대차 지정/해제, 이동전표, 자동투입 목록, 현황 목록.
 *
 * 초보자 가이드:
 * 1. 규칙은 carrier-flow.rules.ts(순수). 여기는 DB 읽기·쓰기와 규칙 호출만.
 * 2. 스탬프/해제(stampInTx/clearInTx)는 실적·확정·장착·출고 서비스가 자기 트랜잭션 안에서 호출한다.
 * 3. 대차번호는 normalizeCarrierNo로 정규화해 마스터와 맞춘다.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
import { CarrierMaster } from '../../../entities/carrier-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { normalizeCarrierNo } from '../../master/services/carrier.service';
import {
  assertCanAutoInput, assertCanLoad, carrierKindOf, deriveCarrierStatus, isProductionKind,
  type CarrierContentKind, type CarrierContentRow, type CarrierStatus,
} from './carrier-flow.rules';
import { CarrierListQueryDto } from '../dto/carrier-flow.dto';

export interface CarrierStatusView {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: CarrierStatus;
  kind: CarrierContentKind | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  nextProcessCode: string | null;
  nextProcessName: string | null;
  contents: CarrierContentRow[];
}

export interface CarrierSlipView extends CarrierStatusView {
  slipNo: string;
  issuedAt: string;
  issuedBy: string;
  reprint: boolean;
  fromProcessCode: string | null;
  fromProcessName: string | null;
  toProcessCode: string | null;
  toProcessName: string | null;
}

export interface CarrierListRow {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: CarrierStatus;
  kind: CarrierContentKind | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  lastLoadedAt: Date | null;
}

/**
 * 3테이블 UNION ALL — 대차에 지금 담긴 것. MAT는 orderNo 없음, qty=CURRENT_QTY
 * FG는 박스 포장(PACKED)·출하(SHIPPED) 시점에 대차에서 나간 것으로 본다(설계 13절) — 해제 누락이 있어도 조회에 남지 않는다.
 * Oracle은 UNION ALL 결과에 바로 ORDER BY <별칭>을 걸 수 없다(첫 번째 가지의 별칭만 보이고
 * 나머지 가지에서는 안 보여 ORA-00904가 난다) — 반드시 바깥 SELECT * FROM (...)으로 감싼 뒤 정렬한다.
 */
const CONTENTS_SQL = `
  SELECT * FROM (
    SELECT 'SG' AS KIND, s.SG_BARCODE AS BARCODE, s.ITEM_CODE, s.ORDER_NO, s.REMAIN_QTY AS QTY,
           s.CARRIER_LOADED_AT AS LOADED_AT, s.CARRIER_SLIP_NO AS SLIP_NO, s.ISSUE_PROCESS_CODE
      FROM SG_LABELS s WHERE s.COMPANY = :1 AND s.PLANT_CD = :2 AND s.CARRIER_NO = :3
    UNION ALL
    SELECT 'FG', f.FG_BARCODE, f.ITEM_CODE, f.ORDER_NO, 1, f.CARRIER_LOADED_AT, f.CARRIER_SLIP_NO, NULL
      FROM FG_LABELS f WHERE f.COMPANY = :4 AND f.PLANT_CD = :5 AND f.CARRIER_NO = :6
             AND f.STATUS NOT IN ('PACKED','SHIPPED')
    UNION ALL
    SELECT 'MAT', m.MAT_UID, m.ITEM_CODE, NULL, m.CURRENT_QTY, m.CARRIER_LOADED_AT, m.CARRIER_SLIP_NO, NULL
      FROM MAT_LOTS m WHERE m.COMPANY = :7 AND m.PLANT_CD = :8 AND m.CARRIER_NO = :9
  ) ORDER BY LOADED_AT, BARCODE`;

/** Oracle IN 절 바인드 한도(1000)를 넘지 않도록 배열을 나눈다 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@Injectable()
export class CarrierFlowService {
  constructor(
    @InjectRepository(CarrierMaster) private readonly carrierRepo: Repository<CarrierMaster>,
    @InjectRepository(EquipMaster) private readonly equipRepo: Repository<EquipMaster>,
    @InjectRepository(JobOrder) private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(RoutingProcess) private readonly routingRepo: Repository<RoutingProcess>,
    @InjectRepository(ItemMaster) private readonly itemRepo: Repository<ItemMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private async findCarrierOrFail(carrierNo: string, company: string, plant: string): Promise<CarrierMaster> {
    const row = await this.carrierRepo.findOne({ where: { company, plant, carrierNo: normalizeCarrierNo(carrierNo) } });
    if (!row) throw new NotFoundException(`등록되지 않은 대차입니다: ${carrierNo}`);
    return row;
  }

  /** 대차번호로 마스터 존재 여부만 — 화면의 "이 바코드가 대차인가" 판별용 */
  async isCarrier(barcode: string, company: string, plant: string): Promise<boolean> {
    const row = await this.carrierRepo.findOne({ where: { company, plant, carrierNo: normalizeCarrierNo(barcode) }, select: ['carrierNo'] });
    return !!row;
  }

  async getContents(carrierNo: string, company: string, plant: string, qr?: QueryRunner): Promise<CarrierContentRow[]> {
    const no = normalizeCarrierNo(carrierNo);
    const manager = qr?.manager ?? this.carrierRepo.manager;
    const raw: Array<Record<string, unknown>> = await manager.query(CONTENTS_SQL, [company, plant, no, company, plant, no, company, plant, no]);
    const rows: CarrierContentRow[] = raw.map((r) => ({
      kind: String(r.KIND) as CarrierContentKind,
      barcode: String(r.BARCODE),
      itemCode: String(r.ITEM_CODE),
      itemName: null,
      orderNo: r.ORDER_NO == null ? null : String(r.ORDER_NO),
      qty: Number(r.QTY ?? 0),
      loadedAt: r.LOADED_AT ? new Date(r.LOADED_AT as string) : null,
      slipNo: r.SLIP_NO == null ? null : String(r.SLIP_NO),
      issueProcessCode: r.ISSUE_PROCESS_CODE == null ? null : String(r.ISSUE_PROCESS_CODE),
    }));
    const itemCodes = [...new Set(rows.map((r) => r.itemCode))];
    if (itemCodes.length > 0) {
      const items = await this.itemRepo.find({ where: { itemCode: In(itemCodes), company, plant }, select: ['itemCode', 'itemName'] });
      const nameMap = new Map(items.map((i) => [i.itemCode, i.itemName]));
      for (const r of rows) r.itemName = nameMap.get(r.itemCode) ?? null;
    }
    return rows;
  }

  /** 출발 공정의 다음 사내 사용 공정 — 전표의 "가야 할 곳" */
  private async resolveNextProcess(orderNo: string | null, fromProcessCode: string | null, company: string, plant: string) {
    if (!orderNo || !fromProcessCode) return { fromName: null, toCode: null, toName: null };
    const jobOrder = await this.jobOrderRepo.findOne({ where: { orderNo, company, plant } });
    if (!jobOrder?.routingCode) return { fromName: null, toCode: null, toName: null };
    const steps = await this.routingRepo.find({ where: { routingCode: jobOrder.routingCode, company, plant }, order: { seq: 'ASC' } });
    const idx = steps.findIndex((s) => s.processCode === fromProcessCode);
    const from = idx >= 0 ? steps[idx] : null;
    const to = idx >= 0 ? steps.slice(idx + 1).find((s) => s.useYn === 'Y' && s.executionType === 'IN_HOUSE') ?? null : null;
    return { fromName: from?.processName ?? null, toCode: to?.processCode ?? null, toName: to?.processName ?? null };
  }

  private toView(master: CarrierMaster, rows: CarrierContentRow[], next: { toCode: string | null; toName: string | null }): CarrierStatusView {
    const head = rows[0];
    return {
      carrierNo: master.carrierNo,
      carrierType: master.carrierType,
      carrierName: master.carrierName,
      capacity: master.capacity,
      status: deriveCarrierStatus(rows),
      kind: carrierKindOf(rows),
      itemCode: head?.itemCode ?? null,
      itemName: head?.itemName ?? null,
      orderNo: head?.orderNo ?? null,
      loadedCount: rows.length,
      totalQty: rows.reduce((s, r) => s + r.qty, 0),
      slipNo: rows.find((r) => r.slipNo)?.slipNo ?? null,
      loadProcessCode: head?.issueProcessCode ?? null,
      nextProcessCode: next.toCode,
      nextProcessName: next.toName,
      contents: rows,
    };
  }

  async getStatus(carrierNo: string, company: string, plant: string): Promise<CarrierStatusView> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    const rows = await this.getContents(master.carrierNo, company, plant);
    const next = await this.resolveNextProcess(rows[0]?.orderNo ?? null, rows[0]?.issueProcessCode ?? null, company, plant);
    return this.toView(master, rows, next);
  }

  async getProcessFlags(orderNo: string, processCode: string, company: string, plant: string) {
    const jobOrder = await this.jobOrderRepo.findOne({ where: { orderNo, company, plant } });
    if (!jobOrder?.routingCode) return { carrierLoadYn: 'N', carrierAutoInputYn: 'N', issueLabelType: 'NONE' };
    const step = await this.routingRepo.findOne({ where: { routingCode: jobOrder.routingCode, processCode, company, plant } });
    return {
      carrierLoadYn: step?.carrierLoadYn ?? 'N',
      carrierAutoInputYn: step?.carrierAutoInputYn ?? 'N',
      issueLabelType: step?.issueLabelType ?? 'NONE',
    };
  }

  /** 설비 공정 플래그 — 자동투입 검사용 (설비→공정→작업지시 라우팅) */
  private async resolveEquipAutoInputYn(equip: EquipMaster, company: string, plant: string): Promise<string> {
    if (!equip.processCode || !equip.currentJobOrderId) return 'N';
    const flags = await this.getProcessFlags(equip.currentJobOrderId, equip.processCode, company, plant);
    return flags.carrierAutoInputYn;
  }

  async select(carrierNo: string, equipCode: string, company: string, plant: string): Promise<CarrierStatusView> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    if (master.useYn !== 'Y') throw new BadRequestException(`사용 중지된 대차입니다: ${master.carrierNo}`);
    const equip = await this.equipRepo.findOne({ where: { equipCode, company, plant } });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    const rows = await this.getContents(master.carrierNo, company, plant);
    const jobOrder = equip.currentJobOrderId
      ? await this.jobOrderRepo.findOne({ where: { orderNo: equip.currentJobOrderId, company, plant } })
      : null;
    // 담긴 것이 있으면 설비의 현재 작업지시·품목과 같아야 한다(생산 대차 규칙). 종류는 기존 내용을 따른다.
    const existingKind = carrierKindOf(rows);
    if (!jobOrder && isProductionKind(existingKind)) {
      // 설비에 작업지시가 없으면 비교 기준이 없다 — rows[0].itemCode로 자기 자신과 비교해 항상 통과하던 구멍을 막는다.
      throw new BadRequestException('설비에 작업지시가 없습니다. 작업지시를 먼저 선택하세요.');
    }
    const kind: CarrierContentKind = existingKind ?? 'SG';
    assertCanLoad({
      rows, kind,
      itemCode: jobOrder?.itemCode ?? rows[0]?.itemCode ?? '',
      orderNo: jobOrder?.orderNo ?? null,
      addCount: 1,
      capacity: master.capacity,
    });
    await this.equipRepo.update({ equipCode, company, plant }, { curCarrierNo: master.carrierNo });
    const next = await this.resolveNextProcess(rows[0]?.orderNo ?? null, rows[0]?.issueProcessCode ?? null, company, plant);
    return this.toView(master, rows, next);
  }

  async release(equipCode: string, company: string, plant: string): Promise<void> {
    await this.equipRepo.update({ equipCode, company, plant }, { curCarrierNo: null });
  }

  /** 실적/확정 서비스가 같은 트랜잭션에서 호출 — 담기 직전 검증 */
  async assertLoadableInTx(qr: QueryRunner, p: {
    carrierNo: string; kind: CarrierContentKind; itemCode: string; orderNo: string | null; addCount: number; company: string; plant: string;
  }): Promise<CarrierMaster> {
    const master = await qr.manager.findOne(CarrierMaster, { where: { company: p.company, plant: p.plant, carrierNo: normalizeCarrierNo(p.carrierNo) } });
    if (!master) throw new NotFoundException(`등록되지 않은 대차입니다: ${p.carrierNo}`);
    if (master.useYn !== 'Y') throw new BadRequestException(`사용 중지된 대차입니다: ${master.carrierNo}`);
    const rows = await this.getContents(master.carrierNo, p.company, p.plant, qr);
    assertCanLoad({ rows, kind: p.kind, itemCode: p.itemCode, orderNo: p.orderNo, addCount: p.addCount, capacity: master.capacity });
    return master;
  }

  /** 라벨/LOT에 대차를 찍는다 (같은 트랜잭션) */
  async stampInTx(qr: QueryRunner, kind: CarrierContentKind, barcodes: string[], carrierNo: string, company: string, plant: string): Promise<void> {
    if (barcodes.length === 0) return;
    const patch = { carrierNo: normalizeCarrierNo(carrierNo), carrierLoadedAt: new Date(), carrierSlipNo: null };
    for (const group of chunk(barcodes, 1000)) {
      if (kind === 'SG') await qr.manager.update(SgLabel, { sgBarcode: In(group), company, plant }, patch);
      else if (kind === 'FG') await qr.manager.update(FgLabel, { fgBarcode: In(group), company, plant }, patch);
      else await qr.manager.update(MatLot, { matUid: In(group), company, plant }, patch);
    }
  }

  /** 소비·취소 시 대차 컬럼을 비운다 (같은 트랜잭션). 대차에 없던 바코드는 영향 없음 */
  async clearInTx(qr: QueryRunner, kind: CarrierContentKind, barcodes: string[], company: string, plant: string): Promise<void> {
    if (barcodes.length === 0) return;
    const patch = { carrierNo: null, carrierLoadedAt: null, carrierSlipNo: null };
    for (const group of chunk(barcodes, 1000)) {
      if (kind === 'SG') await qr.manager.update(SgLabel, { sgBarcode: In(group), company, plant }, patch);
      else if (kind === 'FG') await qr.manager.update(FgLabel, { fgBarcode: In(group), company, plant }, patch);
      else await qr.manager.update(MatLot, { matUid: In(group), company, plant }, patch);
    }
  }

  async issueSlip(carrierNo: string, userId: string, company: string, plant: string): Promise<CarrierSlipView> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    return this.tx.run(async (qr) => {
      // 동시에 두 요청이 같은 대차의 이동전표를 발행하면 둘 다 existing=null을 보고 번호를 두 개 채번할 수 있다 — 행 락으로 직렬화.
      await qr.manager.query(
        'SELECT CARRIER_NO FROM CARRIER_MASTERS WHERE COMPANY = :1 AND PLANT_CD = :2 AND CARRIER_NO = :3 FOR UPDATE',
        [company, plant, master.carrierNo],
      );
      const rows = await this.getContents(master.carrierNo, company, plant, qr);
      if (rows.length === 0) throw new BadRequestException('빈 대차입니다. 담긴 것이 없어 이동전표를 발행할 수 없습니다.');
      const existing = rows.find((r) => r.slipNo)?.slipNo ?? null;
      const slipNo = existing ?? await this.numbering.nextCarrierSlipNo(qr);
      if (!existing) {
        const byKind = new Map<CarrierContentKind, string[]>();
        for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.barcode]);
        for (const [kind, barcodes] of byKind) {
          const patch = { carrierSlipNo: slipNo };
          for (const group of chunk(barcodes, 1000)) {
            if (kind === 'SG') await qr.manager.update(SgLabel, { sgBarcode: In(group), company, plant }, patch);
            else if (kind === 'FG') await qr.manager.update(FgLabel, { fgBarcode: In(group), company, plant }, patch);
            else await qr.manager.update(MatLot, { matUid: In(group), company, plant }, patch);
          }
        }
        for (const r of rows) r.slipNo = slipNo;
        // 전표가 나간 대차는 더 담지 않는다 — 설비의 출력 대차 지정을 푼다
        await qr.manager.update(EquipMaster, { curCarrierNo: master.carrierNo, company, plant }, { curCarrierNo: null });
      }
      const from = rows[0]?.issueProcessCode ?? null;
      const next = await this.resolveNextProcess(rows[0]?.orderNo ?? null, from, company, plant);
      const view = this.toView(master, rows, next);
      return {
        ...view,
        slipNo,
        issuedAt: new Date().toISOString(),
        issuedBy: userId,
        reprint: !!existing,
        fromProcessCode: from,
        fromProcessName: next.fromName,
        toProcessCode: next.toCode,
        toProcessName: next.toName,
      };
    });
  }

  async getAutoInputRows(carrierNo: string, equipCode: string, company: string, plant: string): Promise<{ kind: CarrierContentKind | null; rows: CarrierContentRow[] }> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    const equip = await this.equipRepo.findOne({ where: { equipCode, company, plant } });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    const rows = await this.getContents(master.carrierNo, company, plant);
    const autoInputYn = await this.resolveEquipAutoInputYn(equip, company, plant);
    assertCanAutoInput({ rows, autoInputYn });
    return { kind: carrierKindOf(rows), rows };
  }

  /** 현황 목록 — 마스터 + 내용 집계(서버 페이징). 바코드 검색은 3테이블에서 대차번호를 찾아 필터 */
  async list(query: CarrierListQueryDto, company: string, plant: string): Promise<{ data: CarrierListRow[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 50, search, carrierStatus = 'ACTIVE', processCode, barcode } = query;
    const params: unknown[] = [company, plant];
    const where: string[] = ['c.COMPANY = :1', 'c.PLANT_CD = :2'];
    const bind = (v: unknown) => { params.push(v); return `:${params.length}`; };
    if (search?.trim()) where.push(`(UPPER(c.CARRIER_NO) LIKE ${bind(`%${search.trim().toUpperCase()}%`)} OR UPPER(c.CARRIER_NAME) LIKE ${bind(`%${search.trim().toUpperCase()}%`)})`);
    if (barcode?.trim()) {
      const b = barcode.trim();
      where.push(`c.CARRIER_NO IN (
        SELECT CARRIER_NO FROM SG_LABELS WHERE COMPANY = c.COMPANY AND PLANT_CD = c.PLANT_CD AND SG_BARCODE = ${bind(b)}
        UNION ALL SELECT CARRIER_NO FROM FG_LABELS WHERE COMPANY = c.COMPANY AND PLANT_CD = c.PLANT_CD AND FG_BARCODE = ${bind(b)} AND STATUS NOT IN ('PACKED','SHIPPED')
        UNION ALL SELECT CARRIER_NO FROM MAT_LOTS WHERE COMPANY = c.COMPANY AND PLANT_CD = c.PLANT_CD AND MAT_UID = ${bind(b)})`);
    }
    const statusExpr = `CASE WHEN a.LOADED_COUNT IS NULL OR a.LOADED_COUNT = 0 THEN 'EMPTY' WHEN a.SLIP_NO IS NOT NULL THEN 'IN_TRANSIT' ELSE 'LOADING' END`;
    const having: string[] = [];
    if (carrierStatus === 'ACTIVE') having.push(`${statusExpr} <> 'EMPTY'`);
    else if (carrierStatus) having.push(`${statusExpr} = ${bind(carrierStatus)}`);
    if (processCode) having.push(`a.LOAD_PROCESS_CODE = ${bind(processCode)}`);

    // 집계 서브쿼리는 파생 테이블이라 바깥 c 별칭을 참조(상관 서브쿼리)할 수 없다 — 테넌트 바인드를 직접 건다(전체 테넌트 스캔 방지).
    const base = `
      FROM CARRIER_MASTERS c
      LEFT JOIN (
        SELECT CARRIER_NO, COMPANY, PLANT_CD, MIN(KIND) KIND, MIN(ITEM_CODE) ITEM_CODE, MIN(ORDER_NO) ORDER_NO,
               COUNT(*) LOADED_COUNT, SUM(QTY) TOTAL_QTY, MAX(SLIP_NO) SLIP_NO, MIN(ISSUE_PROCESS_CODE) LOAD_PROCESS_CODE, MAX(LOADED_AT) LAST_LOADED_AT
          FROM (
            SELECT CARRIER_NO, COMPANY, PLANT_CD, 'SG' KIND, ITEM_CODE, ORDER_NO, REMAIN_QTY QTY, CARRIER_SLIP_NO SLIP_NO, ISSUE_PROCESS_CODE, CARRIER_LOADED_AT LOADED_AT FROM SG_LABELS WHERE CARRIER_NO IS NOT NULL AND COMPANY = ${bind(company)} AND PLANT_CD = ${bind(plant)}
            UNION ALL SELECT CARRIER_NO, COMPANY, PLANT_CD, 'FG', ITEM_CODE, ORDER_NO, 1, CARRIER_SLIP_NO, NULL, CARRIER_LOADED_AT FROM FG_LABELS WHERE CARRIER_NO IS NOT NULL AND COMPANY = ${bind(company)} AND PLANT_CD = ${bind(plant)} AND STATUS NOT IN ('PACKED','SHIPPED')
            UNION ALL SELECT CARRIER_NO, COMPANY, PLANT_CD, 'MAT', ITEM_CODE, NULL, CURRENT_QTY, CARRIER_SLIP_NO, NULL, CARRIER_LOADED_AT FROM MAT_LOTS WHERE CARRIER_NO IS NOT NULL AND COMPANY = ${bind(company)} AND PLANT_CD = ${bind(plant)}
          ) GROUP BY CARRIER_NO, COMPANY, PLANT_CD
      ) a ON a.CARRIER_NO = c.CARRIER_NO AND a.COMPANY = c.COMPANY AND a.PLANT_CD = c.PLANT_CD
      WHERE ${where.join(' AND ')}${having.length ? ' AND ' + having.join(' AND ') : ''}`;
    const manager = this.carrierRepo.manager;
    const countRows: Array<{ CNT: number }> = await manager.query(`SELECT COUNT(*) CNT ${base}`, params);
    const total = Number(countRows[0]?.CNT ?? 0);
    const offset = (page - 1) * limit;
    const dataRows: Array<Record<string, unknown>> = await manager.query(
      `SELECT c.CARRIER_NO, c.CARRIER_TYPE, c.CARRIER_NAME, c.CAPACITY, ${statusExpr} STATUS, a.KIND, a.ITEM_CODE, a.ORDER_NO,
              NVL(a.LOADED_COUNT,0) LOADED_COUNT, NVL(a.TOTAL_QTY,0) TOTAL_QTY, a.SLIP_NO, a.LOAD_PROCESS_CODE, a.LAST_LOADED_AT
       ${base} ORDER BY a.LAST_LOADED_AT DESC NULLS LAST, c.CARRIER_NO
       OFFSET ${bind(offset)} ROWS FETCH NEXT ${bind(limit)} ROWS ONLY`, params);
    const itemCodes = [...new Set(dataRows.map((r) => r.ITEM_CODE).filter((v): v is string => typeof v === 'string'))];
    const items = itemCodes.length ? await this.itemRepo.find({ where: { itemCode: In(itemCodes), company, plant }, select: ['itemCode', 'itemName'] }) : [];
    const nameMap = new Map(items.map((i) => [i.itemCode, i.itemName]));
    return {
      data: dataRows.map((r) => ({
        carrierNo: String(r.CARRIER_NO),
        carrierType: String(r.CARRIER_TYPE),
        carrierName: r.CARRIER_NAME == null ? null : String(r.CARRIER_NAME),
        capacity: r.CAPACITY == null ? null : Number(r.CAPACITY),
        status: String(r.STATUS) as CarrierStatus,
        kind: r.KIND == null ? null : (String(r.KIND) as CarrierContentKind),
        itemCode: r.ITEM_CODE == null ? null : String(r.ITEM_CODE),
        itemName: r.ITEM_CODE == null ? null : nameMap.get(String(r.ITEM_CODE)) ?? null,
        orderNo: r.ORDER_NO == null ? null : String(r.ORDER_NO),
        loadedCount: Number(r.LOADED_COUNT ?? 0),
        totalQty: Number(r.TOTAL_QTY ?? 0),
        slipNo: r.SLIP_NO == null ? null : String(r.SLIP_NO),
        loadProcessCode: r.LOAD_PROCESS_CODE == null ? null : String(r.LOAD_PROCESS_CODE),
        lastLoadedAt: r.LAST_LOADED_AT ? new Date(r.LAST_LOADED_AT as string) : null,
      })),
      total, page, limit,
    };
  }
}
