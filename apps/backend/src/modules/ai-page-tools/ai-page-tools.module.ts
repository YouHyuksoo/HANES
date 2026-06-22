import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipMaster } from '../../entities/equip-master.entity';
import { PartMaster } from '../../entities/part-master.entity';
import { ProcessMaster } from '../../entities/process-master.entity';
import { ProdLineMaster } from '../../entities/prod-line-master.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { AiPageToolsController } from './ai-page-tools.controller';
import { AiPageToolsService } from './ai-page-tools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartMaster, ProdLineMaster, ProcessMaster, EquipMaster]),
    InventoryModule, // WarehouseService 재사용(창고 등록 write 도구)
  ],
  controllers: [AiPageToolsController],
  providers: [AiPageToolsService],
  exports: [AiPageToolsService],
})
export class AiPageToolsModule {}
