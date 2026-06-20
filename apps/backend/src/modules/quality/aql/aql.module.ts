import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AqlStandard } from '../../../entities/aql-standard.entity';
import { AqlSamplingRule } from '../../../entities/aql-sampling-rule.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { ComCode } from '../../../entities/com-code.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { VendorInspectionModeHistory } from '../../../entities/vendor-inspection-mode-history.entity';
import { AqlController } from './controllers/aql.controller';
import { AqlService } from './services/aql.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    AqlStandard,
    AqlSamplingRule,
    IqcLog,
    ComCode,
    PartMaster,
    PartnerMaster,
    VendorInspectionModeHistory,
  ])],
  controllers: [AqlController],
  providers: [AqlService],
  exports: [AqlService],
})
export class AqlModule {}
