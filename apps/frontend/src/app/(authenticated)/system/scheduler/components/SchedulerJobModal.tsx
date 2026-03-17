"use client";

/**
 * @file system/scheduler/components/SchedulerJobModal.tsx
 * @description 스케줄러 작업 등록/수정 모달 (lg 사이즈)
 *
 * 초보자 가이드:
 * 1. **editData=null**: 신규 등록, 있으면 수정
 * 2. **execType 선택**: SERVICE/PROCEDURE/SQL/HTTP/SCRIPT 별 동적 폼
 * 3. **cronExpr**: cronstrue 라이브러리로 실시간 한국어 설명
 * 4. API: POST /scheduler/jobs (등록), PUT /scheduler/jobs/:jobCode (수정)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface SchedulerJob {
  jobCode: string;
  jobName: string;
  jobGroup: string;
  execType: string;
  cronExpr: string;
  execTarget: string | null;
  execParams: string | null;
  maxRetry: number;
  timeoutSec: number;
  description: string | null;
}

interface Props {
  editData: SchedulerJob | null;
  onClose: () => void;
  onSave: () => void;
}

interface FormState {
  jobCode: string;
  jobName: string;
  jobGroup: string;
  execType: string;
  cronExpr: string;
  maxRetry: number;
  timeoutSec: number;
  description: string;
  /* execType별 필드 */
  serviceMethod: string;
  packageProc: string;
  sqlQuery: string;
  httpMethod: string;
  httpUrl: string;
  httpHeaders: string;
  httpBody: string;
  scriptPath: string;
  scriptArgs: string;
}

const INIT: FormState = {
  jobCode: "", jobName: "", jobGroup: "", execType: "",
  cronExpr: "", maxRetry: 0, timeoutSec: 60, description: "",
  serviceMethod: "", packageProc: "", sqlQuery: "",
  httpMethod: "GET", httpUrl: "", httpHeaders: "", httpBody: "",
  scriptPath: "", scriptArgs: "",
};

const HTTP_METHODS = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "DELETE", label: "DELETE" },
];

