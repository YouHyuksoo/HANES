/**
 * @file src/modules/production/production.module.ts
 * @description 생산관리 모듈 - 작업지시, 생산실적, 진행현황, 검사/포장/재고 조회
 *
 * 초보자 가이드:
 * 1. **목적**: 생산 계획, 작업 지시, 실적 관리 기능
 * 2. **주요 기능**:
 *    - 작업지시 CRUD 및 상태 관리 (시작/일시정지/완료/취소)
 *    - 생산실적 등록 및 집계
 *    - ERP 연동 플래그 관리
 *    - 설비별/작업자별/일자별 실적 분석
 *    - 작업진행현황 대시보드
 *    - 샘플검사이력, 포장실적, 반제품/제품재고 조회
 *
 * 컨트롤러/서비스 추가 시:
 * 1. controllers/ 폴더에 컨트롤러 생성
 * 2. services/ 폴더에 서비스 생성
 * 3. 이 모듈에 등록
 *
 * API 엔드포인트:
 * - /api/v1/production/job-orders     : 작업지시 관리
 * - /api/v1/production/prod-results   : 생산실적 관리
 * - /api/v1/production/progress       : 작업진행현황 (조회 전용)
 * - /api/v1/production/sample-inspect : 샘플검사이력 (조회 전용)
 * - /api/v1/production/pack-result    : 포장실적 (조회 전용)
 * - /api/v1/production/wip-stock      : 반제품/제품재고 (조회 전용)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobOrderController } from './controllers/job-order.controller';
import { JobOrderService } from './services/job-order.service';
import { ProdResultController } from './controllers/prod-result.controller';
import { ProdResultService } from './services/prod-result.service';
import { ProductionViewsController } from './controllers/production-views.controller';
import { ProductionViewsService } from './services/production-views.service';
import { SampleInspectController } from './controllers/sample-inspect.controller';
import { SampleInspectService } from './services/sample-inspect.service';
import { ProductLabelController } from './controllers/product-label.controller';
import { ProductLabelService } from './services/product-label.service';
import { ProdPlanController } from './controllers/prod-plan.controller';
import { ProdPlanService } from './services/prod-plan.service';
import { InventoryModule } from '../inventory/inventory.module';

// Entities
import { JobOrder } from '../../entities/job-order.entity';
import { ProdResult } from '../../entities/prod-result.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { EquipMaster } from '../../entities/equip-master.entity';
import { EquipBomRel } from '../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../entities/equip-bom-item.entity';
import { MatIssue } from '../../entities/mat-issue.entity';
import { ConsumableMaster } from '../../entities/consumable-master.entity';
import { User } from '../../entities/user.entity';
import { InspectResult } from '../../entities/inspect-result.entity';
import { BoxMaster } from '../../entities/box-master.entity';
import { MatStock } from '../../entities/mat-stock.entity';
import { BomMaster } from '../../entities/bom-master.entity';
import { SampleInspectResult } from '../../entities/sample-inspect-result.entity';
import { LabelPrintLog } from '../../entities/label-print-log.entity';
import { ProdPlan } from '../../entities/prod-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobOrder, ProdResult, PartMaster, EquipMaster, EquipBomRel, EquipBomItem, MatIssue, ConsumableMaster, User, InspectResult, BoxMaster, MatStock, BomMaster, SampleInspectResult, LabelPrintLog, ProdPlan]),
    InventoryModule,
  ],
  controllers: [
    JobOrderController,
    ProdResultController,
    ProductionViewsController,
    SampleInspectController,
    ProductLabelController,
    ProdPlanController,
  ],
  providers: [
    JobOrderService,
    ProdResultService,
    ProductionViewsService,
    SampleInspectService,
    ProductLabelService,
    ProdPlanService,
  ],
  exports: [
    JobOrderService,
    ProdResultService,
    ProductionViewsService,
    SampleInspectService,
    ProdPlanService,
  ],
})
export class ProductionModule {}
