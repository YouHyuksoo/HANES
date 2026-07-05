"use client";

/**
 * @file src/components/system/AiEmbeddingPanel.tsx
 * @description system/config의 Embedding 탭 전용 패널 — 청킹/임베딩 설정, 연결 테스트, 재색인, 검색 테스트.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Database, FileText, Folder, LoaderCircle, Play, Plug, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { api } from "@/services/api";
import toast from "react-hot-toast";

const EMBEDDING_PROVIDER_OPTIONS = [
  { value: "mistral", label: "Mistral" },
  { value: "openai", label: "OpenAI" },
];

const EMBEDDING_MODEL_OPTIONS: Record<string, { value: string; label: string; dims: string }[]> = {
  mistral: [{ value: "mistral-embed", label: "mistral-embed (1024)", dims: "1024" }],
  openai: [
    { value: "text-embedding-3-small", label: "text-embedding-3-small (1536)", dims: "1536" },
    { value: "text-embedding-3-large", label: "text-embedding-3-large (3072)", dims: "3072" },
  ],
};

// v2: 백엔드 DEFAULT_KNOWLEDGE_TARGETS(ai-knowledge.service.ts)와 동일 집합으로 맞춤.
// 두 목록은 같은 개념이므로 폴더 추가/개명 시 양쪽을 함께 갱신한다.
const KNOWLEDGE_TARGET_STORAGE_KEY = "hanes.aiEmbedding.chunkTargets.v2";
const DEFAULT_KNOWLEDGE_TARGETS = [
  { path: "apps/frontend/public/help/user/ko", label: "사용자 도움말" },
  { path: "apps/frontend/public/help/operator/ko", label: "작업자 도움말" },
  { path: "docs/standards", label: "표준 문서" },
  { path: "docs/design", label: "디자인 시스템" },
  { path: "docs/architecture", label: "아키텍처" },
  { path: "docs/database", label: "DB 스키마/ERD" },
  { path: "docs/specs", label: "사양 문서" },
  { path: "docs/plans", label: "계획 문서" },
  { path: "docs/workflows/definitions", label: "워크플로우 정의" },
  { path: "docs/business-logics", label: "비즈니스 로직" },
];
const DEFAULT_KNOWLEDGE_TARGET_LABELS = new Map(DEFAULT_KNOWLEDGE_TARGETS.map((target) => [target.path, target.label]));

type ConfigRow = { configKey: string; configValue: string };
type ChunkTarget = { path: string; label: string };
type ConfigMeta = {
  label: string;
  description: string;
  configType?: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  options?: string;
  sortOrder?: number;
};
type KnowledgeStatus = {
  dbPath?: string;
  dbDirectory?: string;
  dbFileName?: string;
  dbExists?: boolean;
  dbSizeBytes?: number;
  configuredDbPath?: string | null;
  usesDefaultDbPath?: boolean;
  envKey?: string;
  vectorEnabled?: boolean;
  sqliteVecStatus?: string;
  vectorTableExists?: boolean;
  ftsTableExists?: boolean;
  vectorDims?: number | null;
  vectorRows?: number | null;
  ftsRows?: number | null;
  embeddingRows?: number | null;
  lastReindexAt?: string | null;
  chunks?: number;
  provider?: string;
  model?: string;
  dims?: number;
  realEmbeddingProvider?: boolean;
};
type ReindexResult = {
  ok?: boolean;
  vectorEnabled?: boolean;
  targets?: string[];
  documents?: number;
  chunks?: number;
  embedded?: number;
  reused?: number;
  provider?: string;
  model?: string;
  dims?: number;
};
type SearchResult = {
  chunkId: string;
  score: number;
  sourcePath: string;
  menuCode?: string | null;
  title?: string | null;
  heading?: string | null;
  summary?: string | null;
  content: string;
};

function payload<T>(res: { data?: { data?: T } } | { data?: T }): T {
  return ((res as { data?: { data?: T } }).data?.data ?? (res as { data?: T }).data) as T;
}

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

function formatBytes(value?: number | null): string {
  if (value === undefined || value === null) return "-";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** index;
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function normalizeTargetPath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function toChunkTarget(pathValue: string): ChunkTarget | null {
  const path = normalizeTargetPath(pathValue);
  if (!path || path === "." || path.split("/").includes("..") || /^[a-zA-Z]:/.test(path)) return null;
  return { path, label: DEFAULT_KNOWLEDGE_TARGET_LABELS.get(path) ?? path };
}

function loadStoredChunkTargets(): { targets: ChunkTarget[]; selectedPaths: string[] } {
  const fallback = {
    targets: DEFAULT_KNOWLEDGE_TARGETS,
    selectedPaths: DEFAULT_KNOWLEDGE_TARGETS.map((target) => target.path),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_TARGET_STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as { targets?: string[]; selectedPaths?: string[] };
    const targets = Array.from(new Set((stored.targets ?? []).map(normalizeTargetPath)))
      .map(toChunkTarget)
      .filter((target): target is ChunkTarget => !!target);
    return {
      targets,
      selectedPaths: (stored.selectedPaths ?? []).map(normalizeTargetPath).filter((path) => targets.some((target) => target.path === path)),
    };
  } catch {
    return fallback;
  }
}

export default function AiEmbeddingPanel() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState("mistral");
  const [model, setModel] = useState("mistral-embed");
  const [dims, setDims] = useState("1024");
  const [apiKey, setApiKey] = useState("");
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [reindexResult, setReindexResult] = useState<ReindexResult | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("출하지시 확정취소 언제 가능해?");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [chunkTargets, setChunkTargets] = useState<ChunkTarget[]>(DEFAULT_KNOWLEDGE_TARGETS);
  const [selectedTargetPaths, setSelectedTargetPaths] = useState<Set<string>>(() => new Set(DEFAULT_KNOWLEDGE_TARGETS.map((target) => target.path)));
  const [newTargetPath, setNewTargetPath] = useState("");
  const [addMode, setAddMode] = useState<"file" | "folder">("file");
  const [chunkTargetsLoaded, setChunkTargetsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [searching, setSearching] = useState(false);

  const modelOptions = useMemo(() => EMBEDDING_MODEL_OPTIONS[provider] ?? [], [provider]);
  const selectedTargets = useMemo(
    () => chunkTargets.filter((target) => selectedTargetPaths.has(target.path)),
    [chunkTargets, selectedTargetPaths],
  );

  const refreshStatus = useCallback(async () => {
    const res = await api.get("/ai/knowledge/status");
    setStatus(payload<KnowledgeStatus>(res));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [configRes] = await Promise.all([
          api.get("/system/configs", { params: { configGroup: "AI" } }),
          refreshStatus().catch(() => undefined),
        ]);
        const raw = configRes.data?.data;
        const list = (raw?.data ?? (Array.isArray(raw) ? raw : [])) as ConfigRow[];
        const map = Object.fromEntries(list.map((c) => [c.configKey, c.configValue]));
        const p = (map.AI_EMBEDDING_PROVIDER || map.AI_PROVIDER || "mistral").trim();
        const m = (map.AI_EMBEDDING_MODEL || EMBEDDING_MODEL_OPTIONS[p]?.[0]?.value || "mistral-embed").trim();
        const d = (map.AI_EMBEDDING_DIMS || EMBEDDING_MODEL_OPTIONS[p]?.find((opt) => opt.value === m)?.dims || "1024").trim();
        setExistingKeys(new Set(list.map((c) => c.configKey)));
        setProvider(p);
        setModel(m);
        setDims(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshStatus]);

  useEffect(() => {
    const stored = loadStoredChunkTargets();
    setChunkTargets(stored.targets);
    setSelectedTargetPaths(new Set(stored.selectedPaths));
    setChunkTargetsLoaded(true);
  }, []);

  useEffect(() => {
    if (!chunkTargetsLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(KNOWLEDGE_TARGET_STORAGE_KEY, JSON.stringify({
      targets: chunkTargets.map((target) => target.path),
      selectedPaths: Array.from(selectedTargetPaths),
    }));
  }, [chunkTargets, selectedTargetPaths, chunkTargetsLoaded]);

  const onProviderChange = useCallback((nextProvider: string) => {
    const first = EMBEDDING_MODEL_OPTIONS[nextProvider]?.[0];
    setProvider(nextProvider);
    setModel(first?.value || "");
    setDims(first?.dims || "1024");
    setApiKey("");
    setTestResult(null);
  }, []);

  const onModelChange = useCallback((nextModel: string) => {
    setModel(nextModel);
    const option = EMBEDDING_MODEL_OPTIONS[provider]?.find((item) => item.value === nextModel);
    if (option) setDims(option.dims);
  }, [provider]);

  const upsertConfig = useCallback(async (key: string, configValue: string, meta: ConfigMeta) => {
    if (existingKeys.has(key)) {
      await api.patch(`/system/configs/${key}`, {
        configValue,
        label: meta.label,
        description: meta.description,
        options: meta.options,
        sortOrder: meta.sortOrder,
        isActive: "Y",
      });
      return;
    }
    await api.post("/system/configs", {
      configGroup: "AI",
      configKey: key,
      configValue,
      configType: meta.configType ?? "TEXT",
      label: meta.label,
      description: meta.description,
      options: meta.options,
      sortOrder: meta.sortOrder ?? 0,
    });
    setExistingKeys((prev) => new Set(prev).add(key));
  }, [existingKeys]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const providerOptions = JSON.stringify(EMBEDDING_PROVIDER_OPTIONS.map(({ value, label }) => ({ value, label })));
      await Promise.all([
        upsertConfig("AI_EMBEDDING_PROVIDER", provider, {
          label: "Embedding 제공자",
          description: "도움말/설계문서 RAG 검색에 사용할 embedding 제공자입니다. LLM 제공자와 별개로 설정합니다.",
          configType: "SELECT",
          options: providerOptions,
          sortOrder: 20,
        }),
        upsertConfig("AI_EMBEDDING_MODEL", model, {
          label: "Embedding 모델",
          description: "문서 chunk와 사용자 질문을 벡터화할 embedding 모델입니다.",
          configType: "TEXT",
          sortOrder: 21,
        }),
        upsertConfig("AI_EMBEDDING_DIMS", dims, {
          label: "Embedding 차원",
          description: "sqlite-vec vector table 차원입니다. 모델 변경 후 지식 인덱스 재생성을 실행해야 적용됩니다.",
          configType: "NUMBER",
          sortOrder: 22,
        }),
      ]);
      if (apiKey.trim()) {
        await upsertConfig(`AI_${provider.toUpperCase()}_KEY`, apiKey.trim(), {
          label: `${provider.toUpperCase()} API 키`,
          description: "AI API 키입니다. LLM과 embedding이 같은 provider면 같은 키를 공유합니다.",
          configType: "TEXT",
          sortOrder: 31,
        });
      }
      toast.success(t("common.saved", "저장되었습니다."));
      setApiKey("");
      await refreshStatus().catch(() => undefined);
    } catch (e) {
      toast.error(errMessage(e, t("common.error", "오류")));
    } finally {
      setSaving(false);
    }
  }, [provider, model, dims, apiKey, upsertConfig, refreshStatus, t]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post("/ai/embedding/test", {
        provider,
        model,
        dims,
        apiKey: apiKey.trim() || undefined,
      });
      setTestResult(payload<{ ok: boolean; message: string }>(res));
    } catch (e) {
      setTestResult({ ok: false, message: errMessage(e, t("common.error", "오류")) });
    } finally {
      setTesting(false);
    }
  }, [provider, model, dims, apiKey, t]);

  const handleReindex = useCallback(async () => {
    if (selectedTargets.length === 0) {
      toast.error("청킹 대상을 하나 이상 선택하세요.");
      return;
    }
    setReindexing(true);
    setReindexResult(null);
    try {
      const res = await api.post("/ai/knowledge/reindex", {
        targets: selectedTargets.map((target) => target.path),
      }, {
        timeout: 10 * 60 * 1000,
        suppressErrorModal: true,
        skipSuccessToast: true,
      });
      const result = payload<ReindexResult>(res);
      setReindexResult(result);
      toast.success(`인덱스 재생성 완료: ${result.chunks ?? 0} chunks`);
      await refreshStatus();
    } catch (e) {
      const message = (e as { code?: string })?.code === "ECONNABORTED"
        ? "인덱스 재생성이 제한시간을 초과했습니다. 잠시 후 상태를 새로고침해 완료 여부를 확인하세요."
        : errMessage(e, "인덱스 재생성 실패");
      toast.error(message);
    } finally {
      setReindexing(false);
    }
  }, [refreshStatus, selectedTargets]);

  const handleToggleTarget = useCallback((targetPath: string) => {
    setSelectedTargetPaths((prev) => {
      const next = new Set(prev);
      if (next.has(targetPath)) next.delete(targetPath);
      else next.add(targetPath);
      return next;
    });
  }, []);

  const handleAddTarget = useCallback(() => {
    const target = toChunkTarget(newTargetPath);
    if (!target) {
      toast.error("프로젝트 상대경로만 입력하세요.");
      return;
    }
    setChunkTargets((prev) => {
      if (prev.some((item) => item.path === target.path)) return prev;
      return [...prev, target];
    });
    setSelectedTargetPaths((prev) => new Set(prev).add(target.path));
    setNewTargetPath("");
  }, [newTargetPath]);

  const handleDeleteTarget = useCallback((targetPath: string) => {
    setChunkTargets((prev) => prev.filter((target) => target.path !== targetPath));
    setSelectedTargetPaths((prev) => {
      const next = new Set(prev);
      next.delete(targetPath);
      return next;
    });
  }, []);

  const handleRestoreDefaultTargets = useCallback(() => {
    setChunkTargets(DEFAULT_KNOWLEDGE_TARGETS);
    setSelectedTargetPaths(new Set(DEFAULT_KNOWLEDGE_TARGETS.map((target) => target.path)));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.post("/ai/knowledge/search", { query: searchQuery.trim(), topK: 5 });
      setSearchResults(payload<SearchResult[]>(res) ?? []);
    } catch (e) {
      toast.error(errMessage(e, "검색 실패"));
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-text-muted">{t("common.loading", "불러오는 중...")}</CardContent></Card>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_520px] gap-3">
      <div className="space-y-2">
        <Card>
          <CardContent className="space-y-2.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-text">
                <Database className="h-4 w-4 text-primary" />
                Embedding / RAG 검색 설정
              </h2>
              <p className="text-xs text-text-muted">Embedding 모델과 키를 설정합니다.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <label className="text-xs">
                <span className="mb-0.5 block font-medium text-text">Embedding 제공자</span>
                <Select options={EMBEDDING_PROVIDER_OPTIONS} value={provider} onChange={onProviderChange} fullWidth />
              </label>
              <label className="text-xs">
                <span className="mb-0.5 block font-medium text-text">Embedding 모델</span>
                <Select options={modelOptions} value={model} onChange={onModelChange} fullWidth />
              </label>
              <label className="text-xs">
                <span className="mb-0.5 block font-medium text-text">차원</span>
                <Input value={dims} onChange={(e) => setDims(e.target.value)} fullWidth />
              </label>
            </div>
            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-text">API 키</span>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="비우면 저장된 provider 키 또는 서버 .env 사용"
                fullWidth
              />
            </label>
            {testResult && (
              <div className={`rounded-md border px-2.5 py-1.5 text-xs ${testResult.ok ? "border-green-500 text-green-700 dark:text-green-400" : "border-red-500 text-red-700 dark:text-red-400"}`}>
                {testResult.message}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-2">
              <Button variant="secondary" onClick={handleTest} disabled={testing || saving || reindexing}>
                {testing ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                연결 테스트
              </Button>
              <Button onClick={handleSave} disabled={saving || testing || reindexing}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? "저장 중..." : "설정 저장"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-text">청킹 / 임베딩 실행</h2>
                <p className="text-xs text-text-muted">대상 {selectedTargets.length} / {chunkTargets.length}</p>
              </div>
              <Button onClick={handleReindex} disabled={reindexing || saving || testing || selectedTargets.length === 0}>
                {reindexing ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                {reindexing ? "생성 중..." : "청킹 + 임베딩 재생성"}
              </Button>
            </div>
            <div className="rounded-md border border-border bg-surface-secondary/50 p-2">
              <div className="flex gap-1.5">
                <Button
                  variant={addMode === "file" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setAddMode("file")}
                  aria-pressed={addMode === "file"}
                >
                  <FileText className="h-4 w-4" />
                  파일
                </Button>
                <Button
                  variant={addMode === "folder" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setAddMode("folder")}
                  aria-pressed={addMode === "folder"}
                >
                  <Folder className="h-4 w-4" />
                  폴더
                </Button>
              </div>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                <Input
                  value={newTargetPath}
                  onChange={(e) => setNewTargetPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTarget();
                    }
                  }}
                  placeholder={addMode === "folder" ? "docs/custom" : "docs/custom/file.md"}
                  fullWidth
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleAddTarget} disabled={!newTargetPath.trim()}>
                    <Plus className="h-4 w-4" />
                    {addMode === "folder" ? "폴더 추가" : "문서 추가"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRestoreDefaultTargets} title="기본 대상 복원">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {addMode === "folder" && (
                <p className="mt-1 text-[11px] text-text-muted">
                  폴더 경로를 입력하면 하위 .md 파일을 모두 재귀적으로 청킹합니다.
                </p>
              )}
              <div className="mt-2 grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                {chunkTargets.map((target) => {
                  const isFile = target.path.toLowerCase().endsWith(".md");
                  return (
                    <label key={target.path} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-primary"
                        checked={selectedTargetPaths.has(target.path)}
                        onChange={() => handleToggleTarget(target.path)}
                      />
                      {isFile ? (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-text">{target.label}</span>
                        <span className="block truncate font-mono text-[11px] text-text-muted" title={target.path}>{target.path}</span>
                      </span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-text-muted hover:bg-error/10 hover:text-error"
                        title="대상 삭제"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteTarget(target.path);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </label>
                  );
                })}
                {chunkTargets.length === 0 && (
                  <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-muted">
                    등록된 대상이 없습니다.
                  </div>
                )}
              </div>
            </div>
            {reindexResult && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                <Metric label="문서" value={reindexResult.documents} />
                <Metric label="Chunks" value={reindexResult.chunks} />
                <Metric label="신규 Embedding" value={reindexResult.embedded} />
                <Metric label="재사용" value={reindexResult.reused} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <div className="shrink-0">
                <h2 className="text-base font-semibold text-text">검색 테스트</h2>
              </div>
              <div className="flex min-w-0 flex-1 gap-2">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} fullWidth />
                <Button variant="secondary" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                  {searching ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
                  검색
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {searchResults.map((row) => (
                <div key={row.chunkId} className="rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium text-text">{row.title ?? row.menuCode ?? row.chunkId} &gt; {row.heading ?? "본문"}</div>
                  <div className="text-xs text-text-muted">score={row.score.toFixed(4)} · {row.sourcePath}</div>
                  <p className="mt-2 line-clamp-3 text-text-muted">{row.summary || row.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-2 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">인덱스 상태</h2>
            <Button variant="ghost" size="sm" onClick={() => refreshStatus()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <CompactMetric label="Vector" value={status?.vectorEnabled ? "enabled" : "disabled"} />
            <CompactMetric label="Chunks" value={status?.chunks} />
            <CompactMetric label="Provider" value={status?.provider} />
            <CompactMetric label="Model" value={status?.model} />
            <CompactMetric label="Dims" value={status?.dims} />
            <CompactMetric label="Real Provider" value={status?.realEmbeddingProvider ? "Y" : "N"} />
          </div>
          <div className="border-t border-border pt-2">
            <h3 className="mb-1.5 text-sm font-semibold text-text">SQLite 벡터 DB</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <CompactMetric label="파일 존재" value={status?.dbExists ? "Y" : "N"} />
              <CompactMetric label="DB 크기" value={formatBytes(status?.dbSizeBytes)} />
              <CompactMetric label="sqlite-vec" value={status?.sqliteVecStatus ?? (status?.vectorEnabled ? "loaded" : "unavailable")} />
              <CompactMetric label="설정 방식" value={status?.usesDefaultDbPath ? "기본 경로" : "환경변수"} />
              <CompactMetric label="Vector Table" value={status?.vectorTableExists ? "Y" : "N"} />
              <CompactMetric label="FTS Table" value={status?.ftsTableExists ? "Y" : "N"} />
              <CompactMetric label="Vector Dims" value={status?.vectorDims ?? status?.dims} />
              <CompactMetric label="Vector Rows" value={status?.vectorRows} />
              <CompactMetric label="Embedding Rows" value={status?.embeddingRows} />
              <CompactMetric label="FTS Rows" value={status?.ftsRows} />
            </div>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5">
              <PathRow label="환경변수" value={status?.envKey ?? "AI_KNOWLEDGE_DB_PATH"} />
              <PathRow label="설정값" value={status?.configuredDbPath || "미설정 — 서버 기본 경로 사용"} />
              <PathRow label="파일명" value={status?.dbFileName ?? "-"} />
              <PathRow label="디렉터리" value={status?.dbDirectory ?? "-"} />
              <PathRow label="전체 경로" value={status?.dbPath ?? "DB 경로 없음"} />
              <PathRow label="마지막 재생성" value={status?.lastReindexAt ?? "-"} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  const displayValue = value === undefined || value === null ? "-" : String(value);
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-0.5 font-medium text-text">{displayValue}</div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: unknown }) {
  const displayValue = value === undefined || value === null ? "-" : String(value);
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-text" title={displayValue}>{displayValue}</span>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-surface-secondary px-2.5 py-1.5 text-xs">
      <span className="w-20 shrink-0 font-medium text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-text" title={value}>{value}</span>
    </div>
  );
}
