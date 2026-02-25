/**
 * @file src/modules/material/services/mat-stock.service.ts
 * @description 재고 관리 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatStock 테이블**: 창고/위치별 품목 재고 현황
 * 2. **주요 필드**: warehouseCode, locationCode, itemCode, lotNo, qty
 * 3. **재고 조정**: 실사 결과 반영 및 수불 처리
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { StockQueryDto, StockAdjustDto, StockTransferDto } from '../dto/mat-stock.dto';

@Injectable()
export class MatStockService {
  constructor(
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: StockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, warehouseCode, locationCode, search, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {
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
    const lotNos = data.map((stock) => stock.lotNo).filter(Boolean) as string[];
    
    const [parts, lots] = await Promise.all([
      this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }),
      lotNos.length > 0 ? this.matLotRepository.find({ where: { lotNo: In(lotNos) } }) : Promise.resolve([]),
    ]);
    
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));

    // 안전재고 미달 필터링 및 중첩 객체 평면화
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let result = data.map((stock) => {
      const part = partMap.get(stock.itemCode);
      const lot = stock.lotNo ? lotMap.get(stock.lotNo) : null;

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
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
        safetyStock: part?.safetyStock,
        expiryDays: part?.expiryDate || 0,
        lotNo: lot?.lotNo,
        manufactureDate: lot?.manufactureDate || null,
        expireDate: lot?.expireDate || null,
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
          stock.itemName.toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }

  /** 출고 가능 재고 조회 (IQC PASS + 잔량 > 0 인 LOT만) */
  async findAvailable(query: StockQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, warehouseCode, search } = query;
    const where: any = { ...(itemCode && { itemCode }), ...(warehouseCode && { warehouseCode }), ...(company && { company }), ...(plant && { plant }) };

    const stocks = await this.matStockRepository.find({
      where, skip: (page - 1) * limit, take: limit, order: { updatedAt: 'DESC' },
    });

    const lotNos = stocks.map((s) => s.lotNo).filter(Boolean) as string[];
    const itemCodes = stocks.map((s) => s.itemCode).filter(Boolean);
    const [lots, parts] = await Promise.all([
      lotNos.length > 0 ? this.matLotRepository.find({ where: { lotNo: In(lotNos) } }) : Promise.resolve([]),
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    let result = stocks.map((stock) => {
      const lot = stock.lotNo ? lotMap.get(stock.lotNo) : null;
      const part = partMap.get(stock.itemCode);
      return {
        ...stock,
        itemCode: part?.itemCode ?? null, itemName: part?.itemName ?? null,
        unit: part?.unit ?? null, lotNo: lot?.lotNo ?? null,
        iqcStatus: lot?.iqcStatus ?? null, lotStatus: lot?.status ?? null,
        currentQty: lot?.currentQty ?? stock.qty,
      };
    }).filter((s) => s.iqcStatus === 'PASS' && s.currentQty > 0 && s.lotStatus !== 'HOLD');

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.itemCode.toLowerCase().includes(s) || r.itemName.toLowerCase().includes(s) ||
        r.lotNo?.toLowerCase().includes(s));
    }
    return { data: result, total: result.length, page, limit };
  }

  async findByPartAndWarehouse(itemCode: string, warehouseCode: string, lotId?: string) {
    const stock = await this.matStockRepository.findOne({
      where: { itemCode, warehouseCode, ...(lotNo && { lotNo }) },
    });

    if (!stock) return null;

    const [part, lot] = await Promise.all([
      this.partMasterRepository.findOne({ where: { itemCode: stock.itemCode } }),
      stock.lotNo ? this.matLotRepository.findOne({ where: { lotNo: stock.lotNo } }) : null,
    ]);

    return {
      ...stock,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
      lotNo: lot?.lotNo,
    };
  }

  async getStockSummary(itemCode: string) {
    const stocks = await this.matStockRepository.find({ where: { itemCode } });

    const total = stocks.reduce((sum, s) => sum + s.qty, 0);
    const available = stocks.reduce((sum, s) => sum + s.availableQty, 0);

    // part, lot 정보 조회
    const lotNos = stocks.map((stock) => stock.lotNo).filter(Boolean) as string[];
    const [part, lots] = await Promise.all([
      this.partMasterRepository.findOne({ where: { itemCode: itemCode } }),
      lotNos.length > 0 ? this.matLotRepository.find({ where: { lotNo: In(lotNos) } }) : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));

    const flattenedStocks = stocks.map((stock) => ({
      ...stock,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
      lotNo: stock.lotNo ? lotMap.get(stock.lotNo)?.lotNo : null,
    }));

    return { itemCode, totalQty: total, availableQty: available, byWarehouse: flattenedStocks };
  }

  async adjustStock(dto: StockAdjustDto) {
    const { itemCode, warehouseCode, locationCode, adjustQty, reason, lotNo } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 기존 재고 조회 또는 생성
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode, ...(lotNo && { lotNo }) },
      });

      const beforeQty = stock?.qty ?? 0;
      const afterQty = beforeQty + adjustQty;

      if (afterQty < 0) {
        throw new BadRequestException(`재고가 음수가 될 수 없습니다. 현재: ${beforeQty}, 조정: ${adjustQty}`);
      }

      if (stock) {
        await queryRunner.manager.update(MatStock, stock.id, {
          qty: afterQty,
          availableQty: afterQty - stock.reservedQty,
        });
        stock = await queryRunner.manager.findOne(MatStock, { where: { id: stock.id } });
      } else {
        if (adjustQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서 감소 조정을 할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          itemCode,
          warehouseCode,
          locationCode,
          lotNo,
          qty: adjustQty,
          availableQty: adjustQty,
          reservedQty: 0,
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // 조정 이력 기록
      await queryRunner.manager.save(InvAdjLog, {
        warehouseCode,
        itemCode,
        lotNo,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty: adjustQty,
        reason,
      });

      await queryRunner.commitTransaction();
      return stock;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async transferStock(dto: StockTransferDto) {
    const { itemCode, fromWarehouseCode, toWarehouseCode, qty, lotNo } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 출고 창고 재고 확인
      const fromStock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode: fromWarehouseCode, ...(lotNo && { lotNo }) },
      });

      if (!fromStock || fromStock.qty < qty) {
        throw new BadRequestException(`출고 창고 재고 부족: ${fromStock?.qty ?? 0}`);
      }

      // 출고 창고 차감
      await queryRunner.manager.update(MatStock, fromStock.id, {
        qty: fromStock.qty - qty,
        availableQty: fromStock.availableQty - qty,
      });

      // 입고 창고 재고 확인 또는 생성
      let toStock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode: toWarehouseCode, ...(lotNo && { lotNo }) },
      });

      if (toStock) {
        await queryRunner.manager.update(MatStock, toStock.id, {
          qty: toStock.qty + qty,
          availableQty: toStock.availableQty + qty,
        });
        toStock = await queryRunner.manager.findOne(MatStock, { where: { id: toStock.id } });
      } else {
        const newStock = queryRunner.manager.create(MatStock, {
          itemCode,
          warehouseCode: toWarehouseCode,
          lotNo,
          qty,
          availableQty: qty,
          reservedQty: 0,
        });
        toStock = await queryRunner.manager.save(newStock);
      }

      await queryRunner.commitTransaction();
      return { fromStock, toStock };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
