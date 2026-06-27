/**
 * @file src/modules/quality/inspection/inspection.module.ts
 * @description 검사 관리 서브모듈
 *
 * @module InspectionModule
 * @description
 * 검사실적 및 검사 관련 기능을 위한 서브모듈입니다.
 * - InspectResult: 일반 검사실적 관리
 * - Trace: 추적성 조회 (4M 이력)
 *
 * @dependencies
 * - TypeOrmModule: InspectResult, ProdResult, TraceLog, FgLabel 등 엔티티
 * - SharedModule: SeqGeneratorService (채번)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectResultController } from './controllers/inspect-result.controller';
import { TraceController } from './controllers/trace.controller';
import { InspectResultService } from './services/inspect-result.service';
import { ProductTraceabilityService } from './services/product-traceability.service';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { TraceLog } from '../../../entities/trace-log.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ControlPlanItem } from '../../../entities/control-plan-item.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { ProductGenealogy } from '../../../entities/product-genealogy.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { EquipInspectLog } from '../../../entities/equip-inspect-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { DefectLog } from '../../../entities/defect-log.entity';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { ReworkOrder } from '../../../entities/rework-order.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { SharedModule } from '../../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectResult,
      ProdResult,
      TraceLog,
      FgLabel,
      JobOrder,
      MatIssue,
      ItemMaster,
      EquipMaster,
      WorkerMaster,
      ProcessMaster,
      MatLot,
      ControlPlanItem,
      PartnerMaster,
      BoxMaster,
      PalletMaster,
      ProductGenealogy,
      SgLabel,
      PurchaseOrder,
      MatArrival,
      IqcLog,
      MatReceiving,
      ShipmentOrder,
      StockTransaction,
      EquipInspectLog,
      ConsumableMountLog,
      ConsumableMaster,
      DefectLog,
      RepairOrder,
      ReworkOrder,
      Warehouse,
    ]),
    SharedModule, // SeqGeneratorService 제공
  ],
  controllers: [InspectResultController, TraceController],
  providers: [InspectResultService, ProductTraceabilityService],
  exports: [InspectResultService, ProductTraceabilityService],
})
export class InspectionModule {}
