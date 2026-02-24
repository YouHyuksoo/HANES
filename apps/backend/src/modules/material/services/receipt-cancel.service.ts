/**
 * @file src/modules/material/services/receipt-cancel.service.ts
 * @description 입고취소 비즈니스 로직 - StockTransaction 역분개 처리 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Between } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { CreateReceiptCancelDto, ReceiptCancelQueryDto } from '../dto/receipt-cancel.dto';
import { NumRuleService } from '../../num-rule/num-rule.service';

@Injectable()
export class ReceiptCancelService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
  ) {}
  async findCancellable(query: ReceiptCancelQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      transType: 'RECEIPT',
      cancelRefId: IsNull(),
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

    return { data, total, page, limit };
  }

  async cancel(dto: CreateReceiptCancelDto) {
    const { transactionId, reason, workerId } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 원본 트랜잭션 조회
      const originalTransaction = await queryRunner.manager.findOne(StockTransaction, {
        where: { id: transactionId },
      });

      if (!originalTransaction) {
        throw new NotFoundException(`입고 트랜잭션을 찾을 수 없습니다: ${transactionId}`);
      }

      if (originalTransaction.cancelRefId) {
        throw new BadRequestException('이미 취소된 트랜잭션입니다.');
      }

      if (originalTransaction.transType !== 'RECEIPT') {
        throw new BadRequestException('입고 트랜잭션만 취소할 수 있습니다.');
      }

      const { partId, lotId, toWarehouseId, qty } = originalTransaction;

      if (!toWarehouseId) {
        throw new BadRequestException('입고 창고 정보가 없습니다.');
      }

      // 재고 확인 및 차감
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { partId, warehouseCode: toWarehouseId, ...(lotId && { lotId }) },
      });

      if (!stock || stock.qty < qty) {
        throw new BadRequestException(`취소할 재고가 부족합니다. 현재 재고: ${stock?.qty ?? 0}`);
      }

      // 재고 차감
      await queryRunner.manager.update(MatStock, stock.id, {
        qty: stock.qty - qty,
        availableQty: stock.availableQty - qty,
      });

      // LOT 수량 복원
      if (lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { id: lotId },
        });

        if (lot) {
          await queryRunner.manager.update(MatLot, lot.id, {
            currentQty: lot.currentQty - qty,
          });
        }
      }

      // PO 품목 입고량 감소
      if (originalTransaction.refId && originalTransaction.refType === 'PO') {
        const poItem = await queryRunner.manager.findOne(PurchaseOrderItem, {
          where: { id: originalTransaction.refId },
        });

        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, poItem.id, {
            receivedQty: Math.max(0, poItem.receivedQty - qty),
          });
        }
      }

      // 역분개 트랜잭션 생성
      const cancelTransNo = await this.numRuleService.nextNumberInTx(queryRunner, 'CANCEL_TX');
      const cancelTransaction = queryRunner.manager.create(StockTransaction, {
        transNo: cancelTransNo,
        transType: 'RECEIPT_CANCEL',
        transDate: new Date(),
        fromWarehouseId: toWarehouseId,
        partId,
        lotId,
        qty: -qty,
        refType: 'TRANSACTION',
        refId: originalTransaction.id,
        workerId,
        remark: reason,
      });

      const savedCancelTrans = await queryRunner.manager.save(cancelTransaction);

      // 원본 트랜잭션에 취소 참조 설정
      await queryRunner.manager.update(StockTransaction, originalTransaction.id, {
        cancelRefId: savedCancelTrans.id,
      });

      await queryRunner.commitTransaction();

      return {
        id: savedCancelTrans.id,
        transactionId,
        cancelled: true,
        cancelTransactionId: savedCancelTrans.id,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

