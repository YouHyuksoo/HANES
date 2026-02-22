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
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { IqcGroupController } from './controllers/iqc-group.controller';
import { IqcGroupService } from './services/iqc-group.service';
import { IqcPartLinkController } from './controllers/iqc-part-link.controller';
import { IqcPartLinkService } from './services/iqc-part-link.service';
import { EquipInspectController } from './controllers/equip-inspect.controller';
import { EquipInspectService } from './services/equip-inspect.service';
import { EquipBomController } from './controllers/equip-bom.controller';
import { EquipBomService } from './services/equip-bom.service';
import { WorkInstructionController } from './controllers/work-instruction.controller';
import { WorkInstructionService } from './services/work-instruction.service';
import { TransferRuleController } from './controllers/transfer-rule.controller';
import { TransferRuleService } from './services/transfer-rule.service';
import { ModelSuffixController } from './controllers/model-suffix.controller';
import { ModelSuffixService } from './services/model-suffix.service';
import { LabelTemplateController } from './controllers/label-template.controller';
import { LabelTemplateService } from './services/label-template.service';
import { ProdLineController } from './controllers/prod-line.controller';
import { ProdLineService } from './services/prod-line.service';
import { CompanyController } from './controllers/company.controller';
import { CompanyService } from './services/company.service';
import { DepartmentController } from './controllers/department.controller';
import { DepartmentService } from './services/department.service';
import { VendorBarcodeMappingController } from './controllers/vendor-barcode-mapping.controller';
import { VendorBarcodeMappingService } from './services/vendor-barcode-mapping.service';
import { IqcItemPoolController } from './controllers/iqc-item-pool.controller';
import { IqcItemPoolService } from './services/iqc-item-pool.service';

// TypeORM Entities
import { PartMaster } from '../../entities/part-master.entity';
import { BomMaster } from '../../entities/bom-master.entity';
import { ComCode } from '../../entities/com-code.entity';
import { CompanyMaster } from '../../entities/company-master.entity';
import { DepartmentMaster } from '../../entities/department-master.entity';
import { Plant } from '../../entities/plant.entity';
import { ProcessMap } from '../../entities/process-map.entity';
import { ProcessMaster } from '../../entities/process-master.entity';
import { ProdLineMaster } from '../../entities/prod-line-master.entity';
import { WarehouseTransferRule } from '../../entities/warehouse-transfer-rule.entity';
import { WorkInstruction } from '../../entities/work-instruction.entity';
import { WorkerMaster } from '../../entities/worker-master.entity';
import { PartnerMaster } from '../../entities/partner-master.entity';
import { EquipInspectItemMaster } from '../../entities/equip-inspect-item-master.entity';
import { IqcItemMaster } from '../../entities/iqc-item-master.entity';
import { IqcGroup } from '../../entities/iqc-group.entity';
import { IqcGroupItem } from '../../entities/iqc-group-item.entity';
import { IqcPartLink } from '../../entities/iqc-part-link.entity';
import { LabelTemplate } from '../../entities/label-template.entity';
import { EquipBomItem } from '../../entities/equip-bom-item.entity';
import { EquipBomRel } from '../../entities/equip-bom-rel.entity';
import { ModelSuffix } from '../../entities/model-suffix.entity';
import { VendorBarcodeMapping } from '../../entities/vendor-barcode-mapping.entity';
import { IqcItemPool } from '../../entities/iqc-item-pool.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartMaster,
      BomMaster,
      ComCode,
      CompanyMaster,
      DepartmentMaster,
      Plant,
      ProcessMap,
      ProcessMaster,
      ProdLineMaster,
      WarehouseTransferRule,
      WorkInstruction,
      WorkerMaster,
      PartnerMaster,
      EquipInspectItemMaster,
      IqcItemMaster,
      IqcGroup,
      IqcGroupItem,
      IqcPartLink,
      LabelTemplate,
      ModelSuffix,
      EquipBomItem,
      EquipBomRel,
      VendorBarcodeMapping,
      IqcItemPool,
    ]),
  ],
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
    IqcGroupController,
    IqcPartLinkController,
    EquipInspectController,
    EquipBomController,
    WorkInstructionController,
    TransferRuleController,
    ModelSuffixController,
    LabelTemplateController,
    ProdLineController,
    CompanyController,
    DepartmentController,
    VendorBarcodeMappingController,
    IqcItemPoolController,
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
    IqcGroupService,
    IqcPartLinkService,
    EquipInspectService,
    EquipBomService,
    WorkInstructionService,
    TransferRuleService,
    ModelSuffixService,
    LabelTemplateService,
    ProdLineService,
    CompanyService,
    DepartmentService,
    VendorBarcodeMappingService,
    IqcItemPoolService,
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
    IqcGroupService,
    IqcPartLinkService,
    EquipInspectService,
    EquipBomService,
    WorkInstructionService,
    TransferRuleService,
    ModelSuffixService,
    LabelTemplateService,
    ProdLineService,
    CompanyService,
    DepartmentService,
    VendorBarcodeMappingService,
    IqcItemPoolService,
  ],
})
export class MasterModule {}
