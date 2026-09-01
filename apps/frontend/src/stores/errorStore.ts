/**
 * @file src/stores/errorStore.ts
 * @description API 에러 상세 정보를 저장하는 Zustand 스토어
 *
 * 초보자 가이드:
 * 1. API 인터셉터에서 에러 발생 시 showError()로 에러 정보 저장
 * 2. ApiFeedbackModal 컴포넌트가 이 스토어를 구독하여 severity에 맞는 창을 표시
 *    - notice: 업무 안내 창(ApiNoticeModal) - 입력/권한/중복 등 사용자가 조치 가능한 건
 *    - system: 시스템 오류 창(ErrorDetailModal) - 상세 정보 + 복사 후 담당자 전달
 * 3. severity 판정은 services/api-error-severity.ts 단일 출처
 */
import { create } from "zustand";
import type { ApiErrorSeverity } from "@/services/api-error-severity";

export interface ApiErrorDetail {
  /** 심각도 - notice(업무 안내) / system(시스템 오류). 표시할 창을 결정한다. */
  severity: ApiErrorSeverity;
  /** 에러 발생 시각 (로컬 시간 문자열) */
  timestamp: string;
  /** HTTP 메서드 (GET, POST, PUT, DELETE 등) */
  method: string;
  /** 요청 URL 경로 */
  url: string;
  /** HTTP 상태 코드 */
  status: number;
  /** 서버가 반환한 에러 메시지 */
  message: string;
  /** 백엔드 공통 응답의 errorCode (HTTP_400, DB_CONNECTION_ERROR 등) */
  errorCode?: string;
  /** 서버 응답 전문 (JSON) */
  responseBody: string;
  /** 요청 바디 (POST/PUT 등) */
  requestBody?: string;
}

interface ErrorStore {
  /** 현재 표시할 에러 (null이면 모달 숨김) */
  error: ApiErrorDetail | null;
  /** 에러 모달 표시 */
  showError: (error: ApiErrorDetail) => void;
  /** 에러 모달 닫기 */
  clearError: () => void;
}

export const useErrorStore = create<ErrorStore>((set) => ({
  error: null,
  showError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
