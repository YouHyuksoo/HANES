import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { SystemModule } from '../../system/system.module';
import { AdjustmentController } from '../controllers/adjustment.controller';
import { HoldController } from '../controllers/hold.controller';
import { MatStockController } from '../controllers/mat-stock.controller';
import { MiscReceiptController } from '../controllers/misc-receipt.controller';
import { PhysicalInvController } from '../controllers/physical-inv.controller';
import { ScrapController } from '../controllers/scrap.controller';
import { ShelfLifeController } from '../controllers/shelf-life.controller';
import { ShelfLifeReInspectController } from '../controllers/shelf-life-reinspect.controller';
import { AdjustmentService } from '../services/adjustment.service';
import { HoldService } from '../services/hold.service';
import { MatStockService } from '../services/mat-stock.service';
import { MiscReceiptService } from '../services/misc-receipt.service';
import { PhysicalInvService } from '../services/physical-inv.service';
import { ScrapService } from '../services/scrap.service';
import { ShelfLifeReInspectService } from '../services/shelf-life-reinspect.service';
import { ShelfLifeService } from '../services/shelf-life.service';

@Module({
  imports: [
    SystemModule,
    TypeOrmModule.forFeature([
      InvAdjLog,
      IqcLog,
      MatLot,
      MatStock,
      ItemMaster,
      PartnerMaster,
      PhysicalInvCountDetail,
      PhysicalInvSession,
      StockTransaction,
      Warehouse,
    ]),
  ],
  controllers: [
    MatStockController,
    ShelfLifeController,
    ShelfLifeReInspectController,
    HoldController,
    ScrapController,
    AdjustmentController,
    MiscReceiptController,
    PhysicalInvController,
  ],
  providers: [
    MatStockService,
    ShelfLifeService,
    HoldService,
    ScrapService,
    AdjustmentService,
    MiscReceiptService,
    PhysicalInvService,
    ShelfLifeReInspectService,
  ],
  exports: [MatStockService],
})
export class InventoryControlModule {}
