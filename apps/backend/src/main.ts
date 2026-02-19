/**
 * @file src/main.ts
 * @description NestJS 애플리케이션 엔트리 포인트
 *
 * 초보자 가이드:
 * 1. **Swagger**: /api/docs에서 API 문서 확인 가능
 * 2. **CORS**: 모든 origin 허용 (개발 환경)
 * 3. **Prefix**: 모든 API는 /api/v1으로 시작
 * 4. **포트**: 기본 3001 (환경변수로 변경 가능)
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 글로벌 prefix 설정
  app.setGlobalPrefix('api/v1');

  // CORS 활성화
  app.enableCors({
    origin: true, // 개발 환경: 모든 origin 허용
    credentials: true,
  });

  // 글로벌 파이프 - DTO 유효성 검사
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // 정의되지 않은 속성 있으면 에러
      transform: true, // 자동 타입 변환
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 글로벌 필터 - 예외 처리
  app.useGlobalFilters(new HttpExceptionFilter());

  // 글로벌 인터셉터 - 로깅 및 응답 변환
  // 프로덕션에서는 로깅 최소화
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    app.useGlobalInterceptors(new LoggingInterceptor());
  }
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger 설정
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HARNESS MES API')
    .setDescription('와이어 하네스 제조 실행 시스템 API 문서')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
      },
      'access-token',
    )
    .addTag('기준정보 - 공통코드', '공통코드 관리 API')
    .addTag('자재관리', '자재 입출고 및 재고 관리 API')
    .addTag('생산관리', '생산 계획 및 실적 관리 API')
    .addTag('품질관리', '품질 검사 관리 API')
    .addTag('설비관리', '설비 상태 및 정비 관리 API')
    .addTag('출하관리', '출하 지시 및 실적 관리 API')
    .addTag('ERP 인터페이스', 'ERP 연동 API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // 서버 시작 (포트 3003 고정)
  const port = 3003;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
