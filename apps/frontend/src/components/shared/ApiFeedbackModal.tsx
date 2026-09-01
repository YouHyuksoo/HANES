"use client";

/**
 * @file src/components/shared/ApiFeedbackModal.tsx
 * @description API 응답 피드백 창의 단일 진입점 - severity에 따라 표시할 창을 고른다.
 *
 * 초보자 가이드:
 * 1. errorStore를 구독하는 유일한 컴포넌트다. providers.tsx에 한 번만 마운트한다.
 * 2. severity가 notice면 업무 안내 창, system이면 시스템 오류 창을 띄운다.
 *    두 창이 동시에 뜨지 않도록 여기서 배타적으로 분기한다.
 * 3. severity 판정 규칙은 services/api-error-severity.ts에 있다.
 */
import { useErrorStore } from "@/stores/errorStore";
import ApiNoticeModal from "./ApiNoticeModal";
import ErrorDetailModal from "./ErrorDetailModal";

export default function ApiFeedbackModal() {
  const { error, clearError } = useErrorStore();

  if (!error) return null;

  if (error.severity === "notice") {
    return <ApiNoticeModal notice={error} onClose={clearError} />;
  }

  return <ErrorDetailModal error={error} onClose={clearError} />;
}
