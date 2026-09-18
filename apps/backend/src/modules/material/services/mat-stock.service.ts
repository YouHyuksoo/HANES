/**
 * @file src/modules/material/services/mat-stock.service.ts
 * @description 재고 관리 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatStock 테이블**: 창고/위치별 품목 재고 현황
 * 2. **주요 필드**: warehouseCode, locationCode, itemCode, matUid, qty
 * 3. **재고 조정**: 실사 결과 반영 및 수불 처리
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like, FindOptionsWhere, IsNull, QueryRunner, MoreThan, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { StockQueryDto, StockAdjustDto, StockTransferDto, StockAssignLocationDto } from '../dto/mat-stock.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { isMatLotIssuable } from '@harness/shared';
import { normalizeFifoCriteria, resolveShelfLifeBaseDate } from '../rules/fifo.rules';
import type { FifoCriteria } from '../rules/fifo.rules';
import { SysConfigService } from '../../system/services/sys-config.service';

@Injectable()
export class MatStockService {
  constructor(
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(WarehouseLocation)
    private readonly warehouseLocationRepository: Repository<WarehouseLocation>,
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
    private readonly sysConfigService: SysConfigService,
  ) {}

  private async changeStockAtomically(
    qr: QueryRunner,
    key: FindOptionsWhere<MatStock>,
    delta: number,
    requireAvailable: boolean,
  ) {
    const qb = qr.manager.createQueryBuilder().update(MatStock).set({
      qty: () => `"QTY" ${delta < 0 ? '-' : '+'} :stockDelta`,
      availableQty: () => `"AVAILABLE_QTY" ${delta < 0 ? '-' : '+'} :stockDelta`,
    }).where(key);
    if (requireAvailable) {
      qb.andWhere('"QTY" >= :stockDelta AND "AVAILABLE_QTY" >= :stockDelta');
    }
    return qb.setParameters({ stockDelta: Math.abs(delta) }).execute();
  }

  /**
   * 보관위치 명칭 맵 — 정본은 /master/warehouse 의 로케이션 기준정보다.
   * 키는 복합 PK 그대로(창고코드 + 로케이션코드) — 로케이션코드는 창고별로 중복될 수 있다.
   */
  private async loadLocationNameMap(
    stocks: Array<{ warehouseCode: string; locationCode?: string | null }>,
    tenantWhere: Record<string, string>,
  ): Promise<Map<string, string>> {
    const codes = [...new Set(stocks.map((s) => s.locationCode).filter(Boolean))] as string[];
    if (codes.length === 0) return new Map();
    const locations = await this.warehouseLocationRepository.find({
      where: { locationCode: In(codes), ...tenantWhere },
    });
    return new Map(locations.map((l) => [`${l.warehouseCode}|${l.locationCode}`, l.locationName]));
  }

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
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

  async findAll(query: StockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, warehouseCode, locationCode, search, lowStockOnly, includeZero, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    // 최종변동일(UPDATED_AT) 구간 — 소진(0) 포함 조회 시 기간 없이 전량을 훑지 않도록 프론트가 기본 당일을 보낸다
    const dateFrom = parseDateStart(fromDate);
    const dateTo = parseDateEnd(toDate);
    const updatedAtWhere = dateFrom && dateTo ? Between(dateFrom, dateTo)
      : dateFrom ? MoreThanOrEqual(dateFrom)
      : dateTo ? LessThanOrEqual(dateTo)
      : undefined;

    const where: FindOptionsWhere<MatStock> = {
      // 기본 조건: 수량>0. 페이지(take)를 먼저 자른 뒤 메모리에서 거르면 소진 행에 밀려 실제 재고가 페이지 밖으로 나간다.
      ...(!includeZero && { qty: MoreThan(0) }),
      ...(updatedAtWhere && { updatedAt: updatedAtWhere }),
      ...(itemCode && { itemCode }),
      ...(warehouseCode && { warehouseCode }),
      ...(locationCode && { locationCode }),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    let data: MatStock[] = [];
    let total = 0;
    const trimmedSearch = search?.trim();

    if (trimmedSearch) {
      // 검색어(품목코드/품목명/시리얼)는 DB WHERE 로 건다 — 페이지를 자른 뒤 메모리에서 거르면 검색 결과가 페이지 밖으로 밀린다.
      const searchValue = `%${trimmedSearch.toUpperCase()}%`;
      // Oracle에서 상관 EXISTS를 목록/COUNT QueryBuilder에 함께 넣으면 드라이버가 생성하는
      // 페이징 COUNT SQL이 실패할 수 있다. 품목명 검색은 먼저 코드로 해석해 같은 재고 쿼리에 IN으로 결합한다.
      const matchingParts = await this.itemMasterRepository.find({
        where: {
          itemName: Like(`%${trimmedSearch}%`),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        select: ['itemCode'],
      });
      const matchingItemCodes = [...new Set(matchingParts.map((part) => part.itemCode).filter(Boolean))];
      const qb = this.matStockRepository.createQueryBuilder('stock');
      if (!includeZero) qb.andWhere('stock.qty > 0');
      if (dateFrom) qb.andWhere('stock.updatedAt >= :dateFrom', { dateFrom });
      if (dateTo) qb.andWhere('stock.updatedAt <= :dateTo', { dateTo });
      if (itemCode) qb.andWhere('stock.itemCode = :itemCode', { itemCode });
      if (warehouseCode) qb.andWhere('stock.warehouseCode = :warehouseCode', { warehouseCode });
      if (locationCode) qb.andWhere('stock.locationCode = :locationCode', { locationCode });
      if (company) qb.andWhere('stock.company = :company', { company });
      if (plant) qb.andWhere('stock.plant = :plant', { plant });
      const searchConditions = ['UPPER(stock.itemCode) LIKE :search', 'UPPER(stock.matUid) LIKE :search'];
      if (matchingItemCodes.length > 0) searchConditions.push('stock.itemCode IN (:...matchingItemCodes)');
      qb.andWhere(`(${searchConditions.join(' OR ')})`, {
        search: searchValue,
        ...(matchingItemCodes.length > 0 ? { matchingItemCodes } : {}),
      });
      [data, total] = await qb
        .orderBy('stock.updatedAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();
    } else {
      [data, total] = await Promise.all([
        this.matStockRepository.find({
          where,
          skip,
          take: limit,
          order: { updatedAt: 'DESC' },
        }),
        this.matStockRepository.count({ where }),
      ]);
    }

    // part, lot 정보 조회
    const itemCodes = data.map((stock) => stock.itemCode).filter(Boolean);
    const matUids = data.map((stock) => stock.matUid).filter(Boolean) as string[];
    
    const warehouseCodes = [...new Set(data.map((s) => s.warehouseCode).filter(Boolean))];

    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const [parts, lots, warehouses] = await Promise.all([
      this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
      warehouseCodes.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes), ...tenantWhere } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w.warehouseName]));
    const locationNameMap = await this.loadLocationNameMap(data, tenantWhere);

    // 공급사(업체명) 매핑: lots의 vendor 코드 = PARTNER_MASTERS.partnerCode
    const vendorCodes = [...new Set(lots.map((l) => l.vendor).filter(Boolean))];
    const partners =
      vendorCodes.length > 0
        ? await this.partnerMasterRepository.find({
            where: { partnerCode: In(vendorCodes), ...tenantWhere },
          })
        : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    // 안전재고 미달 필터링 및 중첩 객체 평면화
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let result = data.map((stock) => {
      const part = partMap.get(stock.itemCode);
      const lot = stock.matUid ? lotMap.get(stock.matUid) : null;

      // 경과일수는 유효기간과 같은 기산점(제조일 우선, 없으면 입고일)을 쓴다
      const expireDate = lot?.expireDate ? new Date(lot.expireDate) : null;
      let elapsedDays: number | null = null;
      let remainingDays: number | null = null;

      if (lot?.manufactureDate || lot?.recvDate) {
        const baseDate = resolveShelfLifeBaseDate(lot, today);
        elapsedDays = Math.floor((today.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      if (expireDate) {
        remainingDays = Math.floor((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        ...stock,
        warehouseName: warehouseMap.get(stock.warehouseCode) || stock.warehouseCode,
        locationName: stock.locationCode
          ? (locationNameMap.get(`${stock.warehouseCode}|${stock.locationCode}`) ?? stock.locationCode)
          : null,
        itemCode: stock.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        safetyStock: part?.safetyStock ?? null,
        expiryDays: part?.expiryDate || 0,
        matUid: stock.matUid,
        vendor: lot?.vendor ?? null,
        vendorName: lot?.vendor ? (partnerMap.get(lot.vendor) ?? lot.vendor) : null,
        manufactureDate: lot?.manufactureDate || null,
        expireDate: lot?.expireDate || null,
        specialAcceptYn: lot?.specialAcceptYn ?? 'N',
        elapsedDays,
        remainingDays,
      };
    });

    if (lowStockOnly) {
      result = result.filter((stock) => stock.qty < (stock.safetyStock ?? 0));
    }

    return { data: result, total, page, limit };
  }

  /** 출고 가능 재고 조회 (IQC PASS + 잔량 > 0 인 LOT만) */
  async findAvailable(query: StockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, warehouseCode, search } = query;
    // 정렬 기준일은 출고 정책이 FIFO 위반을 판정할 때 쓰는 기준과 같아야 한다.
    // 입고일로 배분해 놓고 정책이 제조일로 판정하면, 엄격히 FIFO 로 배분해도
    // FIFO_ACTION=BLOCK 에 막힌다(설계 §FIFO). 기준 판정은 fifo.rules 단일 출처.
    const fifoCriteria: FifoCriteria = normalizeFifoCriteria(
      await this.sysConfigService.getValue('FIFO_CRITERIA', company, plant),
    );
    const fifoDateColumn = fifoCriteria === 'MFG_DATE' ? 'lot.manufactureDate' : 'lot.recvDate';
    // FIFO(선입선출)는 DB ORDER BY 로 건다. 페이징 후 메모리 정렬하면 페이지 밖으로 밀린
    // 오래된 LOT 가 누락된다. 분할 자식 시리얼은 RECV_DATE 를 계승하지만 UPDATED_AT 은
    // 방금 시각이라, updatedAt 기준 페이징에서는 분할할수록 FIFO 가 무너진다.
    const qb = this.matStockRepository
      .createQueryBuilder('stock')
      .leftJoin(MatLot, 'lot', 'lot.matUid = stock.matUid')
      .where('stock.qty > 0');
    if (itemCode) qb.andWhere('stock.itemCode = :itemCode', { itemCode });
    if (warehouseCode) qb.andWhere('stock.warehouseCode = :warehouseCode', { warehouseCode });
    if (company) qb.andWhere('stock.company = :company', { company });
    if (plant) qb.andWhere('stock.plant = :plant', { plant });

    // leftJoin + skip/take 는 TypeORM 의 "distinctAlias" 두-단계 페이징 래퍼를 태우는데,
    // 이 래퍼는 조인 컬럼(lot.recvDate) 정렬을 내부 서브쿼리의 select alias로 요구해
    // 실제 Oracle에서 ORA-00904로 거부된다(2026-09-15 실측). MAT_LOTS.matUid 가 유일 PK라
    // 이 조인은 1:0..1 로 row fan-out이 없으므로 DISTINCT 래퍼가 필요 없는 offset/limit 을 쓴다.
    // 2차 키는 계보(ORIGIN, 최초 시리얼)다. 분할 자식 시리얼은 nextMatSerial 이 "오늘 날짜"로
    // 발번해 같은 기준일 그룹에서 항상 맨 뒤로 밀리는데(finding #6), ORIGIN 으로 묶으면
    // 자식이 부모 슬롯 그대로 들어오고 형제 롯트 간 상대 순서도 유지된다.
    // 실측(2026-09-15) MAT_LOTS.ORIGIN 은 423건 전부 채워져 있으나, 미래의 NULL 이
    // 순서를 흩뜨리지 않도록 COALESCE 로 자기 시리얼을 기본값으로 둔다.
    const stocks = await qb
      .orderBy(fifoDateColumn, 'ASC', 'NULLS LAST')
      .addOrderBy('COALESCE(lot.origin, stock.matUid)', 'ASC')
      .addOrderBy('stock.matUid', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    const matUids = stocks.map((s) => s.matUid).filter(Boolean) as string[];
    const itemCodes = stocks.map((s) => s.itemCode).filter(Boolean);
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const warehouseCodes = [...new Set(stocks.map((s) => s.warehouseCode).filter(Boolean))];
    const [lots, parts, warehouses] = await Promise.all([
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
      itemCodes.length > 0 ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
      warehouseCodes.length > 0
        ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes), ...tenantWhere } })
        : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    // 배분 그리드가 창고코드 대신 사람이 읽는 이름을 보여주도록 목록 조회(findAll)와 같은 방식으로 매핑한다.
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w.warehouseName]));
    const locationNameMap = await this.loadLocationNameMap(stocks, tenantWhere);

    let result = stocks.map((stock) => {
      const lot = stock.matUid ? lotMap.get(stock.matUid) : null;
      const part = partMap.get(stock.itemCode);
      return {
        ...stock,
        itemCode: stock.itemCode, itemName: part?.itemName ?? null,
        unit: part?.unit ?? null, matUid: stock.matUid,
        warehouseName: warehouseMap.get(stock.warehouseCode) || stock.warehouseCode,
        locationName: stock.locationCode
          ? (locationNameMap.get(`${stock.warehouseCode}|${stock.locationCode}`) ?? stock.locationCode)
          : null,
        recvDate: lot?.recvDate ?? null,
        // 프론트가 "어떤 날짜로 정렬됐는지"를 추측하지 않도록 기준과 두 날짜를 모두 내려준다
        manufactureDate: lot?.manufactureDate ?? null,
        fifoCriteria,
        iqcStatus: lot?.iqcStatus ?? null, lotStatus: lot?.status ?? null,
        specialAcceptYn: lot?.specialAcceptYn ?? null,
      };
    }).filter((s) => (
      (s.iqcStatus === 'PASS' || (s.iqcStatus === 'FAIL' && s.specialAcceptYn === 'Y'))
      && s.qty > 0
      // 출고 가능 LOT 상태는 shared 규칙 한 곳(NORMAL). 종결 LOT(MERGED/SPLIT/DISCARDED/DEPLETED)은 재고가 남아 있어도 출고 목록에서 뺀다.
      && isMatLotIssuable(s.lotStatus)
    ));

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.itemCode.toLowerCase().includes(s) || (r.itemName ?? '').toLowerCase().includes(s) ||
        r.matUid?.toLowerCase().includes(s));
    }

    return { data: result, total: result.length, page, limit };
  }

  async findByPartAndWarehouse(itemCode: string, warehouseCode: string, matUid?: string, company?: string, plant?: string) {
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const stock = await this.matStockRepository.findOne({
      where: { itemCode, warehouseCode, matUid: matUid ?? IsNull(), ...tenantWhere },
    });

    if (!stock) return null;

    const [part, lot] = await Promise.all([
      this.itemMasterRepository.findOne({ where: { itemCode: stock.itemCode, ...tenantWhere } }),
      stock.matUid ? this.matLotRepository.findOne({ where: { matUid: stock.matUid, ...tenantWhere } }) : null,
    ]);

    return {
      ...stock,
      itemCode: stock.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
      matUid: stock.matUid,
    };
  }

  async getStockSummary(itemCode: string, company?: string, plant?: string) {
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const stocks = await this.matStockRepository.find({ where: { itemCode, ...tenantWhere } });

    const total = stocks.reduce((sum, s) => sum + s.qty, 0);
    const available = stocks.reduce((sum, s) => sum + s.availableQty, 0);

    // part, lot 정보 조회
    const matUids = stocks.map((stock) => stock.matUid).filter(Boolean) as string[];
    const [part, lots] = await Promise.all([
      this.itemMasterRepository.findOne({ where: { itemCode: itemCode, ...tenantWhere } }),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    const flattenedStocks = stocks.map((stock) => ({
      ...stock,
      itemCode: stock.itemCode,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
      matUid: stock.matUid,
    }));

    return { itemCode, totalQty: total, availableQty: available, byWarehouse: flattenedStocks };
  }

  async adjustStock(dto: StockAdjustDto, company?: string, plant?: string) {
    const { itemCode, warehouseCode, locationCode, adjustQty, reason, matUid } = dto;

    return this.tx.run(async (queryRunner) => {
      // 기존 재고 조회 또는 생성
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: {
          itemCode,
          warehouseCode,
          matUid: matUid ?? IsNull(),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      const beforeQty = stock?.qty ?? 0;
      const afterQty = beforeQty + adjustQty;

      if (stock) {
        this.assertSameTenant('조정 대상 재고', { company, plant }, stock);
      }

      if (afterQty < 0) {
        throw new BadRequestException(`재고가 음수가 될 수 없습니다. 현재: ${beforeQty}, 조정: ${adjustQty}`);
      }

      if (stock && afterQty < stock.reservedQty) {
        throw new BadRequestException(
          `예약수량(${stock.reservedQty})보다 적은 수량으로는 조정할 수 없습니다.`,
        );
      }

      if (stock) {
        await queryRunner.manager.update(MatStock,
          {
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            matUid: stock.matUid,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty },
        );
        stock = await queryRunner.manager.findOne(MatStock, {
          where: {
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            matUid: stock.matUid,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
        });
      } else {
        if (adjustQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서 감소 조정을 할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          itemCode,
          warehouseCode,
          locationCode,
          matUid,
          qty: adjustQty,
          availableQty: adjustQty,
          reservedQty: 0,
          company,
          plant,
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // 조정 이력 기록
      await queryRunner.manager.save(InvAdjLog, {
        warehouseCode,
        itemCode,
        matUid,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty: adjustQty,
        reason,
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      return stock;
    });
  }

  async transferStock(dto: StockTransferDto, company?: string, plant?: string) {
    const { itemCode, fromWarehouseCode, toWarehouseCode, qty, matUid } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      // 출고 창고 재고 확인
      const fromStock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode: fromWarehouseCode, matUid: matUid ?? IsNull(), ...tenantWhere },
      });

      if (!fromStock || fromStock.qty < qty) {
        throw new BadRequestException(`출고 창고 재고 부족: ${fromStock?.qty ?? 0}`);
      }
      this.assertSameTenant('출고 재고', { company, plant }, fromStock);

      // 출고 창고 차감
      if (fromWarehouseCode === toWarehouseCode) {
        throw new BadRequestException('출발 창고와 도착 창고가 같을 수 없습니다.');
      }
      if (fromStock.availableQty < qty) {
        throw new BadRequestException(
          `출고 가용재고가 부족합니다. 가용재고: ${fromStock.availableQty}`,
        );
      }

      // 입고 창고 재고 확인 또는 생성
      let toStock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode: toWarehouseCode, matUid: matUid ?? IsNull(), ...tenantWhere },
      });
      if (toStock) {
        this.assertSameTenant('입고 재고', { company, plant }, toStock);
      }

      const fromKey = { warehouseCode: fromStock.warehouseCode, itemCode: fromStock.itemCode, matUid: fromStock.matUid, ...tenantWhere };
      const decreased = await this.changeStockAtomically(queryRunner, fromKey, -qty, true);
      if ((decreased.affected ?? 0) !== 1) {
        throw new BadRequestException('동시 처리로 출고 재고가 변경되었거나 가용재고가 부족합니다. 다시 조회해 주세요.');
      }

      if (toStock) {
        await this.changeStockAtomically(queryRunner,
          { warehouseCode: toStock.warehouseCode, itemCode: toStock.itemCode, matUid: toStock.matUid, ...tenantWhere }, qty, false);
        toStock = await queryRunner.manager.findOne(MatStock, {
          where: { warehouseCode: toStock.warehouseCode, itemCode: toStock.itemCode, matUid: toStock.matUid, ...tenantWhere },
        });
      } else {
        const newStock = queryRunner.manager.create(MatStock, {
          itemCode,
          warehouseCode: toWarehouseCode,
          matUid,
          qty,
          availableQty: qty,
          reservedQty: 0,
          company: fromStock.company,
          plant: fromStock.plant,
        });
        toStock = await queryRunner.manager.save(newStock);
      }

      return { fromStock, toStock };
    });
  }

  /**
   * PDA 창고랙 지정 — 스캔한 랙(LOCATION_CODE)으로 재고의 보관위치를 바꾼다.
   *
   * 품목마스터의 고정위치는 입고 시 기본값이고, 이 기능으로 변동 위치를 지정한다.
   * 랙은 /master/warehouse 로케이션 기준정보에 있어야 하고, 재고의 창고와 같아야 한다.
   * 수량 변화는 없지만 위치가 바뀜다는 사실은 STOCK_TRANSACTIONS 에 남긴다.
   */
  async assignLocation(dto: StockAssignLocationDto, company?: string, plant?: string) {
    const { matUid, locationCode, workerCode, remark } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { matUid, ...tenantWhere },
      });
      if (!stock) {
        throw new NotFoundException(`재고를 찾을 수 없습니다: ${matUid}`);
      }
      this.assertSameTenant('보관위치 지정 대상 재고', { company, plant }, stock);

      const location = await queryRunner.manager.findOne(WarehouseLocation, {
        where: { warehouseCode: stock.warehouseCode, locationCode, ...tenantWhere },
      });
      if (!location) {
        throw new BadRequestException(
          `창고 ${stock.warehouseCode} 에 등록되지 않은 로케이션입니다: ${locationCode}`,
        );
      }

      const previousLocationCode = stock.locationCode ?? null;
      if (previousLocationCode === locationCode) {
        return { matUid, warehouseCode: stock.warehouseCode, locationCode, locationName: location.locationName, changed: false };
      }

      await queryRunner.manager.update(
        MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...tenantWhere },
        { locationCode },
      );

      const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');
      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_MOVE',
        transDate: new Date(),
        fromWarehouseId: stock.warehouseCode,
        toWarehouseId: stock.warehouseCode,
        itemCode: stock.itemCode,
        matUid: stock.matUid,
        qty: stock.qty,
        refType: 'LOCATION_ASSIGN',
        refId: locationCode,
        workerCode: workerCode ?? null,
        remark: remark?.trim() || `보관위치 지정: ${previousLocationCode ?? '미지정'} → ${locationCode}`,
        status: 'DONE',
        company: stock.company,
        plant: stock.plant,
      });

      return {
        matUid,
        warehouseCode: stock.warehouseCode,
        previousLocationCode,
        locationCode,
        locationName: location.locationName,
        changed: true,
      };
    });
  }
}
