import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PoStatusController } from '../controllers/po-status.controller';
import { PurchaseOrderController } from '../controllers/purchase-order.controller';
import { PoStatusService } from '../services/po-status.service';
import { PurchaseOrderService } from '../services/purchase-order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatArrival,
      PartMaster,
      PartnerMaster,
      PurchaseOrder,
      PurchaseOrderItem,
    ]),
  ],
  controllers: [PurchaseOrderController, PoStatusController],
  providers: [PurchaseOrderService, PoStatusService],
  exports: [PurchaseOrderService, PoStatusService],
})
export class PurchasingModule {}
