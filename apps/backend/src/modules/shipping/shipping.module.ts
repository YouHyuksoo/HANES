/**
 * @file src/modules/shipping/shipping.module.ts
 * @description 출하관리 모듈 - 박스, 팔레트, 출하, 출하지시, 출하이력, 출하반품 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 완제품 출하 및 배송 관리 기능
 * 2. **주요 기능**:
 *    - 박스 관리 (생성, 시리얼 추가, 닫기, 팔레트 할당)
 *    - 팔레트 관리 (생성, 박스 추가, 닫기, 출하 할당)
 *    - 출하 관리 (생성, 팔레트 적재, 상태 변경, ERP 연동)
 *    - 출하지시 관리 (CRUD + 품목 관리)
 *    - 출하이력 조회 (필터링 조회 전용)
 *    - 출하반품 관리 (CRUD + 품목 관리)
 *    - 출하 통계 (일자별, 고객사별)
 *
 * API 엔드포인트:
 * - /api/v1/shipping/boxes : 박스 관리
 * - /api/v1/shipping/pallets : 팔레트 관리
 * - /api/v1/shipping/shipments : 출하 관리
 * - /api/v1/shipping/orders : 출하지시 관리
 * - /api/v1/shipping/history : 출하이력 조회
 * - /api/v1/shipping/returns : 출하반품 관리
 */

import { Module } from '@nestjs/common';
import { BoxController } from './controllers/box.controller';
import { BoxService } from './services/box.service';
import { PalletController } from './controllers/pallet.controller';
import { PalletService } from './services/pallet.service';
import { ShipmentController } from './controllers/shipment.controller';
import { ShipmentService } from './services/shipment.service';
import { ShipOrderController } from './controllers/ship-order.controller';
import { ShipOrderService } from './services/ship-order.service';
import { ShipHistoryController } from './controllers/ship-history.controller';
import { ShipHistoryService } from './services/ship-history.service';
import { ShipReturnController } from './controllers/ship-return.controller';
import { ShipReturnService } from './services/ship-return.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [
    BoxController,
    PalletController,
    ShipmentController,
    ShipOrderController,
    ShipHistoryController,
    ShipReturnController,
  ],
  providers: [
    BoxService,
    PalletService,
    ShipmentService,
    ShipOrderService,
    ShipHistoryService,
    ShipReturnService,
  ],
  exports: [
    BoxService,
    PalletService,
    ShipmentService,
    ShipOrderService,
    ShipHistoryService,
    ShipReturnService,
  ],
})
export class ShippingModule {}
