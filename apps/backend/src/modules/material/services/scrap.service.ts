/**
 * @file src/modules/material/services/scrap.service.ts
 * @description 자재폐기 비즈니스 로직 - StockTransaction(SCRAP) 생성 + LOT 수량 차감 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateScrapDto, ScrapQueryDto } from '../dto/scrap.dto';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { SysConfigService } from '../../system/services/sys-config.service';

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
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
    private readonly sysConfigService: SysConfigService,
  ) {}
  async findAll(query: ScrapQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      transType: 'SCRAP',
      ...(company && { company }),
      ...(plant && { plant }),
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
    const itemCodes = data.map((t) => t.itemCode).filter(Boolean);
    const matUids = data.map((t) => t.matUid).filter(Boolean) as string[];

    const [parts, lots] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    const result = data.map((transaction) => {
      const part = partMap.get(transaction.itemCode);
      const lot = transaction.matUid ? lotMap.get(transaction.matUid) : null;
      return {
        ...transaction,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        matUid: lot?.matUid,
      };
    });

    return { data: result, total, page, limit };
  }

  async create(dto: CreateScrapDto) {
    const { matUid, warehouseId, qty, reason, workerId } = dto;

    // G10: 불출된 자재(FLOOR 창고)는 반납 후에만 폐기 가능
    const warehouse = await this.warehouseRepository.findOne({ where: { warehouseCode: warehouseId } });
    if (warehouse && warehouse.warehouseType === 'FLOOR') {
      const returnMode = await this.sysConfigService.getValue('RETURN_MODE');
      if (returnMode === 'RETURN') {
        throw new BadRequestException('불출된 자재는 반납 후 폐기해야 합니다.');
      }
      // CANCEL 모드(베트남): 불출취소 후 폐기 허용 — 별도 체크 없음
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // LOT 조회
      const lot = await queryRunner.manager.findOne(MatLot, {
        where: { matUid: matUid },
      });

      if (!lot) {
        throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
      }

      // 재고 확인 (MatStock 기준)
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode: lot.itemCode, warehouseCode: warehouseId, matUid },
      });

      if (!stock || stock.qty < qty) {
        throw new BadRequestException(`폐기할 재고가 부족합니다. 현재 재고: ${stock?.qty ?? 0}`);
      }

      // 재고 차감 (MatStock만 업데이트)
      const newStockQty = stock.qty - qty;
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
        { qty: newStockQty, availableQty: stock.availableQty - qty },
      );

      // 재고 0이면 LOT 상태만 DEPLETED로 변경
      if (newStockQty === 0) {
        await queryRunner.manager.update(MatLot, lot.matUid, { status: 'DEPLETED' });
      }

      // 폐기 트랜잭션 생성
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');
      const transaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'SCRAP',
        transDate: new Date(),
        fromWarehouseId: warehouseId,
        itemCode: lot.itemCode,
        matUid,
        qty,
        refType: 'LOT',
        refId: matUid,
        workerId,
        remark: reason,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        transNo: savedTransaction.transNo,
        matUid,
        warehouseId,
        qty,
        reason,
        transactionId: savedTransaction.transNo,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

