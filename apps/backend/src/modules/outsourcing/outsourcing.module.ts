/**
 * @file src/modules/outsourcing/outsourcing.module.ts
 * @description 외주관리 모듈
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutsourcingController } from './controllers/outsourcing.controller';
import { OutsourcingService } from './services/outsourcing.service';
import { SubconOrder } from '../../entities/subcon-order.entity';
import { SubconDelivery } from '../../entities/subcon-delivery.entity';
import { SubconReceive } from '../../entities/subcon-receive.entity';
import { VendorMaster } from '../../entities/vendor-master.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubconOrder, SubconDelivery, SubconReceive, VendorMaster]),
    InventoryModule,
  ],
  controllers: [OutsourcingController],
  providers: [OutsourcingService],
  exports: [OutsourcingService],
})
export class OutsourcingModule {}
