"use client";

/**
 * @file src/components/system/AiCatalogPanel.tsx
 * @description system/config "AI 카탈로그" 탭 — 구조화 카탈로그 매니저.
 *  - 좌: 테이블 검색 목록(관계/동의어 뱃지)  우: 설명·동의어·관계(JOIN 키) 편집 + 백링크
 *  - 관계 편집은 실제 DB 컬럼 드롭다운(오타 불가). 저장 시 md로 직렬화.
 *  - "고급" 토글로 md 원문 직접 편집 모드 제공.
 *  - API: GET/PUT /ai/catalog/tables, GET /ai/catalog/columns, POST /ai/catalog/sync, GET/PUT /ai/catalog
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Save, RefreshCw, Database, Plus, Trash2, Search, Link2, Code } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { api } from "@/services/api";
import toast from "react-hot-toast";

function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

interface ApiRelation { column: string; target: string; }
interface ApiTable { name: string; description: string; synonyms: string[]; relations: ApiRelation[]; }

interface UiRelation { column: string; targetTable: string; targetColumn: string; }
interface UiTable { name: string; description: string; synonyms: string[]; relations: UiRelation[]; }

function splitTarget(target: string): { targetTable: string; targetColumn: string } {
  const i = target.indexOf(".");
  return i === -1
    ? { targetTable: target.trim(), targetColumn: "" }
    : { targetTable: target.slice(0, i).trim(), targetColumn: target.slice(i + 1).trim() };
}
function joinTarget(r: UiRelation): string {
  return r.targetColumn ? `${r.targetTable}.${r.targetColumn}` : r.targetTable;
}
const toUi = (t: ApiTable): UiTable => ({
  name: t.name,
  description: t.description ?? "",
  synonyms: t.synonyms ?? [],
  relations: (t.relations ?? []).map((r) => ({ column: r.column, ...splitTarget(r.target) })),
});
const toApi = (t: UiTable): ApiTable => ({
  name: t.name,
  description: t.description.trim(),
  synonyms: t.synonyms.map((s) => s.trim()).filter(Boolean),
  relations: t.relations
    .filter((r) => r.column && r.targetTable)
    .map((r) => ({ column: r.column, target: joinTarget(r) })),
});

export default function AiCatalogPanel() {
  const { t } = useTranslation();
  const [tables, setTables] = useState<UiTable[]>([]);
  const [columnsMap, setColumnsMap] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [raw, setRaw] = useState("");

  const dirty = JSON.stringify(tables) !== snapshot;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        api.get("/ai/catalog/tables"),
        api.get("/ai/catalog/columns"),
      ]);
      const ui = ((tRes.data?.data?.tables ?? []) as ApiTable[]).map(toUi);
      setTables(ui);
      setSnapshot(JSON.stringify(ui));
      setColumnsMap((cRes.data?.data?.columns ?? {}) as Record<string, string[]>);
      setSelected((prev) => prev ?? ui[0]?.name ?? null);
    } catch (e: unknown) {
      toast.error(errMessage(e, t("ai.catalog.loadFailed", "카탈로그를 불러오지 못했습니다.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const tableNameOptions = useMemo(
    () => [...tables].map((x) => ({ value: x.name, label: x.name })).sort((a, b) => a.value.localeCompare(b.value)),
    [tables],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return tables.filter(
      (x) => !q || x.name.includes(q) || x.description.toUpperCase().includes(q) || x.synonyms.join(",").toUpperCase().includes(q),
    );
  }, [tables, search]);

  const cur = useMemo(() => tables.find((x) => x.name === selected) ?? null, [tables, selected]);

  // 백링크: 이 테이블을 참조하는 다른 테이블들
  const backlinks = useMemo(() => {
    if (!cur) return [] as { from: string; column: string; targetColumn: string }[];
    const out: { from: string; column: string; targetColumn: string }[] = [];
    for (const tb of tables) {
      if (tb.name === cur.name) continue;
      for (const r of tb.relations) {
        if (r.targetTable === cur.name) out.push({ from: tb.name, column: r.column, targetColumn: r.targetColumn });
      }
    }
    return out;
  }, [tables, cur]);

  const updateCur = useCallback((patch: Partial<UiTable>) => {
    setTables((prev) => prev.map((x) => (x.name === selected ? { ...x, ...patch } : x)));
  }, [selected]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/ai/catalog/tables", { tables: tables.map(toApi) });
      setSnapshot(JSON.stringify(tables));
      toast.success(t("ai.catalog.saved", "카탈로그를 저장했습니다."));
    } catch (e: unknown) {
      toast.error(errMessage(e, t("ai.catalog.saveFailed", "저장에 실패했습니다.")));
    } finally {
      setSaving(false);
    }
  }, [tables, t]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await api.post("/ai/catalog/sync");
      const r = res.data?.data ?? {};
      await load();
      toast.success(t("ai.catalog.synced", "동기화 완료: 추가 {{added}}개 / 전체 {{total}}개", {
        added: r.added?.length ?? 0, total: r.total ?? 0,
      }));
      if (r.missingInDb?.length) {
        toast(t("ai.catalog.missingWarn", "DB에 없는 테이블 {{n}}개(삭제 의심): {{list}}", {
          n: r.missingInDb.length, list: r.missingInDb.slice(0, 10).join(", "),
        }), { icon: "⚠️", duration: 6000 });
      }
    } catch (e: unknown) {
      toast.error(errMessage(e, t("ai.catalog.syncFailed", "동기화에 실패했습니다.")));
    } finally {
      setSyncing(false);
    }
  }, [load, t]);

  const enterAdvanced = useCallback(async () => {
    try {
      const res = await api.get("/ai/catalog");
      setRaw(res.data?.data?.content ?? "");
      setAdvanced(true);
    } catch (e: unknown) {
      toast.error(errMessage(e, t("ai.catalog.loadFailed", "카탈로그를 불러오지 못했습니다.")));
    }
  }, [t]);

  const saveRaw = useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/ai/catalog", { content: raw });
      toast.success(t("ai.catalog.saved", "카탈로그를 저장했습니다."));
      setAdvanced(false);
      await load();
    } catch (e: unknown) {
      toast.error(errMessage(e, t("ai.catalog.saveFailed", "저장에 실패했습니다.")));
    } finally {
      setSaving(false);
    }
  }, [raw, t, load]);

  const colsOf = (name: string) => (columnsMap[name] ?? []).map((c) => ({ value: c, label: c }));

  return (
    <Card>
      <CardContent>
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-text">{t("ai.catalog.title", "AI 테이블 카탈로그")}</h3>
            <p className="mt-1 text-sm text-text-muted">
              {t("ai.catalog.desc", "AI 질의에 주입되는 테이블 지식입니다. 설명과 컬럼 관계(JOIN 키)를 작성하면 text-to-SQL 정확도가 올라갑니다.")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => (advanced ? setAdvanced(false) : void enterAdvanced())} disabled={loading || saving || syncing}>
              <Code className="mr-1 h-4 w-4" />
              {advanced ? t("ai.catalog.structured", "구조화 편집") : t("ai.catalog.advanced", "고급(원문)")}
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading || saving || syncing}>
              <RefreshCw className="mr-1 h-4 w-4" />{t("common.refresh", "새로고침")}
            </Button>
            <Button variant="secondary" onClick={() => void handleSync()} isLoading={syncing} disabled={loading || saving}>
              <Database className="mr-1 h-4 w-4" />{t("ai.catalog.sync", "DB와 동기화")}
            </Button>
            {advanced ? (
              <Button onClick={() => void saveRaw()} isLoading={saving} disabled={loading}>
                <Save className="mr-1 h-4 w-4" />{t("common.save", "저장")}
              </Button>
            ) : (
              <Button onClick={() => void handleSave()} isLoading={saving} disabled={loading || !dirty}>
                <Save className="mr-1 h-4 w-4" />{dirty ? t("ai.catalog.saveChanged", "변경 저장") : t("common.save", "저장")}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-text-muted">{t("common.loading", "불러오는 중...")}</div>
        ) : advanced ? (
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            className="mt-3 h-[62vh] min-h-0 w-full resize-y overflow-auto rounded border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text focus:border-primary focus:outline-none"
          />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            {/* 좌: 테이블 목록 */}
            <div className="flex h-[62vh] min-h-0 flex-col rounded border border-border">
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search", "검색")} className="pl-8" fullWidth />
                </div>
                <div className="mt-1 text-right text-xs text-text-muted">{filtered.length} / {tables.length}</div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.map((x) => (
                  <button
                    key={x.name}
                    type="button"
                    onClick={() => setSelected(x.name)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-xs ${
                      selected === x.name ? "bg-primary/10 text-primary" : "text-text hover:bg-surface"
                    }`}
                  >
                    <span className="truncate font-mono font-medium">{x.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-text-muted">
                      {x.relations.length > 0 && <span className="inline-flex items-center gap-0.5"><Link2 className="h-3 w-3" />{x.relations.length}</span>}
                      {x.synonyms.length > 0 && <span>#{x.synonyms.length}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 우: 선택 테이블 편집 */}
            <div className="h-[62vh] min-h-0 overflow-y-auto rounded border border-border p-4">
              {!cur ? (
                <div className="py-16 text-center text-text-muted">{t("ai.catalog.selectTable", "왼쪽에서 테이블을 선택하세요.")}</div>
              ) : (
                <div className="space-y-4">
                  <div className="font-mono text-base font-bold text-text">{cur.name}</div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">{t("ai.catalog.fieldDesc", "설명")}</label>
                    <textarea
                      value={cur.description}
                      onChange={(e) => updateCur({ description: e.target.value })}
                      rows={2}
                      className="w-full resize-y rounded border border-border bg-bg p-2 text-sm text-text focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">{t("ai.catalog.fieldSynonyms", "동의어 (쉼표로 구분)")}</label>
                    <Input
                      value={cur.synonyms.join(", ")}
                      onChange={(e) => updateCur({ synonyms: e.target.value.split(/[,，]/).map((s) => s.replace(/^\s+/, "")) })}
                      placeholder={t("ai.catalog.synonymsPh", "예: 품목, 자재, 아이템")}
                      fullWidth
                    />
                  </div>

                  {/* 관계 편집기 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-text-muted">{t("ai.catalog.fieldRelations", "관계 (JOIN 키)")}</label>
                      <Button
                        variant="ghost"
                        onClick={() => updateCur({ relations: [...cur.relations, { column: "", targetTable: "", targetColumn: "" }] })}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />{t("ai.catalog.addRelation", "관계 추가")}
                      </Button>
                    </div>
                    {cur.relations.length === 0 ? (
                      <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
                        {t("ai.catalog.noRelation", "관계 없음. '관계 추가'로 JOIN 키를 정의하세요.")}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cur.relations.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="w-40">
                              <Select options={colsOf(cur.name)} value={r.column} placeholder={t("ai.catalog.column", "컬럼")}
                                onChange={(v) => updateCur({ relations: cur.relations.map((x, j) => (j === i ? { ...x, column: v } : x)) })} fullWidth />
                            </div>
                            <span className="shrink-0 text-text-muted">→</span>
                            <div className="flex-1">
                              <Select options={tableNameOptions} value={r.targetTable} placeholder={t("ai.catalog.targetTable", "대상 테이블")}
                                onChange={(v) => updateCur({ relations: cur.relations.map((x, j) => (j === i ? { ...x, targetTable: v, targetColumn: "" } : x)) })} fullWidth />
                            </div>
                            <span className="shrink-0 text-text-muted">.</span>
                            <div className="w-40">
                              <Select options={colsOf(r.targetTable)} value={r.targetColumn} placeholder={t("ai.catalog.targetColumn", "대상 컬럼")} disabled={!r.targetTable}
                                onChange={(v) => updateCur({ relations: cur.relations.map((x, j) => (j === i ? { ...x, targetColumn: v } : x)) })} fullWidth />
                            </div>
                            <button type="button" onClick={() => updateCur({ relations: cur.relations.filter((_, j) => j !== i) })}
                              className="shrink-0 rounded p-1.5 text-text-muted hover:bg-surface hover:text-red-500" title={t("common.delete", "삭제")}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 백링크 */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">{t("ai.catalog.backlinks", "백링크 (이 테이블을 참조하는 곳)")}</label>
                    {backlinks.length === 0 ? (
                      <div className="text-xs text-text-muted">{t("ai.catalog.noBacklink", "참조하는 테이블 없음")}</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {backlinks.map((b, i) => (
                          <button key={i} type="button" onClick={() => setSelected(b.from)}
                            className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text hover:border-primary hover:text-primary">
                            {b.from}.{b.column} → {b.targetColumn || "·"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
