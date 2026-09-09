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
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { isProductionIssueType, ISSUE_REQUEST_PENDING_STATUSES, ISSUE_REQUEST_PENDING_FILTER, deriveIssueRequestStatusFromItems, MAT_LOT_STATUS } from '@harness/shared';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatIssueService } from './mat-issue.service';
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
import {
  CreateIssueRequestDto,
  IssueRequestQueryDto,
  RejectIssueRequestDto,
  RequestIssueDto,
} from '../dto/issue-request.dto';

@Injectable()
export class IssueRequestService {
  constructor(
    @InjectRepository(MatIssueRequest)
    private readonly requestRepository: Repository<MatIssueRequest>,
    @InjectRepository(MatIssueRequestItem)
    private readonly requestItemRepository: Repository<MatIssueRequestItem>,
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
    @InjectRepository(RoutingProcess)
    private readonly routingProcessRepository: Repository<RoutingProcess>,
    private readonly matIssueService: MatIssueService,
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
  async buildBomRequestItems(orderNo: string, company?: string, plant?: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...this.tenantWhere(company, plant) },
    });
    if (!jobOrder) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    this.assertSameTenant('작업지시', { company, plant }, jobOrder);

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
    if (bomRows.length === 0) return [];

    const childCodes = [...new Set(bomRows.map((bom) => bom.childItemCode).filter(Boolean))];
    const parts = childCodes.length > 0
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(childCodes), ...this.tenantWhere(effectiveCompany, effectivePlant) },
      })
      : [];
    const partMap = new Map(parts.map((part) => [part.itemCode, part]));
    const rawBomRows = bomRows.filter((bom) => this.isRawMaterial(partMap.get(bom.childItemCode)));
    const rawCodes = [...new Set(rawBomRows.map((bom) => bom.childItemCode))];

    const [prevIssueMap, floorStockMap, availableStockMap] = await Promise.all([
      this.getPreviousIssueQtyMap(orderNo, rawCodes, effectiveCompany, effectivePlant),
      this.getFloorStockQtyMap(rawCodes, effectiveCompany, effectivePlant),
      this.getAvailableStockQtyMap(rawCodes, effectiveCompany, effectivePlant),
    ]);

    return rawBomRows
      .map((bom) => {
        const part = partMap.get(bom.childItemCode);
        const bomReqQty = this.toNumber(bom.qtyPer) * this.toNumber(jobOrder.planQty);
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
      })
      .filter((item) => item.requestQty > 0);
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
   * 중복 출고요청 가드: 동일 작업지시의 미완료(REQUESTED/APPROVED/PARTIAL) 요청에
   * 같은 품목이 이미 있으면 중복 생성을 차단한다. 작업지시 없는 수동요청은 제외.
   */
  private async assertNoDuplicateActiveRequest(dto: CreateIssueRequestDto, company?: string, plant?: string) {
    if (!dto.orderNo) return;
    const tenantWhere = this.tenantWhere(company, plant);
    const existing = (await this.requestRepository.find({
      where: { orderNo: dto.orderNo, ...tenantWhere },
    })) ?? [];
    const activeNos = existing
      .filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED' || r.status === 'PARTIAL')
      .map((r) => r.requestNo);
    if (activeNos.length === 0) return;

    const existingItems = (await this.requestItemRepository.find({
      where: { requestId: In(activeNos), ...tenantWhere },
    })) ?? [];
    const activeItemCodes = new Set(existingItems.map((i) => i.itemCode));
    const conflicts = [...new Set(dto.items.map((i) => i.itemCode).filter((code) => activeItemCodes.has(code)))];
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `이미 진행 중인 출고요청이 있는 품목입니다(작업지시 ${dto.orderNo}): ${conflicts.join(', ')}`,
      );
    }
  }

  /** 출고요청 생성 (헤더 + 품목 일괄 저장) */
  async create(dto: CreateIssueRequestDto, company?: string, plant?: string) {
    await this.assertNoDuplicateActiveRequest(dto, company, plant);
    const requestNo = await this.tx.run(async (queryRunner) => {
      const requestNo = await this.generateRequestNo(queryRunner);
      const request = queryRunner.manager.create(MatIssueRequest, {
        requestNo,
        orderNo: dto.orderNo ?? null,
        processCode: dto.processCode ?? null,
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

    if (trimmedSearch) {
      const searchValue = `%${trimmedSearch.toUpperCase()}%`;
      const qb = this.requestRepository.createQueryBuilder('req');
      if (status === ISSUE_REQUEST_PENDING_FILTER) qb.andWhere('req.status IN (:...pendingStatuses)', { pendingStatuses });
      else if (status) qb.andWhere('req.status = :status', { status });
      if (dateFrom) qb.andWhere('req.requestDate >= :dateFrom', { dateFrom });
      if (dateTo) qb.andWhere('req.requestDate <= :dateTo', { dateTo });
      if (orderNo) qb.andWhere('req.orderNo = :orderNo', { orderNo });
      if (issueType) qb.andWhere('req.issueType = :issueType', { issueType });
      if (company) qb.andWhere('req.company = :company', { company });
      if (plant) qb.andWhere('req.plant = :plant', { plant });
      qb.andWhere(`
        (
          UPPER(req.requestNo) LIKE :search
          OR UPPER(COALESCE(req.requester, '')) LIKE :search
          OR UPPER(COALESCE(req.orderNo, '')) LIKE :search
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
      `, { search: searchValue });

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
        };
      });
      return {
        ...req,
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
    const flatItems = await this.flattenItems(items, request.company, request.plant);
    // 출고 시 실제 적용될 공정(요청 공정 → 작업지시 공정 → 라우팅 첫 공정) — 출고 모달 기본값
    const issueProcessCode = await this.resolveIssueProcessCode(request, request.company, request.plant);
    return { ...request, items: flatItems, issueProcessCode };
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

      const issueResult = await this.matIssueService.createInTx(queryRunner, {
        orderNo: request.orderNo ?? undefined,
        processCode: processCode ?? undefined,
        warehouseCode: dto.warehouseCode,
        issueType,
        items: dto.items.map((i) => ({ matUid: i.matUid, issueQty: i.issueQty })),
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
