/**
 * @file src/modules/inventory/services/inventory.service.ts
 * @description 재고관리 핵심 서비스 - 수불 트랜잭션 처리
 *
 * 핵심 원칙:
 * 1. 모든 수불은 이력으로 남김 (삭제 금지)
 * 2. 취소 시 원 트랜잭션 참조 + 음수 수량
 * 3. 재고 = SUM(트랜잭션 수량)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
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
  constructor(private prisma: PrismaService) {}

  /**
   * 트랜잭션 번호 생성
   */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `TRX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastTrans = await this.prisma.stockTransaction.findFirst({
      where: { transNo: { startsWith: prefix } },
      orderBy: { transNo: 'desc' },
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

    const lastLot = await this.prisma.lot.findFirst({
      where: { lotNo: { startsWith: prefix } },
      orderBy: { lotNo: 'desc' },
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
    return this.prisma.lot.create({
      data: {
        lotNo: dto.lotNo,
        partId: dto.partId,
        partType: dto.partType,
        initQty: dto.initQty,
        currentQty: dto.initQty,
        recvDate: dto.recvDate,
        expireDate: dto.expireDate,
        origin: dto.origin,
        vendor: dto.vendor,
        invoiceNo: dto.invoiceNo,
        poNo: dto.poNo,
        jobOrderId: dto.jobOrderId,
        parentLotId: dto.parentLotId,
      },
      include: { part: true },
    });
  }

  /**
   * 재고 업데이트 (내부 함수)
   */
  private async updateStock(
    warehouseId: string,
    partId: string,
    lotId: string | null,
    qtyDelta: number,
  ) {
    // 기존 재고 조회
    const existingStock = await this.prisma.stock.findFirst({
      where: { warehouseId, partId, lotId: lotId || null },
    });

    if (existingStock) {
      // 재고 업데이트
      const newQty = existingStock.qty + qtyDelta;
      if (newQty < 0) {
        throw new BadRequestException(`재고 부족: 현재 ${existingStock.qty}, 요청 ${Math.abs(qtyDelta)}`);
      }

      return this.prisma.stock.update({
        where: { id: existingStock.id },
        data: {
          qty: newQty,
          availableQty: newQty - existingStock.reservedQty,
          lastTransAt: new Date(),
        },
      });
    } else {
      // 신규 재고 생성 (입고 시에만)
      if (qtyDelta < 0) {
        throw new BadRequestException('재고가 존재하지 않습니다.');
      }

      return this.prisma.stock.create({
        data: {
          warehouseId,
          partId,
          lotId: lotId || null,
          qty: qtyDelta,
          reservedQty: 0,
          availableQty: qtyDelta,
          lastTransAt: new Date(),
        },
      });
    }
  }

  /**
   * LOT 수량 업데이트 (내부 함수)
   */
  private async updateLotQty(lotId: string, qtyDelta: number) {
    const lot = await this.prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot) return;

    const newQty = lot.currentQty + qtyDelta;
    await this.prisma.lot.update({
      where: { id: lotId },
      data: {
        currentQty: Math.max(0, newQty),
        status: newQty <= 0 ? 'DEPLETED' : lot.status,
      },
    });
  }

  /**
   * 입고 처리
   */
  async receiveStock(dto: ReceiveStockDto) {
    const transNo = await this.generateTransNo();

    return this.prisma.$transaction(async (tx) => {
      // 1. 트랜잭션 생성
      const transaction = await tx.stockTransaction.create({
        data: {
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
        },
      });

      // 2. 재고 업데이트
      const existingStock = await tx.stock.findFirst({
        where: { warehouseId: dto.warehouseId, partId: dto.partId, lotId: dto.lotId || null },
      });

      if (existingStock) {
        await tx.stock.update({
          where: { id: existingStock.id },
          data: {
            qty: existingStock.qty + dto.qty,
            availableQty: existingStock.qty + dto.qty - existingStock.reservedQty,
            lastTransAt: new Date(),
          },
        });
      } else {
        await tx.stock.create({
          data: {
            warehouseId: dto.warehouseId,
            partId: dto.partId,
            lotId: dto.lotId || null,
            qty: dto.qty,
            reservedQty: 0,
            availableQty: dto.qty,
            lastTransAt: new Date(),
          },
        });
      }

      // 3. LOT 수량 업데이트
      if (dto.lotId) {
        const lot = await tx.lot.findUnique({ where: { id: dto.lotId } });
        if (lot) {
          await tx.lot.update({
            where: { id: dto.lotId },
            data: { currentQty: lot.currentQty + dto.qty },
          });
        }
      }

      return transaction;
    });
  }

  /**
   * 출고 처리
   */
  async issueStock(dto: IssueStockDto) {
    const transNo = await this.generateTransNo();

    return this.prisma.$transaction(async (tx) => {
      // 1. 재고 확인
      const stock = await tx.stock.findFirst({
        where: { warehouseId: dto.warehouseId, partId: dto.partId, lotId: dto.lotId || null },
      });

      if (!stock || stock.availableQty < dto.qty) {
        throw new BadRequestException(`재고 부족: 가용 ${stock?.availableQty || 0}, 요청 ${dto.qty}`);
      }

      // 2. 트랜잭션 생성
      const transaction = await tx.stockTransaction.create({
        data: {
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
        },
      });

      // 3. 출고 창고 재고 감소
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          qty: stock.qty - dto.qty,
          availableQty: stock.availableQty - dto.qty,
          lastTransAt: new Date(),
        },
      });

      // 4. 이동 대상 창고가 있으면 입고 처리
      if (dto.toWarehouseId) {
        const targetStock = await tx.stock.findFirst({
          where: { warehouseId: dto.toWarehouseId, partId: dto.partId, lotId: dto.lotId || null },
        });

        if (targetStock) {
          await tx.stock.update({
            where: { id: targetStock.id },
            data: {
              qty: targetStock.qty + dto.qty,
              availableQty: targetStock.qty + dto.qty - targetStock.reservedQty,
              lastTransAt: new Date(),
            },
          });
        } else {
          await tx.stock.create({
            data: {
              warehouseId: dto.toWarehouseId,
              partId: dto.partId,
              lotId: dto.lotId || null,
              qty: dto.qty,
              reservedQty: 0,
              availableQty: dto.qty,
              lastTransAt: new Date(),
            },
          });
        }
      }

      // 5. LOT 수량 업데이트 (이동이 아닌 순수 출고 시)
      if (dto.lotId && !dto.toWarehouseId) {
        const lot = await tx.lot.findUnique({ where: { id: dto.lotId } });
        if (lot) {
          const newQty = lot.currentQty - dto.qty;
          await tx.lot.update({
            where: { id: dto.lotId },
            data: {
              currentQty: Math.max(0, newQty),
              status: newQty <= 0 ? 'DEPLETED' : lot.status,
            },
          });
        }
      }

      return transaction;
    });
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
    const originalTrans = await this.prisma.stockTransaction.findUnique({
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

    return this.prisma.$transaction(async (tx) => {
      // 1. 원본 트랜잭션 상태 변경
      await tx.stockTransaction.update({
        where: { id: dto.transactionId },
        data: { status: 'CANCELED' },
      });

      // 2. 취소 트랜잭션 생성 (반대 수량)
      const cancelTrans = await tx.stockTransaction.create({
        data: {
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
        },
      });

      // 3. 재고 복구
      // 원래 입고 창고에서 감소
      if (originalTrans.toWarehouseId && originalTrans.qty > 0) {
        const stock = await tx.stock.findFirst({
          where: {
            warehouseId: originalTrans.toWarehouseId,
            partId: originalTrans.partId,
            lotId: originalTrans.lotId || null,
          },
        });

        if (stock) {
          const newQty = stock.qty - Math.abs(originalTrans.qty);
          if (newQty < 0) {
            throw new BadRequestException('재고가 부족하여 취소할 수 없습니다.');
          }
          await tx.stock.update({
            where: { id: stock.id },
            data: {
              qty: newQty,
              availableQty: newQty - stock.reservedQty,
              lastTransAt: new Date(),
            },
          });
        }
      }

      // 원래 출고 창고로 복구
      if (originalTrans.fromWarehouseId && originalTrans.qty < 0) {
        const stock = await tx.stock.findFirst({
          where: {
            warehouseId: originalTrans.fromWarehouseId,
            partId: originalTrans.partId,
            lotId: originalTrans.lotId || null,
          },
        });

        if (stock) {
          await tx.stock.update({
            where: { id: stock.id },
            data: {
              qty: stock.qty + Math.abs(originalTrans.qty),
              availableQty: stock.availableQty + Math.abs(originalTrans.qty),
              lastTransAt: new Date(),
            },
          });
        } else {
          await tx.stock.create({
            data: {
              warehouseId: originalTrans.fromWarehouseId,
              partId: originalTrans.partId,
              lotId: originalTrans.lotId || null,
              qty: Math.abs(originalTrans.qty),
              reservedQty: 0,
              availableQty: Math.abs(originalTrans.qty),
              lastTransAt: new Date(),
            },
          });
        }
      }

      // 4. LOT 수량 복구
      if (originalTrans.lotId) {
        const lot = await tx.lot.findUnique({ where: { id: originalTrans.lotId } });
        if (lot) {
          const newQty = lot.currentQty - originalTrans.qty;
          await tx.lot.update({
            where: { id: originalTrans.lotId },
            data: {
              currentQty: Math.max(0, newQty),
              status: newQty > 0 ? 'NORMAL' : lot.status,
            },
          });
        }
      }

      return cancelTrans;
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

  /**
   * 현재고 조회
   */
  async getStock(query: StockQueryDto) {
    const where: any = {};

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.partId) where.partId = query.partId;
    if (query.lotId) where.lotId = query.lotId;
    if (!query.includeZero) where.qty = { gt: 0 };

    if (query.warehouseType) {
      where.warehouse = { warehouseType: query.warehouseType };
    }

    if (query.partType) {
      where.part = { partType: query.partType };
    }

    return this.prisma.stock.findMany({
      where,
      include: {
        warehouse: true,
        part: true,
        lot: true,
      },
      orderBy: [{ warehouseId: 'asc' }, { partId: 'asc' }],
    });
  }

  /**
   * 수불 이력 조회
   */
  async getTransactions(query: TransactionQueryDto) {
    const where: any = {};

    if (query.warehouseId) {
      where.OR = [
        { fromWarehouseId: query.warehouseId },
        { toWarehouseId: query.warehouseId },
      ];
    }
    if (query.partId) where.partId = query.partId;
    if (query.lotId) where.lotId = query.lotId;
    if (query.transType) where.transType = query.transType;
    if (query.refType) where.refType = query.refType;
    if (query.refId) where.refId = query.refId;

    if (query.dateFrom || query.dateTo) {
      where.transDate = {};
      if (query.dateFrom) where.transDate.gte = query.dateFrom;
      if (query.dateTo) where.transDate.lte = query.dateTo;
    }

    return this.prisma.stockTransaction.findMany({
      where,
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        part: true,
        lot: true,
        cancelRef: true,
      },
      orderBy: { transDate: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });
  }

  /**
   * LOT 목록 조회
   */
  async getLots(query: { partId?: string; partType?: string; status?: string }) {
    const where: any = {};
    if (query.partId) where.partId = query.partId;
    if (query.partType) where.partType = query.partType;
    if (query.status) where.status = query.status;

    return this.prisma.lot.findMany({
      where,
      include: { part: true, parentLot: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * LOT 상세 조회
   */
  async getLotById(id: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: {
        part: true,
        parentLot: true,
        childLots: true,
        stocks: { include: { warehouse: true } },
        transactions: { orderBy: { transDate: 'desc' }, take: 20 },
      },
    });

    if (!lot) {
      throw new NotFoundException('LOT을 찾을 수 없습니다.');
    }

    return lot;
  }

  /**
   * 트랜잭션 상세 조회 (ID)
   */
  async getTransactionById(id: string) {
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        part: true,
        lot: true,
        cancelRef: true,
        canceledByTrans: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    }

    return transaction;
  }

  /**
   * 재고 집계
   */
  async getStockSummary(query: { warehouseType?: string; partType?: string }) {
    const warehouseType = query.warehouseType;
    const partType = query.partType;
    const where: any = {};
    if (warehouseType) where.warehouse = { warehouseType };
    if (partType) where.part = { partType };

    const stocks = await this.prisma.stock.findMany({
      where: { ...where, qty: { gt: 0 } },
      include: { warehouse: true, part: true },
    });

    // 품목별 집계
    const summary: Record<string, { partId: string; partCode: string; partName: string; totalQty: number; warehouses: any[] }> = {};

    for (const stock of stocks) {
      if (!summary[stock.partId]) {
        summary[stock.partId] = {
          partId: stock.partId,
          partCode: stock.part.partCode,
          partName: stock.part.partName,
          totalQty: 0,
          warehouses: [],
        };
      }
      summary[stock.partId].totalQty += stock.qty;
      summary[stock.partId].warehouses.push({
        warehouseId: stock.warehouseId,
        warehouseCode: stock.warehouse.warehouseCode,
        warehouseName: stock.warehouse.warehouseName,
        qty: stock.qty,
      });
    }

    return Object.values(summary);
  }

  /**
   * 트랜잭션 상세 조회
   */
  async getTransaction(id: string) {
    return this.prisma.stockTransaction.findUnique({
      where: { id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        part: true,
        lot: true,
        cancelRef: true,
        canceledByTrans: true,
      },
    });
  }
}
