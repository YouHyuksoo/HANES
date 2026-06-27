/**
 * @file src/modules/inventory/inventory.module.ts
 * @description 재고관리 모듈 - 창고, 재고, 수불 통합 관리
 *
 * 초보자 가이드:
 * 1. 다른 모듈에서 InventoryService를 import하여 재고 처리
 * 2. WarehouseService로 창고 마스터 관리
 * 3. 기본 창고 초기화는 API(POST /inventory/warehouses/init)로 수동 실행
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatStock } from '../../entities/mat-stock.entity';
import { MatArrivalTransaction } from '../../entities/mat-arrival-transaction.entity';
import { StockTransaction } from '../../entities/stock-transaction.entity';
import { ProductStock } from '../../entities/product-stock.entity';
import { ProductTransaction } from '../../entities/product-transaction.entity';
import { MatLot } from '../../entities/mat-lot.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { ItemMaster } from '../../entities/item-master.entity';
import { InvAdjLog } from '../../entities/inv-adj-log.entity';
import { WarehouseLocation } from '../../entities/warehouse-location.entity';
import { FgLabel } from '../../entities/fg-label.entity';
import { PhysicalInvSession } from '../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../entities/physical-inv-count-detail.entity';
import { BoxMaster } from '../../entities/box-master.entity';
import { WipMatStock } from '../../entities/wip-mat-stock.entity';
import { WipMatTransaction } from '../../entities/wip-mat-transaction.entity';
import { ProcMatStock } from '../../entities/proc-mat-stock.entity';
import { ProcMatTransaction } from '../../entities/proc-mat-transaction.entity';
import { InventoryController } from './inventory.controller';
import { ProductPhysicalInvController } from './controllers/product-physical-inv.controller';
import { WarehouseLocationController } from './controllers/warehouse-location.controller';
import { ProductHoldController } from './controllers/product-hold.controller';
import { InventoryService } from './services/inventory.service';
import { InventoryQueryService } from './services/inventory-query.service';
import { WarehouseService } from './services/warehouse.service';
import { ProductInventoryService } from './services/product-inventory.service';
import { ProductPhysicalInvService } from './services/product-physical-inv.service';
import { WarehouseLocationService } from './services/warehouse-location.service';
import { ProductHoldService } from './services/product-hold.service';
import { WipMatStockService } from './services/wip-mat-stock.service';
import { ProcMatStockService } from './services/proc-mat-stock.service';
import { STOCK_MANAGER } from '../../common/interfaces/stock-manager.interface';

@Module({
  imports: [TypeOrmModule.forFeature([MatStock, MatArrivalTransaction, StockTransaction, ProductStock, ProductTransaction, MatLot, Warehouse, ItemMaster, InvAdjLog, WarehouseLocation, FgLabel, PhysicalInvSession, PhysicalInvCountDetail, BoxMaster, WipMatStock, WipMatTransaction, ProcMatStock, ProcMatTransaction])],
  controllers: [InventoryController, ProductPhysicalInvController, WarehouseLocationController, ProductHoldController],
  providers: [
    InventoryService,
    InventoryQueryService,
    WarehouseService,
    ProductInventoryService,
    ProductPhysicalInvService,
    WarehouseLocationService,
    ProductHoldService,
    WipMatStockService,
    ProcMatStockService,
    { provide: STOCK_MANAGER, useExisting: ProductInventoryService },
  ],
  exports: [TypeOrmModule, InventoryService, InventoryQueryService, WarehouseService, ProductInventoryService, ProductPhysicalInvService, WarehouseLocationService, ProductHoldService, WipMatStockService, ProcMatStockService, STOCK_MANAGER],
})
export class InventoryModule {}
