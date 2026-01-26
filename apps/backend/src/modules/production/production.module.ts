/**
 * @file src/modules/production/production.module.ts
 * @description 생산관리 모듈 - 작업지시, 생산실적 관리
 *
 * 초보자 가이드:
 * 1. **목적**: 생산 계획, 작업 지시, 실적 관리 기능
 * 2. **주요 기능**:
 *    - 작업지시 CRUD 및 상태 관리 (시작/일시정지/완료/취소)
 *    - 생산실적 등록 및 집계
 *    - ERP 연동 플래그 관리
 *    - 설비별/작업자별/일자별 실적 분석
 *
 * 컨트롤러/서비스 추가 시:
 * 1. controllers/ 폴더에 컨트롤러 생성
 * 2. services/ 폴더에 서비스 생성
 * 3. 이 모듈에 등록
 *
 * API 엔드포인트:
 * - /api/v1/production/job-orders : 작업지시 관리
 * - /api/v1/production/prod-results : 생산실적 관리
 */

import { Module } from '@nestjs/common';
import { JobOrderController } from './controllers/job-order.controller';
import { JobOrderService } from './services/job-order.service';
import { ProdResultController } from './controllers/prod-result.controller';
import { ProdResultService } from './services/prod-result.service';

@Module({
  imports: [],
  controllers: [
    JobOrderController,
    ProdResultController,
  ],
  providers: [
    JobOrderService,
    ProdResultService,
  ],
  exports: [
    JobOrderService,
    ProdResultService,
  ],
})
export class ProductionModule {}
