import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

@Injectable()
export class MatOutRequestService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
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
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  async findPending(query: { page?: number; limit?: number }, company?: string, plant?: string) {
    const { page = 1, limit = 20 } = query;
    const where: FindOptionsWhere<StockTransaction> = {
      status: 'PENDING_APPROVAL',
      ...(company && { company }),
      ...(plant && { plant }),
    };

    const [data, total] = await this.stockTxRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async create(dto: { matUid: string; itemCode: string; qty: number; outType: string; reason?: string; workerId?: string; company?: string; plant?: string }) {
    const lot = await this.matLotRepo.findOne({
      where: {
        matUid: dto.matUid,
        ...(dto.company ? { company: dto.company } : {}),
        ...(dto.plant ? { plant: dto.plant } : {}),
      },
    });
    if (lot?.status === 'HOLD') {
      throw new BadRequestException(`Cannot create material-out request for HOLD lot: ${dto.matUid}`);
    }

    const stock = await this.matStockRepo.findOne({
      where: {
        matUid: dto.matUid,
        itemCode: dto.itemCode,
        ...(dto.company ? { company: dto.company } : {}),
        ...(dto.plant ? { plant: dto.plant } : {}),
      },
    });

    if (!stock) throw new NotFoundException('Material stock not found.');

    const availableQty = stock.availableQty ?? Math.max(0, stock.qty - (stock.reservedQty ?? 0));
    if (availableQty < dto.qty) {
      throw new BadRequestException('Insufficient available stock.');
    }

    return this.tx.run(async (queryRunner) => {
      const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');

      const tx = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MAT_OUT',
        fromWarehouseId: stock.warehouseCode,
        itemCode: dto.itemCode,
        matUid: dto.matUid,
        qty: -dto.qty,
        remark: `Material-out request (${dto.outType}): ${dto.reason || ''}`,
        workerId: dto.workerId,
        refType: dto.outType,
        status: 'PENDING_APPROVAL',
        company: dto.company,
        plant: dto.plant,
      });
      await queryRunner.manager.save(tx);

      const reserved = await queryRunner.manager.createQueryBuilder()
        .update(MatStock)
        .set({
          reservedQty: () => '"RESERVED_QTY" + :stockDelta',
          availableQty: () => '"AVAILABLE_QTY" - :stockDelta',
        })
        .where({
          warehouseCode: stock.warehouseCode,
          itemCode: dto.itemCode,
          matUid: dto.matUid,
          ...(dto.company ? { company: dto.company } : {}),
          ...(dto.plant ? { plant: dto.plant } : {}),
        })
        .andWhere('"AVAILABLE_QTY" >= :stockDelta')
        .setParameters({ stockDelta: dto.qty })
        .execute();
      if ((reserved.affected ?? 0) !== 1) {
        throw new BadRequestException('동시 요청으로 가용재고가 변경되었습니다. 다시 조회해 주세요.');
      }

      return tx;
    });
  }

  async approve(transNo: string, approverId: string, company?: string, plant?: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo, ...this.tenantWhere(company, plant) } });
    if (!tx) throw new NotFoundException('Stock transaction not found.');
    this.assertSameTenant('자재출고요청 거래', tx, company, plant);
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('Transaction is not pending approval.');

    const txTenantWhere = this.tenantWhere(tx.company, tx.plant);

    if (tx.matUid) {
      const lot = await this.matLotRepo.findOne({ where: { matUid: tx.matUid, ...txTenantWhere } });
      if (lot?.status === 'HOLD') {
        throw new BadRequestException(`Cannot approve material-out for HOLD lot: ${tx.matUid}`);
      }
    }

    const stock = await this.matStockRepo.findOne({
      where: {
        ...(tx.fromWarehouseId ? { warehouseCode: tx.fromWarehouseId } : {}),
        ...(tx.matUid ? { matUid: tx.matUid } : {}),
        itemCode: tx.itemCode,
        ...txTenantWhere,
      },
    });
    if (!stock) throw new NotFoundException('Material stock not found.');

    const absQty = Math.abs(tx.qty);
    if (stock.qty < absQty) {
      throw new BadRequestException(`Insufficient physical stock. Current qty: ${stock.qty}`);
    }

    return this.tx.run(async (queryRunner) => {
      const claimed = await queryRunner.manager.createQueryBuilder()
        .update(StockTransaction)
        .set({ status: 'DONE', approverId, approvedAt: new Date() })
        .where({ transNo, ...txTenantWhere })
        .andWhere('"STATUS" = :pendingStatus')
        .setParameters({ pendingStatus: 'PENDING_APPROVAL' })
        .execute();
      if ((claimed.affected ?? 0) !== 1) {
        throw new BadRequestException('이미 처리되었거나 동시에 처리 중인 출고요청입니다.');
      }

      const changed = await queryRunner.manager.createQueryBuilder()
        .update(MatStock)
        .set({
          qty: () => '"QTY" - :stockDelta',
          reservedQty: () => '"RESERVED_QTY" - :stockDelta',
        })
        .where({
        warehouseCode: stock.warehouseCode,
        itemCode: tx.itemCode,
        ...(tx.matUid ? { matUid: tx.matUid } : {}),
        ...txTenantWhere,
        })
        .andWhere('"QTY" >= :stockDelta AND "RESERVED_QTY" >= :stockDelta')
        .setParameters({ stockDelta: absQty })
        .execute();
      if ((changed.affected ?? 0) !== 1) {
        throw new BadRequestException('동시 처리로 재고 또는 예약수량이 변경되었습니다. 다시 조회해 주세요.');
      }

      return { transNo, status: 'DONE' };
    });
  }

  async reject(transNo: string, approverId: string, company?: string, plant?: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo, ...this.tenantWhere(company, plant) } });
    if (!tx) throw new NotFoundException('Stock transaction not found.');
    this.assertSameTenant('자재출고요청 거래', tx, company, plant);
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('Transaction is not pending approval.');

    return this.releaseReservationAndSetStatus(tx, 'REJECTED', approverId);
  }

  async cancel(transNo: string, company?: string, plant?: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo, ...this.tenantWhere(company, plant) } });
    if (!tx) throw new NotFoundException('Stock transaction not found.');
    this.assertSameTenant('자재출고요청 거래', tx, company, plant);
    if (tx.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending approval transaction can be canceled.');
    }

    return this.releaseReservationAndSetStatus(tx, 'CANCELED');
  }

  private async releaseReservationAndSetStatus(tx: StockTransaction, status: 'REJECTED' | 'CANCELED', approverId?: string) {
    const absQty = Math.abs(tx.qty);
    return this.tx.run(async (qr) => {
      const claimed = await qr.manager.createQueryBuilder().update(StockTransaction)
        .set({ status, ...(approverId ? { approverId, approvedAt: new Date() } : {}) })
        .where({ transNo: tx.transNo, ...this.tenantWhere(tx.company, tx.plant) })
        .andWhere('"STATUS" = :pendingStatus').setParameters({ pendingStatus: 'PENDING_APPROVAL' }).execute();
      if ((claimed.affected ?? 0) !== 1) throw new BadRequestException('이미 처리되었거나 동시에 처리 중인 출고요청입니다.');

      if (tx.matUid) {
        const released = await qr.manager.createQueryBuilder().update(MatStock)
          .set({ reservedQty: () => '"RESERVED_QTY" - :stockDelta', availableQty: () => '"AVAILABLE_QTY" + :stockDelta' })
          .where({ ...(tx.fromWarehouseId ? { warehouseCode: tx.fromWarehouseId } : {}), matUid: tx.matUid, itemCode: tx.itemCode, ...this.tenantWhere(tx.company, tx.plant) })
          .andWhere('"RESERVED_QTY" >= :stockDelta').setParameters({ stockDelta: absQty }).execute();
        if ((released.affected ?? 0) !== 1) throw new BadRequestException('동시 처리로 예약재고가 변경되었습니다. 다시 조회해 주세요.');
      }
      return { transNo: tx.transNo, status };
    });
  }
}
