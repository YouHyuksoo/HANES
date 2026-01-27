/**
 * @file src/modules/consumables/consumables.module.ts
 * @description 소모품관리 모듈
 */

import { Module } from '@nestjs/common';
import { ConsumablesController } from './controllers/consumables.controller';
import { ConsumablesService } from './services/consumables.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [ConsumablesController],
  providers: [ConsumablesService],
  exports: [ConsumablesService],
})
export class ConsumablesModule {}
