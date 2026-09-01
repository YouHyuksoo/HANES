/**
 * @file src/services/api-error-severity.ts
 * @description API 에러의 심각도 분류 - 업무 안내(notice)와 시스템 오류(system)를 구분한다.
 *
 * 배경:
 * 백엔드는 입력 검증/업무 규칙 위반도 예외로 던진다(BadRequest 872건, NotFound 320건,
 * Conflict 76건). 이를 시스템 장애(InternalServerError 9건)와 같은 창으로 보여주면
 * 사용자가 정상적인 업무 안내를 전부 "시스템이 고장났다"로 오해한다.
 * 그래서 상태코드/에러코드로 심각도를 나누고 표시 UI를 분리한다.
 *
 * axios/zustand에 의존하지 않는 순수 함수 모듈이다.
 */

/** 에러 심각도 - notice: 사용자 확인 필요 / system: 시스템 오류 */
export type ApiErrorSeverity = "notice" | "system";

/** 상태코드와 무관하게 항상 시스템 오류로 취급하는 백엔드 errorCode */
const SYSTEM_ERROR_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "UNKNOWN_ERROR",
  "DB_CONNECTION_ERROR",
]);

/** 업무 안내로 취급하는 상태코드 (사용자가 입력/조건을 고치면 해결되는 것) */
const NOTICE_STATUSES = new Set([400, 403, 404, 409, 422]);

/**
 * API 에러 심각도 분류.
 * @param status HTTP 상태코드 (네트워크 실패는 0)
 * @param errorCode 백엔드 공통 응답의 errorCode (HTTP_400, DB_CONNECTION_ERROR 등)
 */
export function classifyApiError(status: number, errorCode?: string): ApiErrorSeverity {
  if (errorCode && SYSTEM_ERROR_CODES.has(errorCode)) return "system";
  if (NOTICE_STATUSES.has(status)) return "notice";
  return "system";
}

/**
 * 안내 창 제목의 i18n 키 - 상태코드별로 사용자가 무엇을 해야 하는지 알려준다.
 * 문구 자체는 locales/{ko,en,zh,vi}.json의 apiNotice.title.* 에 있다.
 */
export function getNoticeTitleKey(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "apiNotice.title.invalidInput";
    case 403:
      return "apiNotice.title.forbidden";
    case 404:
      return "apiNotice.title.notFound";
    case 409:
      return "apiNotice.title.conflict";
    default:
      return "apiNotice.title.default";
  }
}

/**
 * 안내 창 보조 설명의 i18n 키 - 시스템 장애가 아님을 분명히 한다.
 * 문구 자체는 locales/{ko,en,zh,vi}.json의 apiNotice.hint.* 에 있다.
 */
export function getNoticeHintKey(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "apiNotice.hint.invalidInput";
    case 403:
      return "apiNotice.hint.forbidden";
    case 404:
      return "apiNotice.hint.notFound";
    case 409:
      return "apiNotice.hint.conflict";
    default:
      return "apiNotice.hint.default";
  }
}
