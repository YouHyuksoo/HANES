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
import { Repository, IsNull, Like, DataSource, In } from 'typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderQueryDto } from '../dto/purchase-order.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: PurchaseOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    // QueryBuilder로 DB 레벨 필터링 (메모리 필터링 제거)
    const qb = this.purchaseOrderRepository
      .createQueryBuilder('po')
      .where('po.deletedAt IS NULL');

    if (company) qb.andWhere('po.company = :company', { company });
    if (plant) qb.andWhere('po.plant = :plant', { plant });
    if (status) qb.andWhere('po.status = :status', { status });

    // 검색: poNo OR partnerName (DB 레벨 OR 조건)
    if (search) {
      qb.andWhere(
        '(LOWER(po.poNo) LIKE :search OR LOWER(po.partnerName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // 날짜 필터 (DB 레벨)
    if (fromDate) qb.andWhere('po.orderDate >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('po.orderDate <= :toDate', { toDate: new Date(toDate) });

    qb.orderBy('po.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();

    if (data.length === 0) return { data: [], total, page, limit };

    // 품목 정보 일괄 조회 (N+1 방지)
    const poIds = data.map((po) => po.id);
    const items = await this.purchaseOrderItemRepository.find({ where: { poId: In(poIds) } });

    const partIds = [...new Set(items.map((item) => item.partId).filter(Boolean))];
    const parts = partIds.length > 0 ? await this.partMasterRepository.find({ where: { id: In(partIds) } }) : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    // PO별 아이템 그룹화
    const itemsByPoId = new Map<string, typeof items>();
    for (const item of items) {
      if (!itemsByPoId.has(item.poId)) {
        itemsByPoId.set(item.poId, []);
      }
      itemsByPoId.get(item.poId)!.push(item);
    }

    const result = data.map((po) => {
      const poItems = itemsByPoId.get(po.id) || [];
      const enrichedItems = poItems.map((item) => {
        const part = partMap.get(item.partId);
        return {
          ...item,
          partCode: part?.partCode,
          partName: part?.partName,
          unit: part?.unit,
        };
      });

      return {
        ...po,
        items: enrichedItems,
      };
    });

    return { data: result, total, page, limit };
  }

  async findById(id: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${id}`);

    const items = await this.purchaseOrderItemRepository.find({
      where: { poId: id },
    });

    const partIds = items.map((item) => item.partId).filter(Boolean);
    const parts = partIds.length > 0 ? await this.partMasterRepository.find({ where: { id: In(partIds) } }) : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    return {
      ...po,
      items: items.map((item) => {
        const part = partMap.get(item.partId);
        return {
          ...item,
          partCode: part?.partCode,
          partName: part?.partName,
          unit: part?.unit,
        };
      }),
    };
  }

  async create(dto: CreatePurchaseOrderDto) {
    const existing = await this.purchaseOrderRepository.findOne({
      where: { poNo: dto.poNo, deletedAt: IsNull() },
    });
    if (existing) throw new ConflictException(`이미 존재하는 PO 번호입니다: ${dto.poNo}`);

    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + (item.orderQty * (item.unitPrice ?? 0));
    }, 0);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // PO 생성
      const po = queryRunner.manager.create(PurchaseOrder, {
        poNo: dto.poNo,
        partnerId: dto.partnerId,
        partnerName: dto.partnerName,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        remark: dto.remark,
        totalAmount,
      });
      const savedPo = await queryRunner.manager.save(po);

      // 품목 생성
      const itemEntities = dto.items.map((item) =>
        queryRunner.manager.create(PurchaseOrderItem, {
          poId: savedPo.id,
          partId: item.partId,
          orderQty: item.orderQty,
          unitPrice: item.unitPrice,
          remark: item.remark,
        }),
      );
      const savedItems = await queryRunner.manager.save(itemEntities);

      // part 정보 조회
      const partIds = savedItems.map((item: PurchaseOrderItem) => item.partId).filter(Boolean);
      const parts = partIds.length > 0 ? await this.partMasterRepository.find({ where: { id: In(partIds) } }) : [];
      const partMap = new Map(parts.map((p) => [p.id, p]));

      await queryRunner.commitTransaction();

      return {
        ...savedPo,
        items: savedItems.map((item: PurchaseOrderItem) => {
          const part = partMap.get(item.partId);
          return {
            ...item,
            partCode: part?.partCode,
            partName: part?.partName,
            unit: part?.unit,
          };
        }),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    await this.findById(id);
    const { items, ...poData } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (items) {
        // 기존 품목 삭제
        await queryRunner.manager.delete(PurchaseOrderItem, { poId: id });

        const totalAmount = items.reduce((sum, item) => sum + (item.orderQty * (item.unitPrice ?? 0)), 0);

        // PO 업데이트
        const updateData: any = {
          ...poData,
          totalAmount,
        };
        if (poData.orderDate) updateData.orderDate = new Date(poData.orderDate);
        if (poData.dueDate) updateData.dueDate = new Date(poData.dueDate);

        await queryRunner.manager.update(PurchaseOrder, id, updateData);

        // 새 품목 생성
        const itemEntities = items.map((item) =>
          queryRunner.manager.create(PurchaseOrderItem, {
            poId: id,
            partId: item.partId,
            orderQty: item.orderQty,
            unitPrice: item.unitPrice,
            remark: item.remark,
          }),
        );
        await queryRunner.manager.save(itemEntities);
      } else {
        const updateData: any = { ...poData };
        if (poData.orderDate) updateData.orderDate = new Date(poData.orderDate);
        if (poData.dueDate) updateData.dueDate = new Date(poData.dueDate);

        await queryRunner.manager.update(PurchaseOrder, id, updateData);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.findById(id);
  }

  /** PO 확정 (DRAFT -> CONFIRMED) */
  async confirm(id: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${id}`);
    if (po.status !== 'DRAFT') {
      throw new BadRequestException(`DRAFT 상태의 PO만 확정할 수 있습니다. 현재 상태: ${po.status}`);
    }

    await this.purchaseOrderRepository.update(id, { status: 'CONFIRMED' });
    return this.findById(id);
  }

  /** PO 마감 (RECEIVED -> CLOSED) */
  async close(id: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${id}`);
    if (!['RECEIVED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException(`마감 가능한 상태가 아닙니다. 현재 상태: ${po.status}`);
    }

    await this.purchaseOrderRepository.update(id, { status: 'CLOSED' });
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.purchaseOrderRepository.update(id, { deletedAt: new Date() });
    return { id, deletedAt: new Date() };
  }
}


