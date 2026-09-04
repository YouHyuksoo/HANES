/**
 * @file src/modules/material/services/shelf-life.service.ts
 * @description 유수명자재 조회 서비스 - 유효기한이 있는 LOT의 만료 현황 (TypeORM)
 *
 * 조회 원칙(조건 없는 전량 조회 금지):
 * - 상태/검색/품목/잔량 조건은 전부 DB WHERE로 처리한다. 페이지를 자른 뒤 메모리에서 거르지 않는다.
 * - expiryStatus 생략 시 관리 대상(만료됨 + 만료임박, 폐기 제외)만 조회한다.
 * - hasStockYn 기본 'Y' → CURRENT_QTY > 0 인 LOT만 조회한다.
 *
 * 만료 상태 판정 기준(DB 조건과 응답 expiryStatus 계산이 같은 경계를 쓴다):
 * - EXPIRED     : EXPIRE_DATE <  오늘(00:00)
 * - NEAR_EXPIRY : 오늘 <= EXPIRE_DATE <= 오늘 + nearExpiryDays
 * - VALID       : EXPIRE_DATE >  오늘 + nearExpiryDays
 * - DISCARDED   : MAT_LOTS.STATUS = 'DISCARDED' (만료일과 무관)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { ShelfLifeQueryDto, ShelfLifeExpiryStatus } from '../dto/shelf-life.dto';

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

  /** 오늘(로컬 00:00)과 만료임박 경계일(오늘 + nearExpiryDays, 00:00) */
  private expiryBoundaries(nearExpiryDays: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nearExpiryDate = new Date(today);
    nearExpiryDate.setDate(today.getDate() + nearExpiryDays);
    nearExpiryDate.setHours(0, 0, 0, 0);
    return { today, nearExpiryDate };
  }

  /** 만료 상태를 DB 조건으로 붙인다. 생략 시 관리 대상(EXPIRED + NEAR_EXPIRY). */
  private applyExpiryStatusWhere(
    qb: SelectQueryBuilder<MatLot>,
    expiryStatus: ShelfLifeExpiryStatus | undefined,
    today: Date,
    nearExpiryDate: Date,
  ) {
    if (expiryStatus === 'DISCARDED') {
      qb.andWhere(`lot.status = 'DISCARDED'`);
      return;
    }
    qb.andWhere(`lot.status <> 'DISCARDED'`);
    switch (expiryStatus) {
      case 'EXPIRED':
        qb.andWhere('lot.expireDate < :today', { today });
        break;
      case 'NEAR_EXPIRY':
        qb.andWhere('lot.expireDate >= :today AND lot.expireDate <= :nearExpiryDate', { today, nearExpiryDate });
        break;
      case 'VALID':
        qb.andWhere('lot.expireDate > :nearExpiryDate', { nearExpiryDate });
        break;
      default:
        // 관리 대상: 만료됨 + 만료임박
        qb.andWhere('lot.expireDate <= :nearExpiryDate', { nearExpiryDate });
    }
  }

  async findAll(query: ShelfLifeQueryDto, company?: string, plant?: string) {
    const {
      page = 1, limit = 50, search, itemCode, expiryStatus, hasStockYn = 'Y', nearExpiryDays = 10,
    } = query;
    const skip = (page - 1) * limit;
    const { today, nearExpiryDate } = this.expiryBoundaries(nearExpiryDays);

    const qb = this.matLotRepository.createQueryBuilder('lot')
      // 유효기한이 있는 LOT만 조회
      .where('lot.expireDate IS NOT NULL');
    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    if (hasStockYn !== 'N') qb.andWhere('lot.currentQty > 0');
    if (itemCode) qb.andWhere('lot.itemCode = :itemCode', { itemCode });
    this.applyExpiryStatusWhere(qb, expiryStatus, today, nearExpiryDate);

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      // LOT번호/품목코드는 LOT 컬럼, 품목명은 ITEM_MASTERS EXISTS 서브쿼리 — 전부 DB 조건
      qb.andWhere(
        `(
          UPPER(lot.matUid) LIKE :search
          OR UPPER(lot.itemCode) LIKE :search
          OR EXISTS (
            SELECT 1 FROM ITEM_MASTERS im
            WHERE im.ITEM_CODE = lot.itemCode
              AND im.COMPANY = lot.company
              AND im.PLANT_CD = lot.plant
              AND UPPER(im.ITEM_NAME) LIKE :search
          )
        )`,
        { search: `%${trimmedSearch.toUpperCase()}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('lot.expireDate', 'ASC')
      .addOrderBy('lot.matUid', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // part 정보 조회
    const itemCodes = Array.from(new Set(data.map((lot) => lot.itemCode).filter(Boolean)));
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

    // 만료 상태 계산 (DB 조건과 같은 경계)
    const result = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const expireDate = lot.expireDate ? new Date(lot.expireDate) : null;
      let status: ShelfLifeExpiryStatus = 'VALID';
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

    return { data: result, total, page, limit };
  }
}
