import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AqlStandard } from '../../../entities/aql-standard.entity';
import { AqlAcceptanceRule } from '../../../entities/aql-acceptance-rule.entity';
import { AqlCodeLetterRule } from '../../../entities/aql-code-letter-rule.entity';
import { AqlCodeLetterSample } from '../../../entities/aql-code-letter-sample.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { DefectCodeMaster } from '../../../entities/defect-code-master.entity';
import { IqcAqlPolicy } from '../../../entities/iqc-aql-policy.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { VendorInspectionModeHistory } from '../../../entities/vendor-inspection-mode-history.entity';
import { IqcPartSpecItem } from '../../../entities/iqc-part-spec-item.entity';
import { AqlController } from './controllers/aql.controller';
import { AqlService } from './services/aql.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    AqlStandard,
    AqlCodeLetterRule,
    AqlCodeLetterSample,
    AqlAcceptanceRule,
    IqcAqlPolicy,
    IqcLog,
    DefectCodeMaster,
    ItemMaster,
    PartnerMaster,
    VendorInspectionModeHistory,
    IqcPartSpecItem,
  ])],
  controllers: [AqlController],
  providers: [AqlService],
  exports: [AqlService],
})
export class AqlModule {}
