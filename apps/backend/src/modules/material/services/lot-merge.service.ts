/**
 * @file src/modules/material/services/lot-merge.service.ts
 * @description 자재 LOT 병합 비즈니스 로직 (TypeORM)
 *
 * 초보자 가이드:
 * 1. 같은 품목(itemCode)의 LOT만 병합 가능
 * 2. 대상 LOT에 수량 합산, 원본 LOT은 DEPLETED 처리
 * 3. MatStock도 동기화, StockTransaction 이력 기록
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like, FindOptionsWhere } from 'typeorm';
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
    const { page = 1, limit = 50, search, itemCode } = query;
    const skip = (page - 1) * limit;

    const qb = this.matLotRepository.createQueryBuilder('lot')
      .innerJoin(MatStock, 'stock', 'stock.matUid = lot.matUid')
      .where('stock.qty > 0')
      .andWhere("lot.status != 'DEPLETED'")
      .andWhere("lot.status != 'HOLD'");

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });

    if (itemCode) {
      qb.andWhere('lot.itemCode = :itemCode', { itemCode });
    }
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(lot.matUid LIKE :search)',
        { search: `%${upper}%` },
      );
    }

    const [lots, total] = await Promise.all([
      qb.orderBy('lot.itemCode', 'ASC')
        .addOrderBy('lot.matUid', 'ASC')
        .skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    const itemCodes = lots.map(l => l.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) }, select: ['itemCode', 'itemName', 'unit'] })
      : [];
    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    const data = lots.map(lot => {
      const part = partMap.get(lot.itemCode);
      return { ...lot, itemCode: part?.itemCode, itemName: part?.itemName, unit: part?.unit };
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
        where: { matUid: In(sourceLotIds) },
      });

      if (lots.length < 2) {
        throw new BadRequestException('병합하려면 2개 이상의 유효한 LOT이 필요합니다.');
      }

      // 같은 품목인지 검증
      const itemCodes = new Set(lots.map(l => l.itemCode));
      if (itemCodes.size > 1) {
        throw new BadRequestException('서로 다른 품목의 LOT은 병합할 수 없습니다.');
      }

      // Minor: 최초 시리얼(origin) 동일 여부 검증 — THN 문서 요구사항
      const origins = new Set(lots.map(l => (l as any).originMatUid || l.matUid));
      if (origins.size > 1) {
        throw new BadRequestException('최초 시리얼이 다른 LOT은 병합할 수 없습니다.');
      }

      // 모든 LOT의 재고 조회 (MatStock 기준)
      const lotMatUids = lots.map(l => l.matUid);
      const stocks = await queryRunner.manager.find(MatStock, {
        where: { matUid: In(lotMatUids) },
      });
      const stockMap = new Map(stocks.map(s => [s.matUid, s]));

      // HOLD/DEPLETED/재고없음 상태 검증
      for (const lot of lots) {
        if (lot.status === 'HOLD') {
          throw new BadRequestException(`HOLD 상태인 LOT은 병합할 수 없습니다: ${lot.matUid}`);
        }
        const lotStock = stockMap.get(lot.matUid);
        if (lot.status === 'DEPLETED' || !lotStock || lotStock.qty <= 0) {
          throw new BadRequestException(`재고가 없는 LOT은 병합할 수 없습니다: ${lot.matUid}`);
        }
      }

      // 대상 LOT 결정 (지정되지 않으면 첫 번째)
      const target = targetLotId
        ? lots.find(l => l.matUid === targetLotId)
        : lots[0];
      if (!target) {
        throw new NotFoundException('대상 LOT을 찾을 수 없습니다.');
      }

      const sources = lots.filter(l => l.matUid !== target.matUid);

      // MatStock 기준으로 병합 수량 합산
      const totalMergeQty = sources.reduce((sum, l) => {
        const s = stockMap.get(l.matUid);
        return sum + (s?.qty ?? 0);
      }, 0);

      // 품목 정보 (배치 선조회 — 병합 대상은 동일 품목이므로 1건)
      const partsForMerge = await queryRunner.manager.find(PartMaster, {
        where: { itemCode: In([...itemCodes]) },
      });
      const partMapForMerge = new Map(partsForMerge.map(p => [p.itemCode, p] as const));
      const part = partMapForMerge.get(target.itemCode);

      // 원본 LOT들 소진 처리 (상태만 변경, currentQty 업데이트 없음)
      for (const src of sources) {
        await queryRunner.manager.update(MatLot, src.matUid, {
          status: 'DEPLETED',
        });
      }

      // MatStock 동기화 — 대상 재고에 합산, 원본 재고 0으로
      const targetStock = stockMap.get(target.matUid);
      const newTargetQty = (targetStock?.qty ?? 0) + totalMergeQty;

      if (targetStock) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: targetStock.warehouseCode, itemCode: targetStock.itemCode, matUid: targetStock.matUid },
          { qty: newTargetQty, availableQty: targetStock.availableQty + totalMergeQty },
        );
      }

      for (const src of sources) {
        const srcStock = stockMap.get(src.matUid);
        if (srcStock) {
          await queryRunner.manager.update(MatStock,
            { warehouseCode: srcStock.warehouseCode, itemCode: srcStock.itemCode, matUid: srcStock.matUid },
            { qty: 0, availableQty: 0 },
          );
        }
      }

      // 트랜잭션 이력
      const transNo = await this.generateTransNo();
      const sourceNos = sources.map(s => s.matUid).join(', ');
      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'LOT_MERGE',
        transDate: new Date(),
        itemCode: target.itemCode,
        matUid: target.matUid,
        qty: totalMergeQty,
        refType: 'LOT_MERGE',
        refId: target.matUid,
        remark: remark || `LOT 병합: [${sourceNos}] → ${target.matUid}`,
        status: 'DONE',
      });

      await queryRunner.commitTransaction();

      return {
        targetLotNo: target.matUid,
        mergedLotNos: sources.map(s => s.matUid),
        totalMergedQty: totalMergeQty,
        newTotalQty: newTargetQty,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
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
      where: { transNo: Like(`${prefix}%`) } as FindOptionsWhere<StockTransaction>,
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
