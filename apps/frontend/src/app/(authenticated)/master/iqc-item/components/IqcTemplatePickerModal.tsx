"use client";
/**
 * @file components/IqcTemplatePickerModal.tsx
 * @description IQC002 템플릿 관리 팝업 — 템플릿 목록/미리보기 + 저장·적용·삭제
 *
 * 초보자 가이드:
 * 1. 좌측: 템플릿 목록(선택) + 선택 삭제
 * 2. 우측: 선택 템플릿 항목 미리보기 + "현재 품목에 적용"
 * 3. 상단: "현재 품목 항목 → 템플릿으로 저장"
 * 4. 적용은 로컬 상태 교체(onApply)만 — 실제 저장은 부모의 [변경 저장]에서 확정
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, Trash2, ArrowRight } from "lucide-react";
import { Modal, Button, ConfirmModal, ComCodeBadge } from "@/components/ui";
import type { IqcSpecRow, IqcTemplate } from "../types";
import api from "@/services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  currentSampleQty: number;
  currentIsDest: string;
  currentItems: IqcSpecRow[];
  onApply: (items: IqcSpecRow[], sampleQty: number, isDest: string) => void;
}

function mapItems(raw: any[]): IqcSpecRow[] {
  return (raw ?? []).map((it) => ({
    seq: it.seq,
    inspItemCode: it.inspItemCode,
    inspItemName: it.inspItem?.inspItemName ?? "",
    judgeMethod: it.inspItem?.judgeMethod,
    unit: it.inspItem?.unit ?? null,
    lsl: it.lsl ?? null,
    usl: it.usl ?? null,
    judgeCriteria: it.judgeCriteria ?? null,
    defectGrade: it.defectGrade ?? null,
    inspectionLevel: it.inspectionLevel ?? null,
    aql: it.aql ?? null,
    inspectionType: it.inspectionType ?? null,
    sampleMethod: it.sampleMethod ?? null,
    sampleQty: it.sampleQty ?? null,
    useYn: it.useYn ?? "Y",
  }));
}

export default function IqcTemplatePickerModal({
  isOpen, onClose, itemName,
  currentSampleQty, currentIsDest, currentItems, onApply,
}: Props) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<IqcTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/iqc-templates");
      const list: IqcTemplate[] = (res.data?.data ?? []).map((tpl: any) => ({
        templateId: tpl.templateId,
        templateName: tpl.templateName,
        sampleQty: tpl.sampleQty ?? 1,
        isDest: tpl.isDest ?? "N",
        items: mapItems(tpl.items),
      }));
      setTemplates(list);
      setSelectedId((prev) => prev ?? (list[0]?.templateId ?? null));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null);
      setTemplateName("");
      load();
    }
  }, [isOpen, load]);

  const selected = templates.find((tpl) => tpl.templateId === selectedId) ?? null;

  const handleSaveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await api.post("/master/iqc-templates", {
        templateName: name,
        sampleQty: currentSampleQty,
        isDest: currentIsDest,
        items: currentItems
          .filter((it) => it.inspItemCode)
          .map((it) => ({
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            lsl: it.lsl,
            usl: it.usl,
            judgeCriteria: it.judgeCriteria ?? null,
            defectGrade: it.defectGrade ?? null,
            inspectionLevel: it.inspectionLevel ?? null,
            aql: it.aql ?? null,
            inspectionType: it.inspectionType ?? null,
            sampleMethod: it.sampleMethod ?? null,
            sampleQty: it.sampleQty ?? null,
            useYn: it.useYn,
          })),
      });
      setTemplateName("");
      await load();
    } catch (err) {
      console.error("템플릿 저장 실패:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/master/iqc-templates/${encodeURIComponent(selectedId)}`);
      setSelectedId(null);
      setDeleteConfirmOpen(false);
      await load();
    } catch (err) {
      console.error("템플릿 삭제 실패:", err);
    }
  };

  const handleApply = () => {
    if (!selected) return;
    onApply(selected.items, selected.sampleQty, selected.isDest);
    onClose();
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.iqcTemplate.title", "IQC 항목 템플릿 관리")} size="xl">
      <div className="flex flex-col gap-3">
        {/* 현재 품목 → 템플릿 저장 */}
        <div className="flex items-center gap-2 flex-wrap border border-border rounded-lg p-3 bg-bg-elevated">
          <span className="text-sm text-text-muted">
            {t("master.iqcTemplate.currentItem", "현재 품목")}: <b className="text-text">{itemName}</b>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t("master.iqcTemplate.namePlaceholder", "템플릿명 입력")}
              className="w-48 border border-border rounded px-2 py-1.5 text-sm bg-bg text-text"
            />
            <Button size="sm" onClick={handleSaveAsTemplate} disabled={saving || !templateName.trim()} className="flex items-center gap-1">
              <Save className="w-4 h-4" />
              {t("master.iqcTemplate.saveAs", "템플릿으로 저장")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3" style={{ minHeight: "420px" }}>
          {/* 템플릿 목록 */}
          <div className="col-span-4 flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-elevated">
              <span className="text-sm font-medium text-text">{t("master.iqcTemplate.list", "템플릿 목록")}</span>
              <button onClick={() => setDeleteConfirmOpen(true)} disabled={!selectedId} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:text-text-muted disabled:cursor-not-allowed" aria-label={t("common.delete", "삭제")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-4 text-center text-text-muted text-sm">{t("common.loading", "불러오는 중…")}</div>
              ) : templates.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">{t("master.iqcTemplate.empty", "저장된 템플릿이 없습니다.")}</div>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.templateId}
                    onClick={() => setSelectedId(tpl.templateId)}
                    className={`w-full text-left px-3 py-2 border-b border-border text-sm transition-colors ${
                      selectedId === tpl.templateId ? "bg-primary/10 text-primary font-medium" : "text-text hover:bg-bg-elevated"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="truncate">{tpl.templateName}</span>
                      <span className="text-text-muted flex-shrink-0">{tpl.items.length}{t("master.iqcTemplate.itemsUnit", "개")}</span>
                    </div>
                    <span className="text-xs text-text-muted">{tpl.templateId}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 미리보기 */}
          <div className="col-span-8 flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-elevated">
              <span className="text-sm font-medium text-text truncate">
                {selected ? selected.templateName : t("master.iqcTemplate.preview", "미리보기")}
                {selected && (
                  <span className="text-xs text-text-muted ml-2">
                    {t("master.iqcItem.sampleQty", "시료수")} {selected.sampleQty} · {selected.isDest === "Y" ? t("master.iqcItem.destructive", "파괴") : t("master.iqcItem.nonDestructive", "비파괴")}
                  </span>
                )}
              </span>
              <Button size="sm" onClick={handleApply} disabled={!selected} className="flex items-center gap-1">
                {t("master.iqcTemplate.apply", "현재 품목에 적용")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm [&_th]:border-r [&_td]:border-r [&_th]:border-border/60 [&_td]:border-border/60 [&_tr>*:last-child]:border-r-0">
                <thead className="sticky top-0 bg-primary/10 border-b border-primary/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-text-muted font-medium w-12">{t("master.iqcItem.seq", "순서")}</th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium">{t("master.iqcItem.inspItem", "검사항목")}</th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium w-20">{t("master.iqcItem.type", "종류")}</th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium w-24">{t("master.iqcItem.inspectionType", "검사유형")}</th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium w-16">{t("master.iqcItem.sampleQtyCol", "샘플수")}</th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium w-24">{t("master.iqcItem.defectGrade", "불량등급")}</th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium w-20">{t("master.iqcItem.inspectionLevel", "검사수준")}</th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium w-16">AQL</th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium w-20">LSL</th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium w-20">USL</th>
                    <th className="px-3 py-2 text-left text-text-muted font-medium">{t("master.iqcItem.judgeCriteria", "판정기준")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!selected || selected.items.length === 0 ? (
                    <tr><td colSpan={11} className="py-8 text-center text-text-muted text-sm">{t("master.iqcTemplate.selectHint", "템플릿을 선택하세요.")}</td></tr>
                  ) : (
                    selected.items.map((row, idx) => {
                      const isMeasure = row.judgeMethod === "MEASURE";
                      const isFixedSample = row.inspectionType === "DESTRUCTIVE" || row.inspectionType === "FULL";
                      return (
                        <tr key={idx} className="border-b border-border">
                          <td className="px-3 py-1.5 text-center text-text-muted">{row.seq}</td>
                          <td className="px-3 py-1.5 text-text">{row.inspItemCode} {row.inspItemName}</td>
                          <td className="px-3 py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isMeasure ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                              {isMeasure ? t("master.iqcItem.typeMeasure", "측정형") : t("master.iqcItem.typeVisual", "판정형")}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            {row.inspectionType && row.inspectionType !== "AQL"
                              ? <ComCodeBadge groupCode="IQC_ITEM_INSP_TYPE" code={row.inspectionType} />
                              : <span className="text-text-muted text-xs">AQL</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-text">
                            {isFixedSample ? (row.sampleQty ?? "-") : <span className="text-text-muted text-xs">{t("master.iqcItem.auto", "자동")}</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.defectGrade
                              ? <ComCodeBadge groupCode="DEFECT_GRADE" code={row.defectGrade} className="!rounded px-2.5 py-1" />
                              : <span className="text-text-muted text-xs">-</span>}
                          </td>
                          <td className="px-3 py-1.5 text-text">{row.inspectionLevel || <span className="text-text-muted text-xs">-</span>}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-text">{row.aql != null ? row.aql : <span className="text-text-muted text-xs">-</span>}</td>
                          <td className="px-3 py-1.5 text-right text-text">{isMeasure ? (row.lsl ?? "-") : "-"}</td>
                          <td className="px-3 py-1.5 text-right text-text">{isMeasure ? (row.usl ?? "-") : "-"}</td>
                          <td className="px-3 py-1.5 text-text">{!isMeasure ? (row.judgeCriteria ?? "-") : "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          {t("master.iqcTemplate.applyHint", "적용 시 현재 품목 항목을 통째로 대체합니다. 적용 후 [변경 저장]을 눌러야 확정됩니다.")}
        </p>
      </div>
    </Modal>
    <ConfirmModal
      isOpen={deleteConfirmOpen}
      onClose={() => setDeleteConfirmOpen(false)}
      onConfirm={handleDelete}
      title={t("common.deleteConfirm", "삭제 확인")}
      message={`${selected?.templateName ?? ""} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
      variant="danger"
    />
    </>
  );
}
