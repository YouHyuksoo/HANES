/**
 * @file src/modules/customs/customs.module.ts
 * @description 보세관리 모듈
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomsController } from './controllers/customs.controller';
import { CustomsService } from './services/customs.service';
import { CustomsEntry } from '../../entities/customs-entry.entity';
import { CustomsLot } from '../../entities/customs-lot.entity';
import { CustomsUsageReport } from '../../entities/customs-usage-report.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomsEntry, CustomsLot, CustomsUsageReport]),
    InventoryModule,
  ],
  controllers: [CustomsController],
  providers: [CustomsService],
  exports: [CustomsService],
})
export class CustomsModule {}
