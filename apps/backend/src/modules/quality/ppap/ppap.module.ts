/**
 * @file src/modules/quality/ppap/ppap.module.ts
 * @description PPAP 관리 서브모듈
 *
 * @module PpapModule
 * @description
 * PPAP(Production Part Approval Process) 관리를 위한 서브모듈입니다.
 * - PpapSubmission: PPAP 제출/승인 관리
 *
 * @dependencies
 * - TypeOrmModule: PpapSubmission 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PpapController } from './controllers/ppap.controller';
import { PpapService } from './services/ppap.service';
import { PpapSubmission } from '../../../entities/ppap-submission.entity';
import { User } from '../../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PpapSubmission,
      User,
    ]),
  ],
  controllers: [PpapController],
  providers: [PpapService],
  exports: [PpapService],
})
export class PpapModule {}
