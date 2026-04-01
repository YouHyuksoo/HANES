/**
 * @file services/mat-out-request.service.ts
 * @description G9: 기타출고(반품/폐기/기타) 승인 워크플로우 서비스
 *
 * 초보자 가이드:
 * 1. create(): 출고요청 등록 → 대상 시리얼 재고 잠금 (reservedQty 증가)
 * 2. approve(): 유권한자 승인 → 실제 출고 처리 (StockTransaction 생성)
 * 3. reject(): 거절 → 재고 잠금 해제
 * 4. cancel(): 요청 취소 → 재고 잠금 해제
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MatOutRequest } from '../../../entities/mat-out-request.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';

@Injectable()
export class MatOutRequestService {
  constructor(
    @InjectRepository(MatOutRequest)
    private readonly outRequestRepo: Repository<MatOutRequest>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
  ) {}

  /** 출고요청 목록 조회 */
  async findAll(query: { status?: string; outType?: string; page?: number; limit?: number }, company?: string, plant?: string) {
    const { status, outType, page = 1, limit = 20 } = query;
    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(status && { status }),
      ...(outType && { outType }),
    };
    const [data, total] = await this.outRequestRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit };
  }

  /** 출고요청 등록 + 재고 잠금 */
  async create(dto: { matUid: string; itemCode: string; qty: number; outType: string; reason?: string; requesterId?: string; company?: string; plant?: string }) {
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
      const requestNo = await this.numRuleService.nextNumberInTx(queryRunner, 'MAT_OUT_REQ');

      const request = queryRunner.manager.create(MatOutRequest, {
        requestNo,
        matUid: dto.matUid,
        itemCode: dto.itemCode,
        qty: dto.qty,
        outType: dto.outType,
        reason: dto.reason,
        requesterId: dto.requesterId,
        status: 'REQUESTED',
        lockYn: 'Y',
        company: dto.company,
        plant: dto.plant,
      });
      await queryRunner.manager.save(request);

      // 재고 잠금
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: dto.itemCode, matUid: dto.matUid },
        { reservedQty: (stock.reservedQty ?? 0) + dto.qty },
      );

      await queryRunner.commitTransaction();
      return request;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** 승인 → 실제 출고 */
  async approve(requestNo: string, approverId: string) {
    const req = await this.outRequestRepo.findOne({ where: { requestNo } });
    if (!req) throw new NotFoundException('출고요청을 찾을 수 없습니다.');
    if (req.status !== 'REQUESTED') throw new BadRequestException('승인 대기 상태가 아닙니다.');

    const stock = await this.matStockRepo.findOne({
      where: { matUid: req.matUid, itemCode: req.itemCode },
    });
    if (!stock) throw new NotFoundException('재고를 찾을 수 없습니다.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

      // 실제 출고
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: req.itemCode, matUid: req.matUid },
        {
          qty: stock.qty - req.qty,
          reservedQty: Math.max(0, (stock.reservedQty ?? 0) - req.qty),
        },
      );

      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'MAT_OUT',
        fromWarehouseId: stock.warehouseCode,
        itemCode: req.itemCode,
        matUid: req.matUid,
        qty: -req.qty,
        remark: `기타출고 승인 (${req.outType}): ${req.reason || ''}`,
        refType: 'OUT_REQUEST',
        refId: requestNo,
        company: req.company,
        plant: req.plant,
      });

      await queryRunner.manager.update(MatOutRequest, { requestNo }, {
        status: 'APPROVED',
        approverId,
        approvedAt: new Date(),
      });

      await queryRunner.commitTransaction();
      return { requestNo, status: 'APPROVED' };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** 거절 → 잠금 해제 */
  async reject(requestNo: string, approverId: string) {
    const req = await this.outRequestRepo.findOne({ where: { requestNo } });
    if (!req) throw new NotFoundException('출고요청을 찾을 수 없습니다.');
    if (req.status !== 'REQUESTED') throw new BadRequestException('승인 대기 상태가 아닙니다.');

    await this.unlockStock(req);
    await this.outRequestRepo.update({ requestNo }, {
      status: 'REJECTED',
      approverId,
      approvedAt: new Date(),
    });
    return { requestNo, status: 'REJECTED' };
  }

  /** 요청 취소 → 잠금 해제 */
  async cancel(requestNo: string) {
    const req = await this.outRequestRepo.findOne({ where: { requestNo } });
    if (!req) throw new NotFoundException('출고요청을 찾을 수 없습니다.');
    if (req.status !== 'REQUESTED') throw new BadRequestException('승인 대기 상태만 취소할 수 있습니다.');

    await this.unlockStock(req);
    await this.outRequestRepo.update({ requestNo }, { status: 'CANCELLED' });
    return { requestNo, status: 'CANCELLED' };
  }

  private async unlockStock(req: MatOutRequest) {
    if (req.lockYn !== 'Y') return;
    const stock = await this.matStockRepo.findOne({
      where: { matUid: req.matUid, itemCode: req.itemCode },
    });
    if (stock) {
      await this.matStockRepo.update(
        { warehouseCode: stock.warehouseCode, itemCode: req.itemCode, matUid: req.matUid },
        { reservedQty: Math.max(0, (stock.reservedQty ?? 0) - req.qty) },
      );
    }
  }
}
