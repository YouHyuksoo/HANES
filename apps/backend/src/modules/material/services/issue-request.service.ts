/**
 * @file src/modules/material/services/issue-request.service.ts
 * @description 자재 출고요청 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatIssueRequest**: 출고요청 헤더 (요청번호, 상태, 요청자 등)
 * 2. **MatIssueRequestItem**: 요청 품목 상세 (품목, 수량, 출고실적)
 * 3. **상태 흐름**: REQUESTED -> APPROVED -> COMPLETED (또는 REJECTED)
 * 4. **issueFromRequest**: 승인된 요청을 실제 출고로 전환
 * 5. **요청번호**: REQ-YYYYMMDD-NNN 형식 자동 생성
 * 6. **묶음 요청**: 같은 공정 작업지시 여러 건(orderNos)을 품목 합산 요청 1건으로 묶는다.
 *    품목 아래 작업지시별 수량은 MAT_ISSUE_REQUEST_ITEM_ORDERS 에 두고, 이 행이 있는 요청이 묶음 요청이다(헤더 ORDER_NO=NULL).
 *    출고 시 작업지시 계획일 빠른 순으로 배분하고 MAT_ISSUES.ORDER_NO 를 작업지시별로 남긴다.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { isProductionIssueType, ISSUE_REQUEST_PENDING_STATUSES, ISSUE_REQUEST_PENDING_FILTER, deriveIssueRequestStatusFromItems, MAT_LOT_STATUS, mulQty, isJobOrderFinished } from '@harness/shared';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { MatIssueRequestItemOrder } from '../../../entities/mat-issue-request-item-order.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatIssueService } from './mat-issue.service';
import { LotSplitService } from './lot-split.service';
import { IssueRequestAllocationService } from './issue-request-allocation.service';
import { distributeQtyToOrders, sortOrdersByPlan, splitRequestQtyByOrder } from './issue-request-order-split';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';

/** 품목별 창고 가용재고를 IQC 관점으로 나눈 값(MAT_STOCKS JOIN MAT_LOTS, 1쿼리) */
export interface ItemStockAvailability {
  /** 창고 가용재고 합(IQC 무관) */
  availableQty: number;
  /** 출고 가능 재고 합 — IQC PASS 또는 FAIL+특채, LOT 상태 issuable */
  issuableQty: number;
  /** IQC 미검사(PENDING/HOLD) 재고 합 */
  pendingIqcQty: number;
}

const EMPTY_AVAILABILITY: ItemStockAvailability = { availableQty: 0, issuableQty: 0, pendingIqcQty: 0 };

/** 라벨 재출력 복원 조회 기간(일) — 분할 후 며칠 뒤 이어서 출고하는 현장 흐름을 덮는다 */
const SPLIT_LABEL_LOOKBACK_DAYS = 7;
import {
  CreateIssueRequestDto,
  IssueRequestQueryDto,
  RejectIssueRequestDto,
  RequestIssueDto,
  SplitForIssueDto,
} from '../dto/issue-request.dto';

@Injectable()
export class IssueRequestService {
  constructor(
    @InjectRepository(MatIssueRequest)
    private readonly requestRepository: Repository<MatIssueRequest>,
    @InjectRepository(MatIssueRequestItem)
    private readonly requestItemRepository: Repository<MatIssueRequestItem>,
    @InjectRepository(MatIssueRequestItemOrder)
    private readonly itemOrderRepository: Repository<MatIssueRequestItemOrder>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(BomMaster)
    private readonly bomRepository: Repository<BomMaster>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(RoutingProcess)
    private readonly routingProcessRepository: Repository<RoutingProcess>,
    private readonly matIssueService: MatIssueService,
    private readonly lotSplitService: LotSplitService,
    private readonly allocation: IssueRequestAllocationService,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
    private readonly sysConfigService: SysConfigService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * 포장단위(MIN_PACK_QTY) 올림.
   * 요청 낱개 수량을 포장단위 배수로 올린다. minPackQty<=0이면 올림 없이 그대로.
   */
  private roundUpToPack(qty: number, minPackQty: number): number {
    if (minPackQty > 0 && qty > 0) {
      return Math.ceil(qty / minPackQty) * minPackQty;
    }
    return qty;
  }

  private isRawMaterial(part?: ItemMaster): boolean {
    if (!part?.itemType) return true;
    const itemType = part.itemType.toUpperCase();
    // 출고요청은 원자재만 대상으로 한다.
    // 제품/반제품과 소모품(MRO)은 제외한다.
    const excludedTypes = new Set([
      'FG', 'FERT', 'PRODUCT', 'FINISHED', 'WIP', 'SEMI', 'SEMI_PRODUCT', 'HALB',
      'CONSUMABLE', 'MRO',
    ]);
    return !excludedTypes.has(itemType);
  }

  private async getPreviousIssueQtyMap(orderNo: string, itemCodes: string[], company?: string | null, plant?: string | null) {
    if (itemCodes.length === 0) return new Map<string, number>();

    const qb = this.matIssueRepository.createQueryBuilder('mi')
      .select('lot.itemCode', 'itemCode')
      .addSelect('SUM(mi.issueQty)', 'qty')
      .innerJoin(
        MatLot,
        'lot',
        'lot.matUid = mi.matUid AND lot.company = mi.company AND lot.plant = mi.plant',
      )
      .where('mi.orderNo = :orderNo', { orderNo })
      .andWhere('mi.status = :status', { status: 'DONE' })
      .andWhere('lot.itemCode IN (:...itemCodes)', { itemCodes });

    if (company) qb.andWhere('mi.company = :company AND lot.company = :company', { company });
    if (plant) qb.andWhere('mi.plant = :plant AND lot.plant = :plant', { plant });

    const rows = await qb.groupBy('lot.itemCode').getRawMany<{ itemCode: string; qty: string | number }>();
    return new Map(rows.map((row) => [row.itemCode, this.toNumber(row.qty)]));
  }

  private async getFloorStockQtyMap(itemCodes: string[], company?: string | null, plant?: string | null) {
    if (itemCodes.length === 0) return new Map<string, number>();

    const qb = this.matStockRepository.createQueryBuilder('s')
      .select('s.itemCode', 'itemCode')
      .addSelect('SUM(s.availableQty)', 'qty')
      .innerJoin(
        Warehouse,
        'w',
        'w.warehouseCode = s.warehouseCode AND w.company = s.company AND w.plant = s.plant',
      )
      .where('w.warehouseType = :warehouseType', { warehouseType: 'FLOOR' })
      .andWhere('s.itemCode IN (:...itemCodes)', { itemCodes });

    if (company) qb.andWhere('s.company = :company AND w.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant AND w.plant = :plant', { plant });

    const rows = await qb.groupBy('s.itemCode').getRawMany<{ itemCode: string; qty: string | number }>();
    return new Map(rows.map((row) => [row.itemCode, this.toNumber(row.qty)]));
  }

  /**
   * 품목별 가용재고를 IQC 관점으로 분해(1쿼리, CASE WHEN SUM).
   * - availableQty: 창고 가용재고 합(기존 currentStock)
   * - issuableQty: IQC PASS 또는 FAIL+특채 이면서 LOT 상태 issuable(NORMAL)
   * - pendingIqcQty: IQC PENDING/HOLD
   */
  private async getAvailableStockQtyMap(itemCodes: string[], company?: string | null, plant?: string | null) {
    if (itemCodes.length === 0) return new Map<string, ItemStockAvailability>();

    const qb = this.matStockRepository.createQueryBuilder('s')
      .select('s.itemCode', 'itemCode')
      .addSelect('SUM(s.availableQty)', 'qty')
      .addSelect(
        `SUM(CASE WHEN (l.iqcStatus = 'PASS' OR (l.iqcStatus = 'FAIL' AND l.specialAcceptYn = 'Y')) AND l.status = :issuableStatus THEN s.availableQty ELSE 0 END)`,
        'issuableQty',
      )
      .addSelect(`SUM(CASE WHEN l.iqcStatus IN ('PENDING', 'HOLD') THEN s.availableQty ELSE 0 END)`, 'pendingIqcQty')
      .leftJoin(MatLot, 'l', 'l.matUid = s.matUid AND l.company = s.company AND l.plant = s.plant')
      .where('s.itemCode IN (:...itemCodes)', { itemCodes })
      .setParameter('issuableStatus', MAT_LOT_STATUS.NORMAL);

    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });

