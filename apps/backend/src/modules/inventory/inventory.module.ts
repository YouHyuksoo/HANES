/**
 * @file src/modules/inventory/inventory.module.ts
 * @description 재고관리 모듈 - 창고, 재고, 수불 통합 관리
 *
 * 초보자 가이드:
 * 1. 서버 시작 시 OnModuleInit으로 기본 창고 8개 자동 초기화
 * 2. 다른 모듈에서 InventoryService를 import하여 재고 처리
 * 3. WarehouseService로 창고 마스터 관리
 */
import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatStock } from '../../entities/mat-stock.entity';
import { StockTransaction } from '../../entities/stock-transaction.entity';
import { ProductStock } from '../../entities/product-stock.entity';
import { ProductTransaction } from '../../entities/product-transaction.entity';
import { MatLot } from '../../entities/mat-lot.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { InvAdjLog } from '../../entities/inv-adj-log.entity';
import { WarehouseLocation } from '../../entities/warehouse-location.entity';
import { InventoryController } from './inventory.controller';
import { ProductPhysicalInvController } from './controllers/product-physical-inv.controller';
import { WarehouseLocationController } from './controllers/warehouse-location.controller';
import { ProductHoldController } from './controllers/product-hold.controller';
import { InventoryService } from './services/inventory.service';
import { WarehouseService } from './services/warehouse.service';
import { ProductInventoryService } from './services/product-inventory.service';
import { ProductPhysicalInvService } from './services/product-physical-inv.service';
import { WarehouseLocationService } from './services/warehouse-location.service';
import { ProductHoldService } from './services/product-hold.service';

@Module({
  imports: [TypeOrmModule.forFeature([MatStock, StockTransaction, ProductStock, ProductTransaction, MatLot, Warehouse, PartMaster, InvAdjLog, WarehouseLocation])],
  controllers: [InventoryController, ProductPhysicalInvController, WarehouseLocationController, ProductHoldController],
  providers: [InventoryService, WarehouseService, ProductInventoryService, ProductPhysicalInvService, WarehouseLocationService, ProductHoldService],
  exports: [InventoryService, WarehouseService, ProductInventoryService, ProductPhysicalInvService, WarehouseLocationService, ProductHoldService],
})
export class InventoryModule implements OnModuleInit {
  private readonly logger = new Logger(InventoryModule.name);

  constructor(private readonly warehouseService: WarehouseService) {}

  /** 서버 시작 시 기본 창고 자동 초기화 (이미 존재하면 스킵) */
  async onModuleInit() {
    try {
      const result = await this.warehouseService.initDefaultWarehouses();
      const created = result.results.filter((r) => r.status === 'created');
      if (created.length > 0) {
        this.logger.log(`기본 창고 ${created.length}개 생성됨: ${created.map((r) => r.code).join(', ')}`);
      }
    } catch (err) {
      this.logger.warn(`기본 창고 초기화 실패 (무시): ${(err as Error).message}`);
    }
  }
}
