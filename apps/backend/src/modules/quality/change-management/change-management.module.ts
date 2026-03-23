/**
 * @file src/modules/quality/change-management/change-management.module.ts
 * @description 변경관리 서브모듈 (4M변경/큠�임/CAPA)
 *
 * @module ChangeManagementModule
 * @description
 * 변경관리 기능을 위한 서브모듈입니다.
 * - ChangeOrder: 4M 변경점 관리
 * - CustomerComplaint: 고객클�임 관리
 * - CAPARequest/CAPAAction: CAPA 시정/예방조치 관리
 *
 * @dependencies
 * - TypeOrmModule: ChangeOrder, CustomerComplaint, CAPARequest, CAPAAction 엔티티
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers (기존 파일 재사용 - 점진적 마이그레이션)
import { ChangeOrderController } from './controllers/change-order.controller';
import { ComplaintController } from './controllers/complaint.controller';
import { CapaController } from './controllers/capa.controller';

// Services (기존 파일 재사용 - 점진적 마이그레이션)
import { ChangeOrderService } from './services/change-order.service';
import { ComplaintService } from './services/complaint.service';
import { CapaService } from './services/capa.service';

// Entities
import { ChangeOrder } from '../../../entities/change-order.entity';
import { CustomerComplaint } from '../../../entities/customer-complaint.entity';
import { CAPARequest } from '../../../entities/capa-request.entity';
import { CAPAAction } from '../../../entities/capa-action.entity';
import { User } from '../../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChangeOrder,
      CustomerComplaint,
      CAPARequest,
      CAPAAction,
      User,
    ]),
  ],
  controllers: [
    ChangeOrderController,
    ComplaintController,
    CapaController,
  ],
  providers: [
    ChangeOrderService,
    ComplaintService,
    CapaService,
  ],
  exports: [
    ChangeOrderService,
    ComplaintService,
    CapaService,
  ],
})
export class ChangeManagementModule {}
