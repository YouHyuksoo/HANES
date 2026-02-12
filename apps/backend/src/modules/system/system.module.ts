/**
 * @file src/modules/system/system.module.ts
 * @description 시스템관리 모듈 - 통신설정 등 시스템 관련 기능
 *
 * 초보자 가이드:
 * 1. **CommConfigController**: 통신설정 API 엔드포인트
 * 2. **CommConfigService**: 통신설정 비즈니스 로직
 * 3. 다른 모듈에서 CommConfigService를 사용하려면 exports에서 가져오기
 */

import { Module } from '@nestjs/common';
import { CommConfigController } from './controllers/comm-config.controller';
import { CommConfigService } from './services/comm-config.service';

@Module({
  controllers: [CommConfigController],
  providers: [CommConfigService],
  exports: [CommConfigService],
})
export class SystemModule {}
