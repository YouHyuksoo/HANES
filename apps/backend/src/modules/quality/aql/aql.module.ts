import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AqlStandard } from '../../../entities/aql-standard.entity';
import { AqlSamplingRule } from '../../../entities/aql-sampling-rule.entity';
import { AqlController } from './controllers/aql.controller';
import { AqlService } from './services/aql.service';

@Module({
  imports: [TypeOrmModule.forFeature([AqlStandard, AqlSamplingRule])],
  controllers: [AqlController],
  providers: [AqlService],
  exports: [AqlService],
})
export class AqlModule {}