    const rows = await qb.groupBy('s.itemCode').getRawMany<{
      itemCode: string; qty: string | number; issuableQty?: string | number; pendingIqcQty?: string | number;
    }>();
    return new Map<string, ItemStockAvailability>(rows.map((row) => [row.itemCode, {
      availableQty: this.toNumber(row.qty),
      issuableQty: this.toNumber(row.issuableQty),
      pendingIqcQty: this.toNumber(row.pendingIqcQty),
    }]));
  }

  /** 승인 단계 재고 검증 정책 MAT_ISSUE_STOCK_CHECK (null→BLOCK) */
  private async loadStockCheckPolicy(company?: string | null, plant?: string | null): Promise<'BLOCK' | 'WARN'> {
    const value = await this.sysConfigService.getValue('MAT_ISSUE_STOCK_CHECK', company ?? undefined, plant ?? undefined);
    return (value ?? 'BLOCK').trim().toUpperCase() === 'WARN' ? 'WARN' : 'BLOCK';
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  /** 통합 채번 서비스를 통한 요청번호 생성 */
  private async generateRequestNo(qr?: import('typeorm').QueryRunner): Promise<string> {
    return this.numbering.next('MAT_REQ', qr);
  }

  /** 품목 목록에 itemCode/itemName + 현재 가용재고(IQC합격/미검사) 평탄화 */
  private async flattenItems(items: MatIssueRequestItem[], company?: string | null, plant?: string | null) {
    const itemCodes = [...new Set(items.map((i) => i.itemCode).filter(Boolean))];
    const [parts, stockMap] = await Promise.all([
      itemCodes.length > 0
        ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
        : Promise.resolve([] as ItemMaster[]),
      this.getAvailableStockQtyMap(itemCodes, company, plant),
    ]);
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return items.map((item) => {
      const part = partMap.get(item.itemCode);
      const stock = stockMap.get(item.itemCode) ?? EMPTY_AVAILABILITY;
      return {
        ...item,
        itemCode: item.itemCode,
        itemName: part?.itemName ?? null,
        unit: item.unit ?? part?.unit ?? null,
        minPackQty: this.toNumber(part?.minPackQty),
        currentStock: stock.availableQty,
        issuableQty: stock.issuableQty,
        pendingIqcQty: stock.pendingIqcQty,
      };
    });
  }

  /**
   * 승인 단계 IQC 가용재고 검증: 품목별 (요청 - 기출고) > 출고가능(IQC합격) 이면 부족.
   * BLOCK 이면 품목·부족·미검사 수량을 나열해 차단, WARN 이면 경고 문자열을 돌려준다.
   */
  private buildStockShortageWarnings(
    items: Array<Pick<MatIssueRequestItem, 'itemCode' | 'requestQty' | 'issuedQty'> & Pick<ItemStockAvailability, 'issuableQty' | 'pendingIqcQty'>>,
  ): string[] {
    return items
      .map((item) => {
        const remainQty = this.toNumber(item.requestQty) - this.toNumber(item.issuedQty);
        const shortage = remainQty - this.toNumber(item.issuableQty);
        if (shortage <= 0) return null;
        return `${item.itemCode}: 출고가능(IQC합격) 재고 부족 ${shortage} (요청잔여 ${remainQty}, 가용 ${this.toNumber(item.issuableQty)}, 미검사 ${this.toNumber(item.pendingIqcQty)})`;
      })
      .filter((message): message is string => message !== null);
  }

  /**
   * 출고 공정 결정: 요청 공정 → 작업지시 대표 공정 → 라우팅 첫 SEQ 공정.
   * 끝내 없으면 null(생산 출고는 호출측이 차단, 기타 출고는 단순출고 허용).
   */
  private async resolveIssueProcessCode(
    request: Pick<MatIssueRequest, 'orderNo' | 'processCode'>,
    company?: string | null,
    plant?: string | null,
  ): Promise<string | null> {
    if (request.processCode) return request.processCode;
    if (!request.orderNo) return null;

    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo: request.orderNo, ...this.tenantWhere(company, plant) },
    });
    if (!jobOrder) return null;
    return this.resolveJobOrderProcessCode(jobOrder, company, plant);
  }

  /** 작업지시 기준 출고 공정: 대표 공정 → 라우팅 첫 SEQ 공정. 없으면 null */
  private async resolveJobOrderProcessCode(jobOrder: JobOrder, company?: string | null, plant?: string | null): Promise<string | null> {
    if (jobOrder.processCode) return jobOrder.processCode;
    if (!jobOrder.routingCode) return null;

    const firstProcess = await this.routingProcessRepository.findOne({
      where: {
        routingCode: jobOrder.routingCode,
        useYn: 'Y',
        ...this.tenantWhere(jobOrder.company ?? company, jobOrder.plant ?? plant),
      },
      order: { seq: 'ASC' },
    });
    return firstProcess?.processCode ?? null;
  }

  /** 요청 헤더 조회 + 존재 검증 */
  private async getRequestOrFail(requestNo: string, company?: string, plant?: string) {
    const request = await this.requestRepository.findOne({ where: { requestNo, ...this.tenantWhere(company, plant) } });
    if (!request) throw new NotFoundException(`출고요청을 찾을 수 없습니다: ${requestNo}`);
    this.assertSameTenant('출고요청', { company, plant }, request);
    return request;
  }

  /** 작업지시 완제품의 BOM 직하위 원자재를 출고예정 품목으로 산출 */
  /** BOM 기준일을 화면 표기용 YYYY-MM-DD 로 만든다(UTC 변환 금지 - 로컬 날짜 그대로). */
  private toDateOnlyStringLocal(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async buildBomRequestItems(orderNo: string, company?: string, plant?: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...this.tenantWhere(company, plant) },
    });
    if (!jobOrder) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    this.assertSameTenant('작업지시', { company, plant }, jobOrder);

    const { bomEffectiveDate, bomCount, rawBomRows, partMap, prevIssueMap, rawCodes, effectiveCompany, effectivePlant } =
      await this.loadOrderBomNeeds(jobOrder, company, plant);
    // 빈 결과의 원인을 호출부가 구분할 수 있도록 단계별 건수를 함께 돌려준다.
    // (BOM 미등록 / BOM에 원자재 없음 / 기출고·현장재고로 이미 충족)
    const emptySummary = (bomCount: number, rawCount: number, coveredCount: number) => ({
      bomCount,
      rawCount,
      coveredCount,
      bomEffectiveDate: this.toDateOnlyStringLocal(bomEffectiveDate),
    });
    if (bomCount === 0) return { items: [], summary: emptySummary(0, 0, 0) };

    const [floorStockMap, availableStockMap] = await Promise.all([
      this.getFloorStockQtyMap(rawCodes, effectiveCompany, effectivePlant),
      this.getAvailableStockQtyMap(rawCodes, effectiveCompany, effectivePlant),
    ]);

    const rows = rawBomRows
      .map((bom) => {
        const part = partMap.get(bom.childItemCode);
        const bomReqQty = mulQty(this.toNumber(bom.qtyPer), this.toNumber(jobOrder.planQty));
        const prevIssueQty = prevIssueMap.get(bom.childItemCode) ?? 0;
        const floorStockQty = floorStockMap.get(bom.childItemCode) ?? 0;
        const requestQty = Math.max(Math.ceil(bomReqQty - prevIssueQty - floorStockQty), 0);
        const stock = availableStockMap.get(bom.childItemCode) ?? EMPTY_AVAILABILITY;
        return {
          itemCode: bom.childItemCode,
          itemName: part?.itemName ?? bom.childItemCode,
          unit: part?.unit ?? 'EA',
          currentStock: stock.availableQty,
          issuableQty: stock.issuableQty,
          pendingIqcQty: stock.pendingIqcQty,
          requestQty,
          bomReqQty,
          prevIssueQty,
          floorStockQty,
          minPackQty: this.toNumber(part?.minPackQty),
        };
      });
    const items = rows.filter((item) => item.requestQty > 0);
    return {
      items,
      summary: emptySummary(bomCount, rawBomRows.length, rows.length - items.length),
    };
  }

  /** 작업지시 1건의 BOM 직하위 원자재와 작업지시 기출고량(현장재고·가용재고는 호출측이 품목 단위로 한 번 조회) */
  private async loadOrderBomNeeds(jobOrder: JobOrder, company?: string, plant?: string) {
    const orderNo = jobOrder.orderNo;
    const effectiveCompany = jobOrder.company ?? company;
    const effectivePlant = jobOrder.plant ?? plant;
    const bomEffectiveDate = this.resolveBomEffectiveDate(jobOrder);
    const bomRows = await this.bomRepository.find({
      where: {
        parentItemCode: jobOrder.itemCode,
        useYn: 'Y',
        validFrom: LessThanOrEqual(bomEffectiveDate),
        validTo: MoreThanOrEqual(bomEffectiveDate),
        ...this.tenantWhere(effectiveCompany, effectivePlant),
      },
      order: { seq: 'ASC' },
    });
    if (bomRows.length === 0) {
      return {
        bomEffectiveDate, bomCount: 0, rawBomRows: [] as BomMaster[], partMap: new Map<string, ItemMaster>(),
        prevIssueMap: new Map<string, number>(), rawCodes: [] as string[], effectiveCompany, effectivePlant,
      };
    }

    const childCodes = [...new Set(bomRows.map((bom) => bom.childItemCode).filter(Boolean))];
    const parts = childCodes.length > 0
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(childCodes), ...this.tenantWhere(effectiveCompany, effectivePlant) },
      })
      : [];
    const partMap = new Map(parts.map((part) => [part.itemCode, part]));
    const rawBomRows = bomRows.filter((bom) => this.isRawMaterial(partMap.get(bom.childItemCode)));
    const rawCodes = [...new Set(rawBomRows.map((bom) => bom.childItemCode))];

    const prevIssueMap = await this.getPreviousIssueQtyMap(orderNo, rawCodes, effectiveCompany, effectivePlant);
    return { bomEffectiveDate, bomCount: bomRows.length, rawBomRows, partMap, prevIssueMap, rawCodes, effectiveCompany, effectivePlant };
  }

  /** 묶음 대상 작업지시 검증: 존재·품목지시·미완료, 공정이 모두 같아야 한다. 계획일 순 작업지시와 공통 공정을 돌려준다 */
  private async assertBundleOrders(orderNos: string[], company?: string, plant?: string) {
    const uniqueNos = [...new Set(orderNos.map((no) => no?.trim()).filter((no): no is string => !!no))];
    if (uniqueNos.length < 2) {
      throw new BadRequestException('묶음 출고요청은 작업지시 2건 이상을 선택해야 합니다.');
    }
    const jobOrders = await this.jobOrderRepository.find({
      where: { orderNo: In(uniqueNos), ...this.tenantWhere(company, plant) },
    });
    const missing = uniqueNos.filter((no) => !jobOrders.some((order) => order.orderNo === no));
    if (missing.length > 0) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${missing.join(', ')}`);
    jobOrders.forEach((order) => {
      this.assertSameTenant('작업지시', { company, plant }, order);
      this.assertRequestableOrder(order);
    });

    const processByOrder = await Promise.all(jobOrders.map(async (order) => ({
      orderNo: order.orderNo,
      processCode: await this.resolveJobOrderProcessCode(order, order.company ?? company, order.plant ?? plant),
    })));
    const unresolved = processByOrder.filter((row) => !row.processCode).map((row) => row.orderNo);
    if (unresolved.length > 0) {
      throw new BadRequestException(`공정을 결정할 수 없는 작업지시는 묶을 수 없습니다(대표 공정·라우팅 없음): ${unresolved.join(', ')}`);
    }
    const processCodes = [...new Set(processByOrder.map((row) => row.processCode as string))];
    if (processCodes.length > 1) {
      throw new BadRequestException(
        `같은 공정의 작업지시만 묶을 수 있습니다: ${processByOrder.map((row) => `${row.orderNo}=${row.processCode}`).join(', ')}`,
      );
    }
    return { jobOrders: sortOrdersByPlan(jobOrders), processCode: processCodes[0] };
  }

  /**
   * 묶음 출고요청 품목 산출: 작업지시별 (BOM 소요 - 기출고)를 품목 단위로 모으고, 현장재고는 품목당 한 번만
   * 계획일 빠른 작업지시부터 덮는다(splitRequestQtyByOrder). 품목 행에 작업지시별 수량(orders)을 싣는다.
   */
  async buildBundleBomRequestItems(orderNos: string[], company?: string, plant?: string) {
    const { jobOrders, processCode } = await this.assertBundleOrders(orderNos, company, plant);
    const needsList = await Promise.all(jobOrders.map((order) => this.loadOrderBomNeeds(order, company, plant)));
    const effectiveCompany = needsList[0].effectiveCompany;
    const effectivePlant = needsList[0].effectivePlant;

    interface OrderNeedRow { orderNo: string; planDate: Date | null; needQty: number; bomReqQty: number; prevIssueQty: number }
    const byItem = new Map<string, { part?: ItemMaster; orders: OrderNeedRow[] }>();
    jobOrders.forEach((order, idx) => {
      const needs = needsList[idx];
      // 같은 작업지시 BOM 에 같은 자품목이 여러 줄이면 소요량을 합친다(기출고량은 품목 단위라 한 번만 뺀다)
      const bomQtyByCode = new Map<string, number>();
      for (const bom of needs.rawBomRows) {
        const qty = mulQty(this.toNumber(bom.qtyPer), this.toNumber(order.planQty));
        bomQtyByCode.set(bom.childItemCode, (bomQtyByCode.get(bom.childItemCode) ?? 0) + qty);
      }
      for (const [itemCode, bomReqQty] of bomQtyByCode) {
        const prevIssueQty = needs.prevIssueMap.get(itemCode) ?? 0;
        const entry = byItem.get(itemCode) ?? { part: needs.partMap.get(itemCode), orders: [] };
        entry.orders.push({ orderNo: order.orderNo, planDate: order.planDate ?? null, needQty: bomReqQty - prevIssueQty, bomReqQty, prevIssueQty });
        byItem.set(itemCode, entry);
      }
    });

    const itemCodes = [...byItem.keys()];
    const [floorStockMap, availableStockMap] = await Promise.all([
      this.getFloorStockQtyMap(itemCodes, effectiveCompany, effectivePlant),
      this.getAvailableStockQtyMap(itemCodes, effectiveCompany, effectivePlant),
    ]);

    const rows = itemCodes.map((itemCode) => {
      const { part, orders } = byItem.get(itemCode)!;
      const floorStockQty = floorStockMap.get(itemCode) ?? 0;
      const split = splitRequestQtyByOrder(orders, floorStockQty);
      const requestQtyByOrder = new Map(split.map((row) => [row.orderNo, row.requestQty]));
      const stock = availableStockMap.get(itemCode) ?? EMPTY_AVAILABILITY;
      return {
        itemCode,
        itemName: part?.itemName ?? itemCode,
        unit: part?.unit ?? 'EA',
        currentStock: stock.availableQty,
        issuableQty: stock.issuableQty,
        pendingIqcQty: stock.pendingIqcQty,
        requestQty: split.reduce((sum, row) => sum + row.requestQty, 0),
        bomReqQty: orders.reduce((sum, row) => sum + row.bomReqQty, 0),
        prevIssueQty: orders.reduce((sum, row) => sum + row.prevIssueQty, 0),
        floorStockQty,
        minPackQty: this.toNumber(part?.minPackQty),
        orders: sortOrdersByPlan(orders).map((row) => ({
          orderNo: row.orderNo,
          requestQty: requestQtyByOrder.get(row.orderNo) ?? 0,
          bomReqQty: row.bomReqQty,
          prevIssueQty: row.prevIssueQty,
        })),
      };
    });
    const items = rows.filter((item) => item.requestQty > 0);
    return {
      items,
      processCode,
      orders: jobOrders.map((order) => ({
        orderNo: order.orderNo,
        itemCode: order.itemCode,
        planQty: this.toNumber(order.planQty),
        planDate: order.planDate ?? null,
      })),
      summary: {
        bomCount: needsList.reduce((sum, needs) => sum + needs.bomCount, 0),
        rawCount: rows.length,
        coveredCount: rows.length - items.length,
        bomEffectiveDate: this.toDateOnlyStringLocal(needsList[0].bomEffectiveDate),
      },
    };
  }

  private resolveBomEffectiveDate(jobOrder: JobOrder): Date {
    if (!jobOrder.planDate) {
      throw new BadRequestException(
        `작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다: ${jobOrder.orderNo}`,
      );
    }

    const date = new Date(jobOrder.planDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `작업지시 계획일이 올바르지 않아 BOM 기준일을 결정할 수 없습니다: ${jobOrder.orderNo}`,
      );
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * 출고요청은 품목지시(ORDER_KIND=ITEM)에만 등록한다.
   * 공정지시(OPERATION)는 품목지시 아래 공정별로 자동 생성되는 하위 지시라 여기에 또 요청하면 소요량이 2배로 잡힌다
   * (2026-09-09 실측: 작업지시 8세트에 출고요청 12건, 6건 중복).
   */
  private async assertItemOrderForRequest(orderNo: string | undefined, company?: string, plant?: string) {
    if (!orderNo) return;
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['orderNo', 'orderKind', 'parentOrderNo', 'status'],
    });
    if (jobOrder) this.assertRequestableOrder(jobOrder);
  }

  private assertRequestableOrder(jobOrder: Pick<JobOrder, 'orderNo' | 'orderKind' | 'parentOrderNo' | 'status'>) {
    if (isJobOrderFinished(String(jobOrder.status ?? ''))) {
      throw new BadRequestException(`완료·취소된 작업지시(${jobOrder.orderNo})에는 출고요청을 등록할 수 없습니다.`);
    }
    if (String(jobOrder.orderKind ?? 'ITEM').toUpperCase() === 'OPERATION') {
      throw new BadRequestException(
        `공정지시(${jobOrder.orderNo})에는 출고요청을 등록할 수 없습니다. 상위 품목지시${jobOrder.parentOrderNo ? `(${jobOrder.parentOrderNo})` : ''}를 선택하세요.`,
      );
    }
  }

  /**
   * 중복 출고요청 가드: 같은 작업지시·품목이 미완료(REQUESTED/APPROVED/PARTIAL) 요청에 이미 있으면 차단한다.
   * 1:1 요청(헤더 ORDER_NO)과 묶음 요청(MAT_ISSUE_REQUEST_ITEM_ORDERS) 양쪽을 모두 본다. 작업지시 없는 수동요청은 제외.
   */
  private async assertNoDuplicateActiveRequest(pairs: Array<{ orderNo: string; itemCode: string }>, company?: string, plant?: string) {
    if (pairs.length === 0) return;
    const tenantWhere = this.tenantWhere(company, plant);
    const orderNos = [...new Set(pairs.map((pair) => pair.orderNo))];
    const activeStatuses = ['REQUESTED', 'APPROVED', 'PARTIAL'];
    const taken = new Set<string>();

    // 1) 1:1 요청 — 헤더 작업지시 × 품목
    const directRequests = ((await this.requestRepository.find({
      where: { orderNo: In(orderNos), ...tenantWhere },
    })) ?? []).filter((r) => activeStatuses.includes(r.status));
    if (directRequests.length > 0) {
      const orderByRequest = new Map(directRequests.map((r) => [r.requestNo, r.orderNo as string]));
      const directItems = (await this.requestItemRepository.find({
        where: { requestId: In([...orderByRequest.keys()]), ...tenantWhere },
      })) ?? [];
      directItems.forEach((item) => taken.add(`${orderByRequest.get(item.requestId)}|${item.itemCode}`));
    }

    // 2) 묶음 요청 — 작업지시별 행 × 품목
    const bundleRows = ((await this.itemOrderRepository.find({ where: { orderNo: In(orderNos), ...tenantWhere } })) ?? [])
      .filter((row) => row.requestQty > 0);
    const bundleRequestNos = [...new Set(bundleRows.map((row) => row.requestId))];
    if (bundleRequestNos.length > 0) {
      const activeBundles = ((await this.requestRepository.find({
        where: { requestNo: In(bundleRequestNos), ...tenantWhere },
      })) ?? []).filter((r) => activeStatuses.includes(r.status));
      const activeNos = new Set(activeBundles.map((r) => r.requestNo));
      const bundleItems = activeNos.size > 0
        ? (await this.requestItemRepository.find({ where: { requestId: In([...activeNos]), ...tenantWhere } })) ?? []
        : [];
      const itemCodeBySeq = new Map(bundleItems.map((item) => [`${item.requestId}|${item.seq}`, item.itemCode]));
      bundleRows
        .filter((row) => activeNos.has(row.requestId))
        .forEach((row) => {
          const itemCode = itemCodeBySeq.get(`${row.requestId}|${row.itemSeq}`);
          if (itemCode) taken.add(`${row.orderNo}|${itemCode}`);
        });
    }

    const conflicts = [...new Set(pairs
      .filter((pair) => taken.has(`${pair.orderNo}|${pair.itemCode}`))
      .map((pair) => `${pair.orderNo}/${pair.itemCode}`))];
    if (conflicts.length > 0) {
      throw new BadRequestException(`이미 진행 중인 출고요청이 있는 품목입니다(작업지시/품목): ${conflicts.join(', ')}`);
    }
  }

  /**
   * 묶음 요청 생성 계획: 작업지시 검증(같은 공정) → 품목별 작업지시 수량 확정 → 중복 가드.
   * 품목 수량(사용자가 고친 합계)을 화면이 보낸 작업지시별 산출 수량을 상한으로 계획일 빠른 순에 채우고,
   * 남는 수량은 마지막 작업지시에 둔다. 작업지시 정보가 없는 품목(BOM 외 직접추가)은 계획일이 가장 빠른 작업지시에 붙인다.
   */
  private async planBundleRequest(dto: CreateIssueRequestDto, company?: string, plant?: string) {
    const { jobOrders, processCode } = await this.assertBundleOrders(dto.orderNos ?? [], company, plant);
    if (dto.processCode && dto.processCode !== processCode) {
      throw new BadRequestException(`묶음 출고요청의 공정은 작업지시 공정(${processCode})과 같아야 합니다: ${dto.processCode}`);
    }
    const planDateMap = new Map(jobOrders.map((order) => [order.orderNo, order.planDate ?? null]));
    const firstOrderNo = jobOrders[0].orderNo;

    const itemOrders = dto.items.map((item) => {
      const base = (item.orders ?? []).filter((row) => row.requestQty > 0);
      const unknown = base.filter((row) => !planDateMap.has(row.orderNo)).map((row) => row.orderNo);
      if (unknown.length > 0) {
        throw new BadRequestException(`묶음에 없는 작업지시가 품목 ${item.itemCode}에 있습니다: ${[...new Set(unknown)].join(', ')}`);
      }
      const baseRows = base.length > 0
        ? base
        : [{ orderNo: firstOrderNo, requestQty: item.requestQty, bomReqQty: undefined, prevIssueQty: undefined }];
      const baseByOrder = new Map(baseRows.map((row) => [row.orderNo, row]));
      return distributeQtyToOrders(
        baseRows.map((row) => ({ orderNo: row.orderNo, planDate: planDateMap.get(row.orderNo), requestQty: row.requestQty, issuedQty: 0 })),
        item.requestQty,
      ).map((take) => ({
        orderNo: take.orderNo,
        requestQty: take.qty,
        bomReqQty: baseByOrder.get(take.orderNo)?.bomReqQty,
        prevIssueQty: baseByOrder.get(take.orderNo)?.prevIssueQty,
      }));
    });

    await this.assertNoDuplicateActiveRequest(
      dto.items.flatMap((item, idx) => itemOrders[idx].map((row) => ({ orderNo: row.orderNo, itemCode: item.itemCode }))),
      company,
      plant,
    );
    return { processCode, itemOrders };
  }

  /** 출고요청 생성 (헤더 + 품목 일괄 저장) */
  async create(dto: CreateIssueRequestDto, company?: string, plant?: string) {
    const bundle = dto.orderNos && dto.orderNos.length > 0
      ? await this.planBundleRequest(dto, company, plant)
      : null;
    if (!bundle) {
      await this.assertItemOrderForRequest(dto.orderNo, company, plant);
      if (dto.orderNo) {
        const orderNo = dto.orderNo;
        await this.assertNoDuplicateActiveRequest(dto.items.map((item) => ({ orderNo, itemCode: item.itemCode })), company, plant);
      }
    }
    const requestNo = await this.tx.run(async (queryRunner) => {
      const requestNo = await this.generateRequestNo(queryRunner);
      const request = queryRunner.manager.create(MatIssueRequest, {
        requestNo,
        orderNo: bundle ? null : dto.orderNo ?? null,
        processCode: bundle ? bundle.processCode : dto.processCode ?? null,
        issueType: dto.issueType ?? null,
        status: 'REQUESTED',
        requester: 'SYSTEM',
        remark: dto.remark ?? null,
        company,
        plant,
      });
      const saved = await queryRunner.manager.save(request);

      const items = dto.items.map((item, idx) =>
        queryRunner.manager.create(MatIssueRequestItem, {
          requestId: saved.requestNo,
          seq: idx + 1,
          itemCode: item.itemCode,
          requestQty: item.requestQty,
          issuedQty: 0,
          unit: item.unit,
          bomReqQty: item.bomReqQty ?? null,
          prevIssueQty: item.prevIssueQty ?? null,
          floorStockQty: item.floorStockQty ?? null,
          remark: item.remark ?? null,
          company,
          plant,
        }),
      );
      await queryRunner.manager.save(items);

      if (bundle) {
        const orderRows = bundle.itemOrders.flatMap((orders, idx) => orders.map((row) =>
          queryRunner.manager.create(MatIssueRequestItemOrder, {
            requestId: saved.requestNo,
            itemSeq: idx + 1,
            orderNo: row.orderNo,
            requestQty: row.requestQty,
            issuedQty: 0,
            bomReqQty: row.bomReqQty ?? null,
            prevIssueQty: row.prevIssueQty ?? null,
            company,
            plant,
          })));
        await queryRunner.manager.save(orderRows);
      }
      return saved.requestNo;
    });

    // 요청 생성은 차단하지 않는다(입고 후 IQC 전 요청은 정상 업무). IQC 미검사 재고만 있는 품목은 안내한다.
    const detail = await this.findByRequestNo(requestNo, company, plant);
    const warnings = detail.items
      .filter((item) => this.toNumber(item.issuableQty) <= 0 && this.toNumber(item.pendingIqcQty) > 0)
      .map((item) => `${item.itemCode}: 출고가능(IQC합격) 재고가 없고 IQC 미검사 재고만 ${this.toNumber(item.pendingIqcQty)} 있습니다. 검사 완료 후 출고할 수 있습니다.`);
    return { ...detail, warnings };
  }

  /** 출고요청 목록 조회 (페이지네이션 + 필터) */
  async findAll(query: IssueRequestQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, search, orderNo, issueType, fromDate, toDate } = query;
    // status=PENDING(미완료 전체)은 shared 상태 집합으로 해석 — 프론트 기본 필터와 같은 정의
    const pendingStatuses = [...ISSUE_REQUEST_PENDING_STATUSES];
    const statusWhere = status === ISSUE_REQUEST_PENDING_FILTER ? In(pendingStatuses) : status;
    // 요청일 구간(로컬 날짜, 종료일 당일 포함) — 전 상태 조회 시 기간 없이 전량을 훑지 않도록 프론트가 기본 당일을 보낸다
    const dateFrom = parseDateStart(fromDate);
    const dateTo = parseDateEnd(toDate);
    const requestDateWhere = dateFrom && dateTo ? Between(dateFrom, dateTo)
      : dateFrom ? MoreThanOrEqual(dateFrom)
      : dateTo ? LessThanOrEqual(dateTo)
      : undefined;
    const where: FindOptionsWhere<MatIssueRequest> = {
      ...(statusWhere && { status: statusWhere }),
      ...(requestDateWhere && { requestDate: requestDateWhere }),
      ...(orderNo && { orderNo }),
      ...(issueType && { issueType }),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    let data: MatIssueRequest[] = [];
    let total = 0;
    const trimmedSearch = search?.trim();

    if (trimmedSearch || orderNo) {
      const qb = this.requestRepository.createQueryBuilder('req');
      if (status === ISSUE_REQUEST_PENDING_FILTER) qb.andWhere('req.status IN (:...pendingStatuses)', { pendingStatuses });
      else if (status) qb.andWhere('req.status = :status', { status });
      if (dateFrom) qb.andWhere('req.requestDate >= :dateFrom', { dateFrom });
      if (dateTo) qb.andWhere('req.requestDate <= :dateTo', { dateTo });
      // 작업지시 필터: 1:1 요청(헤더) 또는 그 작업지시가 묶인 묶음 요청
      if (orderNo) {
        qb.andWhere(`(
          req.orderNo = :orderNo
          OR EXISTS (
            SELECT 1 FROM MAT_ISSUE_REQUEST_ITEM_ORDERS ro
             WHERE ro.REQUEST_ID = "req"."REQUEST_NO"
               AND ro.COMPANY = "req"."COMPANY" AND ro.PLANT_CD = "req"."PLANT_CD"
               AND ro.ORDER_NO = :orderNo
          )
        )`, { orderNo });
      }
      if (issueType) qb.andWhere('req.issueType = :issueType', { issueType });
      if (company) qb.andWhere('req.company = :company', { company });
      if (plant) qb.andWhere('req.plant = :plant', { plant });
      if (trimmedSearch) qb.andWhere(`
        (
          UPPER(req.requestNo) LIKE :search
          OR UPPER(COALESCE(req.requester, '')) LIKE :search
          OR UPPER(COALESCE(req.orderNo, '')) LIKE :search
          OR EXISTS (
            SELECT 1 FROM MAT_ISSUE_REQUEST_ITEM_ORDERS so
             WHERE so.REQUEST_ID = "req"."REQUEST_NO"
               AND so.COMPANY = "req"."COMPANY" AND so.PLANT_CD = "req"."PLANT_CD"
               AND UPPER(so.ORDER_NO) LIKE :search
          )
          OR UPPER(COALESCE(req.issueType, '')) LIKE :search
          OR UPPER(COALESCE(req.remark, '')) LIKE :search
          OR EXISTS (
            SELECT 1
            FROM MAT_ISSUE_REQUEST_ITEMS item
            LEFT JOIN ITEM_MASTERS part
              ON part.ITEM_CODE = item.ITEM_CODE
             AND part.COMPANY = item.COMPANY
             AND part.PLANT_CD = item.PLANT_CD
            WHERE item.REQUEST_ID = "req"."REQUEST_NO"
              ${company ? 'AND item.COMPANY = :company' : ''}
              ${plant ? 'AND item.PLANT_CD = :plant' : ''}
              AND (
                UPPER(item.ITEM_CODE) LIKE :search
                OR UPPER(COALESCE(part.ITEM_NAME, '')) LIKE :search
              )
          )
        )
      `, { search: `%${trimmedSearch.toUpperCase()}%` });

      total = await qb.clone().getCount();
      const rows = await qb
        .select('req.requestNo', 'requestNo')
        .orderBy('req.requestDate', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getRawMany<{ requestNo: string }>();
      const requestNos = rows.map((row) => row.requestNo).filter(Boolean);
      if (requestNos.length > 0) {
        data = await this.requestRepository.find({ where: { requestNo: In(requestNos), ...this.tenantWhere(company, plant) } });
        const order = new Map(requestNos.map((requestNo, idx) => [requestNo, idx]));
        data.sort((a, b) => (order.get(a.requestNo) ?? 0) - (order.get(b.requestNo) ?? 0));
      }
    } else {
      [data, total] = await Promise.all([
        this.requestRepository.find({
          where, skip: (page - 1) * limit, take: limit, order: { requestDate: 'DESC' },
        }),
        this.requestRepository.count({ where }),
      ]);
    }

    // IN 배치 선조회로 N+1 제거 (요청별 아이템 개별 조회 → 일괄 조회)
    const requestNos = data.map((r) => r.requestNo);
    const tenantWhere = this.tenantWhere(company, plant);
    const allItems = requestNos.length > 0
      ? await this.requestItemRepository.find({ where: { requestId: In(requestNos), ...tenantWhere } })
      : [];

    // 품목 정보 일괄 조회
    const allItemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))];
    const allParts = allItemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(allItemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(allParts.map((p) => [p.itemCode, p]));

    const itemOrderMap = await this.loadItemOrderMap(requestNos, tenantWhere);

    // 요청별 아이템 그룹화
    const itemsByRequest = new Map<string, MatIssueRequestItem[]>();
    for (const item of allItems) {
      const list = itemsByRequest.get(item.requestId) ?? [];
      list.push(item);
      itemsByRequest.set(item.requestId, list);
    }

    const result = data.map((req) => {
      const items = itemsByRequest.get(req.requestNo) ?? [];
      const flatItems = items.map((item) => {
        const part = partMap.get(item.itemCode);
        return {
          ...item,
          itemCode: item.itemCode,
          itemName: part?.itemName ?? null,
          unit: item.unit ?? part?.unit ?? null,
          orders: itemOrderMap.get(`${item.requestId}|${item.seq}`) ?? [],
        };
      });
      return {
        ...req,
        bundleOrderNos: this.collectBundleOrderNos(flatItems),
        itemCount: items.length,
        totalRequestQty: items.reduce((sum, i) => sum + i.requestQty, 0),
        totalIssuedQty: items.reduce((sum, i) => sum + i.issuedQty, 0),
        items: flatItems,
      };
    });

    return { data: result, total, page, limit };
  }

  /** 출고요청 상세 조회 (헤더 + 품목) */
  async findByRequestNo(requestNo: string, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    const requestTenantWhere = this.tenantWhere(request.company, request.plant);
    const items = await this.requestItemRepository.find({ where: { requestId: requestNo, ...requestTenantWhere } });
    const itemOrderMap = await this.loadItemOrderMap([requestNo], requestTenantWhere);
    const flatItems = (await this.flattenItems(items, request.company, request.plant)).map((item) => ({
      ...item,
      orders: itemOrderMap.get(`${item.requestId}|${item.seq}`) ?? [],
    }));
    // 출고 시 실제 적용될 공정(요청 공정 → 작업지시 공정 → 라우팅 첫 공정) — 출고 모달 기본값
    const issueProcessCode = await this.resolveIssueProcessCode(request, request.company, request.plant);
    const bundleOrderNos = this.collectBundleOrderNos(flatItems);
    const bundleJobOrders = bundleOrderNos.length > 0
      ? await this.jobOrderRepository.find({ where: { orderNo: In(bundleOrderNos), ...requestTenantWhere } })
      : [];
    const bundleOrders = sortOrdersByPlan(bundleJobOrders).map((order) => ({
      orderNo: order.orderNo,
      itemCode: order.itemCode,
      planQty: this.toNumber(order.planQty),
      planDate: order.planDate ?? null,
      status: order.status,
    }));
    return { ...request, items: flatItems, issueProcessCode, bundleOrderNos, bundleOrders };
  }

  /** 요청 품목별 작업지시 수량(묶음 요청) — key: `${requestId}|${seq}` */
  private async loadItemOrderMap(requestNos: string[], tenantWhere: { company?: string; plant?: string }) {
    const map = new Map<string, Array<{ orderNo: string; requestQty: number; issuedQty: number; bomReqQty: number | null; prevIssueQty: number | null }>>();
    if (requestNos.length === 0) return map;
    const rows = (await this.itemOrderRepository.find({
      where: { requestId: In(requestNos), ...tenantWhere },
      order: { requestId: 'ASC', itemSeq: 'ASC', orderNo: 'ASC' },
    })) ?? [];
    for (const row of rows) {
      const key = `${row.requestId}|${row.itemSeq}`;
      const list = map.get(key) ?? [];
      list.push({
        orderNo: row.orderNo,
        requestQty: this.toNumber(row.requestQty),
        issuedQty: this.toNumber(row.issuedQty),
        bomReqQty: row.bomReqQty === null || row.bomReqQty === undefined ? null : this.toNumber(row.bomReqQty),
        prevIssueQty: row.prevIssueQty === null || row.prevIssueQty === undefined ? null : this.toNumber(row.prevIssueQty),
      });
      map.set(key, list);
    }
    return map;
  }

  private collectBundleOrderNos(items: Array<{ orders: Array<{ orderNo: string }> }>): string[] {
    return [...new Set(items.flatMap((item) => item.orders.map((row) => row.orderNo)))].sort();
  }

  /** 출고요청 승인 (REQUESTED -> APPROVED) */
  async approve(requestNo: string, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`승인할 수 없는 상태입니다: ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);

    // 승인 단계 IQC 가용재고 검증 — 정책 MAT_ISSUE_STOCK_CHECK(BLOCK|WARN, 기본 BLOCK)
    const items = await this.requestItemRepository.find({ where: { requestId: requestNo, ...requestTenantWhere } });
    const flatItems = await this.flattenItems(items, effectiveCompany, effectivePlant);
    const warnings = this.buildStockShortageWarnings(flatItems);
    if (warnings.length > 0) {
      const policy = await this.loadStockCheckPolicy(effectiveCompany, effectivePlant);
      if (policy === 'BLOCK') {
        throw new BadRequestException(
          `출고가능(IQC합격) 재고가 부족해 승인할 수 없습니다: ${requestNo}. ${warnings.join(' / ')}`,
        );
      }
    }

    await this.requestRepository.update({ requestNo, ...requestTenantWhere }, { status: 'APPROVED', approvedAt: new Date() });
    const detail = await this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined);
    return { ...detail, warnings };
  }

  /** 출고요청 반려 (REQUESTED -> REJECTED) */
  async reject(requestNo: string, dto: RejectIssueRequestDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`반려할 수 없는 상태입니다: ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);
    await this.requestRepository.update({ requestNo, ...requestTenantWhere }, { status: 'REJECTED', rejectReason: dto.reason });
    return this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined);
  }

  /**
   * 출고 준비 분할 — 부분 사용 롯트를 실물 분할해 출고분/잔량분 시리얼과 라벨을 만든다.
   *
   * 이 단계를 거치면 이어지는 출고(issueFromRequest)는 전부 전량 출고가 된다.
   * 여러 롯트를 한 트랜잭션으로 묶는다 — 일부만 쪼개져 라벨 없이 남는 상황을 막는다.
   */
  async splitForIssue(requestNo: string, dto: SplitForIssueDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'APPROVED' && request.status !== 'PARTIAL') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED/PARTIAL만 가능): ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const remark = dto.remark ?? `출고요청 ${request.requestNo} 출고 준비 분할`;

    return this.tx.run(async (queryRunner) => {
      const splits = [];
      for (const item of dto.splits) {
        const result = await this.lotSplitService.splitInTx(
          queryRunner,
          { sourceLotId: item.sourceMatUid, splitQty: item.issueQty, remark },
          { allowIssuedSource: true },
          effectiveCompany ?? undefined,
          effectivePlant ?? undefined,
          undefined,
        );
        splits.push({ sourceMatUid: item.sourceMatUid, ...result });
      }
      return { splits };
    });
  }

  /**
   * 이미 커밋된 출고 준비 분할의 라벨 데이터를 되살린다 — 모달을 닫았다 열어도 재출력할 수 있게.
   *
   * 분할은 커밋되지만 라벨 출력은 실패하거나 건너뛸 수 있다(프린터 잼, 미리보기 닫기).
   * 그 상태로 모달을 닫으면 라벨 없는 신규 시리얼 2건이 창고에 남고 원본은 SPLIT(재고 0)이라
   * 실물을 식별할 방법이 사라진다. 그래서 화면 상태가 아니라 DB 에서 복원한다.
   *
   * 복원 근거: 분할이 남긴 STOCK_TRANSACTIONS (transType='LOT_SPLIT_IN', refType='LOT_SPLIT',
   * refId=원본 시리얼). 한 refId 그룹 = 자식 2건 = 라벨 2장이고 TRANS_NO 오름차순이
   * 출고분 → 잔량분 순서다.
   *
   * 한계: 수불에는 "어느 출고요청의 분할인가"를 가리키는 컬럼이 없다. 그래서 요청 품목코드와
   * 최근 기간으로만 좁힌다. 같은 품목을 /material/lot-split 화면에서 따로 분할한 건도 함께
   * 잡힐 수 있다(과다 복원). 재출력 목록이 조금 넓은 것은 무해하지만, 라벨 없는 시리얼을
   * 놓치는 과소 복원은 현장에서 식별 불가 재고를 만들기 때문에 넓은 쪽을 택했다.
   */
  async findSplitLabelGroups(requestNo: string, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const tenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);

    const items = await this.requestItemRepository.find({ where: { requestId: requestNo, ...tenantWhere } });
    const itemCodes = [...new Set(items.map((item) => item.itemCode).filter(Boolean))];
    if (itemCodes.length === 0) return { splits: [] };

    const since = new Date(Date.now() - SPLIT_LABEL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const txs = await this.stockTransactionRepository.find({
      where: {
        transType: 'LOT_SPLIT_IN',
        refType: 'LOT_SPLIT',
        status: 'DONE',
        itemCode: In(itemCodes),
        transDate: MoreThanOrEqual(since),
        ...tenantWhere,
      },
      order: { transNo: 'ASC' },
    });
    if (txs.length === 0) return { splits: [] };

    const childMatUids = [...new Set(txs.map((tx) => tx.matUid).filter((uid): uid is string => !!uid))];
    const [childLots, parts] = await Promise.all([
      this.matLotRepository.find({ where: { matUid: In(childMatUids), ...tenantWhere } }),
      this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }),
    ]);
    const lotMap = new Map(childLots.map((lot) => [lot.matUid, lot]));
    const partMap = new Map(parts.map((part) => [part.itemCode, part]));

    // refId(원본 시리얼)별 그룹 — 한 그룹이 라벨 미리보기 1회분이다
    const bySource = new Map<string, StockTransaction[]>();
    for (const tx of txs) {
      if (!tx.refId || !tx.matUid) continue;
      const group = bySource.get(tx.refId);
      if (group) group.push(tx);
      else bySource.set(tx.refId, [tx]);
    }

    const splits = [...bySource.entries()].filter(([, group]) => {
      // 이미 소진되거나 다시 쪼개진 세대는 뺀다.
      //
      // 자식이 다시 분할되면 그 시리얼은 status='SPLIT', 재고 0 이 되어 실물이 없다.
      // 그 라벨을 다시 뽑아 붙이면 "존재하지 않는 시리얼" 라벨이 현장 물건에 붙는다.
      // 정상 흐름(분할 → 출고분 전량 출고)에서는 출고분만 DEPLETED 가 되고 잔량분은
      // NORMAL 로 남으므로 재출력 경로는 그대로 살아 있다.
      return group.some((tx) => lotMap.get(tx.matUid ?? '')?.status === MAT_LOT_STATUS.NORMAL);
    }).map(([sourceMatUid, group]) => {
      const part = partMap.get(group[0].itemCode);
      const arrivalNo = lotMap.get(group[0].matUid ?? '')?.arrivalNo ?? null;
      const results = group.map((tx) => ({ matUid: tx.matUid as string, qty: Number(tx.qty) }));
      return {
        sourceMatUid,
        sourceLotNo: sourceMatUid,
        itemCode: group[0].itemCode,
        itemName: part?.itemName ?? group[0].itemCode,
        arrivalNo,
        results,
        label: {
          arrivalNo: arrivalNo ?? '',
          serials: results.map((child, idx) => ({
            matUid: child.matUid,
            initQty: lotMap.get(child.matUid)?.initQty ?? child.qty,
            arrivalSeq: idx + 1,
            itemCode: group[0].itemCode,
          })),
        },
      };
    });

    return { splits };
  }

  /**
   * 요청 기반 실출고 처리
   * - APPROVED/PARTIAL 상태만 출고 가능
   * - MatIssueService.createInTx()로 실제 출고 수행(같은 트랜잭션)
   * - 생산 출고는 반드시 공정재고로 적재: 공정은 dto → 요청 → 작업지시 → 라우팅 첫 공정 순으로 결정, 없으면 차단
   * - 모든 품목 완전 출고 시 COMPLETED, 아니면 PARTIAL
   */
  async issueFromRequest(requestNo: string, dto: RequestIssueDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    // APPROVED(승인) 또는 PARTIAL(부분출고 진행 중)에서만 출고 가능
    if (request.status !== 'APPROVED' && request.status !== 'PARTIAL') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED/PARTIAL만 가능): ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);
    const issueType = dto.issueType ?? request.issueType ?? 'PRODUCTION';

    return this.tx.run(async (queryRunner) => {
      // 같은 요청 품목에 여러 LOT가 오면 수량을 합산해 검증/갱신한다(마지막 LOT만 반영되는 덮어쓰기 방지)
      const addedQtyBySeq = new Map<number, number>();

      // 검증에 필요한 항목/품목/LOT를 각각 1회 일괄 조회 후 메모리 매칭(N+1 제거)
      const reqSeqs = [...new Set(dto.items.map((i) => Number(i.requestItemId)))];
      const reqItems = reqSeqs.length
        ? await this.requestItemRepository.find({ where: { requestId: requestNo, seq: In(reqSeqs), ...requestTenantWhere } })
        : [];
      const reqItemMap = new Map(reqItems.map((r) => [r.seq, r]));

      const reqItemCodes = [...new Set(reqItems.map((r) => r.itemCode))];
      const parts = reqItemCodes.length
        ? await this.itemMasterRepository.find({ where: { itemCode: In(reqItemCodes), ...requestTenantWhere } })
        : [];
      const partMap = new Map(parts.map((p) => [p.itemCode, p]));

      const matUids = [...new Set(dto.items.map((i) => i.matUid))];
      const lots = matUids.length
        ? await queryRunner.manager.find(MatLot, { where: { matUid: In(matUids), ...requestTenantWhere } })
        : [];
      const lotMap = new Map(lots.map((l) => [l.matUid, l]));

      for (const dtoItem of dto.items) {
        const reqItemSeq = Number(dtoItem.requestItemId);
        const reqItem = reqItemMap.get(reqItemSeq);
        if (!reqItem) {
          throw new BadRequestException(`출고요청 항목을 찾을 수 없습니다: ${dtoItem.requestItemId}`);
        }

        // 포장단위(MIN_PACK_QTY) 올림: 요청 낱개 잔여를 포장단위 배수까지 출고 허용(잔량은 공정재고 재공)
        const part = partMap.get(reqItem.itemCode);
        const minPackQty = this.toNumber(part?.minPackQty);
        const remainingQty = reqItem.requestQty - reqItem.issuedQty;
        const allowedQty = this.roundUpToPack(remainingQty, minPackQty);
        const accumulatedQty = (addedQtyBySeq.get(reqItemSeq) ?? 0) + dtoItem.issueQty;
        if (accumulatedQty > allowedQty) {
          throw new BadRequestException(
            `요청 수량을 초과해 출고할 수 없습니다. 항목 ${reqItemSeq}, 잔여(포장단위 올림): ${allowedQty}, 요청: ${accumulatedQty}`,
          );
        }

        const lot = lotMap.get(dtoItem.matUid);
        if (!lot) {
          throw new BadRequestException(`LOT를 찾을 수 없습니다: ${dtoItem.matUid}`);
        }

        if (lot.itemCode !== reqItem.itemCode) {
          throw new BadRequestException(
            `출고요청 품목과 스캔 LOT 품목이 일치하지 않습니다. 항목 ${reqItemSeq}, 요청품목: ${reqItem.itemCode}, LOT품목: ${lot.itemCode}`,
          );
        }

        addedQtyBySeq.set(reqItemSeq, accumulatedQty);
      }

      // 생산 출고는 공정재고 적재가 필수 — 공정을 끝내 결정할 수 없으면 조용한 단순출고 대신 차단한다
      const processCode = dto.processCode?.trim()
        || await this.resolveIssueProcessCode(request, effectiveCompany, effectivePlant);
      if (isProductionIssueType(issueType) && !processCode) {
        throw new BadRequestException(
          `출고 공정을 결정할 수 없습니다. 출고요청 ${requestNo}에 공정이 없고` +
          `${request.orderNo ? ` 작업지시 ${request.orderNo}의 대표 공정/라우팅 첫 공정도 없습니다.` : ' 작업지시도 없습니다.'}` +
          ' 출고 공정을 지정하세요.',
        );
      }

      // 묶음 요청: LOT별 출고수량을 작업지시 계획일 빠른 순으로 나눠 작업지시별 행에 가산하고,
      // MAT_ISSUES.ORDER_NO 도 작업지시마다 남긴다(LOT 하나가 두 작업지시에 걸치면 출고 행 2개). 1:1 요청은 빈 배열.
      const orderTakes = await this.allocation.allocateToItemOrdersInTx(
        queryRunner,
        requestNo,
        dto.items.map((i) => ({ seq: Number(i.requestItemId), qty: i.issueQty })),
        effectiveCompany,
        effectivePlant,
      );
      const issueItems = dto.items.flatMap((i, idx) => {
        const takes = orderTakes[idx] ?? [];
        return takes.length > 0
          ? takes.map((take) => ({ matUid: i.matUid, issueQty: take.qty, orderNo: take.orderNo }))
          : [{ matUid: i.matUid, issueQty: i.issueQty }];
      });

      const issueResult = await this.matIssueService.createInTx(queryRunner, {
        orderNo: request.orderNo ?? undefined,
        processCode: processCode ?? undefined,
        warehouseCode: dto.warehouseCode,
        issueType,
        items: issueItems,
        workerId: dto.workerId,
        remark: dto.remark ?? `출고요청 ${request.requestNo} 기반 출고`,
      }, effectiveCompany ?? undefined, effectivePlant ?? undefined);

      // 각 요청 품목의 issuedQty 갱신(품목별 합산)
      for (const [seq, addedQty] of addedQtyBySeq) {
        const reqItem = reqItemMap.get(seq)!;
        await queryRunner.manager.update(MatIssueRequestItem, { requestId: reqItem.requestId, seq: reqItem.seq, ...requestTenantWhere }, {
          issuedQty: reqItem.issuedQty + addedQty,
        });
      }

      // 모든 품목 완전 출고 여부 — 같은 트랜잭션에서 갱신 후 값으로 판정
      const allItems = await queryRunner.manager.find(MatIssueRequestItem, { where: { requestId: requestNo, ...requestTenantWhere } });
      // 전량 출고 완료면 COMPLETED, 일부만 출고됐으면 PARTIAL(부분출고) — 규칙은 shared 단일 출처
      await queryRunner.manager.update(MatIssueRequest, { requestNo, ...requestTenantWhere }, {
        status: deriveIssueRequestStatusFromItems(allItems),
      });

      // 출고 정책 경고(FIFO WARN 등)는 항목별 warnings 를 모아 응답 최상위에도 싣는다(기존 request/issueResult 형태 유지)
      const warnings = issueResult.flatMap((row) => row.warnings ?? []);
      return { request: await this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined), issueResult, warnings };
    });
  }
}
