/**
 * @file services/mat-out-request.service.ts
 * @description G9: 기타출고(반품/폐기/기타) 승인 워크플로우 서비스
 *              StockTransaction의 status를 PENDING_APPROVAL로 활용 (별도 테이블 없음)
 *
 * 초보자 가이드:
 * 1. create(): 출고 트랜잭션을 PENDING_APPROVAL 상태로 생성 + 재고 잠금
 * 2. approve(): 승인 → status를 DONE으로 변경 + 실제 재고 차감
 * 3. reject(): 거절 → status를 REJECTED + 재고 잠금 해제
 * 4. cancel(): 취소 → status를 CANCELED + 재고 잠금 해제
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';

@Injectable()
export class MatOutRequestService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
  ) {}

  /** 승인 대기 목록 조회 */
  async findPending(query: { page?: number; limit?: number }, company?: string, plant?: string) {
    const { page = 1, limit = 20 } = query;
    const where: any = {
      status: 'PENDING_APPROVAL',
      ...(company && { company }),
      ...(plant && { plant }),
    };
    const [data, total] = await this.stockTxRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit };
  }

  /** 출고 요청 등록 (PENDING_APPROVAL 상태 + 재고 잠금) */
  async create(dto: { matUid: string; itemCode: string; qty: number; outType: string; reason?: string; workerId?: string; company?: string; plant?: string }) {
    const stock = await this.matStockRepo.findOne({
      where: { matUid: dto.matUid, itemCode: dto.itemCode },
    });
    if (!stock) throw new NotFoundException('재고를 찾을 수 없습니다.');
    if (stock.qty - (stock.reservedQty ?? 0) < dto.qty) {
      throw new BadRequestException('가용재고가 부족합니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

      const tx = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MAT_OUT',
        fromWarehouseId: stock.warehouseCode,
        itemCode: dto.itemCode,
        matUid: dto.matUid,
        qty: -dto.qty,
        remark: `기타출고 요청 (${dto.outType}): ${dto.reason || ''}`,
        workerId: dto.workerId,
        refType: dto.outType,
        status: 'PENDING_APPROVAL',
        company: dto.company,
        plant: dto.plant,
      });
      await queryRunner.manager.save(tx);

      // 재고 잠금
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: dto.itemCode, matUid: dto.matUid },
        { reservedQty: (stock.reservedQty ?? 0) + dto.qty },
      );

      await queryRunner.commitTransaction();
      return tx;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** 승인 → 실제 출고 (재고 차감) */
  async approve(transNo: string, approverId: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo } });
    if (!tx) throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('승인 대기 상태가 아닙니다.');

    const stock = await this.matStockRepo.findOne({
      where: { matUid: tx.matUid ?? undefined, itemCode: tx.itemCode },
    });
    if (!stock) throw new NotFoundException('재고를 찾을 수 없습니다.');

    const absQty = Math.abs(tx.qty);

    // 재고 차감 + 잠금 해제
    await this.matStockRepo.update(
      { warehouseCode: stock.warehouseCode, itemCode: tx.itemCode, matUid: tx.matUid ?? '' },
      {
        qty: stock.qty - absQty,
        reservedQty: Math.max(0, (stock.reservedQty ?? 0) - absQty),
      },
    );

    // 승인 처리
    await this.stockTxRepo.update({ transNo }, {
      status: 'DONE',
      approverId,
      approvedAt: new Date(),
    });

    return { transNo, status: 'DONE' };
  }

  /** 거절 → 잠금 해제 */
  async reject(transNo: string, approverId: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo } });
    if (!tx) throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('승인 대기 상태가 아닙니다.');

    await this.unlockStock(tx);
    await this.stockTxRepo.update({ transNo }, {
      status: 'REJECTED',
      approverId,
      approvedAt: new Date(),
    });
    return { transNo, status: 'REJECTED' };
  }

  /** 취소 → 잠금 해제 */
  async cancel(transNo: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo } });
    if (!tx) throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('승인 대기 상태만 취소 가능합니다.');

    await this.unlockStock(tx);
    await this.stockTxRepo.update({ transNo }, { status: 'CANCELED' });
    return { transNo, status: 'CANCELED' };
  }

  private async unlockStock(tx: StockTransaction) {
    if (!tx.matUid) return;
    const stock = await this.matStockRepo.findOne({
      where: { matUid: tx.matUid, itemCode: tx.itemCode },
    });
    if (stock) {
      const absQty = Math.abs(tx.qty);
      await this.matStockRepo.update(
        { warehouseCode: stock.warehouseCode, itemCode: tx.itemCode, matUid: tx.matUid },
        { reservedQty: Math.max(0, (stock.reservedQty ?? 0) - absQty) },
      );
    }
  }
}
