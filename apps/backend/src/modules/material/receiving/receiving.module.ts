import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { SystemModule } from '../../system/system.module';
import { ArrivalController } from '../controllers/arrival.controller';
import { IqcHistoryController } from '../controllers/iqc-history.controller';
import { ReceiptCancelController } from '../controllers/receipt-cancel.controller';
import { ReceivingController } from '../controllers/receiving.controller';
import { ArrivalService } from '../services/arrival.service';
import { IqcHistoryService } from '../services/iqc-history.service';
import { ReceiptCancelService } from '../services/receipt-cancel.service';
import { ReceivingService } from '../services/receiving.service';

@Module({
  imports: [
    SystemModule,
    TypeOrmModule.forFeature([
      IqcLog,
      LabelPrintLog,
      MatArrival,
      MatIssue,
      MatLot,
      MatReceiving,
      MatStock,
      PartMaster,
      PartnerMaster,
      PurchaseOrder,
      PurchaseOrderItem,
      StockTransaction,
      VendorBarcodeMapping,
      Warehouse,
    ]),
  ],
  controllers: [
    ArrivalController,
    ReceivingController,
    IqcHistoryController,
    ReceiptCancelController,
  ],
  providers: [
    ArrivalService,
    ReceivingService,
    IqcHistoryService,
    ReceiptCancelService,
  ],
})
export class ReceivingModule {}
