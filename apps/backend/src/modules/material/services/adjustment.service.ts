/**
 * @file src/modules/material/services/adjustment.service.ts
 * @description 재고보정 비즈니스 로직 - InvAdjLog 생성 + StockTransaction 기록 (TypeORM)
 *
 * 초보자 가이드:
 * - create(): 즉시 승인(APPROVED) 처리 — 기존 PC 화면용, 재고 즉시 반영
 * - createPending(): 승인 대기(PENDING) 처리 — PDA 요청용, 재고 보류
 * - approve(id): PENDING → APPROVED, 실제 재고 차감/증가 실행
 * - reject(id): PENDING → REJECTED, 재고 변동 없음
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, Between, In } from 'typeorm';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { CreateAdjustmentDto, AdjustmentQueryDto } from '../dto/adjustment.dto';

@Injectable()
export class AdjustmentService {
  constructor(
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: AdjustmentQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (search) {
      where.warehouseCode = Like(`%${search}%`);
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    }

    const [data, total] = await Promise.all([
      this.invAdjLogRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.invAdjLogRepository.count({ where }),
    ]);

    // part 정보 조회 및 중첩 객체 평면화
    const itemCodes = data.map((log) => log.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  /**
   * 즉시 승인 보정 등록 (PC 화면 기본 동작)
   * - adjustStatus = 'APPROVED' 로 저장하고 재고를 즉시 반영합니다.
   */
  async create(dto: CreateAdjustmentDto) {
    return this._executeAdjustment(dto, 'APPROVED');
  }

  /**
   * 승인 대기 보정 등록 (PDA 요청용)
   * - adjustStatus = 'PENDING' 으로 저장하고 재고 변동은 보류합니다.
   * - approve(id) 호출 시 재고가 실제 반영됩니다.
   */
  async createPending(dto: CreateAdjustmentDto) {
    const { warehouseCode, itemCode, matUid, afterQty, reason, createdBy } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const part = await queryRunner.manager.findOne(PartMaster, { where: { itemCode } });
      if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);

      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid } });
        if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
      }

      // 재고 조회 (변동 없이 beforeQty만 기록)
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode, itemCode, ...(matUid && { matUid }) },
      });
      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;

      // 보정 이력 생성 — PENDING 상태로만 저장, 재고 변동 없음
      const invAdjLog = queryRunner.manager.create(InvAdjLog, {
        warehouseCode,
        itemCode,
        matUid: matUid || null,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus: 'PENDING',
        createdBy,
        company: '40',
        plant: '1000',
      });
      await queryRunner.manager.save(invAdjLog);

      await queryRunner.commitTransaction();

      return {
        id: invAdjLog.id,
        warehouseCode,
        itemCode: part.itemCode,
        matUid,
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus: 'PENDING',
        itemName: part.itemName,
        unit: part.unit,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 보정 승인 처리
   * - PENDING 상태의 보정 요청을 APPROVED로 변경하고 실제 재고를 반영합니다.
   * @param id InvAdjLog PK
   * @param approvedBy 승인자 ID
   */
  async approve(id: number, approvedBy?: string) {
    const adjLog = await this.invAdjLogRepository.findOne({ where: { id } });
    if (!adjLog) throw new NotFoundException(`보정 이력을 찾을 수 없습니다: ${id}`);
    if (adjLog.adjustStatus !== 'PENDING') {
      throw new BadRequestException(`이미 처리된 보정 요청입니다. 현재 상태: ${adjLog.adjustStatus}`);
    }

    const { warehouseCode, itemCode, matUid, afterQty, diffQty, reason } = adjLog;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 재고 업데이트
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode, itemCode, ...(matUid && { matUid }) },
        lock: { mode: 'pessimistic_write' },
      });

      if (stock) {
        await queryRunner.manager.update(
          MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty },
        );
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서 음수 조정을 할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
          company: '40',
          plant: '1000',
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // LOT 재고 업데이트 (matUid가 있는 경우)
      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid } });
        if (lot) {
          const newLotQty = lot.currentQty + diffQty;
          await queryRunner.manager.update(MatLot, matUid, {
            currentQty: Math.max(0, newLotQty),
            status: newLotQty <= 0 ? 'DEPLETED' : lot.status,
          });
        }
      }

      // 재고 거래 이력 생성
      const transNo = await this.generateTransNo();
      const stockTransaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: diffQty >= 0 ? 'ADJUST_IN' : 'ADJUST_OUT',
        transDate: new Date(),
        fromWarehouseId: diffQty < 0 ? warehouseCode : null,
        toWarehouseId: diffQty >= 0 ? warehouseCode : null,
        itemCode,
        matUid: matUid || null,
        qty: Math.abs(diffQty),
        refType: 'ADJUSTMENT',
        refId: String(adjLog.id),
        remark: reason,
        status: 'DONE',
        createdBy: approvedBy,
        company: '40',
        plant: '1000',
      });
      await queryRunner.manager.save(stockTransaction);

      // 보정 이력 상태 업데이트
      await queryRunner.manager.update(InvAdjLog, { id }, {
        adjustStatus: 'APPROVED',
        approvedBy: approvedBy || null,
        approvedAt: new Date(),
      });

      await queryRunner.commitTransaction();

      return { id, adjustStatus: 'APPROVED', approvedBy, approvedAt: new Date() };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 보정 반려 처리
   * - PENDING 상태의 보정 요청을 REJECTED로 변경합니다.
   * - 재고 변동은 일어나지 않습니다.
   * @param id InvAdjLog PK
   * @param rejectedBy 반려자 ID
   */
  async reject(id: number, rejectedBy?: string) {
    const adjLog = await this.invAdjLogRepository.findOne({ where: { id } });
    if (!adjLog) throw new NotFoundException(`보정 이력을 찾을 수 없습니다: ${id}`);
    if (adjLog.adjustStatus !== 'PENDING') {
      throw new BadRequestException(`이미 처리된 보정 요청입니다. 현재 상태: ${adjLog.adjustStatus}`);
    }

    await this.invAdjLogRepository.update({ id }, {
      adjustStatus: 'REJECTED',
      updatedBy: rejectedBy || null,
    });

    return { id, adjustStatus: 'REJECTED', rejectedBy };
  }

  /**
   * 즉시 승인 보정의 내부 공통 로직
   * - adjustStatus='APPROVED'일 때만 실제 재고 변동이 발생합니다.
   */
  private async _executeAdjustment(dto: CreateAdjustmentDto, adjustStatus: 'APPROVED') {
    const { warehouseCode, itemCode, matUid, afterQty, reason, createdBy } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 품목 확인
      const part = await queryRunner.manager.findOne(PartMaster, {
        where: { itemCode },
      });
      if (!part) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
      }

      // LOT 확인 (matUid가 있는 경우)
      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid: matUid },
        });
        if (!lot) {
          throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
        }
      }

      // 기존 재고 조회
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode, itemCode, ...(matUid && { matUid }) },
        lock: { mode: 'pessimistic_write' },
      });

      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;

      // 재고 업데이트 또는 생성
      if (stock) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, matUid: stock.matUid },
          { qty: afterQty, availableQty: afterQty - stock.reservedQty },
        );
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서 음수 조정을 할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
          company: '40',
          plant: '1000',
        });
        stock = await queryRunner.manager.save(newStock);
      }

      // LOT 재고도 업데이트 (matUid가 있는 경우)
      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid: matUid } });
        if (lot) {
          const newLotQty = lot.currentQty + diffQty;
          await queryRunner.manager.update(MatLot, matUid, {
            currentQty: Math.max(0, newLotQty),
            status: newLotQty <= 0 ? 'DEPLETED' : lot.status,
          });
        }
      }

      // 보정 이력 생성
      const invAdjLog = queryRunner.manager.create(InvAdjLog, {
        warehouseCode,
        itemCode,
        matUid: matUid || null,
        adjType: 'ADJUST',
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus,
        createdBy,
        company: '40',
        plant: '1000',
      });
      await queryRunner.manager.save(invAdjLog);

      // 재고 거래 이력 생성 (트랜잭션 번호 생성)
      const transNo = await this.generateTransNo();
      const stockTransaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: diffQty >= 0 ? 'ADJUST_IN' : 'ADJUST_OUT',
        transDate: new Date(),
        fromWarehouseId: diffQty < 0 ? warehouseCode : null,
        toWarehouseId: diffQty >= 0 ? warehouseCode : null,
        itemCode,
        matUid: matUid || null,
        qty: Math.abs(diffQty),
        refType: 'ADJUSTMENT',
        refId: String(invAdjLog.id),
        remark: reason,
        status: 'DONE',
        createdBy,
        company: '40',
        plant: '1000',
      });
      await queryRunner.manager.save(stockTransaction);

      await queryRunner.commitTransaction();

      return {
        id: invAdjLog.id,
        warehouseCode,
        itemCode: part.itemCode,
        matUid,
        beforeQty,
        afterQty,
        diffQty,
        reason,
        adjustStatus,
        itemName: part.itemName,
        unit: part.unit,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 트랜잭션 번호 생성
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `ADJ${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

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
