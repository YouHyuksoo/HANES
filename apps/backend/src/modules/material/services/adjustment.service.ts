/**
 * @file src/modules/material/services/adjustment.service.ts
 * @description 재고보정 비즈니스 로직 - InvAdjLog 생성 + StockTransaction 기록 (TypeORM)
 *
 * 초보자 가이드:
 * - create(): 즉시 승인(APPROVED) 처리 — 기존 PC 화면, 재고 즉시 반영
 * - createPending(): 승인 대기(PENDING) 처리 — PDA 요청, 재고 변동 보류
 * - approve(adjDate, seq): PENDING → APPROVED, 실제 재고 차감/증가 실행
 * - reject(adjDate, seq): PENDING → REJECTED, 재고 변동 없음
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, Between, In, FindOptionsWhere, IsNull, QueryRunner } from 'typeorm';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { CreateAdjustmentDto, AdjustmentQueryDto } from '../dto/adjustment.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { lockRowsForUpdate } from '../../../common/utils/row-lock.util';
import { isUniqueViolation } from '../../../common/utils/mat-stock-upsert.util';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';
import { MAT_LOT_STATUS } from '@harness/shared';

@Injectable()
export class AdjustmentService {
  constructor(
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  async findAll(query: AdjustmentQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<InvAdjLog> = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (search) {
      where.warehouseCode = Like(`%${search}%`);
    }

    if (fromDate && toDate) {
      where.createdAt = Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!);
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
    const tenantWhere = this.tenantWhere(company, plant);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const flattenedData = data.map((log) => {
      const part = partMap.get(log.itemCode);
      return {
        ...log,
        itemCode: log.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  /**
   * 즉시 승인 재고보정 등록 (PC 화면 기본 동작)
   * - adjustStatus = 'APPROVED'로 저장하고 재고를 즉시 반영합니다.
   */
  async create(dto: CreateAdjustmentDto, company?: string, plant?: string) {
    return this._executeAdjustment(dto, 'APPROVED', company, plant);
  }

  /**
   * 승인 대기 재고보정 등록 (PDA 요청용)
   * - adjustStatus = 'PENDING'으로 저장하고 재고 변동은 보류합니다.
   * - approve(id) 호출 후 재고가 실제 반영됩니다.
   */
  async createPending(dto: CreateAdjustmentDto, company?: string, plant?: string) {
    const { warehouseCode, itemCode, matUid, afterQty, reason, createdBy } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      const part = await queryRunner.manager.findOne(ItemMaster, { where: { itemCode, ...tenantWhere } });
      if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);

      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid, ...tenantWhere } });
        if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
      }

      // 재고 조회 (변동 없이 beforeQty만 기록)
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode,
          itemCode,
          matUid: matUid ?? IsNull(),
          ...tenantWhere,
        },
      });
      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;
      if (stock) {
        this.assertSameTenant('보정 대상 재고', { company, plant }, stock);
      }
      if (stock && afterQty < stock.reservedQty) {
        throw new BadRequestException(
          `예약수량(${stock.reservedQty})보다 적은 수량으로는 조정할 수 없습니다.`,
        );
      }

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
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      await queryRunner.manager.save(invAdjLog);

      return {
        adjDate: invAdjLog.adjDate,
        seq: invAdjLog.seq,
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
    });
  }

  /**
   * 보정 승인 처리
   * - PENDING 상태인 보정 요청을 APPROVED로 변경하고 실제 재고를 반영합니다.
   * @param adjDate InvAdjLog 조정일자 PK
   * @param seq InvAdjLog 일련번호 PK
   * @param approvedBy 승인자 ID
   */
  async approve(adjDate: string, seq: number, approvedBy?: string, company?: string, plant?: string) {
    const adjLog = await this.invAdjLogRepository.findOne({
      where: { adjDate: new Date(adjDate), seq, ...this.tenantWhere(company, plant) },
    });
    if (!adjLog) throw new NotFoundException(`보정 이력을 찾을 수 없습니다: ${adjDate}-${seq}`);
    if (adjLog.adjustStatus !== 'PENDING') {
      throw new BadRequestException(`이미 처리된 보정 요청입니다. 현재 상태: ${adjLog.adjustStatus}`);
    }

    const { warehouseCode, itemCode, matUid, afterQty, reason } = adjLog;
    const adjTenantWhere = this.tenantWhere(adjLog.company, adjLog.plant);

    return this.tx.run(async (queryRunner) => {
      // 같은 요청을 동시에 두 번 승인해도 재고가 두 번 반영되지 않게, PENDING 인 요청만 먼저 선점한다.
      const claimed = await queryRunner.manager.createQueryBuilder().update(InvAdjLog)
        .set({ adjustStatus: 'APPROVED', approvedBy: approvedBy || null, approvedAt: new Date() })
        .where({ adjDate: new Date(adjDate), seq, ...adjTenantWhere })
        .andWhere('"ADJUST_STATUS" = :pendingStatus', { pendingStatus: 'PENDING' })
        .execute();
      if ((claimed.affected ?? 0) !== 1) {
        throw new BadRequestException('이미 처리된 보정 요청입니다. 다시 조회해 주세요.');
      }

      // 대상 재고 행을 잠근 뒤 읽는다 (요청 이후 출고·조정이 있었어도 읽은 값이 어긋나지 않게)
      await lockRowsForUpdate(queryRunner, 'MAT_STOCKS', {
        WAREHOUSE_CODE: warehouseCode,
        ITEM_CODE: itemCode,
        MAT_UID: matUid,
        COMPANY: adjLog.company,
        PLANT_CD: adjLog.plant,
      });
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode, itemCode, matUid: matUid ?? IsNull(), ...adjTenantWhere },
      });
      // 요청 시점의 차이(diffQty)가 아니라, 승인 시점 재고 기준으로 afterQty 가 되도록 하는 차이로 반영·기록한다.
      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;

      if (stock) {
        if (afterQty < stock.reservedQty) {
          throw new BadRequestException(
            `예약수량(${stock.reservedQty})보다 적은 수량으로는 조정할 수 없습니다.`,
          );
        }
        // 읽은 값 대입이 아니라 차이만큼 상대 갱신한다(가용 = 수량 - 예약)
        const adjusted = await queryRunner.manager.createQueryBuilder().update(MatStock)
          .set({
            qty: () => '"QTY" + :adjustDelta',
            availableQty: () => '"QTY" + :adjustDelta - NVL("RESERVED_QTY", 0)',
          })
          .where({
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            matUid: stock.matUid ?? IsNull(),
            ...adjTenantWhere,
          })
          .andWhere('"QTY" + :adjustDelta >= NVL("RESERVED_QTY", 0)')
          .setParameters({ adjustDelta: diffQty })
          .execute();
        if ((adjusted.affected ?? 0) !== 1) {
          throw new BadRequestException('동시 처리로 재고가 변경되었습니다. 다시 조회해 주세요.');
        }
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서는 음수로 조정할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
          company: adjLog.company,
          plant: adjLog.plant,
        });
        stock = await this.insertNewStock(queryRunner, newStock);
      }

      // LOT 상태 업데이트 (재고 0이면 DEPLETED — currentQty는 MatStock에서만 관리)
      if (matUid) {
        if (afterQty <= 0) {
          await queryRunner.manager.update(MatLot, { matUid, ...adjTenantWhere }, { status: MAT_LOT_STATUS.DEPLETED });
        }
      }

      // 재고 거래 이력 생성
      const transNo = await this.generateTransNo(queryRunner);
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
        refId: `${adjDate}-${seq}`,
        remark: reason,
        account: 'STOCK_ADJ', // 재고보정계정
        status: 'DONE',
        createdBy: approvedBy,
        company: adjLog.company,
        plant: adjLog.plant,
      });
      await queryRunner.manager.save(stockTransaction);

      // 보정 이력의 조정 전 수량·차이를 승인 시점 기준으로 맞춘다(요청 이후 재고가 달라졌을 수 있음)
      await queryRunner.manager.update(InvAdjLog, { adjDate: new Date(adjDate), seq, ...adjTenantWhere }, { beforeQty, diffQty });

      return { adjDate, seq, adjustStatus: 'APPROVED', approvedBy, approvedAt: new Date() };
    });
  }

  /**
   * 보정 반려 처리
   * - PENDING 상태인 보정 요청을 REJECTED로 변경합니다.
   * - 재고 변동은 일어나지 않습니다.
   * @param adjDate InvAdjLog 조정일자 PK
   * @param seq InvAdjLog 일련번호 PK
   * @param rejectedBy 반려자 ID
   */
  async reject(adjDate: string, seq: number, rejectedBy?: string, company?: string, plant?: string) {
    const adjLog = await this.invAdjLogRepository.findOne({
      where: { adjDate: new Date(adjDate), seq, ...this.tenantWhere(company, plant) },
    });
    if (!adjLog) throw new NotFoundException(`보정 이력을 찾을 수 없습니다: ${adjDate}-${seq}`);
    if (adjLog.adjustStatus !== 'PENDING') {
      throw new BadRequestException(`이미 처리된 보정 요청입니다. 현재 상태: ${adjLog.adjustStatus}`);
    }

    // PENDING 인 요청만 반려한다(동시에 승인된 요청을 덮어쓰지 않게 조건과 행수를 확인)
    const rejected = await this.invAdjLogRepository.createQueryBuilder().update(InvAdjLog)
      .set({ adjustStatus: 'REJECTED', updatedBy: rejectedBy || null })
      .where({ adjDate: new Date(adjDate), seq, ...this.tenantWhere(adjLog.company, adjLog.plant) })
      .andWhere('"ADJUST_STATUS" = :pendingStatus', { pendingStatus: 'PENDING' })
      .execute();
    if ((rejected.affected ?? 0) !== 1) {
      throw new BadRequestException('이미 처리된 보정 요청입니다. 다시 조회해 주세요.');
    }

    return { adjDate, seq, adjustStatus: 'REJECTED', rejectedBy };
  }

  /**
   * 즉시 승인 재고보정의 실제 공통 로직
   * - adjustStatus='APPROVED'일 때만 실제 재고 변동이 발생합니다.
   */
  private async _executeAdjustment(dto: CreateAdjustmentDto, adjustStatus: 'APPROVED', company?: string, plant?: string) {
    const { warehouseCode, itemCode, matUid, afterQty, reason, createdBy } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      // 품목 확인
      const part = await queryRunner.manager.findOne(ItemMaster, {
        where: { itemCode, ...tenantWhere },
      });
      if (!part) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
      }

      // LOT 확인 (matUid가 있는 경우)
      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid, ...tenantWhere },
        });
        if (!lot) {
          throw new NotFoundException(`LOT을 찾을 수 없습니다: ${matUid}`);
        }
      }

      // 대상 재고 행을 먼저 잠근 뒤 읽는다 — 조정 전 수량(before)과 로그가 동시 출고·조정과 어긋나지 않게
      await lockRowsForUpdate(queryRunner, 'MAT_STOCKS', {
        WAREHOUSE_CODE: warehouseCode,
        ITEM_CODE: itemCode,
        MAT_UID: matUid,
        COMPANY: company,
        PLANT_CD: plant,
      });
      // 기존 재고 조회
      let stock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode,
          itemCode,
          matUid: matUid ?? IsNull(),
          ...tenantWhere,
        },
      });

      const beforeQty = stock?.qty ?? 0;
      const diffQty = afterQty - beforeQty;
      if (stock) {
        this.assertSameTenant('보정 대상 재고', { company, plant }, stock);
      }

      // 재고 업데이트 또는 생성
      if (stock) {
        // 읽은 값 대입이 아니라 차이만큼 상대 갱신한다(가용 = 수량 - 예약)
        const adjusted = await queryRunner.manager.createQueryBuilder().update(MatStock)
          .set({
            qty: () => '"QTY" + :adjustDelta',
            availableQty: () => '"QTY" + :adjustDelta - NVL("RESERVED_QTY", 0)',
          })
          .where({
            warehouseCode: stock.warehouseCode,
            itemCode: stock.itemCode,
            matUid: stock.matUid ?? IsNull(),
            ...tenantWhere,
          })
          .setParameters({ adjustDelta: diffQty })
          .execute();
        if ((adjusted.affected ?? 0) !== 1) {
          throw new BadRequestException('동시 처리로 재고가 변경되었습니다. 다시 조회해 주세요.');
        }
      } else {
        if (afterQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서는 음수로 조정할 수 없습니다.');
        }
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty: afterQty,
          availableQty: afterQty,
          reservedQty: 0,
          company,
          plant,
        });
        stock = await this.insertNewStock(queryRunner, newStock);
      }

      // LOT 상태 업데이트 (재고 0이면 DEPLETED — currentQty는 MatStock에서만 관리)
      if (matUid) {
        if (afterQty <= 0) {
          await queryRunner.manager.update(MatLot, { matUid, ...tenantWhere }, { status: MAT_LOT_STATUS.DEPLETED });
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
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      await queryRunner.manager.save(invAdjLog);

      // 재고 거래 이력 생성 (트랜잭션 번호 생성)
      const transNo = await this.generateTransNo(queryRunner);
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
        refId: `${invAdjLog.adjDate}-${invAdjLog.seq}`,
        remark: reason,
        account: 'STOCK_ADJ', // 재고보정계정
        status: 'DONE',
        createdBy,
        company: stock?.company ?? company,
        plant: stock?.plant ?? plant,
      });
      await queryRunner.manager.save(stockTransaction);

      return {
        adjDate: invAdjLog.adjDate,
        seq: invAdjLog.seq,
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
    });
  }

  /** 재고 행이 없어 새로 넣을 때, 동시에 같은 행이 먼저 들어갔으면(유니크 위반) 다시 조회하도록 안내한다. */
  private async insertNewStock(queryRunner: QueryRunner, newStock: MatStock): Promise<MatStock> {
    try {
      return await queryRunner.manager.save(newStock);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('동시 처리로 같은 재고가 먼저 등록되었습니다. 다시 조회해 주세요.');
      }
      throw error;
    }
  }

  /**
   * 트랜잭션 번호 생성 (ADJ+YYYYMMDD+5자리) — NUM_RULE 'ADJ_TX' 채번 (MAX+1 금지)
   */
  private async generateTransNo(queryRunner: QueryRunner): Promise<string> {
    return this.numbering.nextInTx(queryRunner, 'ADJ_TX');
  }
}
