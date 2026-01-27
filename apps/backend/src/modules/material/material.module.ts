/**
 * @file src/modules/material/material.module.ts
 * @description 자재관리 모듈 - LOT, 재고, 출고 관리
 *
 * 초보자 가이드:
 * 1. **MatLot**: 입고된 원자재의 LOT 관리
 * 2. **MatStock**: 창고/라인별 실시간 재고
 * 3. **MatIssue**: 생산을 위한 자재 출고
 */

import { Module } from '@nestjs/common';
import { MatLotController } from './controllers/mat-lot.controller';
import { MatLotService } from './services/mat-lot.service';
import { MatStockController } from './controllers/mat-stock.controller';
import { MatStockService } from './services/mat-stock.service';
import { MatIssueController } from './controllers/mat-issue.controller';
import { MatIssueService } from './services/mat-issue.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [
    MatLotController,
    MatStockController,
    MatIssueController,
  ],
  providers: [
    MatLotService,
    MatStockService,
    MatIssueService,
  ],
  exports: [
    MatLotService,
    MatStockService,
    MatIssueService,
  ],
})
export class MaterialModule {}
