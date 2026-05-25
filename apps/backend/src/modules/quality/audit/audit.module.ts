/**
 * @file src/modules/quality/audit/audit.module.ts
 * @description 심사 관리 서브모듈
 *
 * @module AuditModule
 * @description
 * 품질 심사 관리를 위한 서브모듈입니다.
 * - AuditPlan: 심사 계획 관리
 * - AuditFinding: 심사 finding 관리
 *
 * @dependencies
 * - TypeOrmModule: AuditPlan, AuditFinding 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditPlan } from '../../../entities/audit-plan.entity';
import { AuditFinding } from '../../../entities/audit-finding.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditPlan,
      AuditFinding,
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
