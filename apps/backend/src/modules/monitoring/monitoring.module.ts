/**
 * @file src/modules/monitoring/monitoring.module.ts
 * @description 모니터링 모듈 — 현장 TV/사이니지 보드용 읽기전용 집계 API
 *
 * 초보자 가이드:
 * 1. 보드 3종(생산/품질/재고) 집계 서비스로 구성 — 쓰기 API 없음
 * 2. 작업지시 칸반 보드는 생산현황 API(orders)를 프론트에서 status 별 그룹핑해 재사용
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobOrder } from '../../entities/job-order.entity';
import { ProdResult } from '../../entities/prod-result.entity';
import { DefectLog } from '../../entities/defect-log.entity';
import { RepairOrder } from '../../entities/repair-order.entity';
import { MatStock } from '../../entities/mat-stock.entity';
import { MatLot } from '../../entities/mat-lot.entity';
import { ProductStock } from '../../entities/product-stock.entity';
import { StockTransaction } from '../../entities/stock-transaction.entity';
import { MonitoringBoardController } from './controllers/monitoring-board.controller';
import { ProductionBoardService } from './services/production-board.service';
import { QualityBoardService } from './services/quality-board.service';
import { InventoryBoardService } from './services/inventory-board.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobOrder,
      ProdResult,
      DefectLog,
      RepairOrder,
      MatStock,
      MatLot,
      ProductStock,
      StockTransaction,
    ]),
  ],
  controllers: [MonitoringBoardController],
  providers: [ProductionBoardService, QualityBoardService, InventoryBoardService],
})
export class MonitoringModule {}
