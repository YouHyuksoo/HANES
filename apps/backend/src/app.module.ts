/**
 * @file src/app.module.ts
 * @description 애플리케이션 루트 모듈
 *
 * 초보자 가이드:
 * 1. **ConfigModule**: 환경변수 로드 (.env 파일)
 * 2. **PrismaModule**: 데이터베이스 연결 (글로벌)
 * 3. **기능 모듈**: 각 도메인별 모듈 import
 *
 * 모듈 추가 시:
 * - imports 배열에 새 모듈 추가
 * - 기능별로 modules 폴더에 모듈 생성
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import configuration from './config/configuration';

// 기능 모듈
import { MasterModule } from './modules/master/master.module';
import { MaterialModule } from './modules/material/material.module';
import { ProductionModule } from './modules/production/production.module';
import { QualityModule } from './modules/quality/quality.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { InterfaceModule } from './modules/interface/interface.module';

@Module({
  imports: [
    // 환경변수 설정 (글로벌)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
    }),

    // 데이터베이스 (글로벌)
    PrismaModule,

    // ===== 기능 모듈 =====

    // 기준정보 관리 (공통코드, 품목, 거래처, 공정 등)
    MasterModule,

    // 자재관리 (입고, 출고, 재고, LOT 추적)
    MaterialModule,

    // 생산관리 (계획, 작업지시, 실적, 바코드)
    ProductionModule,

    // 품질관리 (수입검사, 공정검사, 출하검사)
    QualityModule,

    // 설비관리 (설비 마스터, 상태, 정비)
    EquipmentModule,

    // 출하관리 (출하지시, 실적, 배송)
    ShippingModule,

    // ERP 인터페이스 (데이터 연동)
    InterfaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
