/**
 * @file src/modules/inventory/inventory.module.ts
 * @description 재고관리 모듈 - 창고, 재고, 수불 통합 관리
 *
 * 이 모듈은 ERP/MES 표준에 맞는 재고 관리 기능을 제공합니다:
 * - 창고 마스터 관리 (원자재, 반제품, 완제품, 공정재공, 불량, 폐기, 외주)
 * - LOT 추적 관리
 * - 현재고 관리
 * - 수불 트랜잭션 이력 (입고, 입고취소, 출고, 출고취소)
 *
 * 사용법:
 * 1. 다른 모듈에서 InventoryService를 import하여 재고 처리
 * 2. WarehouseService로 창고 마스터 관리
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatStock } from '../../entities/mat-stock.entity';
import { StockTransaction } from '../../entities/stock-transaction.entity';
import { MatLot } from '../../entities/mat-lot.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { InvAdjLog } from '../../entities/inv-adj-log.entity';
import { WarehouseLocation } from '../../entities/warehouse-location.entity';
import { InventoryController } from './inventory.controller';
import { ProductPhysicalInvController } from './controllers/product-physical-inv.controller';
import { WarehouseLocationController } from './controllers/warehouse-location.controller';
import { InventoryService } from './services/inventory.service';
import { WarehouseService } from './services/warehouse.service';
import { ProductPhysicalInvService } from './services/product-physical-inv.service';
import { WarehouseLocationService } from './services/warehouse-location.service';

@Module({
  imports: [TypeOrmModule.forFeature([MatStock, StockTransaction, MatLot, Warehouse, PartMaster, InvAdjLog, WarehouseLocation])],
  controllers: [InventoryController, ProductPhysicalInvController, WarehouseLocationController],
  providers: [InventoryService, WarehouseService, ProductPhysicalInvService, WarehouseLocationService],
  exports: [InventoryService, WarehouseService, ProductPhysicalInvService, WarehouseLocationService],
})
export class InventoryModule {}
