/**
 * @file src/modules/interface/interface.module.ts
 * @description ERP 인터페이스 모듈
 *
 * 초보자 가이드:
 * 1. **목적**: 외부 시스템 (ERP 등)과의 데이터 연동
 * 2. **주요 기능**:
 *    - ERP 주문 데이터 수신
 *    - 생산 실적 ERP 전송
 *    - 재고 동기화
 *    - 인터페이스 로그 관리
 *    - 오류 재처리
 *
 * 컨트롤러/서비스 추가 시:
 * 1. controllers/ 폴더에 컨트롤러 생성
 * 2. services/ 폴더에 서비스 생성
 * 3. 이 모듈에 등록
 */

import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class InterfaceModule {}
