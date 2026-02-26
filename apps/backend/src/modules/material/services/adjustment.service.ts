/**
 * @file src/modules/material/services/adjustment.service.ts
 * @description 재고보정 비즈니스 로직 - InvAdjLog 생성 + StockTransaction 기록 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, Between, In } from 'typeorm';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { CreateAdjustmentDto, AdjustmentQueryDto } from '../dto/adjustment.dto';

@Injectable()
export class AdjustmentService {
  constructor(
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: AdjustmentQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (search) {
      where.warehouseCode = Like(`%${search}%`);
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    }

    const [data, total] = await Promise.all([
      this.invAdjLogRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.invAdjLogRepository.count({ where }),
    ]);

    // part 정보 조회 및 중첩 객체 평면화
    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async create(dto: CreateAdjustmentDto) {
    const { warehouseCode, itemCode, lotId: lotNo, afterQty, reason, createdBy } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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

      // 기존 재고 조회
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode, itemCode, ...(lotNo && { lotNo }) },
      });

      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;

      // 재고 업데이트 또는 생성
      if (stock) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, lotNo: stock.lotNo },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty },
        );
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서 음수 조정을 할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          lotNo: lotNo || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // LOT 재고도 업데이트 (lotId가 있는 경우)
      if (lotNo) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { lotNo: lotNo } });
        if (lot) {
          const newLotQty = lot.currentQty + diffQty;
          await queryRunner.manager.update(MatLot, lotNo, {
            currentQty: Math.max(0, newLotQty),
            status: newLotQty <= 0 ? 'DEPLETED' : lot.status,
          });
        }
      }

      // 보정 이력 생성
      const invAdjLog = queryRunner.manager.create(InvAdjLog, {
        warehouseCode,
        itemCode,
        lotNo: lotNo || null,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty,
        reason,
        createdBy,
      });
      await queryRunner.manager.save(invAdjLog);

      // 재고 거래 이력 생성 (트랜잭션 번호 생성)
      const transNo = await this.generateTransNo();
      const stockTransaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: diffQty >= 0 ? 'ADJUST_IN' : 'ADJUST_OUT',
        transDate: new Date(),
        fromWarehouseId: diffQty < 0 ? warehouseCode : null,
        toWarehouseId: diffQty >= 0 ? warehouseCode : null,
        itemCode,
        lotNo: lotNo || null,
        qty: Math.abs(diffQty),
        refType: 'ADJUSTMENT',
        refId: String(invAdjLog.id),
        remark: reason,
        status: 'DONE',
        createdBy,
      });
      await queryRunner.manager.save(stockTransaction);

      await queryRunner.commitTransaction();

      return {
        id: invAdjLog.id,
        warehouseCode,
        itemCode: part.itemCode,
        lotNo,
        beforeQty,
        afterQty,
        diffQty,
        reason,
        itemName: part.itemName,
        unit: part.unit,
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
    const prefix = `ADJ${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

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
