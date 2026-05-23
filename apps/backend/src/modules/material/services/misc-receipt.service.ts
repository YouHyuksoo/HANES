import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { CreateMiscReceiptDto, MiscReceiptQueryDto } from '../dto/misc-receipt.dto';
import { TransactionService } from '../../../shared/transaction.service';

@Injectable()
export class MiscReceiptService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  async findAll(query: MiscReceiptQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      transType: 'MISC_IN',
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (fromDate && toDate) {
      where.transDate = Between(new Date(fromDate), new Date(toDate));
    }

    let data: StockTransaction[];
    let total: number;

    if (search) {
      const parts = await this.partMasterRepository.find({
        where: [
          { itemCode: Like(`%${search}%`), ...this.tenantWhere(company, plant) },
          { itemName: Like(`%${search}%`), ...this.tenantWhere(company, plant) },
        ],
      });
      const itemCodes = parts.map((p) => p.itemCode);

      const queryBuilder = this.stockTransactionRepository
        .createQueryBuilder('trans')
        .where('trans.transType = :transType', { transType: 'MISC_IN' });

      if (company) queryBuilder.andWhere('trans.company = :company', { company });
      if (plant) queryBuilder.andWhere('trans.plant = :plant', { plant });

      if (fromDate && toDate) {
        queryBuilder.andWhere('trans.transDate BETWEEN :fromDate AND :toDate', {
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
        });
      }

      if (itemCodes.length > 0) {
        queryBuilder.andWhere('trans.itemCode IN (:...itemCodes)', { itemCodes });
      } else {
        return { data: [], total: 0, page, limit };
      }

      [data, total] = await Promise.all([
        queryBuilder.orderBy('trans.transDate', 'DESC').skip(skip).take(limit).getMany(),
        queryBuilder.getCount(),
      ]);
    } else {
      [data, total] = await Promise.all([
        this.stockTransactionRepository.find({
          where,
          skip,
          take: limit,
          order: { transDate: 'DESC' },
        }),
        this.stockTransactionRepository.count({ where }),
      ]);
    }

    const itemCodes = data.map((trans) => trans.itemCode).filter(Boolean);
    const matUids = data.map((trans) => trans.matUid).filter(Boolean) as string[];
    const warehouseIds = data.map((trans) => trans.toWarehouseId).filter(Boolean) as string[];

    const [parts, lots, warehouses] = await Promise.all([
      itemCodes.length > 0
        ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
        : Promise.resolve([]),
      matUids.length > 0
        ? this.matLotRepository.find({ where: { matUid: In(matUids), ...this.tenantWhere(company, plant) } })
        : Promise.resolve([]),
      warehouseIds.length > 0
        ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseIds), ...this.tenantWhere(company, plant) } })
        : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    const flattenedData = data.map((trans) => {
      const part = partMap.get(trans.itemCode);
      const lot = trans.matUid ? lotMap.get(trans.matUid) : null;
      const warehouse = trans.toWarehouseId ? warehouseMap.get(trans.toWarehouseId) : null;
      return {
        ...trans,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
        matUid: lot?.matUid,
        warehouseCode: warehouse?.warehouseCode,
        warehouseName: warehouse?.warehouseName,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async create(dto: CreateMiscReceiptDto, company?: string, plant?: string) {
    const { warehouseId, itemCode, matUid, qty, remark, workerId } = dto;

    return this.tx.run(async (queryRunner) => {
      const warehouse = await queryRunner.manager.findOne(Warehouse, {
        where: {
          warehouseCode: warehouseId,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse not found: ${warehouseId}`);
      }

      const part = await queryRunner.manager.findOne(PartMaster, {
        where: { itemCode, ...this.tenantWhere(company, plant) },
      });
      if (!part) {
        throw new NotFoundException(`Part not found: ${itemCode}`);
      }

      if (matUid) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid, ...this.tenantWhere(company, plant) },
        });
        if (!lot) {
          throw new NotFoundException(`Lot not found: ${matUid}`);
        }
        if (lot.itemCode !== itemCode) {
          throw new BadRequestException(
            `Lot ${matUid} item (${lot.itemCode}) does not match receipt item (${itemCode}).`,
          );
        }
      }

      const transNo = await this.generateTransNo();

      const existingStock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode: warehouse.warehouseCode,
          itemCode,
          ...(matUid && { matUid }),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (existingStock) {
        const nextQty = existingStock.qty + qty;
        await queryRunner.manager.update(
          MatStock,
          {
            warehouseCode: existingStock.warehouseCode,
            itemCode: existingStock.itemCode,
            matUid: existingStock.matUid,
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          {
            qty: nextQty,
            availableQty: Math.max(0, nextQty - (existingStock.reservedQty ?? 0)),
          },
        );
      } else {
        const newStock = queryRunner.manager.create(MatStock, {
          warehouseCode: warehouse.warehouseCode,
          itemCode,
          matUid: matUid || null,
          qty,
          availableQty: qty,
          reservedQty: 0,
          company,
          plant,
        });
        await queryRunner.manager.save(newStock);
      }

      const transaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MISC_IN',
        transDate: new Date(),
        toWarehouseId: warehouse.warehouseCode,
        itemCode,
        matUid: matUid || null,
        qty,
        refType: 'MISC_RECEIPT',
        workerId,
        remark,
        status: 'DONE',
        company: existingStock?.company ?? company,
        plant: existingStock?.plant ?? plant,
      });
      await queryRunner.manager.save(transaction);

      return {
        transNo,
        warehouseId,
        warehouseCode: warehouse.warehouseCode,
        warehouseName: warehouse.warehouseName,
        itemCode: part.itemCode,
        itemName: part.itemName,
        matUid,
        qty,
        remark,
        workerId,
      };
    });
  }

  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `MISC${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

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
