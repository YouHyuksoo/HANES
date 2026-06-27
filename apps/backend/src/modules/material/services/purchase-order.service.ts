/**
 * @file src/modules/material/services/purchase-order.service.ts
 * @description 구매발주(PO) 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **PO 생성**: 품목 목록과 함께 PO 생성 (트랜잭션 처리)
 * 2. **PO 확정**: DRAFT -> CONFIRMED 상태 변경
 * 3. **금액 계산**: 품목별 수량 x 단가 합산
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderQueryDto } from '../dto/purchase-order.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(MatArrival)
    private readonly matArrivalRepository: Repository<MatArrival>,
    @InjectRepository(PartnerMaster)
    private readonly partnerRepository: Repository<PartnerMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  async nextPoNo(): Promise<string> {
    return this.numbering.nextPoNo();
  }

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private withClientId(po: PurchaseOrder) {
    return { ...po, id: po.poNo };
  }

  private buildPurchaseOrderUpdate(
    dto: Omit<UpdatePurchaseOrderDto, 'items' | 'poNo'>,
    totalAmount?: number,
  ): Partial<Pick<PurchaseOrder, 'partnerCode' | 'partnerName' | 'orderDate' | 'dueDate' | 'remark' | 'totalAmount'>> {
    return {
      ...(dto.partnerCode !== undefined ? { partnerCode: dto.partnerCode } : {}),
      ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName } : {}),
      ...(dto.orderDate !== undefined ? { orderDate: parseDateStart(dto.orderDate) } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: parseDateStart(dto.dueDate) } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(totalAmount !== undefined ? { totalAmount } : {}),
    };
  }

  async findAll(query: PurchaseOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    // QueryBuilder로 DB 레벨 필터링 (메모리 필터링 제거)
    const qb = this.purchaseOrderRepository
      .createQueryBuilder('po')

    if (company) qb.andWhere('po.company = :company', { company });
    if (plant) qb.andWhere('po.plant = :plant', { plant });
    if (status) qb.andWhere('po.status = :status', { status });

    // 검색: poNo OR partnerName (DB 레벨 OR 조건)
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(po.poNo LIKE :searchCode OR po.partnerName LIKE :searchRaw)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    // 날짜 필터 (DB 레벨)
    if (fromDate) qb.andWhere('po.orderDate >= :fromDate', { fromDate: parseDateStart(fromDate) });
    if (toDate) qb.andWhere('po.orderDate <= :toDate', { toDate: parseDateEnd(toDate) });

    qb.orderBy('po.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();

    if (data.length === 0) return { data: [], total, page, limit };

    // 품목 정보 일괄 조회 (N+1 방지)
    const poNos = data.map((po) => po.poNo);
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const items = await this.purchaseOrderItemRepository.find({ where: { poNo: In(poNos), ...tenantWhere } });

    const itemCodes = [...new Set(items.map((item) => item.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0 ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // PO별 아이템 그룹화
    const itemsByPoNo = new Map<string, typeof items>();
    for (const item of items) {
      if (!itemsByPoNo.has(item.poNo)) {
        itemsByPoNo.set(item.poNo, []);
      }
      itemsByPoNo.get(item.poNo)!.push(item);
    }

    const result = data.map((po) => {
      const poItems = itemsByPoNo.get(po.poNo) || [];
      const enrichedItems = poItems.map((item) => {
        const part = partMap.get(item.itemCode);
        return {
          ...item,
          itemCode: item.itemCode,
          itemName: part?.itemName ?? null,
          spec: part?.spec ?? null,
          unit: part?.unit ?? null,
        };
      });

      return {
        ...this.withClientId(po),
        items: enrichedItems,
      };
    });

    return { data: result, total, page, limit };
  }

  async findById(poNo: string, company?: string, plant?: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poNo}`);

    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const items = await this.purchaseOrderItemRepository.find({
      where: { poNo, ...tenantWhere },
    });

    const itemCodes = items.map((item) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0 ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return {
      ...this.withClientId(po),
      items: items.map((item) => {
        const part = partMap.get(item.itemCode);
        return {
          ...item,
          itemCode: item.itemCode,
          itemName: part?.itemName ?? null,
          spec: part?.spec ?? null,
          unit: part?.unit ?? null,
        };
      }),
    };
  }

  private async resolvePartnerName(partnerCode?: string, fallback?: string): Promise<string | null> {
    if (!partnerCode) return fallback ?? null;
    if (fallback) return fallback;
    const partner = await this.partnerRepository.findOne({ where: { partnerCode }, select: ['partnerName'] });
    return partner?.partnerName ?? null;
  }

  async create(dto: CreatePurchaseOrderDto, company?: string, plant?: string) {
    const existing = await this.purchaseOrderRepository.findOne({
      where: { poNo: dto.poNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (existing) throw new ConflictException(`이미 존재하는 PO 번호입니다: ${dto.poNo}`);

    const resolvedPartnerName = await this.resolvePartnerName(dto.partnerCode, dto.partnerName);
    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + (item.orderQty * (item.unitPrice ?? 0));
    }, 0);

    return this.tx.run(async (queryRunner) => {
      // PO 생성
      const po = queryRunner.manager.create(PurchaseOrder, {
        poNo: dto.poNo,
        partnerCode: dto.partnerCode,
        partnerName: resolvedPartnerName,
        orderDate: dto.orderDate ? parseDateStart(dto.orderDate) : new Date(),
        dueDate: dto.dueDate ? parseDateStart(dto.dueDate) : null,
        remark: dto.remark,
        totalAmount,
        company: company ?? null,
        plant: plant ?? null,
      });
      const savedPo = await queryRunner.manager.save(po);

      // 품목 생성
      const itemEntities = dto.items.map((item, idx) =>
        queryRunner.manager.create(PurchaseOrderItem, {
          poNo: savedPo.poNo,
          seq: idx + 1,
          itemCode: item.itemCode,
          orderQty: item.orderQty,
          lineNo: item.lineNo ?? (idx + 1),
          revNo: item.revNo ?? 1,
          unitPrice: item.unitPrice ?? null,
          remark: item.remark,
          company: company ?? null,
          plant: plant ?? null,
        }),
      );
      const savedItems = await queryRunner.manager.save(itemEntities);

      // part 정보 조회
      const itemCodes = savedItems.map((item: PurchaseOrderItem) => item.itemCode).filter(Boolean);
      const tenantWhere = {
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      };
      const parts = itemCodes.length > 0 ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : [];
      const partMap = new Map(parts.map((p) => [p.itemCode, p]));

      return {
        ...savedPo,
        items: savedItems.map((item: PurchaseOrderItem) => {
          const part = partMap.get(item.itemCode);
          return {
            ...item,
            itemCode: item.itemCode,
            itemName: part?.itemName ?? null,
            spec: part?.spec ?? null,
            unit: part?.unit ?? null,
          };
        }),
      };
    });
  }

  async update(poNo: string, dto: UpdatePurchaseOrderDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    await this.findById(poNo, company, plant);
    const { items, poNo: _ignoredPoNo, ...poData } = dto;

    const resolvedPartnerName = await this.resolvePartnerName(dto.partnerCode, dto.partnerName);

    await this.tx.run(async (queryRunner) => {
      if (items) {
        // 기존 품목 삭제
        await queryRunner.manager.delete(PurchaseOrderItem, { poNo, ...tenantWhere });

        const totalAmount = items.reduce((sum, item) => sum + (item.orderQty * (item.unitPrice ?? 0)), 0);

        // PO 업데이트
        const updateData = { ...this.buildPurchaseOrderUpdate(poData, totalAmount), ...(resolvedPartnerName !== null ? { partnerName: resolvedPartnerName } : {}) };

        await queryRunner.manager.update(PurchaseOrder, { poNo, ...tenantWhere }, updateData);

        // 새 품목 생성
        const itemEntities = items.map((item, idx) =>
          queryRunner.manager.create(PurchaseOrderItem, {
            poNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            lineNo: item.lineNo ?? (idx + 1),
            revNo: item.revNo ?? 1,
            unitPrice: item.unitPrice ?? null,
            remark: item.remark,
            company: company ?? null,
            plant: plant ?? null,
          }),
        );
        await queryRunner.manager.save(itemEntities);
      } else {
        const updateData = { ...this.buildPurchaseOrderUpdate(poData), ...(resolvedPartnerName !== null ? { partnerName: resolvedPartnerName } : {}) };
        if (Object.keys(updateData).length > 0) {
          await queryRunner.manager.update(PurchaseOrder, { poNo, ...tenantWhere }, updateData);
        }
      }
    });

    return this.findById(poNo, company, plant);
  }

  /** PO 확정 (DRAFT -> CONFIRMED) */
  async confirm(poNo: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo, ...tenantWhere },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poNo}`);
    if (po.status !== 'DRAFT') {
      throw new BadRequestException(`DRAFT 상태의 PO만 확정할 수 있습니다. 현재 상태: ${po.status}`);
    }

    await this.purchaseOrderRepository.update({ poNo, ...tenantWhere }, { status: 'CONFIRMED' });
    return this.findById(poNo, company, plant);
  }

  /** PO 마감 (RECEIVED -> CLOSED) */
  async close(poNo: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo, ...tenantWhere },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poNo}`);
    if (!['RECEIVED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException(`마감 가능한 상태가 아닙니다. 현재 상태: ${po.status}`);
    }

    await this.purchaseOrderRepository.update({ poNo, ...tenantWhere }, { status: 'CLOSED' });
    return this.findById(poNo, company, plant);
  }

  async delete(poNo: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const po = await this.findById(poNo, company, plant);
    if (po.status !== 'DRAFT') {
      throw new BadRequestException(
        `구매오더는 DRAFT 상태에서만 삭제할 수 있습니다. 현재 상태: ${po.status}`,
      );
    }

    const arrivals = await this.matArrivalRepository.find({
      where: { poNo, ...tenantWhere },
    });
    if (arrivals.length > 0) {
      throw new BadRequestException(
        '이미 입하가 진행된 구매오더는 직접 삭제할 수 없습니다. 입하부터 먼저 정리해 주세요.',
      );
    }

    await this.purchaseOrderRepository.delete({ poNo, ...tenantWhere });
    return { poNo };
  }
}

