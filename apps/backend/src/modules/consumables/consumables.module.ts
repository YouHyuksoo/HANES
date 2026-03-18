/**
 * @file src/modules/consumables/consumables.module.ts
 * @description 소모품관리 모듈 — 마스터 CRUD + 라벨 발행 + 개별 인스턴스 관리
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumablesController } from './controllers/consumables.controller';
import { ConsumablesService } from './services/consumables.service';
import { ConsumableLabelController } from './controllers/consumable-label.controller';
import { ConsumableLabelService } from './services/consumable-label.service';
import { ConsumableStockController } from './controllers/consumable-stock.controller';
import { ConsumableMaster } from '../../entities/consumable-master.entity';
import { ConsumableLog } from '../../entities/consumable-log.entity';
import { ConsumableStock } from '../../entities/consumable-stock.entity';
import { LabelPrintLog } from '../../entities/label-print-log.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConsumableMaster,
      ConsumableLog,
      ConsumableStock,
      LabelPrintLog,
    ]),
  ],
  controllers: [
    ConsumableLabelController,
    ConsumableStockController,
    ConsumablesController,
  ],
  providers: [
    ConsumablesService,
    ConsumableLabelService,
  ],
  exports: [ConsumablesService],
})
export class ConsumablesModule {}
