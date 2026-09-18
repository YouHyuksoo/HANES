import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { LotMergeController } from '../controllers/lot-merge.controller';
import { LotSplitController } from '../controllers/lot-split.controller';
import { MatLotController } from '../controllers/mat-lot.controller';
import { LotMergeService } from '../services/lot-merge.service';
import { LotSplitService } from '../services/lot-split.service';
import { MatLotService } from '../services/mat-lot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatIssue,
      MatLot,
      MatStock,
      ItemMaster,
      PartnerMaster,
      StockTransaction,
      Warehouse,
      WarehouseLocation,
    ]),
  ],
  controllers: [MatLotController, LotSplitController, LotMergeController],
  providers: [MatLotService, LotSplitService, LotMergeService],
  exports: [MatLotService, LotSplitService],
})
export class LotModule {}
