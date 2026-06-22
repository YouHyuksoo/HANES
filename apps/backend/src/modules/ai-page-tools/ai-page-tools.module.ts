import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipMaster } from '../../entities/equip-master.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { ProcessMaster } from '../../entities/process-master.entity';
import { ProdLineMaster } from '../../entities/prod-line-master.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { MasterModule } from '../master/master.module';
import { AiPageToolsController } from './ai-page-tools.controller';
import { AiPageToolsService } from './ai-page-tools.service';
import { ProductionOrderToolsProvider } from './registry/production-order-tools.provider';
import { WarehouseToolsProvider } from './registry/warehouse-tools.provider';
import { PAGE_TOOL_PROVIDER, PageToolProvider } from './types';

// 새 페이지 도구 추가 시: Provider 클래스를 만들고 아래 두 배열(providers 등록 + factory inject)에 추가한다.
const PAGE_TOOL_PROVIDERS = [ProductionOrderToolsProvider, WarehouseToolsProvider];

@Module({
  imports: [
    TypeOrmModule.forFeature([PartMaster, ProdLineMaster, ProcessMaster, EquipMaster]),
    InventoryModule, // WarehouseService·WarehouseLocationService
    MasterModule, // TransferRuleService
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
