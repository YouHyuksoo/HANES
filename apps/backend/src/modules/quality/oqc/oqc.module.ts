/**
 * @file src/modules/quality/oqc/oqc.module.ts
 * @description OQC(출하검사) 관리 서브모듈
 *
 * @module OqcModule
 * @description
 * OQC(Outgoing Quality Control) 출하검사 관리를 위한 서브모듈입니다.
 * - OqcRequest: OQC 의뢰 관리
 * - OqcRequestBox: 의뢰별 박스 연결 관리
 * - BoxMaster: 박스 마스터 연동
 * - PartMaster: 품목 정보 연동
 *
 * @dependencies
 * - TypeOrmModule: OqcRequest, OqcRequestBox, BoxMaster, PartMaster 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OqcController } from './controllers/oqc.controller';
import { OqcService } from './services/oqc.service';
import { OqcRequest } from '../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../entities/oqc-request-box.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OqcRequest,
      OqcRequestBox,
      BoxMaster,
      PartMaster,
    ]),
  ],
  controllers: [OqcController],
  providers: [OqcService],
  exports: [OqcService],
})
export class OqcModule {}
