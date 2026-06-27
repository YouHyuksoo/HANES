/**
 * @file src/modules/material/services/hold.service.ts
 * @description 재고홀드 비즈니스 로직 - LOT 상태를 HOLD로 변경/해제 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, FindOptionsWhere } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { HoldActionDto, ReleaseHoldDto, HoldQueryDto } from '../dto/hold.dto';

@Injectable()
export class HoldService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  async findAll(query: HoldQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<MatLot> = this.tenantWhere(company, plant);

    if (status) {
      where.status = status;
    }

    // 검색어로 LOT 번호 또는 품목 코드 검색
    if (search) {
      // 먼저 품목 검색
      const parts = await this.itemMasterRepository.find({
        where: [
          { itemCode: Like(`%${search}%`), ...this.tenantWhere(company, plant) },
          { itemName: Like(`%${search}%`), ...this.tenantWhere(company, plant) },
        ],
      });
      const itemCodes = parts.map((p) => p.itemCode);

      where.matUid = Like(`%${search}%`);
      if (itemCodes.length > 0) {
        // itemCode 조건 추가 (OR 조건을 위해 별도 처리 필요)
      }
    }

    const [data, total] = await Promise.all([
      this.matLotRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.matLotRepository.count({ where }),
    ]);

    // part 정보 조회 및 중첩 객체 평면화
    const itemCodes = data.map((lot) => lot.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 재고 정보 조회
    const matUids = data.map((lot) => lot.matUid);
    const stocks = matUids.length > 0
      ? await this.matStockRepository.find({ where: { matUid: In(matUids), ...this.tenantWhere(company, plant) } })
      : [];
    const stockMap = new Map(stocks.map((s) => [s.matUid, s]));

    // 공급사명 조회 (MAT_LOTS.VENDOR = PARTNER_MASTERS.PARTNER_CODE), 스코프 포함, IN 절 일괄
    const vendorCodes = Array.from(
      new Set(data.map((lot) => lot.vendor).filter((v): v is string => Boolean(v))),
    );
    const partners = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({
          where: { partnerCode: In(vendorCodes), ...this.tenantWhere(company, plant) },
        })
      : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const stock = stockMap.get(lot.matUid);
      return {
        ...lot,
        itemCode: lot.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        warehouseCode: stock?.warehouseCode ?? null,
        vendorName: lot.vendor ? (partnerMap.get(lot.vendor) ?? lot.vendor) : null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async hold(dto: HoldActionDto, company?: string, plant?: string) {
    const { matUid, reason } = dto;

    const lot = await this.matLotRepository.findOne({
      where: { matUid: matUid, ...this.tenantWhere(company, plant) },
    });

    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
    }

    if (lot.status === 'HOLD') {
      throw new BadRequestException('이미 HOLD 상태인 LOT입니다.');
    }

    if (lot.status === 'DEPLETED') {
      throw new BadRequestException('소진된 LOT은 HOLD할 수 없습니다.');
    }

    // HOLD 상태로 변경
    await this.matLotRepository.update({ matUid, ...this.tenantWhere(company, plant) }, {
      status: 'HOLD',
    });

    const updatedLot = await this.matLotRepository.findOne({ where: { matUid: matUid, ...this.tenantWhere(company, plant) } });
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: updatedLot!.itemCode, ...this.tenantWhere(company, plant) },
    });

    return {
      id: matUid,
      status: 'HOLD',
      matUid: updatedLot?.matUid,
      itemCode: updatedLot?.itemCode,
      itemName: part?.itemName ?? null,
      reason,
    };
  }

  async release(dto: ReleaseHoldDto, company?: string, plant?: string) {
    const { matUid, reason } = dto;

    const lot = await this.matLotRepository.findOne({
      where: { matUid: matUid, ...this.tenantWhere(company, plant) },
    });

    if (!lot) {
      throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
    }

    if (lot.status !== 'HOLD') {
      throw new BadRequestException('HOLD 상태가 아닌 LOT입니다.');
    }

    // NORMAL 상태로 변경
    await this.matLotRepository.update({ matUid, ...this.tenantWhere(company, plant) }, {
      status: 'NORMAL',
    });

    const updatedLot = await this.matLotRepository.findOne({ where: { matUid: matUid, ...this.tenantWhere(company, plant) } });
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: updatedLot!.itemCode, ...this.tenantWhere(company, plant) },
    });

    return {
      id: matUid,
      status: 'NORMAL',
      matUid: updatedLot?.matUid,
      itemCode: updatedLot?.itemCode,
      itemName: part?.itemName ?? null,
      reason,
    };
  }
}
