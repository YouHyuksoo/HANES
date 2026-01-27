/**
 * @file src/modules/outsourcing/outsourcing.module.ts
 * @description 외주관리 모듈
 */

import { Module } from '@nestjs/common';
import { OutsourcingController } from './controllers/outsourcing.controller';
import { OutsourcingService } from './services/outsourcing.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [OutsourcingController],
  providers: [OutsourcingService],
  exports: [OutsourcingService],
})
export class OutsourcingModule {}
