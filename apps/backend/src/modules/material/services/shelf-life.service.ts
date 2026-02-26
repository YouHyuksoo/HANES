/**
 * @file src/modules/material/services/shelf-life.service.ts
 * @description 유수명자재 조회 서비스 - 유효기한이 있는 LOT의 만료 현황 (TypeORM)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, In } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ShelfLifeQueryDto } from '../dto/shelf-life.dto';

@Injectable()
export class ShelfLifeService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: ShelfLifeQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, expiryStatus, nearExpiryDays = 30 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
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
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(today.getDate() + nearExpiryDays);
    nearExpiryDate.setHours(0, 0, 0, 0);

    // 만료 상태 계산
    let result = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const expireDate = lot.expireDate ? new Date(lot.expireDate) : null;
      let status: 'EXPIRED' | 'NEAR_EXPIRY' | 'VALID' = 'VALID';
      let daysUntilExpiry: number | null = null;

      if (expireDate) {
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
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
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
          item.itemName.toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }
}

