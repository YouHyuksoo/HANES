import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../../inventory/inventory.module';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatIssueRequest } from '../../../entities/mat-issue-request.entity';
import { MatIssueRequestItem } from '../../../entities/mat-issue-request-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { IssueRequestController } from '../controllers/issue-request.controller';
import { MatIssueController } from '../controllers/mat-issue.controller';
import { IssueRequestService } from '../services/issue-request.service';
import { MatIssueService } from '../services/mat-issue.service';
import { MatOutRequestService } from '../services/mat-out-request.service';

@Module({
  imports: [
    InventoryModule,
    TypeOrmModule.forFeature([
      JobOrder,
      BomMaster,
      MatIssue,
      MatIssueRequest,
      MatIssueRequestItem,
      MatLot,
      MatStock,
      ItemMaster,
      StockTransaction,
      Warehouse,
    ]),
  ],
  controllers: [MatIssueController, IssueRequestController],
  providers: [
    MatIssueService,
    IssueRequestService,
    MatOutRequestService,
  ],
  exports: [MatIssueService, IssueRequestService, MatOutRequestService],
})
export class IssueModule {}