export default function SchedulerJobModal({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<FormState>(INIT);
  const [saving, setSaving] = useState(false);
  const [cronDesc, setCronDesc] = useState("");

  /* 수정 모드 데이터 로드 */
  useEffect(() => {
    if (!editData) { setForm(INIT); return; }
    const params = parseExecParams(editData.execType, editData.execTarget, editData.execParams);
    setForm({
      jobCode: editData.jobCode,
      jobName: editData.jobName,
      jobGroup: editData.jobGroup,
      execType: editData.execType,
      cronExpr: editData.cronExpr,
      maxRetry: editData.maxRetry,
      timeoutSec: editData.timeoutSec,
      description: editData.description ?? "",
      ...params,
    });
  }, [editData]);

  /* cronstrue 한국어 설명 */
  useEffect(() => {
    if (!form.cronExpr) { setCronDesc(""); return; }
    let active = true;
    import("cronstrue/i18n").then((mod) => {
      if (!active) return;
      try {
        const desc = mod.default.toString(form.cronExpr, { locale: "ko" });
        setCronDesc(desc);
      } catch {
        setCronDesc(t("common.invalid", "잘못된 형식"));
      }
    });
    return () => { active = false; };
  }, [form.cronExpr, t]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* execParams -> 폼 필드 파싱 */
  type ExecFields = Pick<FormState, "serviceMethod" | "packageProc" | "sqlQuery" | "httpMethod" | "httpUrl" | "httpHeaders" | "httpBody" | "scriptPath" | "scriptArgs">;
  function parseExecParams(execType: string, target: string | null, params: string | null): ExecFields {
    const base: ExecFields = {
      serviceMethod: "", packageProc: "", sqlQuery: "",
      httpMethod: "GET", httpUrl: "", httpHeaders: "", httpBody: "",
      scriptPath: "", scriptArgs: "",
    };
    try {
      const p = params ? JSON.parse(params) : {};
      switch (execType) {
        case "SERVICE": base.serviceMethod = target ?? ""; break;
        case "PROCEDURE": base.packageProc = target ?? ""; break;
        case "SQL": base.sqlQuery = target ?? ""; break;
        case "HTTP":
          base.httpMethod = p.method ?? "GET";
          base.httpUrl = target ?? "";
          base.httpHeaders = p.headers ? JSON.stringify(p.headers, null, 2) : "";
          base.httpBody = p.body ? JSON.stringify(p.body, null, 2) : "";
          break;
        case "SCRIPT":
          base.scriptPath = target ?? "";
          base.scriptArgs = p.args ?? "";
          break;
      }
    } catch { /* ignore */ }
    return base;
  }

  /* 폼 -> API payload 변환 */
  const buildPayload = useCallback(() => {
    let execTarget = "";
    let execParams: string | null = null;
    switch (form.execType) {
      case "SERVICE": execTarget = form.serviceMethod; break;
      case "PROCEDURE": execTarget = form.packageProc; break;
      case "SQL": execTarget = form.sqlQuery; break;
      case "HTTP":
        execTarget = form.httpUrl;
        execParams = JSON.stringify({
          method: form.httpMethod,
          headers: form.httpHeaders ? JSON.parse(form.httpHeaders) : undefined,
          body: form.httpBody ? JSON.parse(form.httpBody) : undefined,
        });
        break;
      case "SCRIPT":
        execTarget = form.scriptPath;
        execParams = form.scriptArgs ? JSON.stringify({ args: form.scriptArgs }) : null;
        break;
    }
    return {
      jobCode: form.jobCode, jobName: form.jobName, jobGroup: form.jobGroup,
      execType: form.execType, cronExpr: form.cronExpr,
      execTarget, execParams,
      maxRetry: form.maxRetry, timeoutSec: form.timeoutSec,
      description: form.description || undefined,
    };
  }, [form]);

  const handleSave = useCallback(async () => {
    if (!form.jobCode || !form.jobName || !form.execType || !form.cronExpr) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await api.put(`/scheduler/jobs/${editData!.jobCode}`, payload);
      } else {
        await api.post("/scheduler/jobs", payload);
      }
      onSave();
      onClose();
    } catch { /* api 인터셉터에서 처리 */ }
    finally { setSaving(false); }
  }, [form, isEdit, editData, buildPayload, onSave, onClose]);

  /* execType별 동적 폼 섹션 */
  const execTypeForm = useMemo(() => {
    switch (form.execType) {
      case "SERVICE":
        return (
          <Input label={t("scheduler.serviceMethod")} value={form.serviceMethod}
            onChange={(e) => setField("serviceMethod", e.target.value)}
            placeholder="SchedulerService.cleanupLogs" fullWidth />
        );
      case "PROCEDURE":
        return (
          <Input label={t("scheduler.packageProc")} value={form.packageProc}
            onChange={(e) => setField("packageProc", e.target.value)}
            placeholder="PKG_SCHEDULER.PROC_DAILY_CLOSE" fullWidth />
        );
      case "SQL":
        return (
          <div>
            <label className="block text-xs font-medium text-text mb-1">{t("scheduler.sqlQuery")}</label>
            <textarea value={form.sqlQuery}
              onChange={(e) => setField("sqlQuery", e.target.value)}
              className="w-full h-24 text-xs font-mono border border-border rounded-md p-2 bg-background text-text resize-none focus:ring-1 focus:ring-primary"
              placeholder="DELETE FROM SCHED_LOG WHERE CREATED_AT < SYSDATE - 90" />
            <p className="text-[11px] text-text-muted mt-1">SELECT / DELETE only</p>
          </div>
        );
      case "HTTP":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Select label={t("scheduler.httpMethod")} options={HTTP_METHODS}
                value={form.httpMethod} onChange={(v) => setField("httpMethod", v)} />
              <div className="col-span-2">
                <Input label={t("scheduler.httpUrl")} value={form.httpUrl}
                  onChange={(e) => setField("httpUrl", e.target.value)}
                  placeholder="https://api.example.com/webhook" fullWidth />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text mb-1">{t("scheduler.httpHeaders")}</label>
              <textarea value={form.httpHeaders}
                onChange={(e) => setField("httpHeaders", e.target.value)}
                className="w-full h-16 text-xs font-mono border border-border rounded-md p-2 bg-background text-text resize-none focus:ring-1 focus:ring-primary"
                placeholder='{ "Authorization": "Bearer ..." }' />
            </div>
            <div>
              <label className="block text-xs font-medium text-text mb-1">{t("scheduler.httpBody")}</label>
              <textarea value={form.httpBody}
                onChange={(e) => setField("httpBody", e.target.value)}
                className="w-full h-16 text-xs font-mono border border-border rounded-md p-2 bg-background text-text resize-none focus:ring-1 focus:ring-primary"
                placeholder='{ "key": "value" }' />
            </div>
          </div>
        );
      case "SCRIPT":
        return (
          <div className="space-y-3">
            <Input label={t("scheduler.scriptPath")} value={form.scriptPath}
              onChange={(e) => setField("scriptPath", e.target.value)}
              placeholder="/opt/scripts/backup.sh" fullWidth />
            <Input label={t("scheduler.scriptArgs")} value={form.scriptArgs}
              onChange={(e) => setField("scriptArgs", e.target.value)}
              placeholder="--env production --verbose" fullWidth />
          </div>
        );
      default:
        return null;
    }
  }, [form, t]);

  const canSave = form.jobCode && form.jobName && form.execType && form.cronExpr;

  return (
    <Modal isOpen onClose={onClose} size="lg"
      title={isEdit ? t("scheduler.editJob") : t("scheduler.addJob")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("scheduler.jobCode")} value={form.jobCode}
            onChange={(e) => setField("jobCode", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            readOnly={isEdit} placeholder="DAILY_CLEANUP" fullWidth />
          <Input label={t("scheduler.jobName")} value={form.jobName}
            onChange={(e) => setField("jobName", e.target.value)} fullWidth />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="SCHED_GROUP" includeAll={false}
            label={t("scheduler.jobGroup")} value={form.jobGroup}
            onChange={(v) => setField("jobGroup", v)} fullWidth />
          <ComCodeSelect groupCode="SCHED_EXEC_TYPE" includeAll={false}
            label={t("scheduler.execType")} value={form.execType}
            onChange={(v) => setField("execType", v)} fullWidth />
        </div>

        {/* 크론표현식 */}
        <div>
          <Input label={t("scheduler.cronExpr")} value={form.cronExpr}
            onChange={(e) => setField("cronExpr", e.target.value)}
            placeholder="0 0 2 * * *" fullWidth />
          {cronDesc && (
            <p className={`text-[11px] mt-1 ${
              cronDesc === t("common.invalid", "잘못된 형식")
                ? "text-red-500 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}>
              {cronDesc}
            </p>
          )}
        </div>

        {/* execType별 동적 폼 */}
        {form.execType && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-text mb-2">{t("scheduler.execTarget")}</p>
            {execTypeForm}
          </div>
        )}

        {/* 기타 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("scheduler.maxRetry")} type="number" value={String(form.maxRetry)}
            onChange={(e) => setField("maxRetry", Number(e.target.value) || 0)} fullWidth />
          <Input label={t("scheduler.timeoutSec")} type="number" value={String(form.timeoutSec)}
            onChange={(e) => setField("timeoutSec", Number(e.target.value) || 60)} fullWidth />
        </div>

        <div>
          <label className="block text-xs font-medium text-text mb-1">{t("scheduler.description")}</label>
          <textarea value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            className="w-full h-16 text-xs border border-border rounded-md p-2 bg-background text-text resize-none focus:ring-1 focus:ring-primary"
            placeholder={t("scheduler.description")} />
        </div>
      </div>
    </Modal>
  );
}
