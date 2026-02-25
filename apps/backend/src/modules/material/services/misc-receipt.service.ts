/**
 * @file src/modules/material/services/misc-receipt.service.ts
 * @description 기타입고 비즈니스 로직 - StockTransaction(MISC_IN) 생성 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, Like, In } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { CreateMiscReceiptDto, MiscReceiptQueryDto } from '../dto/misc-receipt.dto';

@Injectable()
export class MiscReceiptService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: MiscReceiptQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      transType: 'MISC_IN',
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (fromDate && toDate) {
      where.transDate = Between(new Date(fromDate), new Date(toDate));
    }

    let data: StockTransaction[];
    let total: number;

    if (search) {
      // 검색어가 있으면 품목 검색 후 필터링
      const parts = await this.partMasterRepository.find({
        where: [
          { itemCode: Like(`%${search}%`) },
          { itemName: Like(`%${search}%`) },
        ],
      });
      const itemCodes = parts.map((p) => p.itemCode);

      const queryBuilder = this.stockTransactionRepository.createQueryBuilder('trans')
        .where('trans.transType = :transType', { transType: 'MISC_IN' });

      if (company) queryBuilder.andWhere('trans.company = :company', { company });
      if (plant) queryBuilder.andWhere('trans.plant = :plant', { plant });

      if (fromDate && toDate) {
        queryBuilder.andWhere('trans.transDate BETWEEN :fromDate AND :toDate', {
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
        });
      }

      if (itemCodes.length > 0) {
        queryBuilder.andWhere('trans.itemCode IN (:...itemCodes)', { itemCodes });
      } else {
        // 품목 검색 결과가 없으면 빈 결과 반환
        return { data: [], total: 0, page, limit };
      }

      [data, total] = await Promise.all([
        queryBuilder
          .orderBy('trans.transDate', 'DESC')
          .skip(skip)
          .take(limit)
          .getMany(),
        queryBuilder.getCount(),
      ]);
    } else {
      [data, total] = await Promise.all([
        this.stockTransactionRepository.find({
          where,
          skip,
          take: limit,
          order: { transDate: 'DESC' },
        }),
        this.stockTransactionRepository.count({ where }),
      ]);
    }

    // 관련 정보 조회
    const itemCodes = data.map((trans) => trans.itemCode).filter(Boolean);
    const lotNos = data.map((trans) => trans.lotNo).filter(Boolean) as string[];
    const warehouseIds = data
      .map((trans) => trans.toWarehouseId)
      .filter(Boolean) as string[];

    const [parts, lots, warehouses] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
      lotNos.length > 0 ? this.matLotRepository.find({ where: { lotNo: In(lotNos) } }) : Promise.resolve([]),
      warehouseIds.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseIds) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // 중첩 객체 평면화
    const flattenedData = data.map((trans) => {
      const part = partMap.get(trans.itemCode);
      const lot = trans.lotNo ? lotMap.get(trans.lotNo) : null;
      const warehouse = trans.toWarehouseId ? warehouseMap.get(trans.toWarehouseId) : null;
      return {
        ...trans,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
        lotNo: lot?.lotNo,
        warehouseCode: warehouse?.warehouseCode,
        warehouseName: warehouse?.warehouseName,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async create(dto: CreateMiscReceiptDto) {
    const { warehouseId, itemCode, lotNo, qty, remark, workerId } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 창고 확인
      const warehouse = await queryRunner.manager.findOne(Warehouse, {
        where: { warehouseCode: warehouseId },
      });
      if (!warehouse) {
        throw new NotFoundException(`창고를 찾을 수 없습니다: ${warehouseId}`);
      }

      // 품목 확인
      const part = await queryRunner.manager.findOne(PartMaster, {
        where: { itemCode },
      });
      if (!part) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
      }

      // LOT 확인 (lotId가 있는 경우)
      if (lotNo) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { lotNo: lotNo },
        });
        if (!lot) {
          throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotNo}`);
        }
      }

      // 트랜잭션 번호 생성
      const transNo = await this.generateTransNo();

      // 재고 업데이트 또는 생성
      const existingStock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: warehouse.warehouseCode, itemCode, ...(lotNo && { lotNo }) },
      });

      if (existingStock) {
        await queryRunner.manager.update(MatStock, existingStock.id, {
          qty: existingStock.qty + qty,
          availableQty: existingStock.availableQty + qty,
        });
      } else {
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode: warehouse.warehouseCode,
          itemCode,
          lotNo: lotNo || null,
          qty,
          availableQty: qty,
          reservedQty: 0,
        });
        await queryRunner.manager.save(newStock);
      }

      // LOT 수량 업데이트 (lotId가 있는 경우)
      if (lotNo) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { lotNo: lotNo } });
        if (lot) {
          await queryRunner.manager.update(MatLot, lotNo, {
            currentQty: lot.currentQty + qty,
            status: lot.status === 'DEPLETED' ? 'NORMAL' : lot.status,
          });
        }
      }

      // 기타입고 트랜잭션 생성
      const transaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MISC_IN',
        transDate: new Date(),
        toWarehouseId: warehouse.warehouseCode,
        itemCode,
        lotNo: lotNo || null,
        qty,
        refType: 'MISC_RECEIPT',
        workerId,
        remark,
        status: 'DONE',
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        id: transaction.id,
        transNo,
        warehouseId,
        warehouseCode: warehouse.warehouseCode,
        warehouseName: warehouse.warehouseName,
        itemCode,
        itemCode: part.itemCode,
        itemName: part.itemName,
        lotNo,
        qty,
        remark,
        workerId,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 트랜잭션 번호 생성
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `MISC${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastTrans = await this.stockTransactionRepository.findOne({
      where: { transNo: Like(`${prefix}%`) },
      order: { transNo: 'DESC' },
    });

    let seq = 1;
    if (lastTrans) {
      const lastSeq = parseInt(lastTrans.transNo.slice(-5), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }
}
