import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { LabelTemplate } from '../../../entities/label-template.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { LabelPrintController } from '../controllers/label-print.controller';
import { ReceiveLabelController } from '../controllers/receive-label.controller';
import { LabelPrintService } from '../services/label-print.service';
import { ReceiveLabelService } from '../services/receive-label.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabelPrintLog,
      LabelTemplate,
      MatArrival,
      MatLot,
      ItemMaster,
    ]),
  ],
  controllers: [LabelPrintController, ReceiveLabelController],
  providers: [LabelPrintService, ReceiveLabelService],
})
export class LabelsModule {}
