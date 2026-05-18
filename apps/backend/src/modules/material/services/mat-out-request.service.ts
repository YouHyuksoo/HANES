import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { NumberingService } from '../../../shared/numbering.service';

@Injectable()
export class MatOutRequestService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
  ) {}

  async findPending(query: { page?: number; limit?: number }, company?: string, plant?: string) {
    const { page = 1, limit = 20 } = query;
    const where: any = {
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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

      await queryRunner.manager.update(
        MatStock,
        {
          warehouseCode: stock.warehouseCode,
          itemCode: dto.itemCode,
          matUid: dto.matUid,
          ...(dto.company ? { company: dto.company } : {}),
          ...(dto.plant ? { plant: dto.plant } : {}),
        },
        {
          reservedQty: (stock.reservedQty ?? 0) + dto.qty,
          availableQty: Math.max(0, (stock.availableQty ?? stock.qty - (stock.reservedQty ?? 0)) - dto.qty),
        },
      );

      await queryRunner.commitTransaction();
      return tx;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async approve(transNo: string, approverId: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo } });
    if (!tx) throw new NotFoundException('Stock transaction not found.');
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('Transaction is not pending approval.');

    if (tx.matUid) {
      const lot = await this.matLotRepo.findOne({ where: { matUid: tx.matUid } });
      if (lot?.status === 'HOLD') {
        throw new BadRequestException(`Cannot approve material-out for HOLD lot: ${tx.matUid}`);
      }
    }

    const stock = await this.matStockRepo.findOne({
      where: { matUid: tx.matUid ?? undefined, itemCode: tx.itemCode },
    });
    if (!stock) throw new NotFoundException('Material stock not found.');

    const absQty = Math.abs(tx.qty);
    if (stock.qty < absQty) {
      throw new BadRequestException(`Insufficient physical stock. Current qty: ${stock.qty}`);
    }

    await this.matStockRepo.update(
      { warehouseCode: stock.warehouseCode, itemCode: tx.itemCode, matUid: tx.matUid ?? '' },
      {
        qty: stock.qty - absQty,
        reservedQty: Math.max(0, (stock.reservedQty ?? 0) - absQty),
        availableQty: Math.max(0, stock.qty - absQty - Math.max(0, (stock.reservedQty ?? 0) - absQty)),
      },
    );

    await this.stockTxRepo.update(
      { transNo },
      {
        status: 'DONE',
        approverId,
        approvedAt: new Date(),
      },
    );

    return { transNo, status: 'DONE' };
  }

  async reject(transNo: string, approverId: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo } });
    if (!tx) throw new NotFoundException('Stock transaction not found.');
    if (tx.status !== 'PENDING_APPROVAL') throw new BadRequestException('Transaction is not pending approval.');

    await this.unlockStock(tx);
    await this.stockTxRepo.update(
      { transNo },
      {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
      },
    );

    return { transNo, status: 'REJECTED' };
  }

  async cancel(transNo: string) {
    const tx = await this.stockTxRepo.findOne({ where: { transNo } });
    if (!tx) throw new NotFoundException('Stock transaction not found.');
    if (tx.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending approval transaction can be canceled.');
    }

    await this.unlockStock(tx);
    await this.stockTxRepo.update({ transNo }, { status: 'CANCELED' });
    return { transNo, status: 'CANCELED' };
  }

  private async unlockStock(tx: StockTransaction) {
    if (!tx.matUid) return;

    const stock = await this.matStockRepo.findOne({
      where: { matUid: tx.matUid, itemCode: tx.itemCode },
    });

    if (!stock) return;

    const absQty = Math.abs(tx.qty);
    await this.matStockRepo.update(
      { warehouseCode: stock.warehouseCode, itemCode: tx.itemCode, matUid: tx.matUid },
      {
        reservedQty: Math.max(0, (stock.reservedQty ?? 0) - absQty),
        availableQty: stock.qty - Math.max(0, (stock.reservedQty ?? 0) - absQty),
      },
    );
  }
}
