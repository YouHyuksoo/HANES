/**
 * @file src/modules/scheduler/config/scheduler-security.config.ts
 * @description 스케줄러 보안 설정 - 실행 가능한 서비스/스크립트/호스트 화이트리스트를 관리한다.
 *
 * 초보자 가이드:
 * 1. **ALLOWED_SERVICE_METHODS**: SERVICE 실행 유형에서 호출 가능한 메서드 화이트리스트
 * 2. **SERVICE_CLASS_MAP**: 서비스 이름 → 클래스 참조 매핑 (ModuleRef.get()에 필요)
 * 3. **SQL_ALLOWED_PATTERN**: SQL 실행 유형에서 허용되는 SQL 시작 패턴 (SELECT/DELETE만)
 * 4. **SQL_BLOCKED_KEYWORDS**: SQL에서 차단되는 위험 키워드 목록
 * 5. **getAllowedHosts()**: HTTP 실행 유형에서 허용되는 호스트 목록 (환경변수)
 * 6. **getAllowedScripts()**: SCRIPT 실행 유형에서 허용되는 스크립트 경로 (환경변수)
 * 7. **SCRIPT_ALLOWED_EXTENSIONS**: 허용되는 스크립트 확장자 (.bat, .sh)
 */

import { Type } from '@nestjs/common';

/**
 * SERVICE 실행 유형에서 호출 가능한 메서드 화이트리스트
 * 형식: 'ServiceName.methodName'
 */
export const ALLOWED_SERVICE_METHODS: string[] = [
  'InterfaceService.scheduledSyncBom',
  'InterfaceService.scheduledBulkRetry',
  'DbBackupService.runBackup',
];

/**
 * 서비스 이름 문자열 → 실제 클래스 참조 매핑
 * ModuleRef.get()은 클래스 참조가 필요하므로, 모듈 초기화 시 등록한다.
 * 순환 의존성 방지를 위해 런타임에 populate 된다.
 */
export const SERVICE_CLASS_MAP: Map<string, Type> = new Map();

/** SQL 실행 유형에서 허용되는 SQL 시작 패턴 (SELECT 또는 DELETE만) */
export const SQL_ALLOWED_PATTERN = /^\s*(SELECT|DELETE)\s/i;

/** SQL에서 차단되는 위험 키워드 목록 */
export const SQL_BLOCKED_KEYWORDS = [
  'BEGIN',
  'DROP',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'GRANT',
  'EXECUTE',
  'MERGE',
];

/**
 * HTTP 실행 유형에서 허용되는 호스트 목록 (환경변수 SCHEDULER_ALLOWED_HOSTS)
 * @returns 허용된 호스트명 배열
 */
export function getAllowedHosts(): string[] {
  return (process.env.SCHEDULER_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
}

/**
 * SCRIPT 실행 유형에서 허용되는 스크립트 경로 (환경변수 SCHEDULER_ALLOWED_SCRIPTS)
 * @returns 허용된 스크립트 절대경로 배열
 */
export function getAllowedScripts(): string[] {
  return (process.env.SCHEDULER_ALLOWED_SCRIPTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 허용되는 스크립트 확장자 */
export const SCRIPT_ALLOWED_EXTENSIONS = ['.bat', '.sh'];
