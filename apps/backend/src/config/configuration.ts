/**
 * @file src/config/configuration.ts
 * @description 애플리케이션 환경설정 모듈
 *
 * 초보자 가이드:
 * 1. **목적**: 환경변수를 타입 안전하게 관리
 * 2. **사용법**: ConfigService.get<T>('key')로 접근
 * 3. **검증**: Joi 등으로 환경변수 유효성 검사 가능
 *
 * 환경변수 추가 시:
 * 1. .env 파일에 변수 추가
 * 2. 이 파일에 매핑 추가
 * 3. .env.example에 예시 추가
 */

/**
 * 애플리케이션 설정 인터페이스
 */
export interface AppConfig {
  /** 실행 환경 (development, production, test) */
  nodeEnv: string;
  /** 서버 포트 */
  port: number;
  /** API 버전 prefix */
  apiPrefix: string;
}

/**
 * 데이터베이스 설정 인터페이스
 */
export interface DatabaseConfig {
  /** Prisma 연결 URL (Transaction pooler) */
  url: string;
  /** Direct 연결 URL (Migration용) */
  directUrl: string;
}

/**
 * JWT 설정 인터페이스
 */
export interface JwtConfig {
  /** JWT 시크릿 키 */
  secret: string;
  /** Access Token 만료 시간 */
  accessExpiresIn: string;
  /** Refresh Token 만료 시간 */
  refreshExpiresIn: string;
}

/**
 * CORS 설정 인터페이스
 */
export interface CorsConfig {
  /** 허용할 origin 목록 */
  origins: string[];
  /** credentials 허용 여부 */
  credentials: boolean;
}

/**
 * 전체 설정 인터페이스
 */
export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
}

/**
 * 환경변수를 Configuration 객체로 변환
 */
export default (): Configuration => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
  },
  database: {
    url: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'harness-mes-secret-key-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
});
