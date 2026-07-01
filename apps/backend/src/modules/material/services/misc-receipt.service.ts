import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, FindOptionsWhere } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { CreateMiscReceiptDto, MiscReceiptQueryDto } from '../dto/misc-receipt.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class MiscReceiptService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private assertSameTenant(
    row: { company?: string | null; plant?: string | null } | null | undefined,
    company?: string | null,
    plant?: string | null,
    context = '데이터',
  ) {
    if (company && row?.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row?.company ?? 'NULL'}`);
    }
    if (plant && row?.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row?.plant ?? 'NULL'}`);
    }
  }

  async findAll(query: MiscReceiptQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<StockTransaction> = {
      transType: 'MISC_IN',
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (fromDate && toDate) {
      where.transDate = Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!);
    }

    let data: StockTransaction[];
    let total: number;

    if (search) {
      const parts = await this.itemMasterRepository.find({
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
        queryBuilder.andWhere(
          "trans.transDate >= TO_DATE(:fromDate, 'YYYY-MM-DD') AND trans.transDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1",
          { fromDate, toDate },
        );
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
        ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) } })
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
        itemCode: trans.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        matUid: trans.matUid ?? null,
        warehouseCode: trans.toWarehouseId ?? null,
        warehouseName: warehouse?.warehouseName ?? null,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  async create(dto: CreateMiscReceiptDto, company?: string, plant?: string) {
    const { warehouseId, itemCode, matUid, qty, remark, workerId } = dto;
    // 입고계정: 미지정 시 기본 양산(PROD)
    const account = dto.account || 'PROD';

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

      const part = await queryRunner.manager.findOne(ItemMaster, {
        where: { itemCode, ...this.tenantWhere(company, plant) },
      });
      if (!part) {
        throw new NotFoundException(`Part not found: ${itemCode}`);
      }

      const txDate = new Date();
      const requestedMatUid = matUid?.trim() || null;
      const effectiveMatUid = requestedMatUid ?? await this.numbering.nextMatSerial(queryRunner, txDate);
      const resolvedCompany = company ?? warehouse.company ?? part.company;
      const resolvedPlant = plant ?? warehouse.plant ?? part.plant;

      if (requestedMatUid) {
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid: requestedMatUid, ...this.tenantWhere(company, plant) },
        });
        if (!lot) {
          throw new NotFoundException(`Lot not found: ${requestedMatUid}`);
        }
        if (lot.itemCode !== itemCode) {
          throw new BadRequestException(
            `Lot ${requestedMatUid} item (${lot.itemCode}) does not match receipt item (${itemCode}).`,
          );
        }
      } else {
        if (!resolvedCompany || !resolvedPlant) {
          throw new BadRequestException('회사/사업장 정보가 없어 기타입고 LOT을 생성할 수 없습니다.');
        }
        const lot = queryRunner.manager.create(MatLot, {
          matUid: effectiveMatUid,
          itemCode,
          initQty: qty,
          currentQty: qty,
          recvDate: txDate,
          origin: effectiveMatUid,
          vendor: 'MISC',
          poNo: null,
          arrivalNo: null,
          arrivalSeq: null,
          iqcStatus: 'PASS',
          specialAcceptYn: 'N',
          status: 'NORMAL',
          company: resolvedCompany,
          plant: resolvedPlant,
        });
        await queryRunner.manager.save(lot);
      }

      const transNo = await this.generateTransNo();

      const existingStock = await queryRunner.manager.findOne(MatStock, {
        where: {
          warehouseCode: warehouse.warehouseCode,
          itemCode,
          matUid: effectiveMatUid,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });

      if (existingStock) {
        this.assertSameTenant(existingStock, company, plant, '기존 재고');
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
          matUid: effectiveMatUid,
          qty,
          availableQty: qty,
          reservedQty: 0,
          company: resolvedCompany,
          plant: resolvedPlant,
        });
        await queryRunner.manager.save(newStock);
      }

      const transaction = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MISC_IN',
        transDate: new Date(),
        toWarehouseId: warehouse.warehouseCode,
        itemCode,
        matUid: effectiveMatUid,
        qty,
        refType: 'MISC_RECEIPT',
        workerId,
        remark,
        account,
        status: 'DONE',
        company: existingStock?.company ?? resolvedCompany,
        plant: existingStock?.plant ?? resolvedPlant,
      });
      await queryRunner.manager.save(transaction);

      return {
        transNo,
        warehouseId,
        warehouseCode: warehouse.warehouseCode,
        warehouseName: warehouse.warehouseName,
        itemCode: part.itemCode,
        itemName: part.itemName,
        matUid: effectiveMatUid,
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
