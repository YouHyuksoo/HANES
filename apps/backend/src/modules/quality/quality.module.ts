/**
 * @file src/modules/quality/quality.module.ts
 * @description 품질관리 통합 모듈
 *
 * @module QualityModule
 * @description
 * 품질관리 기능을 위한 통합 모듈입니다.
 * 기존에는 모든 품질 관련 엔티티/서비스/컨트롤러가 이 모듈에 집중되었으나,
 * 기능별 서브모듈로 분리하여 관리합니다.
 *
 * ## 서브모듈 구조
 * - DefectsModule: 불량/수리 관리
 * - InspectionModule: 검사실적 관리
 * - OqcModule: 출하검사 관리
 * - ReworkModule: 재작업 관리
 * - ChangeManagementModule: 4M변경/큠�임/CAPA 관리
 * - AuditModule: 심사 관리
 * - SpcModule: SPC/MSA/관리도 관리
 * - PpapModule: PPAP 관리
 * - FaiModule: 초물검사 관리
 * - ContinuityInspectModule: 통전검사/FG라벨 관리
 *
 * ## 하위호환성
 * 기존 코드에서 QualityModule을 직접 사용하는 경우,
 * 동일한 exports를 통해 서비스에 계속 접근할 수 있습니다.
 */

import { Module } from '@nestjs/common';

// 서브모듈 import
import { DefectsModule } from './defects/defects.module';
import { InspectionModule } from './inspection/inspection.module';
import { OqcModule } from './oqc/oqc.module';
import { ReworkModule } from './rework/rework.module';
import { ChangeManagementModule } from './change-management/change-management.module';
import { AuditModule } from './audit/audit.module';
import { SpcModule } from './spc/spc.module';
import { PpapModule } from './ppap/ppap.module';
import { FaiModule } from './fai/fai.module';
import { ContinuityInspectModule } from './continuity-inspect/continuity-inspect.module';

@Module({
  imports: [
    // 기능별 서브모듈 (신규 분리된 모듈들)
    DefectsModule,
    InspectionModule,
    OqcModule,
    ReworkModule,
    ChangeManagementModule,
    AuditModule,
    SpcModule,
    PpapModule,
    FaiModule,
    ContinuityInspectModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    // 모든 서브모듈 export
    DefectsModule,
    InspectionModule,
    OqcModule,
    ReworkModule,
    ChangeManagementModule,
    AuditModule,
    SpcModule,
    PpapModule,
    FaiModule,
    ContinuityInspectModule,
  ],
})
export class QualityModule {}
