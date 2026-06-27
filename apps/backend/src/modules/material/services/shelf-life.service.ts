/**
 * @file src/modules/material/services/shelf-life.service.ts
 * @description 유수명자재 조회 서비스 - 유효기한이 있는 LOT의 만료 현황 (TypeORM)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, In, FindOptionsWhere } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { ShelfLifeQueryDto } from '../dto/shelf-life.dto';

@Injectable()
export class ShelfLifeService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
  ) {}

  async findAll(query: ShelfLifeQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, expiryStatus, nearExpiryDays = 10 } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<MatLot> = {
      // 유효기한이 있는 LOT만 조회
      expireDate: Raw((alias) => `${alias} IS NOT NULL`),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    const [data, total] = await Promise.all([
      this.matLotRepository.find({
        where,
        skip,
        take: limit,
        order: { expireDate: 'ASC' },
      }),
      this.matLotRepository.count({ where }),
    ]);

    // part 정보 조회
    const itemCodes = data.map((lot) => lot.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({
        where: { itemCode: In(itemCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // vendor(공급사) 코드 → 업체명 매핑 (IN 절 일괄 조회, company/plant 스코프)
    const vendorCodes = Array.from(
      new Set(data.map((lot) => lot.vendor).filter((v): v is string => Boolean(v))),
    );
    const partners = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({
        where: { partnerCode: In(vendorCodes), ...(company && { company }), ...(plant && { plant }) },
      })
      : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(today.getDate() + nearExpiryDays);
    nearExpiryDate.setHours(0, 0, 0, 0);

    // 만료 상태 계산
    let result = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const expireDate = lot.expireDate ? new Date(lot.expireDate) : null;
      let status: 'EXPIRED' | 'NEAR_EXPIRY' | 'VALID' | 'DISCARDED' = 'VALID';
      let daysUntilExpiry: number | null = null;

      // 폐기 처리된 LOT는 별도 상태로 표시
      if (lot.status === 'DISCARDED') {
        status = 'DISCARDED';
      } else if (expireDate) {
        expireDate.setHours(0, 0, 0, 0);
        daysUntilExpiry = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          status = 'EXPIRED';
        } else if (daysUntilExpiry <= nearExpiryDays) {
          status = 'NEAR_EXPIRY';
        }
      }

      return {
        ...lot,
        itemCode: lot.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        vendorName: lot.vendor ? (partnerMap.get(lot.vendor) ?? lot.vendor) : null,
        expiryStatus: status,
        daysUntilExpiry,
      };
    });

    // 만료 상태 필터링
    if (expiryStatus) {
      result = result.filter((item) => item.expiryStatus === expiryStatus);
    }

    // 검색어 필터링
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.matUid?.toLowerCase().includes(searchLower) ||
          item.itemCode.toLowerCase().includes(searchLower) ||
          (item.itemName ?? '').toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }
}
