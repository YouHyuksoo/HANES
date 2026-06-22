"use client";

/**
 * @file src/components/system/AiConfigPanel.tsx
 * @description system/config의 AI 탭 전용 설정 패널
 *  - provider(Mistral/OpenAI)·모델 드롭다운, API 키 입력, 연결 테스트, 저장
 *  - 저장: PUT /system/configs/bulk (AI_PROVIDER/AI_MODEL/AI_ENABLED/AI_{provider}_KEY)
 *  - 키를 비우면 서버 .env로 폴백. 키 원문은 조회되지 않는다(keyConfigured만).
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, LoaderCircle, Save, Plug } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { api } from "@/services/api";
import toast from "react-hot-toast";

const PROVIDER_OPTIONS = [
  { value: "mistral", label: "Mistral" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
];

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  mistral: [
    { value: "mistral-large-latest", label: "mistral-large-latest" },
    { value: "mistral-small-latest", label: "mistral-small-latest" },
    { value: "mistral-medium-latest", label: "mistral-medium-latest" },
    { value: "open-mistral-7b", label: "open-mistral-7b" },
  ],
  openai: [
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4-turbo", label: "gpt-4-turbo" },
    { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
  ],
  openrouter: [
    { value: "openai/gpt-oss-120b:free", label: "openai/gpt-oss-120b:free" },
    { value: "meta-llama/llama-3.3-70b-instruct:free", label: "meta-llama/llama-3.3-70b-instruct:free" },
    { value: "qwen/qwen3-coder:free", label: "qwen/qwen3-coder:free" },
    { value: "deepseek/deepseek-chat-v3-0324", label: "deepseek/deepseek-chat-v3-0324 (유료)" },
  ],
};

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function AiConfigPanel() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState("mistral");
  const [model, setModel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const st = await api.get("/ai/status");
      setKeyConfigured(!!st.data?.data?.keyConfigured);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/system/configs", { params: { configGroup: "AI" } });
        const raw = res.data?.data;
        const list = (raw?.data ?? (Array.isArray(raw) ? raw : [])) as { configKey: string; configValue: string }[];
        const map = Object.fromEntries(list.map((c) => [c.configKey, c.configValue]));
        const p = (map.AI_PROVIDER || "mistral").trim();
        setProvider(p);
        setModel((map.AI_MODEL || MODEL_OPTIONS[p]?.[0]?.value || "").trim());
        setEnabled((map.AI_ENABLED ?? "Y") === "Y");
        await refreshStatus();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshStatus]);

  const modelOptions = useMemo(() => MODEL_OPTIONS[provider] ?? [], [provider]);

  const onProviderChange = useCallback((p: string) => {
    setProvider(p);
    setModel(MODEL_OPTIONS[p]?.[0]?.value || "");
    setApiKey("");
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post("/ai/test", { provider, model, apiKey: apiKey.trim() || undefined });
      setTestResult(res.data?.data ?? { ok: false, message: "실패" });
    } catch (e) {
      setTestResult({ ok: false, message: errMessage(e, t("common.error", "오류")) });
    } finally {
      setTesting(false);
    }
  }, [provider, model, apiKey, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const items: { id: string; configValue: string }[] = [
        { id: "AI_PROVIDER", configValue: provider },
        { id: "AI_MODEL", configValue: model },
        { id: "AI_ENABLED", configValue: enabled ? "Y" : "N" },
      ];
      if (apiKey.trim()) items.push({ id: `AI_${provider.toUpperCase()}_KEY`, configValue: apiKey.trim() });
      await api.put("/system/configs/bulk", { items });
      toast.success(t("common.saved", "저장되었습니다."));
      setApiKey("");
      await refreshStatus();
    } catch (e) {
      toast.error(errMessage(e, t("common.error", "오류")));
    } finally {
      setSaving(false);
    }
  }, [provider, model, enabled, apiKey, refreshStatus, t]);

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-text-muted">{t("common.loading", "불러오는 중...")}</CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="max-w-xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-text">{t("ai.config.provider", "AI 제공자")}</span>
            <Select options={PROVIDER_OPTIONS} value={provider} onChange={onProviderChange} fullWidth />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-text">{t("ai.config.model", "모델")}</span>
            <Select options={modelOptions} value={model} onChange={setModel} fullWidth />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t("ai.config.enabled", "AI 채팅 활성화")}
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-text">{t("ai.config.apiKey", "API 키")}</span>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyConfigured
              ? t("ai.config.keySetPlaceholder", "설정됨 — 변경하려면 새 키 입력")
              : t("ai.config.keyEmptyPlaceholder", "키 입력 (비우면 서버 .env 사용)")}
            fullWidth
          />
          <span className={`mt-1 inline-flex items-center gap-1 text-xs ${keyConfigured ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
            {keyConfigured ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {keyConfigured ? t("ai.config.keyConfigured", "키가 설정되어 있습니다.") : t("ai.config.keyMissing", "키가 설정되지 않았습니다.")}
          </span>
        </label>

        {testResult && (
          <div className={`rounded-lg border px-3 py-2 text-sm ${testResult.ok ? "border-green-500 text-green-700 dark:text-green-400" : "border-red-500 text-red-700 dark:text-red-400"}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={handleTest} disabled={testing || saving}>
            {testing ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
            {t("ai.config.test", "연결 테스트")}
          </Button>
          <Button onClick={handleSave} disabled={saving || testing}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? t("common.saving", "저장 중...") : t("common.save", "저장")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
