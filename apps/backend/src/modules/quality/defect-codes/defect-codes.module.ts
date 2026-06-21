import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefectCategoryMaster } from '../../../entities/defect-category-master.entity';
import { DefectCodeMaster } from '../../../entities/defect-code-master.entity';
import { DefectCodeProductType } from '../../../entities/defect-code-product-type.entity';
import { DefectCodeController } from './controllers/defect-code.controller';
import { DefectCodeService } from './services/defect-code.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DefectCategoryMaster,
      DefectCodeMaster,
      DefectCodeProductType,
    ]),
  ],
  controllers: [DefectCodeController],
  providers: [DefectCodeService],
  exports: [DefectCodeService],
})
export class DefectCodesModule {}
