/**
 * @file src/modules/material/services/mat-stock.service.ts
 * @description 재고 관리 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatStock 테이블**: 창고/위치별 품목 재고 현황
 * 2. **주요 필드**: warehouseCode, locationCode, partId, lotId, qty
 * 3. **재고 조정**: 실사 결과 반영 및 수불 처리
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

  async findAll(query: StockQueryDto) {
    const { page = 1, limit = 10, partId, warehouseCode, locationCode, search, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(partId && { partId }),
      ...(warehouseCode && { warehouseCode }),
      ...(locationCode && { locationCode }),
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
    const partIds = data.map((stock) => stock.partId).filter(Boolean);
    const lotIds = data.map((stock) => stock.lotId).filter(Boolean) as string[];
    
    const [parts, lots] = await Promise.all([
      this.partMasterRepository.findByIds(partIds),
      lotIds.length > 0 ? this.matLotRepository.findByIds(lotIds) : Promise.resolve([]),
    ]);
    
    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    // 안전재고 미달 필터링 및 중첩 객체 평면화
    let result = data.map((stock) => {
      const part = partMap.get(stock.partId);
      const lot = stock.lotId ? lotMap.get(stock.lotId) : null;
      return {
        ...stock,
        partCode: part?.partCode,
        partName: part?.partName,
        unit: part?.unit,
        safetyStock: part?.safetyStock,
        lotNo: lot?.lotNo,
      };
    });

    if (lowStockOnly) {
      result = result.filter((stock) => stock.qty < (stock.safetyStock ?? 0));
    }

    // 검색어 필터링 (partCode, partName)
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (stock) =>
          stock.partCode?.toLowerCase().includes(searchLower) ||
          stock.partName?.toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }

  /** 출고 가능 재고 조회 (IQC PASS + 잔량 > 0 인 LOT만) */
  async findAvailable(query: StockQueryDto) {
    const { page = 1, limit = 10, partId, warehouseCode, search } = query;
    const where: any = { ...(partId && { partId }), ...(warehouseCode && { warehouseCode }) };

    const stocks = await this.matStockRepository.find({
      where, skip: (page - 1) * limit, take: limit, order: { updatedAt: 'DESC' },
    });

    const lotIds = stocks.map((s) => s.lotId).filter(Boolean) as string[];
    const partIds = stocks.map((s) => s.partId).filter(Boolean);
    const [lots, parts] = await Promise.all([
      lotIds.length > 0 ? this.matLotRepository.findByIds(lotIds) : Promise.resolve([]),
      partIds.length > 0 ? this.partMasterRepository.findByIds(partIds) : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.id, l]));
    const partMap = new Map(parts.map((p) => [p.id, p]));

    let result = stocks.map((stock) => {
      const lot = stock.lotId ? lotMap.get(stock.lotId) : null;
      const part = partMap.get(stock.partId);
      return {
        ...stock,
        partCode: part?.partCode ?? null, partName: part?.partName ?? null,
        unit: part?.unit ?? null, lotNo: lot?.lotNo ?? null,
        iqcStatus: lot?.iqcStatus ?? null, currentQty: lot?.currentQty ?? stock.qty,
      };
    }).filter((s) => s.iqcStatus === 'PASS' && s.currentQty > 0);

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.partCode?.toLowerCase().includes(s) || r.partName?.toLowerCase().includes(s) ||
        r.lotNo?.toLowerCase().includes(s));
    }
    return { data: result, total: result.length, page, limit };
  }

  async findByPartAndWarehouse(partId: string, warehouseCode: string, lotId?: string) {
    const stock = await this.matStockRepository.findOne({
      where: { partId, warehouseCode, ...(lotId && { lotId }) },
    });

    if (!stock) return null;

    const [part, lot] = await Promise.all([
      this.partMasterRepository.findOne({ where: { id: stock.partId } }),
      stock.lotId ? this.matLotRepository.findOne({ where: { id: stock.lotId } }) : null,
    ]);

    return {
      ...stock,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
      lotNo: lot?.lotNo,
    };
  }

  async getStockSummary(partId: string) {
    const stocks = await this.matStockRepository.find({ where: { partId } });

    const total = stocks.reduce((sum, s) => sum + s.qty, 0);
    const available = stocks.reduce((sum, s) => sum + s.availableQty, 0);

    // part, lot 정보 조회
    const lotIds = stocks.map((stock) => stock.lotId).filter(Boolean) as string[];
    const [part, lots] = await Promise.all([
      this.partMasterRepository.findOne({ where: { id: partId } }),
      lotIds.length > 0 ? this.matLotRepository.findByIds(lotIds) : Promise.resolve([]),
    ]);
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    const flattenedStocks = stocks.map((stock) => ({
      ...stock,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
      lotNo: stock.lotId ? lotMap.get(stock.lotId)?.lotNo : null,
    }));

    return { partId, totalQty: total, availableQty: available, byWarehouse: flattenedStocks };
  }

  async adjustStock(dto: StockAdjustDto) {
    const { partId, warehouseCode, locationCode, adjustQty, reason, lotId } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 기존 재고 조회 또는 생성
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { partId, warehouseCode, ...(lotId && { lotId }) },
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
          partId,
          warehouseCode,
          locationCode,
          lotId,
          qty: adjustQty,
          availableQty: adjustQty,
          reservedQty: 0,
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // 조정 이력 기록
      await queryRunner.manager.save(InvAdjLog, {
        warehouseCode,
        partId,
        lotId,
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
    const { partId, fromWarehouseCode, toWarehouseCode, qty, lotId } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 출고 창고 재고 확인
      const fromStock = await queryRunner.manager.findOne(MatStock, {
        where: { partId, warehouseCode: fromWarehouseCode, ...(lotId && { lotId }) },
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
        where: { partId, warehouseCode: toWarehouseCode, ...(lotId && { lotId }) },
      });

      if (toStock) {
        await queryRunner.manager.update(MatStock, toStock.id, {
          qty: toStock.qty + qty,
          availableQty: toStock.availableQty + qty,
        });
        toStock = await queryRunner.manager.findOne(MatStock, { where: { id: toStock.id } });
      } else {
        const newStock = queryRunner.manager.create(MatStock, {
          partId,
          warehouseCode: toWarehouseCode,
          lotId,
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
