/**
 * @file src/modules/customs/customs.module.ts
 * @description 보세관리 모듈
 */

import { Module } from '@nestjs/common';
import { CustomsController } from './controllers/customs.controller';
import { CustomsService } from './services/customs.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [CustomsController],
  providers: [CustomsService],
  exports: [CustomsService],
})
export class CustomsModule {}
