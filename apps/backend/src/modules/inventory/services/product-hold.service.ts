import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, FindOptionsWhere } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProductHoldActionDto, ProductReleaseHoldDto, ProductHoldQueryDto } from '../dto/product-hold.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { PRODUCT_STOCK_HOLD_STATUS, isProductStockOnHold } from '@harness/shared';

@Injectable()
export class ProductHoldService {
  constructor(
    @InjectRepository(ProductStock)
    private readonly productStockRepository: Repository<ProductStock>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    private readonly tx: TransactionService,
  ) {}

  async findAll(query: ProductHoldQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, status, itemType } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ProductStock> = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (status) where.status = status;
    if (itemType) where.itemType = itemType;
    if (search) where.itemCode = Like(`%${search}%`);

    const [data, total] = await Promise.all([
      this.productStockRepository.find({
        where,
        skip,
        take: limit,
        order: { updatedAt: 'DESC' },
      }),
      this.productStockRepository.count({ where }),
    ]);

    const itemCodes = [...new Set(data.map((s) => s.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...(company && { company }), ...(plant && { plant }) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const flatData = data.map((stock) => {
      const part = partMap.get(stock.itemCode);
      const stockId = `${stock.warehouseCode}::${stock.itemCode}`;
      return {
        ...stock,
        id: stockId,
        itemCode: stock.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
      };
    });

    return { data: flatData, total, page, limit };
  }

  private parseStockId(stockId: string): { warehouseCode: string; itemCode: string } {
    const [warehouseCode, itemCode] = stockId.split('::');
    if (!warehouseCode || !itemCode) {
      throw new NotFoundException(`�߸��� ��� ID �����Դϴ�: ${stockId} (��: WH001::ITEM001)`);
    }
    return { warehouseCode, itemCode };
  }

  async hold(dto: ProductHoldActionDto, company?: string, plant?: string, userId?: string) {
    const { stockId, reason } = dto;
    const compositeKey = this.parseStockId(stockId);
    const scopedKey = {
      ...compositeKey,
      ...(company && { company }),
      ...(plant && { plant }),
    };

    await this.tx.run(async (queryRunner) => {
      const stock = await queryRunner.manager.findOne(ProductStock, {
        where: scopedKey,
      });
      if (!stock) throw new NotFoundException(`��ǰ ���� ã�� �� �����ϴ�: ${stockId}`);
      if (isProductStockOnHold(stock.status)) throw new BadRequestException('�̹� HOLD �����Դϴ�.');
      if (stock.qty <= 0) throw new BadRequestException('������ 0�� ���� HOLD�� �� �����ϴ�.');

      await queryRunner.manager.update(ProductStock, scopedKey, {
        status: PRODUCT_STOCK_HOLD_STATUS.HOLD,
        holdReason: reason,
        holdAt: new Date(),
        holdBy: userId || null,
        updatedBy: userId || null,
      });
    });

    const updated = await this.productStockRepository.findOne({ where: scopedKey });
    if (!updated) throw new NotFoundException(`��ǰ ���� ã�� �� �����ϴ�: ${stockId}`);
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: updated.itemCode, ...(company && { company }), ...(plant && { plant }) },
    });

    return {
      id: stockId,
      status: PRODUCT_STOCK_HOLD_STATUS.HOLD,
      itemCode: updated.itemCode,
      itemName: part?.itemName ?? null,
      qty: updated.qty,
      reason,
    };
  }

  async release(dto: ProductReleaseHoldDto, company?: string, plant?: string, userId?: string) {
    const { stockId, reason } = dto;
    const compositeKey = this.parseStockId(stockId);
    const scopedKey = {
      ...compositeKey,
      ...(company && { company }),
      ...(plant && { plant }),
    };

    await this.tx.run(async (queryRunner) => {
      const stock = await queryRunner.manager.findOne(ProductStock, {
        where: scopedKey,
      });
      if (!stock) throw new NotFoundException(`��ǰ ���� ã�� �� �����ϴ�: ${stockId}`);
      if (!isProductStockOnHold(stock.status)) throw new BadRequestException('HOLD ���°� �ƴմϴ�.');

      await queryRunner.manager.update(ProductStock, scopedKey, {
        status: PRODUCT_STOCK_HOLD_STATUS.NORMAL,
        holdReason: null,
        holdAt: null,
        holdBy: null,
        updatedBy: userId || null,
      });
    });

    const updated = await this.productStockRepository.findOne({ where: scopedKey });
    if (!updated) throw new NotFoundException(`��ǰ ���� ã�� �� �����ϴ�: ${stockId}`);
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: updated.itemCode, ...(company && { company }), ...(plant && { plant }) },
    });

    return {
      id: stockId,
      status: PRODUCT_STOCK_HOLD_STATUS.NORMAL,
      itemCode: updated.itemCode,
      itemName: part?.itemName ?? null,
      qty: updated.qty,
      reason,
    };
  }
}
