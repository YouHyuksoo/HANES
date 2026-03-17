/**
 * @file src/stores/errorStore.ts
 * @description API 에러 상세 정보를 저장하는 Zustand 스토어
 *
 * 초보자 가이드:
 * 1. API 인터셉터에서 에러 발생 시 showError()로 에러 정보 저장
 * 2. ErrorDetailModal 컴포넌트가 이 스토어를 구독하여 모달 표시
 * 3. 사용자가 에러 내용을 복사해서 개발자에게 전달 가능
 */
import { create } from "zustand";

export interface ApiErrorDetail {
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
