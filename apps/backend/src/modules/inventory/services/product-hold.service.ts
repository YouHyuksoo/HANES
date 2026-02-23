/**
 * @file src/modules/inventory/services/product-hold.service.ts
 * @description 제품 재고 홀드 비즈니스 로직 - PRODUCT_STOCKS 상태를 HOLD/NORMAL로 변경
 *
 * 초보자 가이드:
 * - 제품 재고(WIP/FG)를 홀드하면 출하 불가
 * - 자재 홀드는 LOT 기반(MatLot.status), 제품 홀드는 재고 기반(ProductStock.status)
 * - API: GET /inventory/product-hold, POST /inventory/product-hold/hold, POST /inventory/product-hold/release
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ProductHoldActionDto, ProductReleaseHoldDto, ProductHoldQueryDto } from '../dto/product-hold.dto';

@Injectable()
export class ProductHoldService {
  constructor(
    @InjectRepository(ProductStock)
    private readonly productStockRepository: Repository<ProductStock>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: ProductHoldQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, status, partType } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (status) where.status = status;
    if (partType) where.partType = partType;
    if (search) where.partId = Like(`%${search}%`);

    const [data, total] = await Promise.all([
      this.productStockRepository.find({
        where,
        skip,
        take: limit,
        order: { updatedAt: 'DESC' },
      }),
      this.productStockRepository.count({ where }),
    ]);

    /* part 정보 조인 */
    const partIds = [...new Set(data.map((s) => s.partId).filter(Boolean))];
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    const flatData = data.map((stock) => {
      const part = partMap.get(stock.partId);
      return {
        ...stock,
        partCode: part?.partCode ?? null,
        partName: part?.partName ?? null,
        unit: part?.unit ?? null,
      };
    });

    return { data: flatData, total, page, limit };
  }

  async hold(dto: ProductHoldActionDto) {
    const { stockId, reason } = dto;

    const stock = await this.productStockRepository.findOne({ where: { id: stockId } });
    if (!stock) throw new NotFoundException(`제품 재고를 찾을 수 없습니다: ${stockId}`);
    if (stock.status === 'HOLD') throw new BadRequestException('이미 HOLD 상태입니다.');
    if (stock.qty <= 0) throw new BadRequestException('수량이 0인 재고는 HOLD할 수 없습니다.');

    await this.productStockRepository.update(stockId, {
      status: 'HOLD',
      holdReason: reason,
      holdAt: new Date(),
    });

    const updated = await this.productStockRepository.findOne({ where: { id: stockId } });
    const part = await this.partMasterRepository.findOne({ where: { id: updated!.partId } });

    return {
      id: stockId,
      status: 'HOLD',
      partCode: part?.partCode,
      partName: part?.partName,
      qty: updated!.qty,
      reason,
    };
  }

  async release(dto: ProductReleaseHoldDto) {
    const { stockId, reason } = dto;

    const stock = await this.productStockRepository.findOne({ where: { id: stockId } });
    if (!stock) throw new NotFoundException(`제품 재고를 찾을 수 없습니다: ${stockId}`);
    if (stock.status !== 'HOLD') throw new BadRequestException('HOLD 상태가 아닙니다.');

    await this.productStockRepository.update(stockId, {
      status: 'NORMAL',
      holdReason: null,
      holdAt: null,
    });

    const updated = await this.productStockRepository.findOne({ where: { id: stockId } });
    const part = await this.partMasterRepository.findOne({ where: { id: updated!.partId } });

    return {
      id: stockId,
      status: 'NORMAL',
      partCode: part?.partCode,
      partName: part?.partName,
      qty: updated!.qty,
      reason,
    };
  }
}
