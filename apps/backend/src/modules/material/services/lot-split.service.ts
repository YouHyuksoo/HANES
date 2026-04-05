/**
 * @file src/modules/material/services/lot-split.service.ts
 * @description 자재 LOT 분할 비즈니스 로직 (TypeORM)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In } from 'typeorm';
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

    // 분할 가능한 LOT: MatStock.qty > 1 이고 DEPLETED 상태가 아닌 LOT
    const qb = this.matLotRepository.createQueryBuilder('lot')
      .innerJoin(MatStock, 'stock', 'stock.matUid = lot.matUid')
      .where('stock.qty > 1')
      .andWhere("lot.status != 'DEPLETED'");

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    if (search) qb.andWhere('lot.matUid LIKE :search', { search: `%${search}%` });

    const [data, total] = await Promise.all([
      qb.orderBy('lot.createdAt', 'DESC')
        .skip(skip).take(limit).getMany(),
      qb.getCount(),
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

      if (sourceLot.status === 'HOLD') {
        throw new BadRequestException('HOLD 상태인 LOT은 분할할 수 없습니다.');
      }

      if (sourceLot.status === 'DEPLETED') {
        throw new BadRequestException('소진된 LOT은 분할할 수 없습니다.');
      }

      // 원본 재고 조회 (수량 체크용)
      const sourceStock = await queryRunner.manager.findOne(MatStock, {
        where: { matUid: sourceLotId },
      });

      if (!sourceStock || sourceStock.qty < splitQty) {
        throw new BadRequestException(`분할 수량이 현재 재고보다 많습니다. 현재: ${sourceStock?.qty ?? 0}, 요청: ${splitQty}`);
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

      // 원본 재고 차감 (MatStock만 업데이트)
      const newSourceStockQty = sourceStock.qty - splitQty;
      await queryRunner.manager.update(MatStock,
        { warehouseCode: sourceStock.warehouseCode, itemCode: sourceStock.itemCode, matUid: sourceStock.matUid },
        { qty: newSourceStockQty, availableQty: newSourceStockQty - sourceStock.reservedQty },
      );

      // 원본 LOT 상태만 업데이트 (재고 0이면 DEPLETED)
      if (newSourceStockQty === 0) {
        await queryRunner.manager.update(MatLot, sourceLotId, { status: 'DEPLETED' });
      }

      // 새 LOT 생성 (currentQty 없이 — 재고는 MatStock에서만 관리)
      const newLot = queryRunner.manager.create(MatLot, {
        matUid: generatedLotNo,
        itemCode: sourceLot.itemCode,
        initQty: splitQty,
        recvDate: new Date(),
        expireDate: sourceLot.expireDate,
        origin: sourceLot.origin,
        vendor: sourceLot.vendor,
        invoiceNo: sourceLot.invoiceNo,
        poNo: sourceLot.poNo,
        iqcStatus: sourceLot.iqcStatus,
        status: 'NORMAL',
        company: sourceLot.company,
        plant: sourceLot.plant,
      });
      await queryRunner.manager.save(newLot);

      // 새 재고 생성 (MatStock)
      const newStock = queryRunner.manager.create(MatStock, {
        warehouseCode: sourceStock.warehouseCode,
        locationCode: sourceStock.locationCode,
        itemCode: sourceStock.itemCode,
        matUid: newLot.matUid,
        qty: splitQty,
        availableQty: splitQty,
        reservedQty: 0,
        company: sourceStock.company,
        plant: sourceStock.plant,
      });
      await queryRunner.manager.save(newStock);

      // 수불 트랜잭션 2건 생성 (원본 차감 + 신규 증가)
      const transNo1 = await this.generateTransNo();
      const transNo2 = await this.generateTransNo();
      const transDate = new Date();
      const warehouseCode = sourceStock?.warehouseCode || null;
      const splitRemark = remark || `자재분할: ${sourceLot.matUid} → ${generatedLotNo}`;

      // 1) 원본 시리얼 차감 (-splitQty)
      await queryRunner.manager.save(StockTransaction, {
        transNo: transNo1,
        transType: 'LOT_SPLIT_OUT',
        transDate,
        fromWarehouseId: warehouseCode,
        itemCode: sourceLot.itemCode,
        matUid: sourceLotId,
        qty: -splitQty,
        refType: 'LOT_SPLIT',
        refId: newLot.matUid,
        remark: splitRemark,
        status: 'DONE',
        company: sourceLot.company,
        plant: sourceLot.plant,
      });

      // 2) 신규 시리얼 증가 (+splitQty)
      await queryRunner.manager.save(StockTransaction, {
        transNo: transNo2,
        transType: 'LOT_SPLIT_IN',
        transDate,
        toWarehouseId: warehouseCode,
        itemCode: sourceLot.itemCode,
        matUid: newLot.matUid,
        qty: splitQty,
        refType: 'LOT_SPLIT',
        refId: sourceLotId,
        remark: splitRemark,
        status: 'DONE',
        company: sourceLot.company,
        plant: sourceLot.plant,
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
        sourceRemainingQty: newSourceStockQty,
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
