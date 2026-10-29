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
      throw new NotFoundException(`잘못된 재고 ID 형식입니다: ${stockId} (예: WH001::ITEM001)`);
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
      if (!stock) throw new NotFoundException(`제품 재고를 찾을 수 없습니다: ${stockId}`);
      if (isProductStockOnHold(stock.status)) throw new BadRequestException('이미 HOLD 상태입니다.');
      if (stock.qty <= 0) throw new BadRequestException('수량이 0인 재고는 HOLD할 수 없습니다.');

      await queryRunner.manager.update(ProductStock, scopedKey, {
        status: PRODUCT_STOCK_HOLD_STATUS.HOLD,
        holdReason: reason,
        holdAt: new Date(),
        holdBy: userId || null,
        updatedBy: userId || null,
      });
    });

    // 같은 창고·품목에 품질상태(GOOD/DEFECT)별 행이 여럿일 수 있다 — 응답 수량은 임의의 한 행이 아니라 합계다
    const rows = await this.productStockRepository.find({ where: scopedKey });
    const updated = rows[0];
    if (!updated) throw new NotFoundException(`제품 재고를 찾을 수 없습니다: ${stockId}`);
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: updated.itemCode, ...(company && { company }), ...(plant && { plant }) },
    });

    return {
      id: stockId,
      status: PRODUCT_STOCK_HOLD_STATUS.HOLD,
      itemCode: updated.itemCode,
      itemName: part?.itemName ?? null,
      qty: rows.reduce((sum, r) => sum + Number(r.qty ?? 0), 0),
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
      if (!stock) throw new NotFoundException(`제품 재고를 찾을 수 없습니다: ${stockId}`);
      if (!isProductStockOnHold(stock.status)) throw new BadRequestException('HOLD 상태가 아닙니다.');

      await queryRunner.manager.update(ProductStock, scopedKey, {
        status: PRODUCT_STOCK_HOLD_STATUS.NORMAL,
        holdReason: null,
        holdAt: null,
        holdBy: null,
        updatedBy: userId || null,
      });
    });

    // 같은 창고·품목에 품질상태(GOOD/DEFECT)별 행이 여럿일 수 있다 — 응답 수량은 임의의 한 행이 아니라 합계다
    const rows = await this.productStockRepository.find({ where: scopedKey });
    const updated = rows[0];
    if (!updated) throw new NotFoundException(`제품 재고를 찾을 수 없습니다: ${stockId}`);
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: updated.itemCode, ...(company && { company }), ...(plant && { plant }) },
    });

    return {
      id: stockId,
      status: PRODUCT_STOCK_HOLD_STATUS.NORMAL,
      itemCode: updated.itemCode,
      itemName: part?.itemName ?? null,
      qty: rows.reduce((sum, r) => sum + Number(r.qty ?? 0), 0),
      reason,
    };
  }
}
