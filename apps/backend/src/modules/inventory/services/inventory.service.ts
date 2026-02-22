/**
 * @file src/modules/inventory/services/inventory.service.ts
 * @description 재고관리 핵심 서비스 - 수불 트랜잭션 처리 (TypeORM)
 *
 * 핵심 원칙:
 * 1. 모든 수불은 이력으로 남김 (삭제 금지)
 * 2. 취소 시 원 트랜잭션 참조 + 음수 수량
 * 3. 재고 = SUM(트랜잭션 수량)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  ReceiveStockDto,
  IssueStockDto,
  TransferStockDto,
  CancelTransactionDto,
  StockQueryDto,
  TransactionQueryDto,
  CreateLotDto,
} from '../dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly stockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly lotRepository: Repository<MatLot>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 트랜잭션 번호 생성
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `TRX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastTrans = await this.stockTransactionRepository.findOne({
      where: { transNo: prefix },
      order: { transNo: 'DESC' },
    });

    let seq = 1;
    if (lastTrans) {
      const lastSeq = parseInt(lastTrans.transNo.slice(-5), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /**
   * LOT 번호 생성
   */
  async generateLotNo(partType: string): Promise<string> {
    const today = new Date();
    const prefix = `${partType}${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastLot = await this.lotRepository.findOne({
      where: { lotNo: prefix },
      order: { lotNo: 'DESC' },
    });

    let seq = 1;
    if (lastLot) {
      const lastSeq = parseInt(lastLot.lotNo.slice(-4), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * LOT 생성
   */
  async createLot(dto: CreateLotDto) {
    const lot = this.lotRepository.create({
      lotNo: dto.lotNo,
      partId: dto.partId,
      initQty: dto.initQty,
      currentQty: dto.initQty,
      recvDate: dto.recvDate,
      expireDate: dto.expireDate,
      origin: dto.origin,
      vendor: dto.vendor,
      invoiceNo: dto.invoiceNo,
      poNo: dto.poNo,
    });

    return this.lotRepository.save(lot);
  }

  /**
   * 재고 업데이트 (낶부 함수)
   */
  private async updateStock(
    warehouseCode: string,
    partId: string,
    lotId: string | null,
    qtyDelta: number,
  ) {
    // 기존 재고 조회
    const existingStock = await this.stockRepository.findOne({
      where: { warehouseCode, partId, lotId: lotId || IsNull() },
    });

    if (existingStock) {
      // 재고 업데이트
      const newQty = existingStock.qty + qtyDelta;
      if (newQty < 0) {
        throw new BadRequestException(`재고 부족: 현재 ${existingStock.qty}, 요청 ${Math.abs(qtyDelta)}`);
      }

      return this.stockRepository.update(existingStock.id, {
        qty: newQty,
        availableQty: newQty - existingStock.reservedQty,
      });
    } else {
      // 신규 재고 생성 (입고 시에만)
      if (qtyDelta < 0) {
        throw new BadRequestException('재고가 존재하지 않습니다.');
      }

      const newStock = this.stockRepository.create({
        warehouseCode,
        partId,
        lotId: lotId || null,
        qty: qtyDelta,
        reservedQty: 0,
        availableQty: qtyDelta,
      });

      return this.stockRepository.save(newStock);
    }
  }

  /**
   * LOT 수량 업데이트 (낶부 함수)
   */
  private async updateLotQty(lotId: string, qtyDelta: number) {
    const lot = await this.lotRepository.findOne({ where: { id: lotId } });
    if (!lot) return;

    const newQty = lot.currentQty + qtyDelta;
    await this.lotRepository.update(lotId, {
      currentQty: Math.max(0, newQty),
      status: newQty <= 0 ? 'DEPLETED' : lot.status,
    });
  }

  /**
   * 입고 처리
   */
  async receiveStock(dto: ReceiveStockDto) {
    const transNo = await this.generateTransNo();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 트랜잭션 생성
      const transaction = this.stockTransactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        toWarehouseId: dto.warehouseId,
        partId: dto.partId,
        lotId: dto.lotId,
        qty: dto.qty, // 양수
        unitPrice: dto.unitPrice,
        totalAmount: dto.unitPrice ? dto.unitPrice * dto.qty : null,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
      });

      const savedTransaction = await queryRunner.manager.save(StockTransaction, transaction);

      // 2. 재고 업데이트
      const existingStock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: dto.warehouseId, partId: dto.partId, lotId: dto.lotId || IsNull() },
      });

      if (existingStock) {
        await queryRunner.manager.update(MatStock, existingStock.id, {
          qty: existingStock.qty + dto.qty,
          availableQty: existingStock.qty + dto.qty - existingStock.reservedQty,
        });
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: dto.warehouseId,
          partId: dto.partId,
          lotId: dto.lotId || null,
          qty: dto.qty,
          reservedQty: 0,
          availableQty: dto.qty,
        });
      }

      // 3. LOT 수량 업데이트
      if (dto.lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: dto.lotId } });
        if (lot) {
          await queryRunner.manager.update(MatLot, dto.lotId, {
            currentQty: lot.currentQty + dto.qty,
          });
        }
      }

      await queryRunner.commitTransaction();
      return savedTransaction;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 출고 처리
   */
  async issueStock(dto: IssueStockDto) {
    const transNo = await this.generateTransNo();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 재고 확인
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { warehouseCode: dto.warehouseId, partId: dto.partId, lotId: dto.lotId || IsNull() },
      });

      if (!stock || stock.availableQty < dto.qty) {
        throw new BadRequestException(`재고 부족: 가용 ${stock?.availableQty || 0}, 요청 ${dto.qty}`);
      }

      // 2. 트랜잭션 생성
      const transaction = this.stockTransactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        fromWarehouseId: dto.warehouseId,
        toWarehouseId: dto.toWarehouseId,
        partId: dto.partId,
        lotId: dto.lotId,
        qty: -dto.qty, // 음수 (출고)
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
      });

      const savedTransaction = await queryRunner.manager.save(StockTransaction, transaction);

      // 3. 출고 창고 재고 감소
      await queryRunner.manager.update(MatStock, stock.id, {
        qty: stock.qty - dto.qty,
        availableQty: stock.availableQty - dto.qty,
      });

      // 4. 이동 대상 창고가 있으면 입고 처리
      if (dto.toWarehouseId) {
        const targetStock = await queryRunner.manager.findOne(MatStock, {
          where: { warehouseCode: dto.toWarehouseId, partId: dto.partId, lotId: dto.lotId || IsNull() },
        });

        if (targetStock) {
          await queryRunner.manager.update(MatStock, targetStock.id, {
            qty: targetStock.qty + dto.qty,
            availableQty: targetStock.qty + dto.qty - targetStock.reservedQty,
          });
        } else {
          await queryRunner.manager.save(MatStock, {
            warehouseCode: dto.toWarehouseId,
            partId: dto.partId,
            lotId: dto.lotId || null,
            qty: dto.qty,
            reservedQty: 0,
            availableQty: dto.qty,
          });
        }
      }

      // 5. LOT 수량 업데이트 (이동이 아닌 순수 출고 시)
      if (dto.lotId && !dto.toWarehouseId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: dto.lotId } });
        if (lot) {
          const newQty = lot.currentQty - dto.qty;
          await queryRunner.manager.update(MatLot, dto.lotId, {
            currentQty: Math.max(0, newQty),
            status: newQty <= 0 ? 'DEPLETED' : lot.status,
          });
        }
      }

      await queryRunner.commitTransaction();
      return savedTransaction;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 창고간 이동
   */
  async transferStock(dto: TransferStockDto) {
    return this.issueStock({
      warehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      partId: dto.partId,
      lotId: dto.lotId,
      qty: dto.qty,
      transType: 'TRANSFER',
      refType: dto.refType,
      refId: dto.refId,
      workerId: dto.workerId,
      remark: dto.remark,
    });
  }

  /**
   * 트랜잭션 취소 (입고취소, 출고취소)
   * 원 트랜잭션의 반대 수량으로 새 트랜잭션 생성
   */
  async cancelTransaction(dto: CancelTransactionDto) {
    const originalTrans = await this.stockTransactionRepository.findOne({
      where: { id: dto.transactionId },
    });

    if (!originalTrans) {
      throw new NotFoundException('원본 트랜잭션을 찾을 수 없습니다.');
    }

    if (originalTrans.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    }

    // 취소 트랜잭션 유형 결정
    const cancelTransType = this.getCancelTransType(originalTrans.transType);
    const transNo = await this.generateTransNo();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 원본 트랜잭션 상태 변경
      await queryRunner.manager.update(StockTransaction, dto.transactionId, { status: 'CANCELED' });

      // 2. 취소 트랜잭션 생성 (반대 수량)
      const cancelTrans = this.stockTransactionRepository.create({
        transNo,
        transType: cancelTransType,
        transDate: new Date(),
        fromWarehouseId: originalTrans.toWarehouseId, // 반대
        toWarehouseId: originalTrans.fromWarehouseId, // 반대
        partId: originalTrans.partId,
        lotId: originalTrans.lotId,
        qty: -originalTrans.qty, // 반대 부호
        unitPrice: originalTrans.unitPrice,
        totalAmount: originalTrans.totalAmount ? -Number(originalTrans.totalAmount) : null,
        refType: originalTrans.refType,
        refId: originalTrans.refId,
        cancelRefId: originalTrans.id,
        workerId: dto.workerId,
        remark: dto.remark || `취소: ${originalTrans.transNo}`,
        status: 'DONE',
      });

      const savedCancelTrans = await queryRunner.manager.save(StockTransaction, cancelTrans);

      // 3. 재고 복구
      // 원래 입고 창고에서 감소
      if (originalTrans.toWarehouseId && originalTrans.qty > 0) {
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: {
            warehouseCode: originalTrans.toWarehouseId,
            partId: originalTrans.partId,
            lotId: originalTrans.lotId || IsNull(),
          },
        });

        if (stock) {
          const newQty = stock.qty - Math.abs(originalTrans.qty);
          if (newQty < 0) {
            throw new BadRequestException('재고가 부족하여 취소할 수 없습니다.');
          }
          await queryRunner.manager.update(MatStock, stock.id, {
            qty: newQty,
            availableQty: newQty - stock.reservedQty,
          });
        }
      }

      // 원래 출고 창고로 복구
      if (originalTrans.fromWarehouseId && originalTrans.qty < 0) {
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: {
            warehouseCode: originalTrans.fromWarehouseId,
            partId: originalTrans.partId,
            lotId: originalTrans.lotId || IsNull(),
          },
        });

        if (stock) {
          await queryRunner.manager.update(MatStock, stock.id, {
            qty: stock.qty + Math.abs(originalTrans.qty),
            availableQty: stock.availableQty + Math.abs(originalTrans.qty),
          });
        } else {
          await queryRunner.manager.save(MatStock, {
            warehouseCode: originalTrans.fromWarehouseId,
            partId: originalTrans.partId,
            lotId: originalTrans.lotId || null,
            qty: Math.abs(originalTrans.qty),
            reservedQty: 0,
            availableQty: Math.abs(originalTrans.qty),
          });
        }
      }

      // 4. LOT 수량 복구
      if (originalTrans.lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: originalTrans.lotId } });
        if (lot) {
          const newQty = lot.currentQty - originalTrans.qty;
          await queryRunner.manager.update(MatLot, originalTrans.lotId, {
            currentQty: Math.max(0, newQty),
            status: newQty > 0 ? 'NORMAL' : lot.status,
          });
        }
      }

      await queryRunner.commitTransaction();
      return savedCancelTrans;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 취소 트랜잭션 유형 결정
   */
  private getCancelTransType(originalType: string): string {
    const cancelMap: Record<string, string> = {
      'MAT_IN': 'MAT_IN_CANCEL',
      'MAT_OUT': 'MAT_OUT_CANCEL',
      'WIP_IN': 'WIP_IN_CANCEL',
      'WIP_OUT': 'WIP_OUT_CANCEL',
      'FG_IN': 'FG_IN_CANCEL',
      'FG_OUT': 'FG_OUT_CANCEL',
      'SUBCON_IN': 'SUBCON_IN_CANCEL',
      'SUBCON_OUT': 'SUBCON_OUT_CANCEL',
    };
    return cancelMap[originalType] || `${originalType}_CANCEL`;
  }

  /**
   * 현재고 조회
   * @returns 평면화된 재고 데이터 (중첩 객체 → 평면 필드)
   */
  async getStock(query: StockQueryDto, company?: string, plant?: string) {
    const queryBuilder = this.stockRepository.createQueryBuilder('stock')
      .leftJoinAndSelect(Warehouse, 'warehouse', 'stock.warehouseCode = warehouse.warehouseCode')
      .leftJoinAndSelect(PartMaster, 'part', 'stock.partId = part.id')
      .leftJoinAndSelect(MatLot, 'lot', 'stock.lotId = lot.id')
      .select([
        'stock',
        'warehouse.warehouseCode AS warehouse_code',
        'warehouse.warehouseName AS warehouse_name',
        'warehouse.warehouseType AS warehouse_type',
        'part.partCode AS part_code',
        'part.partName AS part_name',
        'part.partType AS part_type',
        'part.unit AS part_unit',
        'lot.lotNo AS lot_no',
        'lot.status AS lot_status',
      ]);

    if (company) {
      queryBuilder.andWhere('stock.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('stock.plant = :plant', { plant });
    }
    if (query.warehouseId) {
      queryBuilder.andWhere('stock.warehouseCode = :warehouseId', { warehouseId: query.warehouseId });
    }
    if (query.partId) {
      queryBuilder.andWhere('stock.partId = :partId', { partId: query.partId });
    }
    if (query.lotId) {
      queryBuilder.andWhere('stock.lotId = :lotId', { lotId: query.lotId });
    }
    if (!query.includeZero) {
      queryBuilder.andWhere('stock.qty > 0');
    }
    if (query.warehouseType) {
      queryBuilder.andWhere('warehouse.warehouseType = :warehouseType', { warehouseType: query.warehouseType });
    }
    if (query.partType) {
      queryBuilder.andWhere('part.partType = :partType', { partType: query.partType });
    }

    const stocks = await queryBuilder
      .orderBy('stock.warehouseId', 'ASC')
      .addOrderBy('stock.partId', 'ASC')
      .getRawMany();

    // 평면화된 응답으로 변환
    return stocks.map((stock) => ({
      id: stock.stock_id,
      warehouseId: stock.stock_warehouseCode,
      partId: stock.stock_partId,
      lotId: stock.stock_lotId,
      qty: stock.stock_qty,
      reservedQty: stock.stock_reservedQty,
      availableQty: stock.stock_availableQty,
      // 품목 정보 (평면화)
      partCode: stock.part_code || null,
      partName: stock.part_name || null,
      partType: stock.part_type || null,
      unit: stock.part_unit || null,
      // 창고 정보 (평면화)
      warehouseCode: stock.warehouse_code || null,
      warehouseName: stock.warehouse_name || null,
      warehouseType: stock.warehouse_type || null,
      // LOT 정보 (평면화)
      lotNo: stock.lot_no || null,
      lotStatus: stock.lot_status || null,
    }));
  }

  /**
   * 수불 이력 조회
   */
  async getTransactions(query: TransactionQueryDto, company?: string, plant?: string) {
    const queryBuilder = this.stockTransactionRepository.createQueryBuilder('trans')
      .leftJoinAndSelect(Warehouse, 'fromWh', 'trans.fromWarehouseId = fromWh.id')
      .leftJoinAndSelect(Warehouse, 'toWh', 'trans.toWarehouseId = toWh.id')
      .leftJoinAndSelect(PartMaster, 'part', 'trans.partId = part.id')
      .leftJoinAndSelect(MatLot, 'lot', 'trans.lotId = lot.id')
      .leftJoinAndSelect(StockTransaction, 'cancelRef', 'trans.cancelRefId = cancelRef.id')
      .select([
        'trans',
        'fromWh AS fromWarehouse',
        'toWh AS toWarehouse',
        'part AS part',
        'lot AS lot',
        'cancelRef AS cancelRef',
      ]);

    if (company) {
      queryBuilder.andWhere('trans.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('trans.plant = :plant', { plant });
    }
    if (query.warehouseId) {
      queryBuilder.andWhere(
        '(trans.fromWarehouseId = :warehouseId OR trans.toWarehouseId = :warehouseId)',
        { warehouseId: query.warehouseId }
      );
    }
    if (query.partId) {
      queryBuilder.andWhere('trans.partId = :partId', { partId: query.partId });
    }
    if (query.lotId) {
      queryBuilder.andWhere('trans.lotId = :lotId', { lotId: query.lotId });
    }
    if (query.transType) {
      queryBuilder.andWhere('trans.transType = :transType', { transType: query.transType });
    }
    if (query.refType) {
      queryBuilder.andWhere('trans.refType = :refType', { refType: query.refType });
    }
    if (query.refId) {
      queryBuilder.andWhere('trans.refId = :refId', { refId: query.refId });
    }
    if (query.dateFrom) {
      queryBuilder.andWhere('trans.transDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      queryBuilder.andWhere('trans.transDate <= :dateTo', { dateTo: query.dateTo });
    }

    return queryBuilder
      .orderBy('trans.transDate', 'DESC')
      .take(query.limit || 100)
      .skip(query.offset || 0)
      .getMany();
  }

  /**
   * LOT 목록 조회
   */
  async getLots(query: { partId?: string; partType?: string; status?: string }) {
    const queryBuilder = this.lotRepository.createQueryBuilder('lot')
      .leftJoinAndSelect(PartMaster, 'part', 'lot.partId = part.id')
      .select(['lot', 'part AS part']);

    if (query.partId) {
      queryBuilder.andWhere('lot.partId = :partId', { partId: query.partId });
    }
    if (query.status) {
      queryBuilder.andWhere('lot.status = :status', { status: query.status });
    }

    return queryBuilder
      .orderBy('lot.createdAt', 'DESC')
      .getMany();
  }

  /**
   * LOT 상세 조회
   */
  async getLotById(id: string) {
    const lot = await this.lotRepository.findOne({
      where: { id },
    });

    if (!lot) {
      throw new NotFoundException('LOT을 찾을 수 없습니다.');
    }

    // Get related data
    const [part, stocks, transactions] = await Promise.all([
      this.partMasterRepository.findOne({ where: { id: lot.partId } }),
      this.stockRepository
        .createQueryBuilder('stock')
        .leftJoinAndSelect(Warehouse, 'warehouse', 'stock.warehouseCode = warehouse.warehouseCode')
        .where('stock.lotId = :lotId', { lotId: id })
        .select(['stock', 'warehouse AS warehouse'])
        .getMany(),
      this.stockTransactionRepository.find({
        where: { lotId: id },
        order: { transDate: 'DESC' },
        take: 20,
      }),
    ]);

    return {
      ...lot,
      part,
      stocks,
      transactions,
    };
  }

  /**
   * 트랜잭션 상세 조회 (ID)
   */
  async getTransactionById(id: string) {
    const transaction = await this.stockTransactionRepository.findOne({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    }

    // Get related data
    const [fromWarehouse, toWarehouse, part, lot, cancelRef, canceledByTrans] = await Promise.all([
      transaction.fromWarehouseId ? this.warehouseRepository.findOne({ where: { id: transaction.fromWarehouseId } }) : null,
      transaction.toWarehouseId ? this.warehouseRepository.findOne({ where: { id: transaction.toWarehouseId } }) : null,
      this.partMasterRepository.findOne({ where: { id: transaction.partId } }),
      transaction.lotId ? this.lotRepository.findOne({ where: { id: transaction.lotId } }) : null,
      transaction.cancelRefId ? this.stockTransactionRepository.findOne({ where: { id: transaction.cancelRefId } }) : null,
      this.stockTransactionRepository.findOne({ where: { cancelRefId: id } }),
    ]);

    return {
      ...transaction,
      fromWarehouse,
      toWarehouse,
      part,
      lot,
      cancelRef,
      canceledByTrans,
    };
  }

  /**
   * 재고 집계
   */
  async getStockSummary(query: { warehouseType?: string; partType?: string }) {
    const queryBuilder = this.stockRepository.createQueryBuilder('stock')
      .leftJoinAndSelect(Warehouse, 'warehouse', 'stock.warehouseCode = warehouse.warehouseCode')
      .leftJoinAndSelect(PartMaster, 'part', 'stock.partId = part.id')
      .where('stock.qty > 0');

    if (query.warehouseType) {
      queryBuilder.andWhere('warehouse.warehouseType = :warehouseType', { warehouseType: query.warehouseType });
    }
    if (query.partType) {
      queryBuilder.andWhere('part.partType = :partType', { partType: query.partType });
    }

    const stocks = await queryBuilder
      .select(['stock', 'warehouse AS warehouse', 'part AS part'])
      .getMany();

    // 품목별 집계
    const summary: Record<string, { partId: string; partCode: string; partName: string; totalQty: number; warehouses: any[] }> = {};

    for (const stock of stocks) {
      if (!summary[stock.partId]) {
        summary[stock.partId] = {
          partId: stock.partId,
          partCode: (stock as any).part?.partCode || '',
          partName: (stock as any).part?.partName || '',
          totalQty: 0,
          warehouses: [],
        };
      }
      summary[stock.partId].totalQty += stock.qty;
      summary[stock.partId].warehouses.push({
        warehouseId: stock.warehouseCode,
        warehouseCode: (stock as any).warehouse?.warehouseCode || '',
        warehouseName: (stock as any).warehouse?.warehouseName || '',
        qty: stock.qty,
      });
    }

    return Object.values(summary);
  }

  /**
   * 트랜잭션 상세 조회
   */
  async getTransaction(id: string) {
    return this.getTransactionById(id);
  }
}
