/**
 * @file consumable-stock.controller.ts
 * @description 소모품 개별 인스턴스(ConsumableStock) 조회 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /consumables/stocks           인스턴스 목록 (conUid별)
 * 2. GET /consumables/stocks/:conUid   특정 인스턴스 상세
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsumableStock } from '../../../entities/consumable-stock.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';

@Controller('consumables/stocks')
export class ConsumableStockController {
  constructor(
    @InjectRepository(ConsumableStock)
    private readonly stockRepo: Repository<ConsumableStock>,
    @InjectRepository(ConsumableMaster)
    private readonly masterRepo: Repository<ConsumableMaster>,
  ) {}

  /** 개별 인스턴스 목록 */
  @Get()
  async list(
    @Query('consumableCode') consumableCode?: string,
    @Query('status') status?: string,
  ) {
    const qb = this.stockRepo.createQueryBuilder('s');
    if (consumableCode) qb.andWhere('s.consumableCode = :consumableCode', { consumableCode });
    if (status) qb.andWhere('s.status = :status', { status });
    qb.orderBy('s.createdAt', 'DESC');

    const stocks = await qb.getMany();
    const masters = await this.masterRepo.find();
    const masterMap = new Map(masters.map((m) => [m.consumableCode, m]));

    const data = stocks.map((s) => {
      const master = masterMap.get(s.consumableCode);
      return {
        ...s,
        consumableName: master?.consumableName ?? '',
        category: master?.category ?? '',
        expectedLife: master?.expectedLife ?? null,
      };
    });

    return { data };
  }

  /** 특정 인스턴스 상세 */
  @Get(':conUid')
  async detail(@Param('conUid') conUid: string) {
    const stock = await this.stockRepo.findOne({ where: { conUid } });
    if (!stock) return { data: null };

    const master = await this.masterRepo.findOne({
      where: { consumableCode: stock.consumableCode },
    });

    return {
      data: {
        ...stock,
        consumableName: master?.consumableName ?? '',
        category: master?.category ?? '',
        expectedLife: master?.expectedLife ?? null,
      },
    };
  }
}
