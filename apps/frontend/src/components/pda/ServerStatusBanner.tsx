"use client";

/**
 * @file src/components/pda/ServerStatusBanner.tsx
 * @description 서버 연결 상태 배너 — API 오류(503, 타임아웃 등) 감지 시 안내 표시
 *
 * 초보자 가이드:
 * 1. axios 인터셉터로 503/네트워크 에러 감지
 * 2. 서버 오류 시 빨간 배너 상단 고정 표시
 * 3. "다시 시도" 버튼으로 수동 재확인
 * 4. 정상 복구 시 자동으로 배너 사라짐
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ServerCrash, RefreshCw } from "lucide-react";
import { api } from "@/services/api";

export default function ServerStatusBanner() {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const errorCountRef = useRef(0);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => {
        errorCountRef.current = 0;
        if (serverError) setServerError(false);
        return response;
      },
      (error) => {
        const status = error?.response?.status;
        const isNetworkError = !error.response && error.code !== "ERR_CANCELED";
        const isServerError =
          status === 500 || status === 502 || status === 503 || status === 504;

        if (isNetworkError || isServerError) {
          errorCountRef.current += 1;
          setServerError(true);
        }
        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [serverError]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await api.get("/auth/me");
      errorCountRef.current = 0;
      setServerError(false);
    } catch {
      /* still down */
    } finally {
      setRetrying(false);
    }
  }, []);

  if (!serverError) return null;

  return (
    <div
      role="alert"
      className="w-full px-4 py-3 flex items-center justify-between bg-red-600 dark:bg-red-700 text-white text-sm"
    >
      <div className="flex items-center gap-2">
        <ServerCrash className="w-4 h-4 shrink-0" />
        <span>{t("pda.server.error")}</span>
      </div>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-xs font-medium disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
        {t("pda.server.retry")}
      </button>
    </div>
  );
}
