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
import { Repository, DataSource, In, FindOptionsWhere, IsNull } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { StockQueryDto, StockAdjustDto, StockTransferDto } from '../dto/mat-stock.dto';
import { TransactionService } from '../../../shared/transaction.service';

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
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
  ) {}

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
    const { page = 1, limit = 10, itemCode, warehouseCode, locationCode, search, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<MatStock> = {
      ...(itemCode && { itemCode }),
      ...(warehouseCode && { warehouseCode }),
      ...(locationCode && { locationCode }),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    const [data, total] = await Promise.all([
      this.matStockRepository.find({
        where,
        skip,
        take: limit,
        order: { updatedAt: 'DESC' },
      }),
      this.matStockRepository.count({ where }),
    ]);

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

      // 제조일자 기반 경과일수/남은유효기간 계산
      const manufactureDate = lot?.manufactureDate ? new Date(lot.manufactureDate) : null;
      const expireDate = lot?.expireDate ? new Date(lot.expireDate) : null;
      let elapsedDays: number | null = null;
      let remainingDays: number | null = null;

      if (manufactureDate) {
        elapsedDays = Math.floor((today.getTime() - manufactureDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      if (expireDate) {
        remainingDays = Math.floor((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        ...stock,
        warehouseName: warehouseMap.get(stock.warehouseCode) || stock.warehouseCode,
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

    // 검색어 필터링 (itemCode, itemName)
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (stock) =>
          stock.itemCode.toLowerCase().includes(searchLower) ||
          (stock.itemName ?? '').toLowerCase().includes(searchLower) ||
          (stock.matUid ?? '').toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }

  /** 출고 가능 재고 조회 (IQC PASS + 잔량 > 0 인 LOT만) */
  async findAvailable(query: StockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, warehouseCode, search } = query;
    const where: FindOptionsWhere<MatStock> = { ...(itemCode && { itemCode }), ...(warehouseCode && { warehouseCode }), ...(company && { company }), ...(plant && { plant }) };

    const stocks = await this.matStockRepository.find({
      where, skip: (page - 1) * limit, take: limit, order: { updatedAt: 'DESC' },
    });

    const matUids = stocks.map((s) => s.matUid).filter(Boolean) as string[];
    const itemCodes = stocks.map((s) => s.itemCode).filter(Boolean);
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const [lots, parts] = await Promise.all([
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([]),
      itemCodes.length > 0 ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    let result = stocks.map((stock) => {
      const lot = stock.matUid ? lotMap.get(stock.matUid) : null;
      const part = partMap.get(stock.itemCode);
      return {
        ...stock,
        itemCode: stock.itemCode, itemName: part?.itemName ?? null,
        unit: part?.unit ?? null, matUid: stock.matUid,
        recvDate: lot?.recvDate ?? null,
        iqcStatus: lot?.iqcStatus ?? null, lotStatus: lot?.status ?? null,
      };
    }).filter((s) => s.iqcStatus === 'PASS' && s.qty > 0 && s.lotStatus !== 'HOLD');

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.itemCode.toLowerCase().includes(s) || (r.itemName ?? '').toLowerCase().includes(s) ||
        r.matUid?.toLowerCase().includes(s));
    }

    // FIFO(선입선출): 입고일(RECV_DATE) 오름차순, 입고일 미상(null)은 뒤로
    result.sort((a, b) => {
      const at = a.recvDate ? new Date(a.recvDate).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.recvDate ? new Date(b.recvDate).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });
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

      await queryRunner.manager.update(MatStock,
        { warehouseCode: fromStock.warehouseCode, itemCode: fromStock.itemCode, matUid: fromStock.matUid, ...tenantWhere },
        { qty: fromStock.qty - qty, availableQty: fromStock.availableQty - qty },
      );

      if (toStock) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: toStock.warehouseCode, itemCode: toStock.itemCode, matUid: toStock.matUid, ...tenantWhere },
          { qty: toStock.qty + qty, availableQty: toStock.availableQty + qty },
        );
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
}
