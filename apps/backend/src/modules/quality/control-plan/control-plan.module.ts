import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../../../shared/shared.module';
import { QualityPlanPackageEntity } from '../../../entities/quality-plan-package.entity';
import { QualityPlanDocumentEntity } from '../../../entities/quality-plan-document.entity';
import { QualityPlanRevisionEntity } from '../../../entities/quality-plan-revision.entity';
import { ProcessFlowRowEntity } from '../../../entities/process-flow-row.entity';
import { PfmeaRowEntity } from '../../../entities/pfmea-row.entity';
import { QualityControlPlanRowEntity } from '../../../entities/quality-control-plan-row.entity';
import { QualityPlanParticipantEntity } from '../../../entities/quality-plan-participant.entity';
import { QualityPlanValidationEntity } from '../../../entities/quality-plan-validation.entity';
import { QualityPlanEventEntity } from '../../../entities/quality-plan-event.entity';
import { PlanPackageController } from './controllers/plan-package.controller';
import { QualityDocumentController } from './controllers/quality-document.controller';
import { PlanPackageService } from './services/plan-package.service';
import { QualityDocumentRevisionService } from './services/quality-document-revision.service';
import { ProcessFlowDocumentService } from './services/process-flow-document.service';
import { PfmeaDocumentService } from './services/pfmea-document.service';
import { ControlPlanDocumentService } from './services/control-plan-document.service';
import { QualityPlanDraftGeneratorService } from './services/quality-plan-draft-generator.service';
import { QualityPlanValidationService } from './services/quality-plan-validation.service';
import { QualityPlanPrintModelService } from './services/quality-plan-print-model.service';
import { QualityPlanParticipantService } from './services/quality-plan-participant.service';

const QUALITY_PLAN_ENTITIES = [
  QualityPlanPackageEntity,
  QualityPlanDocumentEntity,
  QualityPlanRevisionEntity,
  ProcessFlowRowEntity,
  PfmeaRowEntity,
  QualityControlPlanRowEntity,
  QualityPlanParticipantEntity,
  QualityPlanValidationEntity,
  QualityPlanEventEntity,
];

/**
 * PFD/PFMEA/Control Plan 통합 문서 모듈.
 * Controller와 업무 Service는 각 기능 구현 시 이 모듈에 단계적으로 등록한다.
 */
@Module({
  imports: [TypeOrmModule.forFeature(QUALITY_PLAN_ENTITIES), SharedModule],
  controllers: [PlanPackageController, QualityDocumentController],
  providers: [PlanPackageService, QualityPlanValidationService, QualityDocumentRevisionService, ProcessFlowDocumentService, PfmeaDocumentService, ControlPlanDocumentService, QualityPlanDraftGeneratorService, QualityPlanPrintModelService, QualityPlanParticipantService],
  exports: [TypeOrmModule, PlanPackageService, QualityDocumentRevisionService, ProcessFlowDocumentService, PfmeaDocumentService, ControlPlanDocumentService, QualityPlanDraftGeneratorService, QualityPlanValidationService, QualityPlanPrintModelService],
})
export class ControlPlanDocumentModule {}
