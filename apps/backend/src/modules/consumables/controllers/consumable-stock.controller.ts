/**
 * @file consumable-stock.controller.ts
 * @description 소모품 개별 인스턴스(ConsumableStock) 조회 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /consumables/stocks           인스턴스 목록 (conUid별)
 *    - 필터: consumableCode / status / category / search(UID·코드·이름)
 * 2. GET /consumables/stocks/:conUid   특정 인스턴스 상세
 */
import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
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
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const qb = this.stockRepo.createQueryBuilder('s');
    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plantCd = :plant', { plant });
    if (consumableCode) qb.andWhere('s.consumableCode = :consumableCode', { consumableCode });
    if (status) qb.andWhere('s.status = :status', { status });
    qb.orderBy('s.createdAt', 'DESC');

    const stocks = await qb.getMany();
    const masters = await this.masterRepo.find({
      where: {
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });
    const masterMap = new Map(masters.map((m) => [m.consumableCode, m]));

    let data = stocks.map((s) => {
      const master = masterMap.get(s.consumableCode);
      return {
        ...s,
        consumableName: master?.consumableName ?? '',
        category: master?.category ?? '',
        expectedLife: master?.expectedLife ?? null,
        warningCount: master?.warningCount ?? null,
      };
    });

    // 마스터 조인 후에만 판단 가능한 조건(분류/이름 검색)은 여기서 거른다
    if (category) {
      data = data.filter((row) => row.category === category);
    }
    if (search) {
      const keyword = search.trim().toLowerCase();
      data = data.filter(
        (row) =>
          row.conUid?.toLowerCase().includes(keyword) ||
          row.consumableCode?.toLowerCase().includes(keyword) ||
          row.consumableName?.toLowerCase().includes(keyword),
      );
    }

    // 전역 TransformInterceptor 가 { success, data } 봉투를 씌운다.
    // 여기서 한 번 더 { data } 로 감싸면 클라이언트의 res.data.data 가 배열이 아닌 객체가 된다.
    return data;
  }

  /** 특정 인스턴스 상세 */
  @Get(':conUid')
  async detail(
    @Param('conUid') conUid: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const stock = await this.stockRepo.findOne({
      where: {
        conUid,
        ...(company && { company }),
        ...(plant && { plantCd: plant }),
      },
    });
    if (!stock) throw new NotFoundException(`소모품 인스턴스를 찾을 수 없습니다: ${conUid}`);

    const master = await this.masterRepo.findOne({
      where: {
        consumableCode: stock.consumableCode,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });

    return {
      ...stock,
      consumableName: master?.consumableName ?? '',
      category: master?.category ?? '',
      expectedLife: master?.expectedLife ?? null,
      warningCount: master?.warningCount ?? null,
    };
  }
}
