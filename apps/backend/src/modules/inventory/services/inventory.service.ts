/**
 * @file src/modules/inventory/services/inventory.service.ts
 * @description 재고관리 쓰기 서비스 - 수불 트랜잭션 처리 (TypeORM)
 *
 * 핵심 원칙:
 * 1. 모든 수불은 이력으로 남김 (삭제 금지)
 * 2. 취소 시 원 트랜잭션 참조 + 음수 수량
 * 3. 재고 = SUM(트랜잭션 수량)
 *
 * 조회 전용 메서드는 InventoryQueryService로 분리되어 있음
 * 하위 호환성을 위해 컨트롤러에서 호출되는 조회 메서드는 위임(delegate) 처리
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import {
  ReceiveStockDto,
  IssueStockDto,
  TransferStockDto,
  CancelTransactionDto,
  CreateLotDto,
  StockQueryDto,
  TransactionQueryDto,
} from '../dto/inventory.dto';
import { InventoryQueryService } from './inventory-query.service';
import { TransactionService } from '../../../shared/transaction.service';

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
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    private readonly inventoryQueryService: InventoryQueryService,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string; plant?: string },
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

  // ──────────────────────────────────────────────────────────────
  // 조회 위임 (컨트롤러 하위 호환성 유지 — 실제 로직은 InventoryQueryService)
  // ──────────────────────────────────────────────────────────────

  async getStock(query: StockQueryDto, company?: string, plant?: string) {
    return this.inventoryQueryService.getStock(query, company, plant);
  }

  async getTransactions(query: TransactionQueryDto, company?: string, plant?: string) {
    return this.inventoryQueryService.getTransactions(query, company, plant);
  }

  async getLots(query: { itemCode?: string; itemType?: string; status?: string }, company?: string, plant?: string) {
    return this.inventoryQueryService.getLots(query, company, plant);
  }

  async getLotById(id: string, company?: string, plant?: string) {
    return this.inventoryQueryService.getLotById(id, company, plant);
  }

  async getTransactionById(transNo: string, company?: string, plant?: string) {
    return this.inventoryQueryService.getTransactionById(transNo, company, plant);
  }

  async getTransaction(id: string, company?: string, plant?: string) {
    return this.inventoryQueryService.getTransaction(id, company, plant);
  }

  async getStockSummary(query: { warehouseType?: string; itemType?: string }, company?: string, plant?: string) {
    return this.inventoryQueryService.getStockSummary(query, company, plant);
  }

  /**
   * 트랜잭션 번호 생성
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `TRX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

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

  /**
   * 자재 UID 생성
   */
  async generateMatUid(itemType: string, company?: string, plant?: string): Promise<string> {
    const today = new Date();
    const prefix = `${itemType}${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastLot = await this.lotRepository.findOne({
      where: { matUid: Like(`${prefix}%`), ...this.tenantWhere(company, plant) },
      order: { matUid: 'DESC' },
    });

    let seq = 1;
    if (lastLot) {
      const lastSeq = parseInt(lastLot.matUid.slice(-4), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * LOT 생성
   */
  async createLot(dto: CreateLotDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const existingLot = await this.lotRepository.findOne({
      where: { matUid: dto.matUid, ...tenantWhere },
    });

    if (existingLot) {
      throw new BadRequestException(`이미 등록된 LOT입니다: ${dto.matUid}`);
    }

    const lot = this.lotRepository.create({
      matUid: dto.matUid,
      itemCode: dto.itemCode,
      initQty: dto.initQty,
      recvDate: dto.recvDate,
      expireDate: dto.expireDate,
      origin: dto.origin,
      vendor: dto.vendor,
      invoiceNo: dto.invoiceNo,
      poNo: dto.poNo,
      company: company || null,
      plant: plant || null,
    });

    return this.lotRepository.save(lot);
  }

  /**
   * 입고 처리
   */
  async receiveStock(dto: ReceiveStockDto, company?: string, plant?: string) {
    const transNo = await this.generateTransNo();

    return this.tx.run(async (queryRunner) => {
      // 1. 트랜잭션 생성
      const transaction = this.stockTransactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        toWarehouseId: dto.warehouseCode,
        itemCode: dto.itemCode,
        matUid: dto.matUid,
        qty: dto.qty, // 양수
        unitPrice: dto.unitPrice,
        totalAmount: dto.unitPrice ? dto.unitPrice * dto.qty : null,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
        company: company || null,
        plant: plant || null,
      });

      const savedTransaction = await queryRunner.manager.save(StockTransaction, transaction);

      // 2. 재고 업데이트
      const existingStock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode: dto.warehouseCode,
          itemCode: dto.itemCode,
          matUid: dto.matUid || IsNull(),
          ...(company && { company }),
          ...(plant && { plant }),
        },
      });

      if (existingStock) {
        await queryRunner.manager.update(MatStock,
          {
            warehouseCode: existingStock.warehouseCode,
            itemCode: existingStock.itemCode,
            matUid: existingStock.matUid,
            ...(company && { company }),
            ...(plant && { plant }),
          },
          { qty: existingStock.qty + dto.qty, availableQty: existingStock.qty + dto.qty - existingStock.reservedQty },
        );
      } else {
        await queryRunner.manager.save(MatStock, {
          warehouseCode: dto.warehouseCode,
          itemCode: dto.itemCode,
          matUid: dto.matUid || null,
          qty: dto.qty,
          reservedQty: 0,
          availableQty: dto.qty,
          company: company || null,
          plant: plant || null,
        });
      }

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리

      return savedTransaction;
    });
  }

  /**
   * 출고 처리
   */
  async issueStock(dto: IssueStockDto, company?: string, plant?: string) {
    const transNo = await this.generateTransNo();

    return this.tx.run(async (queryRunner) => {
      // 1. 재고 확인
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode: dto.warehouseCode,
          itemCode: dto.itemCode,
          matUid: dto.matUid || IsNull(),
          ...(company && { company }),
          ...(plant && { plant }),
        },
      });

      if (!stock || stock.availableQty < dto.qty) {
        throw new BadRequestException(`재고 부족: 가용 ${stock?.availableQty || 0}, 요청 ${dto.qty}`);
      }

      // 2. 트랜잭션 생성
      const transaction = this.stockTransactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        fromWarehouseId: dto.warehouseCode,
        toWarehouseId: dto.toWarehouseCode,
        itemCode: dto.itemCode,
        matUid: dto.matUid,
        qty: -dto.qty, // 음수 (출고)
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
        company: company || null,
        plant: plant || null,
      });

      const savedTransaction = await queryRunner.manager.save(StockTransaction, transaction);

      // 3. 출고 창고 재고 감소
      await queryRunner.manager.update(MatStock,
        {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          matUid: stock.matUid,
          ...(company && { company }),
          ...(plant && { plant }),
        },
        { qty: stock.qty - dto.qty, availableQty: stock.availableQty - dto.qty },
      );

      // 4. 이동 대상 창고가 있으면 입고 처리
      if (dto.toWarehouseCode) {
        const targetStock = await queryRunner.manager.findOne(MatStock, {
          where: {
            warehouseCode: dto.toWarehouseCode,
            itemCode: dto.itemCode,
            matUid: dto.matUid || IsNull(),
            ...(company && { company }),
            ...(plant && { plant }),
          },
        });

        if (targetStock) {
          await queryRunner.manager.update(MatStock,
            {
              warehouseCode: targetStock.warehouseCode,
              itemCode: targetStock.itemCode,
              matUid: targetStock.matUid,
              ...(company && { company }),
              ...(plant && { plant }),
            },
            { qty: targetStock.qty + dto.qty, availableQty: targetStock.qty + dto.qty - targetStock.reservedQty },
          );
        } else {
          await queryRunner.manager.save(MatStock, {
            warehouseCode: dto.toWarehouseCode,
            itemCode: dto.itemCode,
            matUid: dto.matUid || null,
            qty: dto.qty,
            reservedQty: 0,
            availableQty: dto.qty,
            company: company || null,
            plant: plant || null,
          });
        }
      }

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리

      return savedTransaction;
    });
  }

  /**
   * 창고간 이동
   */
  async transferStock(dto: TransferStockDto, company?: string, plant?: string) {
    return this.issueStock({
      warehouseCode: dto.fromWarehouseCode,
      toWarehouseCode: dto.toWarehouseCode,
      itemCode: dto.itemCode,
      matUid: dto.matUid,
      qty: dto.qty,
      transType: 'TRANSFER',
      refType: dto.refType,
      refId: dto.refId,
      workerId: dto.workerId,
      remark: dto.remark,
    }, company, plant);
  }

  /**
   * 트랜잭션 취소 (입고취소, 출고취소)
   * 원 트랜잭션의 반대 수량으로 새 트랜잭션 생성
   */
  async cancelTransaction(dto: CancelTransactionDto, company?: string, plant?: string) {
    const originalTrans = await this.stockTransactionRepository.findOne({
      where: {
        transNo: dto.transactionId,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });

    if (!originalTrans) {
      throw new NotFoundException('원본 트랜잭션을 찾을 수 없습니다.');
    }

    if (originalTrans.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    }

    this.assertSameTenant('원본 트랜잭션', { company, plant }, originalTrans);

    // 취소 트랜잭션 유형 결정
    const cancelTransType = this.getCancelTransType(originalTrans.transType);
    const transNo = await this.generateTransNo();
    const txTenantWhere = {
      ...(originalTrans.company && { company: originalTrans.company }),
      ...(originalTrans.plant && { plant: originalTrans.plant }),
    };

    return this.tx.run(async (queryRunner) => {
      // 1. 원본 트랜잭션 상태 변경
      await queryRunner.manager.update(StockTransaction, { transNo: originalTrans.transNo, ...txTenantWhere }, { status: 'CANCELED' });

      // 2. 취소 트랜잭션 생성 (반대 수량)
      const cancelTrans = this.stockTransactionRepository.create({
        transNo,
        transType: cancelTransType,
        transDate: new Date(),
        fromWarehouseId: originalTrans.toWarehouseId, // 반대
        toWarehouseId: originalTrans.fromWarehouseId, // 반대
        itemCode: originalTrans.itemCode,
        matUid: originalTrans.matUid,
        qty: -originalTrans.qty, // 반대 부호
        unitPrice: originalTrans.unitPrice,
        totalAmount: originalTrans.totalAmount ? -Number(originalTrans.totalAmount) : null,
        refType: originalTrans.refType,
        refId: originalTrans.refId,
        cancelRefId: originalTrans.transNo,
        workerId: dto.workerId,
        remark: dto.remark || `취소: ${originalTrans.transNo}`,
        status: 'DONE',
        company: originalTrans.company || company || null,
        plant: originalTrans.plant || plant || null,
      });

      const savedCancelTrans = await queryRunner.manager.save(StockTransaction, cancelTrans);

      // 3. 재고 복구
      // 원래 입고 창고에서 감소
      if (originalTrans.toWarehouseId && originalTrans.qty > 0) {
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: {
            warehouseCode: originalTrans.toWarehouseId,
            itemCode: originalTrans.itemCode,
            matUid: originalTrans.matUid || IsNull(),
            ...txTenantWhere,
          },
        });

        if (stock) {
          this.assertSameTenant('취소 대상 재고', { company: originalTrans.company ?? company, plant: originalTrans.plant ?? plant }, stock);
          const newQty = stock.qty - Math.abs(originalTrans.qty);
          if (newQty < 0) {
            throw new BadRequestException('재고가 부족하여 취소할 수 없습니다.');
          }
          await queryRunner.manager.update(MatStock,
            {
              warehouseCode: stock.warehouseCode,
              itemCode: stock.itemCode,
              matUid: stock.matUid,
              ...txTenantWhere,
            },
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
            matUid: originalTrans.matUid || IsNull(),
            ...txTenantWhere,
          },
        });

        if (stock) {
          this.assertSameTenant('복구 대상 재고', { company: originalTrans.company ?? company, plant: originalTrans.plant ?? plant }, stock);
          await queryRunner.manager.update(MatStock,
            {
              warehouseCode: stock.warehouseCode,
              itemCode: stock.itemCode,
              matUid: stock.matUid,
              ...txTenantWhere,
            },
            { qty: stock.qty + Math.abs(originalTrans.qty), availableQty: stock.availableQty + Math.abs(originalTrans.qty) },
          );
        } else {
          await queryRunner.manager.save(MatStock, {
            warehouseCode: originalTrans.fromWarehouseId,
            itemCode: originalTrans.itemCode,
            matUid: originalTrans.matUid || null,
            qty: Math.abs(originalTrans.qty),
            reservedQty: 0,
            availableQty: Math.abs(originalTrans.qty),
            company: originalTrans.company || company || null,
            plant: originalTrans.plant || plant || null,
          });
        }
      }

      // NOTE: MatLot.currentQty 제거됨 — 재고수량은 MatStock에서만 관리

      return savedCancelTrans;
    });
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
}
