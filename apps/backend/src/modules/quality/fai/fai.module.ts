/**
 * @file src/modules/quality/fai/fai.module.ts
 * @description FAI(초물검사) 관리 서브모듈
 *
 * @module FaiModule
 * @description
 * FAI(First Article Inspection) 초물검사 관리를 위한 서브모듈입니다.
 * - FaiRequest: FAI 요청 관리
 * - FaiItem: FAI 검사 항목 관리
 *
 * @dependencies
 * - TypeOrmModule: FaiRequest, FaiItem 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaiController } from './controllers/fai.controller';
import { FaiService } from './services/fai.service';
import { FaiRequest } from '../../../entities/fai-request.entity';
import { FaiItem } from '../../../entities/fai-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FaiRequest,
      FaiItem,
    ]),
  ],
  controllers: [FaiController],
  providers: [FaiService],
  exports: [FaiService],
})
export class FaiModule {}
