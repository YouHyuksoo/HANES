import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipMaster } from '../../entities/equip-master.entity';
import { ItemMaster } from '../../entities/item-master.entity';
import { ProcessMaster } from '../../entities/process-master.entity';
import { ProdLineMaster } from '../../entities/prod-line-master.entity';
import { EquipmentModule } from '../equipment/equipment.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MasterModule } from '../master/master.module';
import { AiPageToolsController } from './ai-page-tools.controller';
import { AiPageToolsService } from './ai-page-tools.service';
import { ProductionOrderToolsProvider } from './registry/production-order-tools.provider';
import { WarehouseToolsProvider } from './registry/warehouse-tools.provider';
import { PartToolsProvider } from './registry/part-tools.provider';
import { BomToolsProvider } from './registry/bom-tools.provider';
import { PartnerToolsProvider } from './registry/partner-tools.provider';
import { EquipToolsProvider } from './registry/equip-tools.provider';
import { ProcessToolsProvider } from './registry/process-tools.provider';
import { ProdLineToolsProvider } from './registry/prod-line-tools.provider';
import { RoutingToolsProvider } from './registry/routing-tools.provider';
import { WorkCalendarToolsProvider } from './registry/work-calendar-tools.provider';
import { WorkerToolsProvider } from './registry/worker-tools.provider';
import { WorkInstructionToolsProvider } from './registry/work-instruction-tools.provider';
import { LabelToolsProvider } from './registry/label-tools.provider';
import { VendorBarcodeToolsProvider } from './registry/vendor-barcode-tools.provider';
import { ProcessCapaToolsProvider } from './registry/process-capa-tools.provider';
import { PAGE_TOOL_PROVIDER, PageToolProvider } from './types';

// 새 페이지 도구 추가 시: Provider 클래스를 만들고 이 배열에 한 줄 추가한다(중앙 디스패처/모듈 본문 불변).
const PAGE_TOOL_PROVIDERS = [
  ProductionOrderToolsProvider,
  WarehouseToolsProvider,
  PartToolsProvider,
  BomToolsProvider,
  PartnerToolsProvider,
  EquipToolsProvider,
  ProcessToolsProvider,
  ProdLineToolsProvider,
  RoutingToolsProvider,
  WorkCalendarToolsProvider,
  WorkerToolsProvider,
  WorkInstructionToolsProvider,
  LabelToolsProvider,
  VendorBarcodeToolsProvider,
  ProcessCapaToolsProvider,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([ItemMaster, ProdLineMaster, ProcessMaster, EquipMaster]),
    InventoryModule, // WarehouseService·WarehouseLocationService
    MasterModule, // 기준정보 도메인 서비스(Part/Bom/Partner/Process/ProdLine/Routing/Worker/... )
    EquipmentModule, // EquipMasterService
  ],
  controllers: [AiPageToolsController],
  providers: [
    ...PAGE_TOOL_PROVIDERS,
    {
      provide: PAGE_TOOL_PROVIDER,
      useFactory: (...providers: PageToolProvider[]) => providers,
      inject: PAGE_TOOL_PROVIDERS,
    },
    AiPageToolsService,
  ],
  exports: [AiPageToolsService],
})
export class AiPageToolsModule {}
