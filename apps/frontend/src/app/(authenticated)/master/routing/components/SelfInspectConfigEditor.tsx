"use client";

/**
 * @file components/SelfInspectConfigEditor.tsx
 * @description 공정별 자주검사 항목 CRUD 에디터
 *
 * 초보자 가이드:
 * 1. selectedProcess.processCode 기준으로 SELF_INSPECT_ITEMS 조회/편집
 * 2. 행 추가 → 상단에 빈 행 추가, 저장 버튼으로 POST
 * 3. 기존 행 수정 → 인라인 편집 후 저장 버튼으로 PUT
 * 4. 삭제 아이콘 → 즉시 DELETE (id 없는 신규 행은 목록에서 제거)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ui";
import api from "@/services/api";
import type { SelectedProcess } from "../types";

interface SelfInspectItem {
  id: string;
  processCode: string | null;
  itemName: string;
  standard: string | null;
  inspectMethod: string;
  timing: string;
  isDestructive: boolean;
  sortOrder: number;
  useYn: string;
  itemType: string;
  unit: string | null;
  lslValue: number | null;
  uslValue: number | null;
  sampleCount: number;
}

type EditRow = Omit<SelfInspectItem, "id"> & { id: string | null; dirty: boolean };

interface Props {
  selectedProcess: SelectedProcess;
}

const TIMING_OPTIONS = ["FIRST", "MID", "LAST"] as const;

export default function SelfInspectConfigEditor({ selectedProcess }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTargetIdx, setDeleteTargetIdx] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/self-inspect/items/all", {
        params: { processCode: selectedProcess.processCode },
      });
      const items: SelfInspectItem[] = res.data?.data ?? [];
      setRows(items.map((item) => ({ ...item, dirty: false })));
    } catch {
      toast.error(t("common.loadError", "조회 중 오류"));
    } finally {
      setLoading(false);
    }
  }, [selectedProcess.processCode, t]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleAdd = () => {
    const newRow: EditRow = {
      id: null,
      processCode: selectedProcess.processCode,
      itemName: "",
      standard: null,
      inspectMethod: "DIRECT",
      timing: "MID",
      isDestructive: false,
      sortOrder: rows.length * 10,
      useYn: "Y",
      itemType: "VISUAL",
      unit: null,
      lslValue: null,
      uslValue: null,
      sampleCount: 1,
      dirty: true,
    };
    setRows((prev) => [newRow, ...prev]);
  };

  const handleChange = (idx: number, field: keyof EditRow, value: unknown) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value, dirty: true } : row))
    );
  };

  const handleTimingToggle = (idx: number, timing: string) => {
    const row = rows[idx];
    const parts = row.timing ? row.timing.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = parts.includes(timing)
      ? parts.filter((p) => p !== timing)
      : [...parts, timing];
    handleChange(idx, "timing", next.join(",") || "MID");
  };

  const handleSave = async (idx: number) => {
    const row = rows[idx];
    if (!row.itemName.trim()) {
      toast.error(t("selfInspect.itemNameRequired", "항목명을 입력하세요"));
      return;
    }
    try {
      if (row.id) {
        const res = await api.put(`/production/self-inspect/items/${row.id}`, row);
        const updated = res.data?.data as SelfInspectItem;
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...updated, dirty: false } : r))
        );
      } else {
        const res = await api.post("/production/self-inspect/items", {
          ...row,
          processCode: selectedProcess.processCode,
        });
        const created = res.data?.data as SelfInspectItem;
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...created, dirty: false } : r))
        );
      }
      toast.success(t("common.saved", "저장되었습니다"));
    } catch {
      toast.error(t("common.saveError", "저장 중 오류"));
    }
  };

  const handleDelete = async () => {
    if (deleteTargetIdx == null) return;
    const idx = deleteTargetIdx;
    const row = rows[idx];
    if (!row.id) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      setDeleteTargetIdx(null);
      return;
    }
    try {
      await api.delete(`/production/self-inspect/items/${row.id}`);
      setRows((prev) => prev.filter((_, i) => i !== idx));
      setDeleteTargetIdx(null);
      toast.success(t("common.deleted", "삭제되었습니다"));
    } catch {
      toast.error(t("common.deleteError", "삭제 중 오류"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        {t("common.loading", "조회 중...")}
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex justify-between items-center shrink-0">
        <span className="text-xs text-text-muted">
          {selectedProcess.processName} ({selectedProcess.processCode})
        </span>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t("selfInspect.addItem", "항목 추가")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            {t("selfInspect.noItems", "등록된 자주검사 항목이 없습니다")}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.id ?? `new-${idx}`}
              className={`p-3 rounded-lg border text-xs space-y-2 ${
                row.dirty
                  ? "border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-950/20"
                  : "border-border bg-surface/50"
              }`}
            >
              {/* 항목명 + 유형 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={row.itemName}
                  onChange={(e) => handleChange(idx, "itemName", e.target.value)}
                  placeholder={t("selfInspect.itemName", "항목명")}
                  className="flex-1 px-2 py-1 border border-border rounded bg-background text-text focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
                <select
                  value={row.itemType}
                  onChange={(e) => handleChange(idx, "itemType", e.target.value)}
                  className="w-24 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                >
                  <option value="VISUAL">{t("selfInspect.typeVisual", "판정형")}</option>
                  <option value="MEASURE">{t("selfInspect.typeMeasure", "측정형")}</option>
                </select>
              </div>

              {/* 기준 */}
              <input
                type="text"
                value={row.standard ?? ""}
                onChange={(e) => handleChange(idx, "standard", e.target.value || null)}
                placeholder={t("selfInspect.standard", "기준/규격 (선택)")}
                className="w-full px-2 py-1 border border-border rounded bg-background text-text focus:outline-none focus:ring-1 focus:ring-primary text-xs"
              />

              {/* 측정형일 때: 단위 + LSL + USL */}
              {row.itemType === "MEASURE" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={row.unit ?? ""}
                    onChange={(e) => handleChange(idx, "unit", e.target.value || null)}
                    placeholder={t("common.unit", "단위")}
                    className="w-16 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                  <input
                    type="number"
                    value={row.lslValue ?? ""}
                    onChange={(e) =>
                      handleChange(idx, "lslValue", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="LSL"
                    className="w-20 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                  <input
                    type="number"
                    value={row.uslValue ?? ""}
                    onChange={(e) =>
                      handleChange(idx, "uslValue", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="USL"
                    className="w-20 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                </div>
              )}

              {/* 검사방법 + 샘플수 */}
              <div className="flex gap-2 items-center">
                <select
                  value={row.inspectMethod}
                  onChange={(e) => handleChange(idx, "inspectMethod", e.target.value)}
                  className="w-24 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                >
                  <option value="DIRECT">{t("selfInspect.methodDirect", "직접검사")}</option>
                  <option value="DELEGATE">{t("selfInspect.methodDelegate", "의뢰검사")}</option>
                </select>
                <label className="flex items-center gap-1 text-text-muted">
                  <span>{t("selfInspect.sampleCount", "샘플수")}</span>
                  <input
                    type="number"
                    min={1}
                    value={row.sampleCount}
                    onChange={(e) => handleChange(idx, "sampleCount", Number(e.target.value))}
                    className="w-14 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-text-muted">
                  <input
                    type="checkbox"
                    checked={row.isDestructive}
                    onChange={(e) => handleChange(idx, "isDestructive", e.target.checked)}
                    className="rounded"
                  />
                  <span>{t("selfInspect.destructive", "파괴")}</span>
                </label>
              </div>

              {/* 검사시점 체크박스 */}
              <div className="flex gap-2 items-center">
                <span className="text-text-muted">{t("selfInspect.timing", "시점")}:</span>
                {TIMING_OPTIONS.map((timingOpt) => (
                  <label key={timingOpt} className="flex items-center gap-1 text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.timing.includes(timingOpt)}
                      onChange={() => handleTimingToggle(idx, timingOpt)}
                      className="rounded"
                    />
                    <span>{timingOpt === "FIRST" ? t("selfInspect.timingFirst", "초물") : timingOpt === "MID" ? t("selfInspect.timingMid", "중물") : t("selfInspect.timingLast", "종물")}</span>
                  </label>
                ))}
              </div>

              {/* 순서 + 사용여부 + 저장/삭제 */}
              <div className="flex gap-2 items-center justify-between">
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1 text-text-muted">
                    <span>{t("selfInspect.sortOrder", "순서")}</span>
                    <input
                      type="number"
                      value={row.sortOrder}
                      onChange={(e) => handleChange(idx, "sortOrder", Number(e.target.value))}
                      className="w-14 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                    />
                  </label>
                  <select
                    value={row.useYn}
                    onChange={(e) => handleChange(idx, "useYn", e.target.value)}
                    className="w-16 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  >
                    <option value="Y">{t("selfInspect.useY", "사용")}</option>
                    <option value="N">{t("selfInspect.useN", "미사용")}</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  {row.dirty && (
                    <button
                      type="button"
                      onClick={() => handleSave(idx)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90"
                    >
                      <Save className="w-3 h-3" />
                      {t("common.save", "저장")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTargetIdx(idx)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t("common.delete", "삭제")}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    <ConfirmModal
      isOpen={deleteTargetIdx != null}
      onClose={() => setDeleteTargetIdx(null)}
      onConfirm={handleDelete}
      title={t("common.deleteConfirm", "삭제 확인")}
      message={`${rows[deleteTargetIdx ?? -1]?.itemName || ""} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
      variant="danger"
    />
    </>
  );
}
