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
import { PrismaModule } from '@/prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './services/inventory.service';
import { WarehouseService } from './services/warehouse.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, WarehouseService],
  exports: [InventoryService, WarehouseService],
})
export class InventoryModule {}
