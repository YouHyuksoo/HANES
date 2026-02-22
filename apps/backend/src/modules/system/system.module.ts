/**
 * @file src/modules/system/system.module.ts
 * @description 시스템관리 모듈 - 통신설정, 환경설정, 시리얼 테스트 등
 *
 * 초보자 가이드:
 * 1. **CommConfig**: 통신설정 API 엔드포인트 및 비즈니스 로직
 * 2. **SerialTest**: 시리얼 포트 목록 조회 및 통신 테스트
 * 3. **SysConfig**: 환경설정 API (선입선출, 장기재고 등 시스템 옵션 관리)
 * 4. 다른 모듈에서 SysConfigService를 주입하여 설정값 참조 가능
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommConfigController } from './controllers/comm-config.controller';
import { CommConfigService } from './services/comm-config.service';
import { SerialTestService } from './services/serial-test.service';
import { CommConfig } from '../../entities/comm-config.entity';
import { SysConfigController } from './controllers/sys-config.controller';
import { SysConfigService } from './services/sys-config.service';
import { SysConfig } from '../../entities/sys-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommConfig, SysConfig])],
  controllers: [CommConfigController, SysConfigController],
  providers: [CommConfigService, SerialTestService, SysConfigService],
  exports: [CommConfigService, SysConfigService],
})
export class SystemModule {}
