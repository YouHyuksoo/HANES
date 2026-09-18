import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { IqcLogTarget } from '../../../entities/iqc-log-target.entity';
import { IqcRequestLot } from '../../../entities/iqc-request-lot.entity';
import { IqcRequestLotLine } from '../../../entities/iqc-request-lot-line.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatArrivalTransaction } from '../../../entities/mat-arrival-transaction.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { SystemModule } from '../../system/system.module';
import { AqlModule } from '../../quality/aql/aql.module';
import { ArrivalController } from '../controllers/arrival.controller';
import { ConcessionController } from '../controllers/concession.controller';
import { IqcHistoryController } from '../controllers/iqc-history.controller';
import { IqcDefectReceiveController } from '../controllers/iqc-defect-receive.controller';
import { IqcRequestLotController } from '../controllers/iqc-request-lot.controller';
import { ReceiptCancelController } from '../controllers/receipt-cancel.controller';
import { ReceivingController } from '../controllers/receiving.controller';
import { ArrivalService } from '../services/arrival.service';
import { ConcessionService } from '../services/concession.service';
import { IqcHistoryService } from '../services/iqc-history.service';
import { IqcJudgementLookupService } from '../services/iqc-judgement-lookup.service';
import { IqcDefectReceiveService } from '../services/iqc-defect-receive.service';
import { IqcRequestLotService } from '../services/iqc-request-lot.service';
import { ReceiptCancelService } from '../services/receipt-cancel.service';
import { ReceivingService } from '../services/receiving.service';

@Module({
  imports: [
    SystemModule,
    AqlModule,
    TypeOrmModule.forFeature([
      IqcLog,
      IqcLogTarget,
      IqcRequestLot,
      IqcRequestLotLine,
      LabelPrintLog,
      MatArrival,
      MatArrivalStock,
      MatArrivalTransaction,
      MatIssue,
      MatLot,
      MatReceiving,
      MatStock,
      ItemMaster,
      PartnerMaster,
      PurchaseOrder,
      PurchaseOrderItem,
      StockTransaction,
      VendorBarcodeMapping,
      Warehouse,
      WarehouseLocation,
      WorkerMaster,
    ]),
  ],
  controllers: [
    ArrivalController,
    ReceivingController,
    IqcHistoryController,
    IqcDefectReceiveController,
    IqcRequestLotController,
    ReceiptCancelController,
    ConcessionController,
  ],
  providers: [
    ArrivalService,
    ReceivingService,
    IqcHistoryService,
    IqcJudgementLookupService,
    IqcDefectReceiveService,
    IqcRequestLotService,
    ReceiptCancelService,
    ConcessionService,
  ],
})
export class ReceivingModule {}
