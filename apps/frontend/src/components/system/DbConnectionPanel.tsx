"use client";

/**
 * @file src/components/system/DbConnectionPanel.tsx
 * @description system/config의 DB 접속 탭 — .env 접속값 편집·연결 테스트·저장·백엔드 재시작.
 *
 * 접속 설정의 단일 출처는 apps/backend/.env 이며 이 화면이 그 파일을 편집한다.
 * 저장은 연결 테스트를 통과한 경우에만 이뤄지고, 반영은 재시작 후다.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Database, Plug, RotateCcw, Save } from "lucide-react";
import { Button, Card, CardContent, ConfirmModal, Input, Select } from "@/components/ui";
import { api } from "@/services/api";
import toast from "react-hot-toast";

interface DbConnectionStatus {
  host: string;
  port: number;
  username: string;
  passwordMasked: string;
  sid?: string;
  serviceName?: string;
  envFile: string;
  restartRequired: boolean;
}

interface TestResult {
  success: boolean;
  message?: string;
  code?: string;
  hint?: string;
}

type ConnectMode = "SERVICE" | "SID";

function payload<T>(res: { data?: { data?: T } }): T {
  return (res.data?.data ?? res.data) as T;
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
    if (error instanceof Error) return error.message;
  }
  return fallback;
}

export default function DbConnectionPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DbConnectionStatus | null>(null);
  const [mode, setMode] = useState<ConnectMode>("SERVICE");
  const [form, setForm] = useState({
    host: "",
    port: "1521",
    username: "",
    password: "",
    sid: "",
    serviceName: "",
  });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const refreshStatus = useCallback(async () => {
    const res = await api.get("/system/db-connection/status");
    const next = payload<DbConnectionStatus>(res);
    setStatus(next);
    setMode(next.sid ? "SID" : "SERVICE");
    setForm({
      host: next.host,
      port: String(next.port),
      username: next.username,
      // 비밀번호는 서버가 내려주지 않는다. 비워두면 기존 값을 유지한다.
      password: "",
      sid: next.sid ?? "",
      serviceName: next.serviceName ?? "",
    });
  }, []);

  useEffect(() => {
    refreshStatus().catch((error: unknown) => {
      toast.error(errorMessage(error, t("system.dbConnection.loadFailed")));
    });
  }, [refreshStatus, t]);

  const buildBody = () => ({
    host: form.host.trim(),
    port: Number(form.port),
    username: form.username.trim(),
    ...(form.password ? { password: form.password } : {}),
    ...(mode === "SID"
      ? { sid: form.sid.trim() }
      : { serviceName: form.serviceName.trim() }),
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.post("/system/db-connection/test", buildBody());
      const result = payload<TestResult>(res);
      setTestResult(result);
      if (result.success) toast.success(t("system.dbConnection.testSuccess"));
      else toast.error(result.hint ?? result.message ?? t("system.dbConnection.testFailed"));
    } catch (error: unknown) {
      toast.error(errorMessage(error, t("system.dbConnection.testFailed")));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await api.put("/system/db-connection", buildBody());
      const saved = payload<{ envFile: string; backupFile: string }>(res);
      toast.success(t("system.dbConnection.saved", { file: saved.backupFile }));
      setForm((prev) => ({ ...prev, password: "" }));
      await refreshStatus();
    } catch (error: unknown) {
      toast.error(errorMessage(error, t("system.dbConnection.saveFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await api.post("/system/db-connection/restart");
      toast.success(t("system.dbConnection.restartRequested"));
      setShowRestartConfirm(false);
    } catch (error: unknown) {
      toast.error(errorMessage(error, t("system.dbConnection.restartFailed")));
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <Card padding="none">
      <CardContent className="p-4 space-y-4">
        {/* 액션 버튼은 상단 배치 (우측 폼 패널 표준) */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-text-muted" />
            <div>
              <div className="text-sm font-medium text-text">{t("system.dbConnection.title")}</div>
              <div className="text-xs text-text-muted">
                {t("system.dbConnection.sourceFile", { file: status?.envFile ?? ".env" })}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleTest} isLoading={isTesting}>
              <Plug className="w-4 h-4 mr-1" />
              {t("system.dbConnection.test")}
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-1" />
              {t("common.save")}
            </Button>
            <Button variant="danger" onClick={() => setShowRestartConfirm(true)}>
              <RotateCcw className="w-4 h-4 mr-1" />
              {t("system.dbConnection.restart")}
            </Button>
          </div>
        </div>

        {status?.restartRequired && (
          <div className="border border-warning/60 px-3 py-2 text-sm text-warning">
            {t("system.dbConnection.restartRequired")}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label={t("system.dbConnection.host")}
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
          />
          <Input
            label={t("system.dbConnection.port")}
            value={form.port}
            onChange={(e) => setForm({ ...form, port: e.target.value.replace(/[^0-9]/g, "") })}
          />
          <Input
            label={t("system.dbConnection.username")}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <Input
            label={t("system.dbConnection.password")}
            type="password"
            placeholder={t("system.dbConnection.passwordKeep")}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select
            label={t("system.dbConnection.mode")}
            value={mode}
            onChange={(value) => setMode(value as ConnectMode)}
            options={[
              { value: "SERVICE", label: t("system.dbConnection.modeService") },
              { value: "SID", label: t("system.dbConnection.modeSid") },
            ]}
          />
          {mode === "SID" ? (
            <Input
              label="SID"
              value={form.sid}
              onChange={(e) => setForm({ ...form, sid: e.target.value })}
            />
          ) : (
            <Input
              label={t("system.dbConnection.serviceName")}
              value={form.serviceName}
              onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
            />
          )}
        </div>

        {testResult && (
          <div
            className={`border px-3 py-2 text-sm ${
              testResult.success ? "border-success/60 text-success" : "border-danger/60 text-danger"
            }`}
          >
            {testResult.success
              ? t("system.dbConnection.testSuccess")
              : `${testResult.code ?? ""} ${testResult.hint ?? testResult.message ?? ""}`.trim()}
          </div>
        )}

        <p className="text-xs text-text-muted">{t("system.dbConnection.notice")}</p>
      </CardContent>

      <ConfirmModal
        isOpen={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={handleRestart}
        title={t("system.dbConnection.restart")}
        message={t("system.dbConnection.restartConfirm")}
        confirmText={t("system.dbConnection.restart")}
        variant="danger"
        isLoading={isRestarting}
      />
    </Card>
  );
}
