/**
 * @file src/modules/material/services/receipt-cancel.service.ts
 * @description 입고취소 비즈니스 로직 - StockTransaction 역분개 처리 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Between, In, FindOptionsWhere } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { CreateReceiptCancelDto, ReceiptCancelQueryDto } from '../dto/receipt-cancel.dto';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

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
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    row: { company?: string | null; plant?: string | null } | null | undefined,
    expectedCompany?: string | null,
    expectedPlant?: string | null,
    label = '데이터',
  ) {
    if (expectedCompany && row?.company !== expectedCompany) {
      throw new BadRequestException(`${label}의 회사 정보가 요청 회사와 일치하지 않습니다.`);
    }
    if (expectedPlant && row?.plant !== expectedPlant) {
      throw new BadRequestException(`${label}의 공장 정보가 요청 공장과 일치하지 않습니다.`);
    }
  }

  async findCancellable(query: ReceiptCancelQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<StockTransaction> = {
      transType: 'RECEIPT',
      cancelRefId: IsNull(),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (fromDate && toDate) {
      where.transDate = Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!);
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

  async cancel(dto: CreateReceiptCancelDto, company?: string, plant?: string) {
    const { transactionId, reason, workerId } = dto;
    return this.tx.run(async (queryRunner) => {
      // 원본 트랜잭션 조회
      const originalTransaction = await queryRunner.manager.findOne(StockTransaction, {
        where: { transNo: transactionId, ...this.tenantWhere(company, plant) },
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

      this.assertSameTenant(originalTransaction, company, plant, '원본 입고 거래');

      await this.ensureNoDownstreamProgress(originalTransaction);

      const { itemCode, matUid, toWarehouseId, qty } = originalTransaction;
      const txTenantWhere = this.tenantWhere(originalTransaction.company, originalTransaction.plant);

      if (!toWarehouseId) {
        throw new BadRequestException('입고 창고 정보가 없습니다.');
      }

      // 재고 확인 및 차감
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { itemCode, warehouseCode: toWarehouseId, matUid: matUid ?? IsNull(), ...txTenantWhere },
      });

      if (!stock || stock.qty < qty) {
        throw new BadRequestException(`취소할 재고가 부족합니다. 현재 재고: ${stock?.qty ?? 0}`);
      }
      this.assertSameTenant(stock, originalTransaction.company, originalTransaction.plant, '입고취소 대상 재고');

      // 재고 차감
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid, ...txTenantWhere },
        { qty: stock.qty - qty, availableQty: stock.availableQty - qty },
      );

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리

      // PO 품목 입고량 감소
      if (originalTransaction.refId && originalTransaction.refType === 'PO') {
        const refSeq = Number(originalTransaction.refId);
        // refId를 seq로 해석 — 해당 품목의 PO 품목 조회
        const poItem = !isNaN(refSeq)
          ? await queryRunner.manager.findOne(PurchaseOrderItem, {
              where: { seq: refSeq, ...txTenantWhere },
            })
          : null;

        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, { poNo: poItem.poNo, seq: poItem.seq, ...txTenantWhere }, {
            receivedQty: Math.max(0, poItem.receivedQty - qty),
          });
        }
      }

      // 역분개 트랜잭션 생성
      const cancelTransNo = await this.numbering.nextInTx(queryRunner, 'CANCEL_TX');
      const cancelTransaction = queryRunner.manager.create(StockTransaction, {
        transNo: cancelTransNo,
        transType: 'RECEIPT_CANCEL',
        transDate: new Date(),
        fromWarehouseId: toWarehouseId,
        itemCode,
        matUid,
        qty: -qty,
        refType: 'TRANSACTION',
        refId: originalTransaction.transNo,
        workerId,
        remark: reason,
        company: originalTransaction.company,
        plant: originalTransaction.plant,
      });

      const savedCancelTrans = await queryRunner.manager.save(cancelTransaction);

      // 원본 트랜잭션에 취소 참조 설정
      await queryRunner.manager.update(StockTransaction, { transNo: originalTransaction.transNo, ...txTenantWhere }, {
        cancelRefId: savedCancelTrans.transNo,
      });

      return {
        transNo: savedCancelTrans.transNo,
        transactionId,
        cancelled: true,
        cancelTransNo: savedCancelTrans.transNo,
      };
    });
  }

  private async ensureNoDownstreamProgress(originalTransaction: StockTransaction) {
    if (!originalTransaction.matUid) {
      return;
    }

    const matIssueRepo = this.dataSource.getRepository(MatIssue);
    const prodResultRepo = this.dataSource.getRepository(ProdResult);
    const fgLabelRepo = this.dataSource.getRepository(FgLabel);

    const latestIssue = await matIssueRepo.findOne({
      where: {
        matUid: originalTransaction.matUid,
        status: 'DONE',
        ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
      },
      order: { issueDate: 'DESC' },
    });

    if (!latestIssue) {
      return;
    }

    const blockers = [`자재출고=${latestIssue.issueNo}-${latestIssue.seq}`];
    let prodResult: ProdResult | null = null;

    if (latestIssue.prodResultNo) {
      prodResult = await prodResultRepo.findOne({
        where: {
          resultNo: latestIssue.prodResultNo,
          ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
        },
      });
    } else if (latestIssue.orderNo) {
      prodResult = await prodResultRepo.findOne({
        where: {
          orderNo: latestIssue.orderNo,
          status: In(['RUNNING', 'DONE']),
          ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
        },
        order: { createdAt: 'DESC' },
      });
    }

    if (prodResult && prodResult.status !== 'CANCELED') {
      blockers.push(`생산실적=${prodResult.resultNo}(${prodResult.status})`);

      if (prodResult.prdUid) {
        const fgLabel = await fgLabelRepo.findOne({
          where: {
            fgBarcode: prodResult.prdUid,
            ...this.tenantWhere(originalTransaction.company, originalTransaction.plant),
          },
        });
        if (fgLabel) {
          blockers.push(`FG=${fgLabel.fgBarcode}(${fgLabel.status})`);
        }
      }
    }

    throw new BadRequestException(
      `입고취소 ${originalTransaction.transNo} 는 뒤 공정이 이미 진행되어 처리할 수 없습니다. ` +
        `현재 상태: ${blockers.join(', ')}. ` +
        `출하 -> 팔레트 -> 박스/OQC -> FG 라벨 -> 생산실적 -> 자재출고 순서로 역처리 후 다시 입고취소를 진행해 주세요.`,
    );
  }
}
