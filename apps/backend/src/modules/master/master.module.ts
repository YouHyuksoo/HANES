/**
 * @file src/modules/master/master.module.ts
 * @description 기준정보 모듈 - 공통코드, 공장, 품목, BOM 등 관리
 *
 * 초보자 가이드:
 * 1. **Controllers**: API 엔드포인트 정의
 * 2. **Services**: 비즈니스 로직 처리
 * 3. **확장**: 새 기준정보 추가 시 여기에 등록
 */

import { Module } from '@nestjs/common';
import { ComCodeController } from './controllers/com-code.controller';
import { ComCodeService } from './services/com-code.service';
import { PlantController } from './controllers/plant.controller';
import { PlantService } from './services/plant.service';
import { PartController } from './controllers/part.controller';
import { PartService } from './services/part.service';
import { BomController } from './controllers/bom.controller';
import { BomService } from './services/bom.service';
import { PartnerController } from './controllers/partner.controller';
import { PartnerService } from './services/partner.service';

@Module({
  controllers: [
    ComCodeController,
    PlantController,
    PartController,
    BomController,
    PartnerController,
  ],
  providers: [
    ComCodeService,
    PlantService,
    PartService,
    BomService,
    PartnerService,
  ],
  exports: [
    ComCodeService,
    PlantService,
    PartService,
    BomService,
    PartnerService,
  ],
})
export class MasterModule {}
