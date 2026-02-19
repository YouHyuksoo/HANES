/**
 * @file src/modules/consumables/consumables.module.ts
 * @description 소모품관리 모듈
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumablesController } from './controllers/consumables.controller';
import { ConsumablesService } from './services/consumables.service';
import { ConsumableMaster } from '../../entities/consumable-master.entity';
import { ConsumableLog } from '../../entities/consumable-log.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConsumableMaster, ConsumableLog]),
    InventoryModule,
  ],
  controllers: [ConsumablesController],
  providers: [ConsumablesService],
  exports: [ConsumablesService],
})
export class ConsumablesModule {}
