/**
 * @file src/modules/quality/quality.module.ts
 * @description 품질관리 모듈 - 검사실적, 불량로그, 수리이력, OQC(출하검사), 재작업 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 품질 검사 및 불량 관리 기능
 * 2. **주요 기능**:
 *    - 검사실적 관리 (통전검사, 외관검사, 치수검사 등)
 *    - 불량 등록/추적/처리
 *    - 수리 이력 관리
 *    - OQC(출하검사) 의뢰/검사/판정
 *    - 재작업 지시/2단계 승인/재검사 (IATF 16949 8.7.1)
 *    - 4M 변경점관리 (IATF 16949 8.5.6)
 *    - 고객클레임 관리 (IATF 16949 10.2.6)
 *    - 합격률/불량률 통계
 *
 * 컨트롤러:
 * - InspectResultController: 검사실적 API (/quality/inspect-results)
 * - DefectLogController: 불량로그 API (/quality/defect-logs)
 * - OqcController: OQC 출하검사 API (/quality/oqc)
 * - ReworkController: 재작업 API (/quality/reworks, /quality/reworks/inspects, /quality/reworks/processes)
 * - ChangeOrderController: 변경점관리 API (/quality/changes)
 * - ComplaintController: 고객클레임 API (/quality/complaints)
 * - CapaController: CAPA API (/quality/capas)
 * - FaiController: 초물검사 API (/quality/fai)
 * - SpcController: SPC 관리도 API (/quality/spc/charts, /quality/spc/data)
 * - MsaController: MSA 계측기/교정 API (/quality/msa/gauges, /quality/msa/calibrations)
 * - PpapController: PPAP API (/quality/ppap)
 * - ContinuityInspectController: 통전검사 API (/quality/continuity-inspect)
 *
 * 서비스:
 * - InspectResultService: 검사실적 비즈니스 로직
 * - DefectLogService: 불량로그/수리이력 비즈니스 로직
 * - OqcService: OQC 출하검사 비즈니스 로직
 * - ReworkService: 재작업 지시/승인/재검사 비즈니스 로직
 * - ChangeOrderService: 변경점관리 비즈니스 로직
 * - ComplaintService: 고객클레임 비즈니스 로직
 * - CapaService: CAPA 시정/예방조치 비즈니스 로직
 * - FaiService: 초물검사 비즈니스 로직
 * - SpcService: SPC 통계적 공정 관리 비즈니스 로직
 * - MsaService: MSA 계측기 마스터/교정 이력 비즈니스 로직
 * - PpapService: PPAP 제출/승인 비즈니스 로직
 * - ContinuityInspectService: 통전검사 + FG_BARCODE 발행 비즈니스 로직
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectResultController } from './controllers/inspect-result.controller';
import { InspectResultService } from './services/inspect-result.service';
import { DefectLogController } from './controllers/defect-log.controller';
import { DefectLogService } from './services/defect-log.service';
import { OqcController } from './controllers/oqc.controller';
import { OqcService } from './services/oqc.service';
import { ReworkController } from './controllers/rework.controller';
import { ReworkService } from './services/rework.service';
import { ReworkProcessService } from './services/rework-process.service';
import { ChangeOrderController } from './controllers/change-order.controller';
import { ChangeOrderService } from './services/change-order.service';
import { ComplaintController } from './controllers/complaint.controller';
import { ComplaintService } from './services/complaint.service';
import { DefectLog } from '../../entities/defect-log.entity';
import { RepairLog } from '../../entities/repair-log.entity';
import { InspectResult } from '../../entities/inspect-result.entity';
import { ProdResult } from '../../entities/prod-result.entity';
import { OqcRequest } from '../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../entities/oqc-request-box.entity';
import { BoxMaster } from '../../entities/box-master.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { TraceLog } from '../../entities/trace-log.entity';
import { ReworkOrder } from '../../entities/rework-order.entity';
import { ReworkInspect } from '../../entities/rework-inspect.entity';
import { ReworkProcess } from '../../entities/rework-process.entity';
import { ReworkResult } from '../../entities/rework-result.entity';
import { ProcessMap } from '../../entities/process-map.entity';
import { ChangeOrder } from '../../entities/change-order.entity';
import { CustomerComplaint } from '../../entities/customer-complaint.entity';
import { CapaController } from './controllers/capa.controller';
import { CapaService } from './services/capa.service';
import { CAPARequest } from '../../entities/capa-request.entity';
import { CAPAAction } from '../../entities/capa-action.entity';
import { FaiController } from './controllers/fai.controller';
import { FaiService } from './services/fai.service';
import { FaiRequest } from '../../entities/fai-request.entity';
import { FaiItem } from '../../entities/fai-item.entity';
import { SpcController } from './controllers/spc.controller';
import { SpcService } from './services/spc.service';
import { SpcChart } from '../../entities/spc-chart.entity';
import { SpcData } from '../../entities/spc-data.entity';
import { MsaController } from './controllers/msa.controller';
import { MsaService } from './services/msa.service';
import { GaugeMaster } from '../../entities/gauge-master.entity';
import { CalibrationLog } from '../../entities/calibration-log.entity';
import { ControlPlanController } from './controllers/control-plan.controller';
import { ControlPlanService } from './services/control-plan.service';
import { ControlPlan } from '../../entities/control-plan.entity';
import { ControlPlanItem } from '../../entities/control-plan-item.entity';
import { PpapController } from './controllers/ppap.controller';
import { PpapService } from './services/ppap.service';
import { PpapSubmission } from '../../entities/ppap-submission.entity';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditPlan } from '../../entities/audit-plan.entity';
import { AuditFinding } from '../../entities/audit-finding.entity';
import { FgLabel } from '../../entities/fg-label.entity';
import { JobOrder } from '../../entities/job-order.entity';
import { EquipProtocol } from '../../entities/equip-protocol.entity';
import { ContinuityInspectController } from './controllers/continuity-inspect.controller';
import { ContinuityInspectService } from './services/continuity-inspect.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DefectLog,
      RepairLog,
      InspectResult,
      ProdResult,
      OqcRequest,
      OqcRequestBox,
      BoxMaster,
      PartMaster,
      TraceLog,
      ReworkOrder,
      ReworkInspect,
      ReworkProcess,
      ReworkResult,
      ProcessMap,
      ChangeOrder,
      CustomerComplaint,
      CAPARequest,
      CAPAAction,
      FaiRequest,
      FaiItem,
      SpcChart,
      SpcData,
      GaugeMaster,
      CalibrationLog,
      ControlPlan,
      ControlPlanItem,
      PpapSubmission,
      AuditPlan,
      AuditFinding,
      FgLabel,
      JobOrder,
      EquipProtocol,
    ]),
  ],
  controllers: [
    InspectResultController,
    DefectLogController,
    OqcController,
    ReworkController,
    ChangeOrderController,
    ComplaintController,
    CapaController,
    FaiController,
    SpcController,
    MsaController,
    ControlPlanController,
    PpapController,
    AuditController,
    ContinuityInspectController,
  ],
  providers: [
    InspectResultService,
    DefectLogService,
    OqcService,
    ReworkService,
    ReworkProcessService,
    ChangeOrderService,
    ComplaintService,
    CapaService,
    FaiService,
    SpcService,
    MsaService,
    ControlPlanService,
    PpapService,
    AuditService,
    ContinuityInspectService,
  ],
  exports: [
    InspectResultService,
    DefectLogService,
    OqcService,
    ReworkService,
    ReworkProcessService,
    ChangeOrderService,
    ComplaintService,
    CapaService,
    FaiService,
    SpcService,
    MsaService,
    ControlPlanService,
    PpapService,
    AuditService,
    ContinuityInspectService,
  ],
})
export class QualityModule {}
