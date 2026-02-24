/**
 * @file src/modules/material/services/mat-issue.service.ts
 * @description 자재출고 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatIssue 테이블**: 작업지시/외주처로의 자재 불출 이력
 * 2. **주요 필드**: issueNo, jobOrderId, lotId, issueQty, issueType
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

    const lot = issue.lotId ? await this.matLotRepository.findOne({ where: { id: issue.lotId } }) : null;
    const part = lot?.partId ? await this.partMasterRepository.findOne({ where: { id: lot.partId } }) : null;
    const jobOrder = issue.jobOrderId ? await this.jobOrderRepository.findOne({ where: { id: issue.jobOrderId } }) : null;

    return {
      ...issue,
      lotId: lot?.id ?? null,
      lotNo: lot?.lotNo ?? null,
      partId: part?.id ?? null,
      partCode: part?.partCode ?? null,
      partName: part?.partName ?? null,
      unit: part?.unit ?? null,
      jobOrderNo: jobOrder?.orderNo ?? null,
    };
  }

  async findAll(query: MatIssueQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, jobOrderId, lotId, issueType, issueDateFrom, issueDateTo, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(jobOrderId && { jobOrderId }),
      ...(lotId && { lotId }),
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

  async findById(id: string) {
    const issue = await this.matIssueRepository.findOne({ where: { id } });

    if (!issue) throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${id}`);
    return this.flattenIssue(issue);
  }

  async create(dto: CreateMatIssueDto) {
    const { jobOrderId, prodResultId, warehouseCode, issueType, items, remark, workerId } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];
      // 같은 배치의 모든 아이템에 동일한 issueNo 부여
      const issueNo = await this.numRuleService.nextNumberInTx(queryRunner, 'MAT_ISSUE');

      for (const item of items) {
        // LOT 유효성 확인
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { id: item.lotId },
        });

        if (!lot) {
          throw new BadRequestException(`LOT을 찾을 수 없습니다: ${item.lotId}`);
        }

        if (lot.iqcStatus !== 'PASS') {
          throw new BadRequestException(`IQC 합격되지 않은 LOT입니다: ${lot.lotNo}`);
        }

        if (lot.status === 'HOLD') {
          throw new BadRequestException(`홀드 상태인 LOT은 출고할 수 없습니다: ${lot.lotNo}`);
        }

        if (lot.currentQty < item.issueQty) {
          throw new BadRequestException(`LOT 재고 부족: ${lot.lotNo} (현재: ${lot.currentQty}, 요청: ${item.issueQty})`);
        }

        // 1. 출고 이력 생성 (issueNo 포함)
        const issue = queryRunner.manager.create(MatIssue, {
          issueNo,
          jobOrderId,
          prodResultId, // 생산실적과 연결
          lotId: item.lotId,
          issueQty: item.issueQty,
          issueType,
          workerId,
          remark,
          status: 'DONE',
        });
        const savedIssue = await queryRunner.manager.save(issue);

        // 2. StockTransaction(MAT_OUT) 생성 (수불원장)
        const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'MAT_OUT',
          fromWarehouseId: warehouseCode || null,
          partId: lot.partId,
          lotId: item.lotId,
          qty: -item.issueQty,
          remark: remark || `자재출고: ${lot.lotNo}`,
          workerId,
          refType: 'MAT_ISSUE',
          refId: savedIssue.id,
          status: 'DONE',
        });
        await queryRunner.manager.save(stockTx);

        // 3. LOT 재고 차감
        await queryRunner.manager.update(MatLot, lot.id, {
          currentQty: lot.currentQty - item.issueQty,
          status: lot.currentQty - item.issueQty === 0 ? 'DEPLETED' : lot.status,
        });

        // 4. 창고 재고 차감 (warehouseCode가 있는 경우)
        if (warehouseCode) {
          const stock = await queryRunner.manager.findOne(MatStock, {
            where: { partId: lot.partId, warehouseCode, lotId: lot.id },
          });

          if (stock) {
            await queryRunner.manager.update(MatStock, stock.id, {
              qty: Math.max(0, stock.qty - item.issueQty),
              availableQty: Math.max(0, stock.availableQty - item.issueQty),
            });
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
   * - lotNo로 LOT 조회 → IQC/소진 검증 → 전량 출고 → 품목 정보 반환
   */
  async scanIssue(dto: ScanIssueDto) {
    const lot = await this.matLotRepository.findOne({
      where: { lotNo: dto.lotNo },
    });
    if (!lot) {
      throw new BadRequestException(`LOT을 찾을 수 없습니다: ${dto.lotNo}`);
    }
    if (lot.iqcStatus !== 'PASS') {
      throw new BadRequestException(
        `IQC 미합격 LOT입니다: ${dto.lotNo} (상태: ${lot.iqcStatus})`,
      );
    }
    if (lot.status === 'HOLD') {
      throw new BadRequestException(
        `홀드 상태인 LOT은 출고할 수 없습니다: ${dto.lotNo}`,
      );
    }
    if (lot.status === 'DEPLETED' || lot.currentQty <= 0) {
      throw new BadRequestException(
        `이미 소진된 LOT입니다: ${dto.lotNo}`,
      );
    }

    const result = await this.create({
      warehouseCode: dto.warehouseCode,
      issueType: dto.issueType,
      items: [{ lotId: lot.id, issueQty: lot.currentQty }],
      workerId: dto.workerId,
      remark: dto.remark ?? `바코드 스캔 출고: ${dto.lotNo}`,
    });

    const part = await this.partMasterRepository.findOne({
      where: { id: lot.partId },
    });

    return {
      ...result[0],
      lotNo: lot.lotNo,
      issuedQty: lot.currentQty,
      partCode: part?.partCode,
      partName: part?.partName,
      unit: part?.unit,
    };
  }

  async cancel(id: string, reason?: string) {
    const rawIssue = await this.matIssueRepository.findOne({ where: { id } });
    if (!rawIssue) {
      throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${id}`);
    }

    if (rawIssue.status !== 'DONE') {
      throw new BadRequestException('이미 취소된 출고입니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 출고 상태 변경
      await queryRunner.manager.update(MatIssue, id, { status: 'CANCELED', remark: reason });

      // 2. StockTransaction 역분개 (MAT_OUT 취소)
      const originalTx = await queryRunner.manager.findOne(StockTransaction, {
        where: { refType: 'MAT_ISSUE', refId: id, status: 'DONE' },
      });

      if (originalTx) {
        const cancelTransNo = await this.numRuleService.nextNumberInTx(queryRunner, 'CANCEL_TX');
        const cancelTx = queryRunner.manager.create(StockTransaction, {
          transNo: cancelTransNo,
          transType: 'MAT_OUT',
          fromWarehouseId: originalTx.fromWarehouseId,
          partId: originalTx.partId,
          lotId: originalTx.lotId,
          qty: -originalTx.qty,
          remark: reason || `출고취소 역분개: ${originalTx.transNo}`,
          refType: 'MAT_ISSUE_CANCEL',
          refId: id,
          cancelRefId: originalTx.id,
          status: 'DONE',
        });
        await queryRunner.manager.save(cancelTx);

        // 원본 트랜잭션 상태 변경
        await queryRunner.manager.update(StockTransaction, originalTx.id, { status: 'CANCELED' });
      }

      // 3. LOT 재고 복구
      if (rawIssue.lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: rawIssue.lotId } });
        if (lot) {
          await queryRunner.manager.update(MatLot, lot.id, {
            currentQty: lot.currentQty + rawIssue.issueQty,
            status: 'NORMAL',
          });
        }
      }

      // 4. 창고 재고 복구 (stock이 있는 경우)
      const stock = rawIssue.lotId ? await queryRunner.manager.findOne(MatStock, {
        where: { lotId: rawIssue.lotId },
      }) : null;

      if (stock) {
        await queryRunner.manager.update(MatStock, stock.id, {
          qty: stock.qty + rawIssue.issueQty,
          availableQty: stock.availableQty + rawIssue.issueQty,
        });
      }

      await queryRunner.commitTransaction();
      return { id, status: 'CANCELED' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
