/**
 * @file src/modules/material/services/mat-issue.service.ts
 * @description 자재출고 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatIssue 테이블**: 작업지시/외주처로의 자재 불출 이력
 * 2. **주요 필드**: issueNo, orderNo, matUid, issueQty, issueType
 * 3. **출고 유형**: PROD(생산), SUBCON(외주), SAMPLE(샘플), ADJ(조정)
 * 4. **StockTransaction 연동**: 출고 시 MAT_OUT 타입 수불 트랜잭션도 함께 생성
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { CreateMatIssueDto, MatIssueQueryDto } from '../dto/mat-issue.dto';
import { ScanIssueDto } from '../dto/scan-issue.dto';
import { NumRuleService } from '../../num-rule/num-rule.service';

@Injectable()
export class MatIssueService {
  constructor(
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
  ) {}

  /**
   * 출고 이력 데이터를 평면화하여 반환
   * lot, part 중첩 구조를 평면화된 필드로 변환
   */
  private async flattenIssue(issue: MatIssue) {
    if (!issue) return null;

    const lot = issue.matUid ? await this.matLotRepository.findOne({ where: { matUid: issue.matUid } }) : null;
    const part = lot?.itemCode ? await this.partMasterRepository.findOne({ where: { itemCode: lot.itemCode } }) : null;
    const jobOrder = issue.orderNo ? await this.jobOrderRepository.findOne({ where: { orderNo: issue.orderNo } }) : null;

    return {
      ...issue,
      matUid: lot?.matUid ?? null,
      itemCode: part?.itemCode ?? null,
      itemName: part?.itemName ?? null,
      unit: part?.unit ?? null,
      jobOrderNo: jobOrder?.orderNo ?? null,
    };
  }

  async findAll(query: MatIssueQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, orderNo, matUid, issueType, issueDateFrom, issueDateTo, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(orderNo && { orderNo }),
      ...(matUid && { matUid: matUid }),
      ...(issueType && { issueType }),
      ...(status && { status }),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (issueDateFrom && issueDateTo) {
      where.issueDate = Between(new Date(issueDateFrom), new Date(issueDateTo));
    } else if (issueDateFrom) {
      where.issueDate = Between(new Date(issueDateFrom), new Date());
    } else if (issueDateTo) {
      where.issueDate = Between(new Date('1900-01-01'), new Date(issueDateTo));
    }

    const [data, total] = await Promise.all([
      this.matIssueRepository.find({
        where,
        skip,
        take: limit,
        order: { issueDate: 'DESC' },
      }),
      this.matIssueRepository.count({ where }),
    ]);

    const flattenedData = await Promise.all(data.map((issue) => this.flattenIssue(issue)));

    return { data: flattenedData, total, page, limit };
  }

  async findById(issueNo: string, seq: number) {
    const issue = await this.matIssueRepository.findOne({ where: { issueNo, seq } });

    if (!issue) throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${issueNo}-${seq}`);
    return this.flattenIssue(issue);
  }

  async create(dto: CreateMatIssueDto) {
    const { orderNo, prodResultNo, warehouseCode, issueType, items, remark, workerId } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];
      // 같은 배치의 모든 아이템에 동일한 issueNo 부여
      const issueNo = await this.numRuleService.nextNumberInTx(queryRunner, 'MAT_ISSUE');
      let seqCounter = 1;

      for (const item of items) {
        // LOT 유효성 확인
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid: item.matUid },
        });

        if (!lot) {
          throw new BadRequestException(`LOT을 찾을 수 없습니다: ${item.matUid}`);
        }

        if (lot.iqcStatus !== 'PASS') {
          throw new BadRequestException(`IQC 합격되지 않은 LOT입니다: ${lot.matUid}`);
        }

        if (lot.status === 'HOLD') {
          throw new BadRequestException(`홀드 상태인 LOT은 출고할 수 없습니다: ${lot.matUid}`);
        }

        // MatStock에서 재고 확인
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: { matUid: lot.matUid },
          lock: { mode: 'pessimistic_write' },
        });
        const stockQty = stock?.qty ?? 0;

        if (stockQty < item.issueQty) {
          throw new BadRequestException(`LOT 재고 부족: ${lot.matUid} (현재: ${stockQty}, 요청: ${item.issueQty})`);
        }

        // 1. 출고 이력 생성 (issueNo + seq)
        const currentSeq = seqCounter++;
        const issue = queryRunner.manager.create(MatIssue, {
          issueNo,
          seq: currentSeq,
          orderNo,
          prodResultNo: prodResultNo || null,
          matUid: item.matUid,
          issueQty: item.issueQty,
          issueType,
          workerId,
          remark,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
        });
        const savedIssue = await queryRunner.manager.save(issue);

        // 2. StockTransaction(MAT_OUT) 생성 (수불원장)
        const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'MAT_OUT',
          fromWarehouseId: warehouseCode || null,
          itemCode: lot.itemCode,
          matUid: item.matUid,
          qty: -item.issueQty,
          remark: remark || `자재출고: ${lot.matUid}`,
          workerId,
          refType: 'MAT_ISSUE',
          refId: `${savedIssue.issueNo}-${savedIssue.seq}`,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
        });
        await queryRunner.manager.save(stockTx);

        // 3. MatStock 재고 차감
        if (stock) {
          const newStockQty = Math.max(0, stock.qty - item.issueQty);
          await queryRunner.manager.update(MatStock,
            { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
            { qty: newStockQty, availableQty: Math.max(0, stock.availableQty - item.issueQty) },
          );

          // MatStock.qty가 0이면 MatLot 상태를 DEPLETED로 변경
          if (newStockQty <= 0) {
            await queryRunner.manager.update(MatLot, lot.matUid, { status: 'DEPLETED' });
          }
        }

        results.push(await this.flattenIssue(savedIssue));
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 바코드 스캔 출고 (LOT 전량 출고)
   * - matUid로 LOT 조회 → IQC/소진 검증 → 전량 출고 → 품목 정보 반환
   */
  async scanIssue(dto: ScanIssueDto) {
    const lot = await this.matLotRepository.findOne({
      where: { matUid: dto.matUid },
    });
    if (!lot) {
      throw new BadRequestException(`LOT을 찾을 수 없습니다: ${dto.matUid}`);
    }
    if (lot.iqcStatus !== 'PASS') {
      throw new BadRequestException(
        `IQC 미합격 LOT입니다: ${dto.matUid} (상태: ${lot.iqcStatus})`,
      );
    }
    if (lot.status === 'HOLD') {
      throw new BadRequestException(
        `홀드 상태인 LOT은 출고할 수 없습니다: ${dto.matUid}`,
      );
    }
    // MatStock에서 재고 확인
    const stock = await this.matStockRepository.findOne({
      where: { matUid: dto.matUid },
    });
    const stockQty = stock?.qty ?? 0;

    if (lot.status === 'DEPLETED' || stockQty <= 0) {
      throw new BadRequestException(
        `이미 소진된 LOT입니다: ${dto.matUid}`,
      );
    }

    const result = await this.create({
      warehouseCode: dto.warehouseCode,
      issueType: dto.issueType,
      items: [{ matUid: lot.matUid, issueQty: stockQty }],
      workerId: dto.workerId,
      remark: dto.remark ?? `바코드 스캔 출고: ${dto.matUid}`,
    });

    const part = await this.partMasterRepository.findOne({
      where: { itemCode: lot.itemCode },
    });

    return {
      ...result[0],
      matUid: lot.matUid,
      issuedQty: stockQty,
      itemCode: part?.itemCode,
      itemName: part?.itemName,
      unit: part?.unit,
    };
  }

  async cancel(issueNo: string, seq: number, reason?: string) {
    const rawIssue = await this.matIssueRepository.findOne({ where: { issueNo, seq } });
    if (!rawIssue) {
      throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${issueNo}-${seq}`);
    }

    if (rawIssue.status !== 'DONE') {
      throw new BadRequestException('이미 취소된 출고입니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 출고 상태 변경
      await queryRunner.manager.update(MatIssue, { issueNo, seq }, { status: 'CANCELED', remark: reason });

      // 2. StockTransaction 역분개 (MAT_OUT 취소)
      const refId = `${issueNo}-${seq}`;
      const originalTx = await queryRunner.manager.findOne(StockTransaction, {
        where: { refType: 'MAT_ISSUE', refId, status: 'DONE' },
      });

      if (originalTx) {
        const cancelTransNo = await this.numRuleService.nextNumberInTx(queryRunner, 'CANCEL_TX');
        const cancelTx = queryRunner.manager.create(StockTransaction, {
          transNo: cancelTransNo,
          transType: 'MAT_OUT',
          fromWarehouseId: originalTx.fromWarehouseId,
          itemCode: originalTx.itemCode,
          matUid: originalTx.matUid,
          qty: -originalTx.qty,
          remark: reason || `출고취소 역분개: ${originalTx.transNo}`,
          refType: 'MAT_ISSUE_CANCEL',
          refId: refId,
          cancelRefId: originalTx.transNo,
          status: 'DONE',
          company: originalTx.company,
          plant: originalTx.plant,
        });
        await queryRunner.manager.save(cancelTx);

        // 원본 트랜잭션 상태 변경
        await queryRunner.manager.update(StockTransaction, { transNo: originalTx.transNo }, { status: 'CANCELED' });
      }

      // 3. MatStock 재고 복구 + MatLot 상태 복구
      const stock = rawIssue.matUid ? await queryRunner.manager.findOne(MatStock, {
        where: { matUid: rawIssue.matUid },
        lock: { mode: 'pessimistic_write' },
      }) : null;

      if (stock) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
          { qty: stock.qty + rawIssue.issueQty, availableQty: stock.availableQty + rawIssue.issueQty },
        );

        // MatLot 상태를 NORMAL로 복구 (재고가 복구되었으므로)
        if (rawIssue.matUid) {
          await queryRunner.manager.update(MatLot, rawIssue.matUid, { status: 'NORMAL' });
        }
      }

      await queryRunner.commitTransaction();
      return { issueNo, seq, status: 'CANCELED' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
