/**
 * @file src/modules/material/services/lot-merge.service.ts
 * @description 자재 LOT 병합 비즈니스 로직 (TypeORM)
 *
 * 초보자 가이드:
 * 1. 같은 품목(partId)의 LOT만 병합 가능
 * 2. 대상 LOT에 수량 합산, 원본 LOT은 DEPLETED 처리
 * 3. MatStock도 동기화, StockTransaction 이력 기록
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In, Like } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { LotMergeDto, LotMergeQueryDto } from '../dto/lot-merge.dto';

@Injectable()
export class LotMergeService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async findMergeableLots(query: LotMergeQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 5000, search, partId } = query;
    const skip = (page - 1) * limit;

    const qb = this.matLotRepository.createQueryBuilder('lot')
      .where('lot.deletedAt IS NULL')
      .andWhere('lot.currentQty > 0')
      .andWhere("lot.status != 'DEPLETED'")
      .andWhere("lot.status != 'HOLD'");

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });

    if (partId) {
      qb.andWhere('lot.partId = :partId', { partId });
    }
    if (search) {
      qb.andWhere(
        '(UPPER(lot.lotNo) LIKE UPPER(:search))',
        { search: `%${search}%` },
      );
    }

    const [lots, total] = await Promise.all([
      qb.orderBy('lot.partId', 'ASC')
        .addOrderBy('lot.lotNo', 'ASC')
        .skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    const partIds = lots.map(l => l.partId).filter(Boolean);
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) }, select: ['id', 'partCode', 'partName', 'unit'] })
      : [];
    const partMap = new Map(parts.map(p => [p.id, p]));

    const data = lots.map(lot => {
      const part = partMap.get(lot.partId);
      return { ...lot, partCode: part?.partCode, partName: part?.partName, unit: part?.unit };
    });

    return { data, total, page, limit };
  }

  async merge(dto: LotMergeDto) {
    const { sourceLotIds, targetLotId, remark } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 모든 LOT 조회
      const lots = await queryRunner.manager.find(MatLot, {
        where: { id: In(sourceLotIds), deletedAt: IsNull() },
      });

      if (lots.length < 2) {
        throw new BadRequestException('병합하려면 2개 이상의 유효한 LOT이 필요합니다.');
      }

      // 같은 품목인지 검증
      const partIds = new Set(lots.map(l => l.partId));
      if (partIds.size > 1) {
        throw new BadRequestException('서로 다른 품목의 LOT은 병합할 수 없습니다.');
      }

      // HOLD/DEPLETED 상태 검증
      for (const lot of lots) {
        if (lot.status === 'HOLD') {
          throw new BadRequestException(`HOLD 상태인 LOT은 병합할 수 없습니다: ${lot.lotNo}`);
        }
        if (lot.status === 'DEPLETED' || lot.currentQty <= 0) {
          throw new BadRequestException(`재고가 없는 LOT은 병합할 수 없습니다: ${lot.lotNo}`);
        }
      }

      // 대상 LOT 결정 (지정되지 않으면 첫 번째)
      const target = targetLotId
        ? lots.find(l => l.id === targetLotId)
        : lots[0];
      if (!target) {
        throw new NotFoundException('대상 LOT을 찾을 수 없습니다.');
      }

      const sources = lots.filter(l => l.id !== target.id);
      const totalMergeQty = sources.reduce((sum, l) => sum + l.currentQty, 0);

      // 품목 정보
      const part = await queryRunner.manager.findOne(PartMaster, { where: { id: target.partId } });

      // 대상 LOT에 수량 합산
      const newTargetQty = target.currentQty + totalMergeQty;
      await queryRunner.manager.update(MatLot, target.id, {
        currentQty: newTargetQty,
        initQty: target.initQty + totalMergeQty,
      });

      // 원본 LOT들 소진 처리
      for (const src of sources) {
        await queryRunner.manager.update(MatLot, src.id, {
          currentQty: 0,
          status: 'DEPLETED',
        });
      }

      // MatStock 동기화 — 대상 재고에 합산, 원본 재고 0으로
      const targetStock = await queryRunner.manager.findOne(MatStock, {
        where: { lotId: target.id },
      });

      if (targetStock) {
        await queryRunner.manager.update(MatStock, targetStock.id, {
          qty: targetStock.qty + totalMergeQty,
          availableQty: targetStock.availableQty + totalMergeQty,
        });
      }

      for (const src of sources) {
        const srcStock = await queryRunner.manager.findOne(MatStock, {
          where: { lotId: src.id },
        });
        if (srcStock) {
          await queryRunner.manager.update(MatStock, srcStock.id, {
            qty: 0,
            availableQty: 0,
          });
        }
      }

      // 트랜잭션 이력
      const transNo = await this.generateTransNo();
      const sourceNos = sources.map(s => s.lotNo).join(', ');
      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'LOT_MERGE',
        transDate: new Date(),
        partId: target.partId,
        lotId: target.id,
        qty: totalMergeQty,
        refType: 'LOT_MERGE',
        refId: target.id,
        remark: remark || `LOT 병합: [${sourceNos}] → ${target.lotNo}`,
        status: 'DONE',
      });

      await queryRunner.commitTransaction();

      return {
        targetLotId: target.id,
        targetLotNo: target.lotNo,
        mergedLotNos: sources.map(s => s.lotNo),
        totalMergedQty: totalMergeQty,
        newTotalQty: newTargetQty,
        partCode: part?.partCode,
        partName: part?.partName,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `MRG${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const lastTrans = await this.stockTransactionRepository.findOne({
      where: { transNo: Like(`${prefix}%`) } as any,
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
