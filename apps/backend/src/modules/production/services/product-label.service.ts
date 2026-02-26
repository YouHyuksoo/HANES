/**
 * @file product-label.service.ts
 * @description 제품 라벨 발행 서비스 — 생산실적/OQC PASS → prdUid 채번 → 제품 라벨 발행
 *
 * 초보자 가이드:
 * 1. findLabelableResults(): 라벨 미발행 생산실적 조회 (JobOrder join으로 itemCode 획득)
 * 2. findLabelableOqcPassed(): OQC 합격 + 라벨 미발행건 조회
 * 3. createPrdLabels(): prdUid 채번 → ProdResult 업데이트 → 인쇄 로그 저장
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ProdResult } from '../../../entities/prod-result.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { UidGeneratorService } from '../../../shared/uid-generator.service';
import { CreatePrdLabelsDto, PrdLabelResultDto } from '../dto/product-label.dto';

@Injectable()
export class ProductLabelService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly uidGenerator: UidGeneratorService,
    @InjectRepository(ProdResult)
    private readonly prodResultRepo: Repository<ProdResult>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    @InjectRepository(LabelPrintLog)
    private readonly printLogRepo: Repository<LabelPrintLog>,
  ) {}

  /** 라벨 미발행 생산실적 목록 (JobOrder join으로 itemCode 획득) */
  async findLabelableResults() {
    const results = await this.prodResultRepo.find({
      where: { prdUid: IsNull() },
      relations: ['jobOrder'],
      order: { createdAt: 'DESC' },
    });
    return this.enrichWithPartInfo(results);
  }

  /** OQC 합격 + 라벨 미발행 생산실적 */
  async findLabelableOqcPassed() {
    const results = await this.prodResultRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.jobOrder', 'jo')
      .innerJoin('r.inspectResults', 'ir', 'ir.result = :result', { result: 'PASS' })
      .where('r.prdUid IS NULL')
      .orderBy('r.createdAt', 'DESC')
      .getMany();
    return this.enrichWithPartInfo(results);
  }

  /** prdUid 채번 + ProdResult 업데이트 + 라벨 인쇄 로그 */
  async createPrdLabels(dto: CreatePrdLabelsDto): Promise<PrdLabelResultDto[]> {
    const prodResult = await this.prodResultRepo.findOne({
      where: { id: dto.sourceId },
      relations: ['jobOrder'],
    });
    if (!prodResult) throw new NotFoundException('생산실적을 찾을 수 없습니다.');

    const itemCode = prodResult.jobOrder?.itemCode ?? '';
    const part = itemCode
      ? await this.partRepo.findOne({ where: { itemCode } })
      : null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: PrdLabelResultDto[] = [];

      for (let i = 0; i < dto.qty; i++) {
        const prdUid = await this.uidGenerator.nextPrdUid(queryRunner);
        results.push({
          prdUid,
          itemCode,
          itemName: part?.itemName ?? '',
        });
      }

      if (dto.qty === 1 && !prodResult.prdUid) {
        await queryRunner.manager.update(ProdResult, prodResult.id, {
          prdUid: results[0].prdUid,
        });
      }

      const log = queryRunner.manager.create(LabelPrintLog, {
        category: 'prd_uid',
        printMode: 'BROWSER',
        uidList: JSON.stringify(results.map((r) => r.prdUid)),
        labelCount: dto.qty,
        status: 'SUCCESS',
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private enrichWithPartInfo(results: ProdResult[]) {
    return results.map((r) => {
      const itemCode = r.jobOrder?.itemCode ?? '';
      const part = r.jobOrder?.part;
      return {
        id: r.id,
        orderNo: r.orderNo,
        itemCode,
        itemName: part?.itemName ?? '',
        goodQty: r.goodQty,
        prdUid: r.prdUid,
        createdAt: r.createdAt,
      };
    });
  }
}
