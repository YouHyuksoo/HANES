/**
 * @file src/modules/material/services/lot-split.service.ts
 * @description 자재 LOT 분할 비즈니스 로직 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In, Not, MoreThan } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { LotSplitDto, LotSplitQueryDto } from '../dto/lot-split.dto';

@Injectable()
export class LotSplitService {
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

  async findSplittableLots(query: LotSplitQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // 분할 가능한 LOT: 재고가 있고, DEPLETED 상태가 아닌 LOT
    const where: any = {
      currentQty: MoreThan(1),
      status: Not('DEPLETED'),
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (search) {
      where.matUid = Like(`%${search}%`);
    }

    const [data, total] = await Promise.all([
      this.matLotRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.matLotRepository.count({ where }),
    ]);

    // part 정보 조회 및 중첩 객체 평면화
    const itemCodes = data.map((lot) => lot.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 재고 정보 조회
    const matUids = data.map((lot) => lot.matUid);
    const stocks = matUids.length > 0
      ? await this.matStockRepository.find({ where: { matUid: In(matUids) } })
      : [];
    const stockMap = new Map(stocks.map((s) => [s.matUid, s]));

    const flattenedData = data.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const stock = stockMap.get(lot.matUid);
      return {
        ...lot,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
        warehouseCode: stock?.warehouseCode,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async split(dto: LotSplitDto) {
    const { sourceLotId, splitQty, newLotNo, remark } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 원본 LOT 조회
      const sourceLot = await queryRunner.manager.findOne(MatLot, {
        where: { matUid: sourceLotId },
      });

      if (!sourceLot) {
        throw new NotFoundException(`원본 LOT을 찾을 수 없습니다: ${sourceLotId}`);
      }

      if (sourceLot.currentQty < splitQty) {
        throw new BadRequestException(`분할 수량이 현재 재고보다 많습니다. 현재: ${sourceLot.currentQty}, 요청: ${splitQty}`);
      }

      if (sourceLot.status === 'HOLD') {
        throw new BadRequestException('HOLD 상태인 LOT은 분할할 수 없습니다.');
      }

      if (sourceLot.status === 'DEPLETED') {
        throw new BadRequestException('소진된 LOT은 분할할 수 없습니다.');
      }

      // 품목 정보 조회
      const part = await queryRunner.manager.findOne(PartMaster, {
        where: { itemCode: sourceLot.itemCode },
      });
      if (!part) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${sourceLot.itemCode}`);
      }

      // 분할 가능 여부 체크
      if (part.isSplittable === 'N') {
        throw new BadRequestException(
          `해당 품목은 분할할 수 없습니다. 품번: ${part.itemCode}, 분할 설정: ${part.isSplittable}`
        );
      }

      // 새 LOT 번호 생성 (미지정 시 자동 생성)
      const generatedLotNo = newLotNo || (await this.generateLotNo(sourceLot.matUid));

      // 중복 LOT 번호 확인
      const existingLot = await queryRunner.manager.findOne(MatLot, {
        where: { matUid: generatedLotNo },
      });
      if (existingLot) {
        throw new BadRequestException(`이미 존재하는 LOT 번호입니다: ${generatedLotNo}`);
      }

      // 원본 LOT 재고 차감
      const newSourceQty = sourceLot.currentQty - splitQty;
      await queryRunner.manager.update(MatLot, sourceLotId, {
        currentQty: newSourceQty,
        status: newSourceQty === 0 ? 'DEPLETED' : sourceLot.status,
      });

      // 새 LOT 생성
      const newLot = queryRunner.manager.create(MatLot, {
        matUid: generatedLotNo,
        itemCode: sourceLot.itemCode,
        initQty: splitQty,
        currentQty: splitQty,
        recvDate: new Date(),
        expireDate: sourceLot.expireDate,
        origin: sourceLot.origin,
        vendor: sourceLot.vendor,
        invoiceNo: sourceLot.invoiceNo,
        poNo: sourceLot.poNo,
        iqcStatus: sourceLot.iqcStatus,
        status: 'NORMAL',
      });
      await queryRunner.manager.save(newLot);

      // 재고 정보도 분할 (원본 LOT의 재고가 있는 경우)
      const sourceStock = await queryRunner.manager.findOne(MatStock, {
        where: { matUid: sourceLotId },
      });

      if (sourceStock) {
        // 원본 재고 차감
        const newSourceStockQty = sourceStock.qty - splitQty;
        await queryRunner.manager.update(MatStock,
          { warehouseCode: sourceStock.warehouseCode, itemCode: sourceStock.itemCode, matUid: sourceStock.matUid },
          { qty: newSourceStockQty, availableQty: newSourceStockQty - sourceStock.reservedQty },
        );

        // 새 재고 생성
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode: sourceStock.warehouseCode,
          locationCode: sourceStock.locationCode,
          itemCode: sourceStock.itemCode,
          matUid: newLot.matUid,
          qty: splitQty,
          availableQty: splitQty,
          reservedQty: 0,
        });
        await queryRunner.manager.save(newStock);
      }

      // 트랜잭션 이력 생성
      const transNo = await this.generateTransNo();
      await queryRunner.manager.save(StockTransaction, {
        transNo,
        transType: 'LOT_SPLIT',
        transDate: new Date(),
        itemCode: sourceLot.itemCode,
        matUid: sourceLotId,
        qty: splitQty,
        refType: 'LOT_SPLIT',
        refId: newLot.matUid,
        remark: remark || `LOT 분할: ${sourceLot.matUid} → ${generatedLotNo}`,
        status: 'DONE',
      });

      await queryRunner.commitTransaction();

      return {
        matUid: newLot.matUid,
        parentLotNo: sourceLotId,
        sourceLotNo: sourceLot.matUid,
        newLotNo: generatedLotNo,
        splitQty,
        itemCode: part.itemCode,
        itemName: part.itemName,
        sourceRemainingQty: newSourceQty,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * LOT 번호 생성
   * 원본 LOT 번호 기반으로 새 번호 생성
   */
  private async generateLotNo(sourceLotNo: string): Promise<string> {
    const baseLotNo = sourceLotNo.length > 10 ? sourceLotNo.substring(0, 10) : sourceLotNo;
    const prefix = `${baseLotNo}-S`;

    // 기존 분할 LOT 검색
    const existingLots = await this.matLotRepository.find({
      where: { matUid: Like(`${prefix}%`) },
      order: { matUid: 'DESC' },
    });

    let seq = 1;
    if (existingLots.length > 0) {
      const lastLot = existingLots[0];
      const match = lastLot.matUid.match(/-S(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  /**
   * 트랜잭션 번호 생성
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `SPL${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastTrans = await this.stockTransactionRepository.findOne({
      where: { transNo: Like(`${prefix}%`) },
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
