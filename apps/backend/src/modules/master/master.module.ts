/**
 * @file src/modules/master/master.module.ts
 * @description 기준정보 모듈 - 공통코드, 공장, 품목, BOM, 거래처, 공정, 라우팅, 작업자 등 관리
 *
 * 초보자 가이드:
 * 1. **Controllers**: API 엔드포인트 정의
 * 2. **Services**: 비즈니스 로직 처리
 * 3. **확장**: 새 기준정보 추가 시 여기에 등록
 */

import { Module } from '@nestjs/common';
import { ComCodeController } from './controllers/com-code.controller';
import { ComCodeService } from './services/com-code.service';
import { PlantController } from './controllers/plant.controller';
import { PlantService } from './services/plant.service';
import { PartController } from './controllers/part.controller';
import { PartService } from './services/part.service';
import { BomController } from './controllers/bom.controller';
import { BomService } from './services/bom.service';
import { PartnerController } from './controllers/partner.controller';
import { PartnerService } from './services/partner.service';
import { ProcessController } from './controllers/process.controller';
import { ProcessService } from './services/process.service';
import { RoutingController } from './controllers/routing.controller';
import { RoutingService } from './services/routing.service';
import { WorkerController } from './controllers/worker.controller';
import { WorkerService } from './services/worker.service';
import { IqcItemController } from './controllers/iqc-item.controller';
import { IqcItemService } from './services/iqc-item.service';
import { EquipInspectController } from './controllers/equip-inspect.controller';
import { EquipInspectService } from './services/equip-inspect.service';
import { WorkInstructionController } from './controllers/work-instruction.controller';
import { WorkInstructionService } from './services/work-instruction.service';
import { TransferRuleController } from './controllers/transfer-rule.controller';
import { TransferRuleService } from './services/transfer-rule.service';
import { ModelSuffixController } from './controllers/model-suffix.controller';
import { ModelSuffixService } from './services/model-suffix.service';

@Module({
  controllers: [
    ComCodeController,
    PlantController,
    PartController,
    BomController,
    PartnerController,
    ProcessController,
    RoutingController,
    WorkerController,
    IqcItemController,
    EquipInspectController,
    WorkInstructionController,
    TransferRuleController,
    ModelSuffixController,
  ],
  providers: [
    ComCodeService,
    PlantService,
    PartService,
    BomService,
    PartnerService,
    ProcessService,
    RoutingService,
    WorkerService,
    IqcItemService,
    EquipInspectService,
    WorkInstructionService,
    TransferRuleService,
    ModelSuffixService,
  ],
  exports: [
    ComCodeService,
    PlantService,
    PartService,
    BomService,
    PartnerService,
    ProcessService,
    RoutingService,
    WorkerService,
    IqcItemService,
    EquipInspectService,
    WorkInstructionService,
    TransferRuleService,
    ModelSuffixService,
  ],
})
export class MasterModule {}
