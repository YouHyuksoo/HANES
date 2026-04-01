/**
 * @file src/modules/interface/interface.module.ts
 * @description ERP 인터페이스 모듈
 *
 * 주요 기능:
 * - ERP 작업지시 수신 (Inbound)
 * - BOM/품목 마스터 동기화 (Inbound)
 * - 생산실적 ERP 전송 (Outbound)
 * - G12: 자재 ERP 인터페이스 (PO 수신, 입고/반품/출고/보정 전송)
 * - 인터페이스 로그 관리
 * - 오류 재처리
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemModule } from '../system/system.module';
import { InterfaceController } from './controllers/interface.controller';
import { InterfaceService } from './services/interface.service';
import { ErpMaterialController } from './controllers/erp-material.controller';
import { ErpMaterialService } from './services/erp-material.service';
import { InterLog } from '../../entities/inter-log.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { BomMaster } from '../../entities/bom-master.entity';
import { JobOrder } from '../../entities/job-order.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';

@Module({
  imports: [
    SystemModule,
    TypeOrmModule.forFeature([InterLog, PartMaster, BomMaster, JobOrder, PurchaseOrder, PurchaseOrderItem]),
  ],
  controllers: [InterfaceController, ErpMaterialController],
  providers: [InterfaceService, ErpMaterialService],
  exports: [InterfaceService, ErpMaterialService],
})
export class InterfaceModule {}
