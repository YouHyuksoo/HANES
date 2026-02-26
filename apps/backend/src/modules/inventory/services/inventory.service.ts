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
import { Repository, DataSource, IsNull, In, MoreThan } from 'typeorm';
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
  async generateLotNo(itemType: string): Promise<string> {
    const today = new Date();
    const prefix = `${itemType}${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

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
      lotNo: dto.lotId,
      itemCode: dto.itemCode,
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
    itemCode: string,
    lotNo: string | null,
    qtyDelta: number,
  ) {
    // 기존 재고 조회
    const existingStock = await this.stockRepository.findOne({
      where: { warehouseCode, itemCode, lotNo: lotNo || IsNull() },
    });

    if (existingStock) {
      // 재고 업데이트
      const newQty = existingStock.qty + qtyDelta;
      if (newQty < 0) {
        throw new BadRequestException(`재고 부족: 현재 ${existingStock.qty}, 요청 ${Math.abs(qtyDelta)}`);
      }

      return this.stockRepository.update(
        { warehouseCode: existingStock.warehouseCode, itemCode: existingStock.itemCode, lotNo: existingStock.lotNo },
        { qty: newQty, availableQty: newQty - existingStock.reservedQty },
      );
    } else {
      // 신규 재고 생성 (입고 시에만)
      if (qtyDelta < 0) {
        throw new BadRequestException('재고가 존재하지 않습니다.');
      }

      const newStock = this.stockRepository.create({
        warehouseCode,
        itemCode,
        lotNo: lotNo || null,
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
  private async updateLotQty(lotNo: string, qtyDelta: number) {
    const lot = await this.lotRepository.findOne({ where: { lotNo: lotNo } });
    if (!lot) return;

    const newQty = lot.currentQty + qtyDelta;
    await this.lotRepository.update(lotNo, {
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
        itemCode: dto.itemCode,
        lotNo: dto.lotId,
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
        where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, lotNo: dto.lotId || IsNull() },
      });

      if (existingStock) {
        await queryRunner.manager.update(MatStock,
          { warehouseCode: existingStock.warehouseCode, itemCode: existingStock.itemCode, lotNo: existingStock.lotNo },
          { qty: existingStock.qty + dto.qty, availableQty: existingStock.qty + dto.qty - existingStock.reservedQty },
        );
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: dto.warehouseId,
          itemCode: dto.itemCode,
          lotNo: dto.lotId || null,
          qty: dto.qty,
          reservedQty: 0,
          availableQty: dto.qty,
        });
      }

      // 3. LOT 수량 업데이트
      if (dto.lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { lotNo: dto.lotId } });
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
        where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, lotNo: dto.lotId || IsNull() },
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
        itemCode: dto.itemCode,
        lotNo: dto.lotId,
        qty: -dto.qty, // 음수 (출고)
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
      });

      const savedTransaction = await queryRunner.manager.save(StockTransaction, transaction);

      // 3. 출고 창고 재고 감소
      await queryRunner.manager.update(MatStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, lotNo: stock.lotNo },
        { qty: stock.qty - dto.qty, availableQty: stock.availableQty - dto.qty },
      );

      // 4. 이동 대상 창고가 있으면 입고 처리
      if (dto.toWarehouseId) {
        const targetStock = await queryRunner.manager.findOne(MatStock, {
          where: { warehouseCode: dto.toWarehouseId, itemCode: dto.itemCode, lotNo: dto.lotId || IsNull() },
        });

        if (targetStock) {
          await queryRunner.manager.update(MatStock,
            { warehouseCode: targetStock.warehouseCode, itemCode: targetStock.itemCode, lotNo: targetStock.lotNo },
            { qty: targetStock.qty + dto.qty, availableQty: targetStock.qty + dto.qty - targetStock.reservedQty },
          );
        } else {
          await queryRunner.manager.save(MatStock, {
            warehouseCode: dto.toWarehouseId,
            itemCode: dto.itemCode,
            lotNo: dto.lotId || null,
            qty: dto.qty,
            reservedQty: 0,
            availableQty: dto.qty,
          });
        }
      }

      // 5. LOT 수량 업데이트 (이동이 아닌 순수 출고 시)
      if (dto.lotId && !dto.toWarehouseId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { lotNo: dto.lotId } });
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
      itemCode: dto.itemCode,
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
      where: { id: +dto.transactionId },
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
      await queryRunner.manager.update(StockTransaction, +dto.transactionId, { status: 'CANCELED' });

      // 2. 취소 트랜잭션 생성 (반대 수량)
      const cancelTrans = this.stockTransactionRepository.create({
        transNo,
        transType: cancelTransType,
        transDate: new Date(),
        fromWarehouseId: originalTrans.toWarehouseId, // 반대
        toWarehouseId: originalTrans.fromWarehouseId, // 반대
        itemCode: originalTrans.itemCode,
        lotNo: originalTrans.lotNo,
        qty: -originalTrans.qty, // 반대 부호
        unitPrice: originalTrans.unitPrice,
        totalAmount: originalTrans.totalAmount ? -Number(originalTrans.totalAmount) : null,
        refType: originalTrans.refType,
        refId: originalTrans.refId,
        cancelRefId: String(originalTrans.id),
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
            itemCode: originalTrans.itemCode,
            lotNo: originalTrans.lotNo || IsNull(),
          },
        });

        if (stock) {
          const newQty = stock.qty - Math.abs(originalTrans.qty);
          if (newQty < 0) {
            throw new BadRequestException('재고가 부족하여 취소할 수 없습니다.');
          }
          await queryRunner.manager.update(MatStock,
            { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, lotNo: stock.lotNo },
            { qty: newQty, availableQty: newQty - stock.reservedQty },
          );
        }
      }

      // 원래 출고 창고로 복구
      if (originalTrans.fromWarehouseId && originalTrans.qty < 0) {
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: {
            warehouseCode: originalTrans.fromWarehouseId,
            itemCode: originalTrans.itemCode,
            lotNo: originalTrans.lotNo || IsNull(),
          },
        });

        if (stock) {
          await queryRunner.manager.update(MatStock,
            { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, lotNo: stock.lotNo },
            { qty: stock.qty + Math.abs(originalTrans.qty), availableQty: stock.availableQty + Math.abs(originalTrans.qty) },
          );
        } else {
          await queryRunner.manager.save(MatStock, {
            warehouseCode: originalTrans.fromWarehouseId,
            itemCode: originalTrans.itemCode,
            lotNo: originalTrans.lotNo || null,
            qty: Math.abs(originalTrans.qty),
            reservedQty: 0,
            availableQty: Math.abs(originalTrans.qty),
          });
        }
      }

      // 4. LOT 수량 복구
      if (originalTrans.lotNo) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { lotNo: originalTrans.lotNo } });
        if (lot) {
          const newQty = lot.currentQty - originalTrans.qty;
          await queryRunner.manager.update(MatLot, originalTrans.lotNo, {
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
    const where: any = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.warehouseId) where.warehouseCode = query.warehouseId;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.lotId) where.lotNo = query.lotId;

    const stocks = await this.stockRepository.find({
      where,
      select: ['warehouseCode', 'itemCode', 'lotNo', 'qty', 'reservedQty', 'availableQty'],
      order: { warehouseCode: 'ASC', itemCode: 'ASC' },
    });

    // 0수량 제외
    let filtered = query.includeZero ? stocks : stocks.filter((s) => s.qty > 0);

    if (filtered.length === 0) return [];

    // 관련 데이터 일괄 조회
    const whCodes = [...new Set(filtered.map((s) => s.warehouseCode).filter(Boolean))];
    const itemCodes = [...new Set(filtered.map((s) => s.itemCode).filter(Boolean))];
    const lotNos = [...new Set(filtered.map((s) => s.lotNo).filter(Boolean))];

    const warehouses = whCodes.length > 0 ? await this.warehouseRepository.find({
      where: { warehouseCode: In(whCodes) },
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName', 'itemType', 'unit'],
    }) : [];
    const lots = lotNos.length > 0 ? await this.lotRepository.find({
      where: { lotNo: In(lotNos as string[]) },
      select: ['lotNo', 'status'],
    }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w] as const));
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));
    const lotMap = new Map(lots.map((l) => [l.lotNo, l] as const));

    // warehouseType/itemType 필터링
    if (query.warehouseType) {
      filtered = filtered.filter((s) => whMap.get(s.warehouseCode)?.warehouseType === query.warehouseType);
    }
    if (query.itemType) {
      filtered = filtered.filter((s) => partMap.get(s.itemCode)?.itemType === query.itemType);
    }

    return filtered.map((s) => {
      const wh = whMap.get(s.warehouseCode);
      const part = partMap.get(s.itemCode);
      const lot = s.lotNo ? lotMap.get(s.lotNo) : null;
      return {
        warehouseId: s.warehouseCode,
        itemCode: s.itemCode,
        lotNo: s.lotNo,
        qty: s.qty,
        reservedQty: s.reservedQty,
        availableQty: s.availableQty,
        itemName: part?.itemName || null,
        itemType: part?.itemType || null,
        unit: part?.unit || null,
        warehouseCode: wh?.warehouseCode || null,
        warehouseName: wh?.warehouseName || null,
        warehouseType: wh?.warehouseType || null,
        lotStatus: lot?.status || null,
      };
    });
  }

  /**
   * 수불 이력 조회
   */
  async getTransactions(query: TransactionQueryDto, company?: string, plant?: string) {
    const where: any = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.lotId) where.lotNo = query.lotId;
    if (query.transType) where.transType = query.transType;
    if (query.refType) where.refType = query.refType;
    if (query.refId) where.refId = query.refId;

    const qb = this.stockTransactionRepository.createQueryBuilder('trans')
      .where(where);

    if (query.warehouseId) {
      qb.andWhere(
        '(trans.fromWarehouseId = :warehouseId OR trans.toWarehouseId = :warehouseId)',
        { warehouseId: query.warehouseId },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('trans.transDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      // dateTo를 해당일 23:59:59로 설정 (자정 기준이면 당일 데이터 누락됨)
      const endOfDay = new Date(query.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      qb.andWhere('trans.transDate <= :dateTo', { dateTo: endOfDay });
    }

    const transactions = await qb
      .orderBy('trans.transDate', 'DESC')
      .take(query.limit || 100)
      .skip(query.offset || 0)
      .getMany();

    if (transactions.length === 0) return [];

    // 관련 데이터 일괄 조회
    const whIds = [...new Set(transactions.flatMap((t) => [t.fromWarehouseId, t.toWarehouseId].filter(Boolean)))];
    const itemCodes = [...new Set(transactions.map((t) => t.itemCode).filter(Boolean))];
    const lotNos = [...new Set(transactions.map((t) => t.lotNo).filter(Boolean))];

    const warehouses = whIds.length > 0 ? await this.warehouseRepository.find({ where: { warehouseCode: In(whIds as string[]) } }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes as string[]) } }) : [];
    const lots = lotNos.length > 0 ? await this.lotRepository.find({ where: { lotNo: In(lotNos as string[]) } }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));

    return transactions.map((t) => ({
      ...t,
      fromWarehouse: t.fromWarehouseId ? whMap.get(t.fromWarehouseId) || null : null,
      toWarehouse: t.toWarehouseId ? whMap.get(t.toWarehouseId) || null : null,
      part: partMap.get(t.itemCode) || null,
      lot: t.lotNo ? lotMap.get(t.lotNo) || null : null,
    }));
  }

  /**
   * LOT 목록 조회
   */
  async getLots(query: { itemCode?: string; itemType?: string; status?: string }) {
    const where: any = {};
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.status) where.status = query.status;

    const lots = await this.lotRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (lots.length === 0) return [];

    const itemCodes = [...new Set(lots.map((l) => l.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return lots.map((l) => ({
      ...l,
      part: partMap.get(l.itemCode) || null,
    }));
  }

  /**
   * LOT 상세 조회
   */
  async getLotById(id: string) {
    const lot = await this.lotRepository.findOne({
      where: { lotNo: id },
    });

    if (!lot) {
      throw new NotFoundException('LOT을 찾을 수 없습니다.');
    }

    const [part, stocks, transactions] = await Promise.all([
      this.partMasterRepository.findOne({ where: { itemCode: lot.itemCode } }),
      this.stockRepository.find({ where: { lotNo: id } }),
      this.stockTransactionRepository.find({
        where: { lotNo: id },
        order: { transDate: 'DESC' },
        take: 20,
      }),
    ]);

    // stock에 warehouse 정보 추가
    const whCodes = [...new Set(stocks.map((s) => s.warehouseCode).filter(Boolean))];
    const warehouses = whCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(whCodes) } })
      : [];
    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    return {
      ...lot,
      part,
      stocks: stocks.map((s) => ({ ...s, warehouse: whMap.get(s.warehouseCode) || null })),
      transactions,
    };
  }

  /**
   * 트랜잭션 상세 조회 (ID)
   */
  async getTransactionById(id: string) {
    const transaction = await this.stockTransactionRepository.findOne({
      where: { id: +id },
    });

    if (!transaction) {
      throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    }

    // Get related data
    const [fromWarehouse, toWarehouse, part, lot, cancelRef, canceledByTrans] = await Promise.all([
      transaction.fromWarehouseId ? this.warehouseRepository.findOne({ where: { warehouseCode: transaction.fromWarehouseId } }) : null,
      transaction.toWarehouseId ? this.warehouseRepository.findOne({ where: { warehouseCode: transaction.toWarehouseId } }) : null,
      this.partMasterRepository.findOne({ where: { itemCode: transaction.itemCode } }),
      transaction.lotNo ? this.lotRepository.findOne({ where: { lotNo: transaction.lotNo } }) : null,
      transaction.cancelRefId ? this.stockTransactionRepository.findOne({ where: { id: +transaction.cancelRefId } }) : null,
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
  async getStockSummary(query: { warehouseType?: string; itemType?: string }) {
    let stocks = await this.stockRepository.find({
      where: { qty: MoreThan(0) },
      select: ['warehouseCode', 'itemCode', 'qty'],
    });

    if (stocks.length === 0) return [];

    const whCodes = [...new Set(stocks.map((s) => s.warehouseCode).filter(Boolean))];
    const itemCodes = [...new Set(stocks.map((s) => s.itemCode).filter(Boolean))];

    const warehouses = whCodes.length > 0 ? await this.warehouseRepository.find({
      where: { warehouseCode: In(whCodes) },
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName', 'itemType'],
    }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w] as const));
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    // 타입 필터
    if (query.warehouseType) {
      stocks = stocks.filter((s) => whMap.get(s.warehouseCode)?.warehouseType === query.warehouseType);
    }
    if (query.itemType) {
      stocks = stocks.filter((s) => partMap.get(s.itemCode)?.itemType === query.itemType);
    }

    // 품목별 집계
    const summary: Record<string, { itemCode: string; itemName: string; totalQty: number; warehouses: any[] }> = {};

    for (const stock of stocks) {
      const part = partMap.get(stock.itemCode);
      const wh = whMap.get(stock.warehouseCode);

      if (!summary[stock.itemCode]) {
        summary[stock.itemCode] = {
          itemCode: stock.itemCode,
          itemName: part?.itemName || '',
          totalQty: 0,
          warehouses: [],
        };
      }
      summary[stock.itemCode].totalQty += stock.qty;
      summary[stock.itemCode].warehouses.push({
        warehouseId: stock.warehouseCode,
        warehouseCode: wh?.warehouseCode || '',
        warehouseName: wh?.warehouseName || '',
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
