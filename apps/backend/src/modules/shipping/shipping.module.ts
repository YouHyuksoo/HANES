/**
 * @file src/modules/shipping/shipping.module.ts
 * @description 출하관리 모듈 - 박스, 팔레트, 출하 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 완제품 출하 및 배송 관리 기능
 * 2. **주요 기능**:
 *    - 박스 관리 (생성, 시리얼 추가, 닫기, 팔레트 할당)
 *    - 팔레트 관리 (생성, 박스 추가, 닫기, 출하 할당)
 *    - 출하 관리 (생성, 팔레트 적재, 상태 변경, ERP 연동)
 *    - 출하 통계 (일자별, 고객사별)
 *
 * 상태 플로우:
 * - 박스: OPEN -> CLOSED -> SHIPPED
 * - 팔레트: OPEN -> CLOSED -> LOADED -> SHIPPED
 * - 출하: PREPARING -> LOADED -> SHIPPED -> DELIVERED (또는 CANCELED)
 *
 * API 엔드포인트:
 * - /api/v1/shipping/boxes : 박스 관리
 * - /api/v1/shipping/pallets : 팔레트 관리
 * - /api/v1/shipping/shipments : 출하 관리
 *
 * 컨트롤러/서비스 추가 시:
 * 1. controllers/ 폴더에 컨트롤러 생성
 * 2. services/ 폴더에 서비스 생성
 * 3. 이 모듈에 등록
 */

import { Module } from '@nestjs/common';
import { BoxController } from './controllers/box.controller';
import { BoxService } from './services/box.service';
import { PalletController } from './controllers/pallet.controller';
import { PalletService } from './services/pallet.service';
import { ShipmentController } from './controllers/shipment.controller';
import { ShipmentService } from './services/shipment.service';

@Module({
  imports: [],
  controllers: [
    BoxController,
    PalletController,
    ShipmentController,
  ],
  providers: [
    BoxService,
    PalletService,
    ShipmentService,
  ],
  exports: [
    BoxService,
    PalletService,
    ShipmentService,
  ],
})
export class ShippingModule {}
