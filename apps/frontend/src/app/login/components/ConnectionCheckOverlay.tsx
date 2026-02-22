"use client";

/**
 * @file ConnectionCheckOverlay.tsx
 * @description 로그인 페이지 진입 시 서버/DB 연결 상태를 확인하는 오버레이
 *
 * 초보자 가이드:
 * 1. 백엔드 /health 엔드포인트를 호출하여 서버 + DB 상태를 확인
 * 2. 연결 단계별(서버→DB) 진행 상태를 시각적으로 표시
 * 3. 실패 시 재시도 버튼 제공, 성공 시 자동으로 사라짐
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Server,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/services/api";

type StepStatus = "pending" | "checking" | "success" | "error";

interface Step {
  id: string;
  labelKey: string;
  status: StepStatus;
  errorMsg?: string;
}

interface Props {
  onReady: () => void;
}

const INITIAL_STEPS: Step[] = [
  { id: "server", labelKey: "auth.connection.serverCheck", status: "pending" },
  { id: "database", labelKey: "auth.connection.dbCheck", status: "pending" },
];

/** 단계별 상태 아이콘 */
function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending":
      return <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
    case "checking":
      return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    case "success":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "error":
      return <XCircle className="w-5 h-5 text-red-500" />;
  }
}

/** 단계별 메인 아이콘 */
function MainIcon({ id, status }: { id: string; status: StepStatus }) {
  const color = status === "error"
    ? "text-red-400"
    : status === "success"
      ? "text-green-500"
      : status === "checking"
        ? "text-primary"
        : "text-gray-400 dark:text-gray-500";
  const Icon = id === "server" ? Server : Database;
  return <Icon className={`w-6 h-6 ${color}`} />;
}

export default function ConnectionCheckOverlay({ onReady }: Props) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [hasError, setHasError] = useState(false);
  const didRun = useRef(false);

  const update = (id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runCheck = async () => {
    setHasError(false);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));

    // Step 1: 서버 연결
    update("server", { status: "checking" });
    try {
      const res = await api.get("/health", { timeout: 10000 });
      // 응답 형태: { success, data: { status, database, ... } }
      const health = res.data?.data ?? res.data;
      update("server", { status: "success" });

      // Step 2: DB 연결 (health 응답 내 database.status 확인)
      update("database", { status: "checking" });
      await new Promise((r) => setTimeout(r, 300));

      if (health.database?.status === "connected") {
        update("database", { status: "success" });
        await new Promise((r) => setTimeout(r, 400));
        onReady();
      } else {
        update("database", {
          status: "error",
          errorMsg: health.database?.error || t("auth.connection.dbDisconnected"),
        });
        setHasError(true);
      }
    } catch {
      update("server", {
        status: "error",
        errorMsg: t("auth.connection.serverUnreachable"),
      });
      setHasError(true);
    }
  };

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    runCheck();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-xl p-8">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Server className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-text">
            {t("auth.connection.title")}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {t("auth.connection.subtitle")}
          </p>
        </div>

        {/* 체크 단계 */}
        <div className="space-y-3 mb-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                step.status === "error"
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : step.status === "success"
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : step.status === "checking"
                      ? "bg-primary/5 border border-primary/20"
                      : "bg-gray-50 dark:bg-gray-800/50 border border-transparent"
              }`}
            >
              <MainIcon id={step.id} status={step.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{t(step.labelKey)}</p>
                {step.errorMsg && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate">
                    {step.errorMsg}
                  </p>
                )}
              </div>
              <StepIcon status={step.status} />
            </div>
          ))}
        </div>

        {/* 에러 시 재시도 */}
        {hasError && (
          <div className="text-center space-y-3">
            <p className="text-sm text-text-muted">
              {t("auth.connection.retryDesc")}
            </p>
            <Button onClick={runCheck} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("auth.connection.retry")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
