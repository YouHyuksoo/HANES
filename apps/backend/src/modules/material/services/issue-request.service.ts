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
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatIssueService } from './mat-issue.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
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
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(BomMaster)
    private readonly bomRepository: Repository<BomMaster>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    private readonly matIssueService: MatIssueService,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
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

  private isRawMaterial(part?: PartMaster): boolean {
    if (!part?.itemType) return true;
    const itemType = part.itemType.toUpperCase();
    const productTypes = new Set(['FG', 'FERT', 'PRODUCT', 'FINISHED', 'WIP', 'SEMI', 'SEMI_PRODUCT', 'HALB']);
    return !productTypes.has(itemType);
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

  private async getAvailableStockQtyMap(itemCodes: string[], company?: string | null, plant?: string | null) {
    if (itemCodes.length === 0) return new Map<string, number>();

    const qb = this.matStockRepository.createQueryBuilder('s')
      .select('s.itemCode', 'itemCode')
      .addSelect('SUM(s.availableQty)', 'qty')
      .where('s.itemCode IN (:...itemCodes)', { itemCodes });

    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });

    const rows = await qb.groupBy('s.itemCode').getRawMany<{ itemCode: string; qty: string | number }>();
    return new Map(rows.map((row) => [row.itemCode, this.toNumber(row.qty)]));
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

  /** 품목 목록에 itemCode/itemName 평탄화 */
  private async flattenItems(items: MatIssueRequestItem[], company?: string | null, plant?: string | null) {
    const itemCodes = items.map((i) => i.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } }) : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return items.map((item) => {
      const part = partMap.get(item.itemCode);
      return {
        ...item,
        itemCode: item.itemCode,
        itemName: part?.itemName ?? null,
        unit: item.unit ?? part?.unit ?? null,
      };
    });
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
    const bomRows = await this.bomRepository.find({
      where: {
        parentItemCode: jobOrder.itemCode,
        useYn: 'Y',
        ...this.tenantWhere(effectiveCompany, effectivePlant),
      },
      order: { seq: 'ASC' },
    });
    if (bomRows.length === 0) return [];

    const childCodes = [...new Set(bomRows.map((bom) => bom.childItemCode).filter(Boolean))];
    const parts = childCodes.length > 0
      ? await this.partMasterRepository.find({
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
        return {
          itemCode: bom.childItemCode,
          itemName: part?.itemName ?? bom.childItemCode,
          unit: part?.unit ?? 'EA',
          currentStock: availableStockMap.get(bom.childItemCode) ?? 0,
          requestQty,
          bomReqQty,
          prevIssueQty,
          floorStockQty,
        };
      })
      .filter((item) => item.requestQty > 0);
  }

  /** 출고요청 생성 (헤더 + 품목 일괄 저장) */
  async create(dto: CreateIssueRequestDto, company?: string, plant?: string) {
    const requestNo = await this.tx.run(async (queryRunner) => {
      const requestNo = await this.generateRequestNo(queryRunner);
      const request = queryRunner.manager.create(MatIssueRequest, {
        requestNo,
        orderNo: dto.orderNo ?? null,
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

    return this.findByRequestNo(requestNo, company, plant);
  }

  /** 출고요청 목록 조회 (페이지네이션 + 필터) */
  async findAll(query: IssueRequestQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, status, search, orderNo } = query;
    const where: FindOptionsWhere<MatIssueRequest> = { ...(status && { status }), ...(orderNo && { orderNo }), ...(company && { company }), ...(plant && { plant }) };

    const [data, total] = await Promise.all([
      this.requestRepository.find({
        where, skip: (page - 1) * limit, take: limit, order: { requestDate: 'DESC' },
      }),
      this.requestRepository.count({ where }),
    ]);

    // IN 배치 선조회로 N+1 제거 (요청별 아이템 개별 조회 → 일괄 조회)
    const requestNos = data.map((r) => r.requestNo);
    const tenantWhere = this.tenantWhere(company, plant);
    const allItems = requestNos.length > 0
      ? await this.requestItemRepository.find({ where: { requestId: In(requestNos), ...tenantWhere } })
      : [];

    // 품목 정보 일괄 조회
    const allItemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))];
    const allParts = allItemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(allItemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(allParts.map((p) => [p.itemCode, p]));

    // 요청별 아이템 그룹화
    const itemsByRequest = new Map<string, MatIssueRequestItem[]>();
    for (const item of allItems) {
      const list = itemsByRequest.get(item.requestId) ?? [];
      list.push(item);
      itemsByRequest.set(item.requestId, list);
    }

    let result = data.map((req) => {
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

    if (search) {
      const upper = search.toUpperCase();
      result = result.filter(
        (r) => r.requestNo?.toUpperCase().includes(upper) || r.requester?.toUpperCase().includes(upper),
      );
    }
    return { data: result, total, page, limit };
  }

  /** 출고요청 상세 조회 (헤더 + 품목) */
  async findByRequestNo(requestNo: string, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    const requestTenantWhere = this.tenantWhere(request.company, request.plant);
    const items = await this.requestItemRepository.find({ where: { requestId: requestNo, ...requestTenantWhere } });
    const flatItems = await this.flattenItems(items, request.company, request.plant);
    return { ...request, items: flatItems };
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
    await this.requestRepository.update({ requestNo, ...requestTenantWhere }, { status: 'APPROVED', approvedAt: new Date() });
    return this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined);
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
   * - APPROVED 상태만 출고 가능
   * - MatIssueService.create()로 실제 출고 수행
   * - 모든 품목 완전 출고 시 COMPLETED 처리
   */
  async issueFromRequest(requestNo: string, dto: RequestIssueDto, company?: string, plant?: string) {
    const request = await this.getRequestOrFail(requestNo, company, plant);
    if (request.status !== 'APPROVED') {
      throw new BadRequestException(`출고할 수 없는 상태입니다 (APPROVED만 가능): ${request.status}`);
    }
    const effectiveCompany = request.company ?? company;
    const effectivePlant = request.plant ?? plant;
    const requestTenantWhere = this.tenantWhere(effectiveCompany, effectivePlant);

    return this.tx.run(async (queryRunner) => {
      const issueResult = await this.matIssueService.createInTx(queryRunner, {
        orderNo: request.orderNo ?? undefined,
        warehouseCode: dto.warehouseCode,
        issueType: dto.issueType ?? request.issueType ?? 'PRODUCTION',
        items: dto.items.map((i) => ({ matUid: i.matUid, issueQty: i.issueQty })),
        workerId: dto.workerId,
        remark: dto.remark ?? `출고요청 ${request.requestNo} 기반 출고`,
      }, effectiveCompany ?? undefined, effectivePlant ?? undefined);

      // 각 요청 품목의 issuedQty 갱신
      for (const dtoItem of dto.items) {
        // requestItemId는 seq 번호
        const reqItemSeq = Number(dtoItem.requestItemId);
        const reqItem = await this.requestItemRepository.findOne({
          where: { requestId: requestNo, seq: reqItemSeq, ...requestTenantWhere },
        });
        if (!reqItem) {
          throw new BadRequestException(`출고요청 항목을 찾을 수 없습니다: ${dtoItem.requestItemId}`);
        }
        const remainingQty = reqItem.requestQty - reqItem.issuedQty;
        if (dtoItem.issueQty > remainingQty) {
          throw new BadRequestException(
            `요청 수량을 초과해 출고할 수 없습니다. 항목 ${reqItemSeq}, 잔여: ${remainingQty}, 요청: ${dtoItem.issueQty}`,
          );
        }
        if (reqItem) {
          await queryRunner.manager.update(MatIssueRequestItem, { requestId: reqItem.requestId, seq: reqItem.seq, ...requestTenantWhere }, {
            issuedQty: reqItem.issuedQty + dtoItem.issueQty,
          });
        }
      }

      // 모든 품목 완전 출고 여부 확인
      const allItems = await this.requestItemRepository.find({ where: { requestId: requestNo, ...requestTenantWhere } });
      const allCompleted = allItems.every((item) => {
        const addedQty = dto.items
          .filter((d) => Number(d.requestItemId) === item.seq)
          .reduce((sum, d) => sum + d.issueQty, 0);
        return (item.issuedQty + addedQty) >= item.requestQty;
      });

      if (allCompleted) {
        await queryRunner.manager.update(MatIssueRequest, { requestNo, ...requestTenantWhere }, { status: 'COMPLETED' });
      }

      return { request: await this.findByRequestNo(requestNo, effectiveCompany ?? undefined, effectivePlant ?? undefined), issueResult };
    });
  }
}
