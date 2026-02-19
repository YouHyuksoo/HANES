/**
 * @file src/modules/material/services/scrap.service.ts
 * @description 자재폐기 비즈니스 로직 - StockTransaction(SCRAP) 생성 + LOT 수량 차감 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Between } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateScrapDto, ScrapQueryDto } from '../dto/scrap.dto';

@Injectable()
export class ScrapService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}
  async findAll(query: ScrapQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      transType: 'SCRAP',
    };

    if (fromDate && toDate) {
      where.transDate = Between(new Date(fromDate), new Date(toDate));
    }

    const [data, total] = await Promise.all([
      this.stockTransactionRepository.find({
        where,
        skip,
        take: limit,
        order: { transDate: 'DESC' },
      }),
      this.stockTransactionRepository.count({ where }),
    ]);

    // part, lot 정보 조회
    const partIds = data.map((t) => t.partId).filter(Boolean);
    const lotIds = data.map((t) => t.lotId).filter(Boolean) as string[];

    const [parts, lots] = await Promise.all([
      this.partMasterRepository.findByIds(partIds),
      lotIds.length > 0 ? this.matLotRepository.findByIds(lotIds) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    const result = data.map((transaction) => {
      const part = partMap.get(transaction.partId);
      const lot = transaction.lotId ? lotMap.get(transaction.lotId) : null;
      return {
        ...transaction,
        partCode: part?.partCode,
        partName: part?.partName,
        lotNo: lot?.lotNo,
      };
    });

    return { data: result, total, page, limit };
  }

  async create(dto: CreateScrapDto) {
    const { lotId, warehouseId, qty, reason, workerId } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // LOT 조회
      const lot = await queryRunner.manager.findOne(MatLot, {
        where: { id: lotId, deletedAt: IsNull() },
      });

      if (!lot) {
        throw new NotFoundException(`LOT을 찾을 수 없습니다: ${lotId}`);
      }

      if (lot.currentQty < qty) {
        throw new BadRequestException(`폐기 수량이 LOT 재고를 초과합니다. 현재: ${lot.currentQty}`);
      }

      // 재고 확인
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { partId: lot.partId, warehouseCode: warehouseId, lotId },
      });

      if (!stock || stock.qty < qty) {
        throw new BadRequestException(`폐기할 재고가 부족합니다. 현재 재고: ${stock?.qty ?? 0}`);
      }

      // 재고 차감
      await queryRunner.manager.update(MatStock, stock.id, {
        qty: stock.qty - qty,
        availableQty: stock.availableQty - qty,
      });

      // LOT 수량 차감
      await queryRunner.manager.update(MatLot, lot.id, {
        currentQty: lot.currentQty - qty,
      });

      // 폐기 트랜잭션 생성
      const transaction = queryRunner.manager.create(StockTransaction, {
        transNo: `SCR-${Date.now()}`,
        transType: 'SCRAP',
        transDate: new Date(),
        fromWarehouseId: warehouseId,
        partId: lot.partId,
        lotId,
        qty,
        refType: 'LOT',
        refId: lotId,
        workerId,
        remark: reason,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        id: savedTransaction.id,
        lotId,
        warehouseId,
        qty,
        reason,
        transactionId: savedTransaction.id,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

