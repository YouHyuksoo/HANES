"use client";
/**
 * @file components/IqcSpecPanel.tsx
 * @description 품목별 IQC 기준 우측 패널 — 시료수/파괴검사 헤더 + 검사항목 인라인 DataGrid
 *
 * 초보자 가이드:
 * 1. 선택된 품목(itemCode)에 대한 IQC 기준을 표시/편집
 * 2. 헤더: 시료수(number), 파괴검사여부(Y/N 토글)
 * 3. 검사항목 DataGrid: 행 추가/삭제 + 행별 수정 버튼으로 인라인 편집
 * 4. [저장] 한 번에 POST /master/iqc-part-specs
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Save, ClipboardList, Pencil, Check, X } from "lucide-react";
import { Button, ComCodeBadge } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import type { IqcPoolItem, IqcPartSpec, IqcSpecRow } from "../types";
import IqcTemplatePickerModal from "./IqcTemplatePickerModal";
import api from "@/services/api";

interface Props {
  itemCode: string | null;
  itemName: string;
  poolItems: IqcPoolItem[];
}

interface AqlStandardOption {
  aqlCode: string;
  aqlName?: string | null;
  inspectionLevel?: string | null;
  aqlValue?: number | null;
}

const EMPTY_SPEC: IqcPartSpec = {
  itemCode: '',
  sampleQty: 1,
  isDest: 'N',
  useYn: 'Y',
  items: [],
};

export default function IqcSpecPanel({ itemCode, itemName, poolItems }: Props) {
  const { t } = useTranslation();
  const [spec, setSpec] = useState<IqcPartSpec>(EMPTY_SPEC);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [validAqlStandards, setValidAqlStandards] = useState<AqlStandardOption[]>([]);
  // 수정 중인 행 인덱스 (-1: 없음)
  const [editingIdx, setEditingIdx] = useState<number>(-1);
  // 수정 임시 값
  const [editDraft, setEditDraft] = useState<IqcSpecRow | null>(null);

  // 검사기준서: 불량등급/검사수준/AQL 공통코드 옵션
  const defectGradeOptions = useComCodeOptions("DEFECT_GRADE");
  const inspLevelOptions = useComCodeOptions("AQL_INSP_LEVEL");
  const aqlOptions = useComCodeOptions("AQL_VALUE");
  const inspectTypeOptions = useComCodeOptions("IQC_ITEM_INSP_TYPE");

  useEffect(() => {
    let mounted = true;
    api.get("/quality/aql", { params: { useYn: "Y", limit: "5000" } })
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setValidAqlStandards(rows
          .filter((row: AqlStandardOption) => row.inspectionLevel && row.aqlValue != null)
          .map((row: AqlStandardOption) => ({
            aqlCode: row.aqlCode,
            aqlName: row.aqlName ?? null,
            inspectionLevel: row.inspectionLevel?.trim().toUpperCase() ?? null,
            aqlValue: Number(row.aqlValue),
          })));
      })
      .catch(() => {
        if (mounted) setValidAqlStandards([]);
      });
    return () => { mounted = false; };
  }, []);

  const aqlStandardOptionsByLevel = useMemo(() => {
    const grouped = new Map<string, AqlStandardOption[]>();
    for (const standard of validAqlStandards) {
      if (!standard.inspectionLevel || standard.aqlValue == null) continue;
      const list = grouped.get(standard.inspectionLevel) ?? [];
      if (!list.some((item) => Number(item.aqlValue) === Number(standard.aqlValue))) {
        list.push(standard);
      }
      grouped.set(standard.inspectionLevel, list.sort((a, b) => Number(a.aqlValue) - Number(b.aqlValue)));
    }
    return grouped;
  }, [validAqlStandards]);

  const aqlLevelOptions = useMemo(() => {
    const levels = new Set(aqlStandardOptionsByLevel.keys());
    return inspLevelOptions.filter((option) => levels.has(String(option.value).trim().toUpperCase()));
  }, [aqlStandardOptionsByLevel, inspLevelOptions]);

  const availableAqlOptionsForLevel = useCallback((inspectionLevel?: string | null) => {
    const level = inspectionLevel?.trim().toUpperCase();
    return level ? (aqlStandardOptionsByLevel.get(level) ?? []) : [];
  }, [aqlStandardOptionsByLevel]);

  const loadSpec = useCallback(async (code: string) => {
    setLoading(true);
    setEditingIdx(-1);
    setEditDraft(null);
    try {
      const res = await api.get(`/master/iqc-part-specs/${encodeURIComponent(code)}`);
      if (res.data?.data) {
        const d = res.data.data;
        setSpec({
          itemCode: d.itemCode,
          sampleQty: d.sampleQty ?? 1,
          isDest: d.isDest ?? 'N',
          useYn: d.useYn ?? 'Y',
          items: (d.items ?? []).map((it: any) => ({
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            inspItemName: it.inspItem?.inspItemName ?? '',
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
            useYn: it.useYn ?? 'Y',
          })),
        });
      } else {
        setSpec({ ...EMPTY_SPEC, itemCode: code });
      }
    } catch {
      setSpec({ ...EMPTY_SPEC, itemCode: code });
    } finally {
      setLoading(false);
      setDirty(false);
    }
  }, []);

  useEffect(() => {
    if (itemCode) {
      loadSpec(itemCode);
    } else {
      setSpec(EMPTY_SPEC);
      setEditingIdx(-1);
      setEditDraft(null);
    }
  }, [itemCode, loadSpec]);

  const updateHeader = (field: keyof IqcPartSpec, value: unknown) => {
    setSpec((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const addRow = () => {
    const maxSeq = spec.items.length > 0
      ? Math.max(...spec.items.map((i) => i.seq))
      : 0;
    const newRow: IqcSpecRow = { seq: maxSeq + 1, inspItemCode: '', lsl: null, usl: null, judgeCriteria: null, defectGrade: null, inspectionLevel: null, aql: null, inspectionType: 'AQL', sampleMethod: 'AQL', sampleQty: null, useYn: 'Y' };
    setSpec((prev) => ({ ...prev, items: [...prev.items, newRow] }));
    setDirty(true);
    // 새 행은 바로 수정 모드로
    const newIdx = spec.items.length;
    setEditingIdx(newIdx);
    setEditDraft({ ...newRow });
  };

  const removeRow = (idx: number) => {
    if (editingIdx === idx) {
      setEditingIdx(-1);
      setEditDraft(null);
    }
    setSpec((prev) => {
      const newItems = prev.items
        .filter((_, i) => i !== idx)
        .map((it, i) => ({ ...it, seq: i + 1 }));
      return { ...prev, items: newItems };
    });
    setDirty(true);
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditDraft({ ...spec.items[idx] });
  };

  const cancelEdit = () => {
    // 새로 추가했지만 취소 — inspItemCode가 비어 있으면 행 제거
    if (editDraft && !editDraft.inspItemCode) {
      removeRow(editingIdx);
    }
    setEditingIdx(-1);
    setEditDraft(null);
  };

  const confirmEdit = () => {
    if (editDraft === null) return;
    setSpec((prev) => {
      const items = [...prev.items];
      items[editingIdx] = { ...editDraft };
      return { ...prev, items };
    });
    setDirty(true);
    setEditingIdx(-1);
    setEditDraft(null);
  };

  const updateDraft = (field: keyof IqcSpecRow, value: unknown) => {
    if (!editDraft) return;
    if (field === 'inspItemCode') {
      const pool = poolItems.find((p) => p.inspItemCode === value);
      setEditDraft({
        ...editDraft,
        inspItemCode: value as string,
        inspItemName: pool?.inspItemName ?? '',
        judgeMethod: pool?.judgeMethod,
        unit: pool?.unit ?? null,
        lsl: null,
        usl: null,
        judgeCriteria: null,
      });
    } else if (field === 'inspectionLevel') {
      const level = (value as string | null)?.trim().toUpperCase() || null;
      const availableAqlValues = availableAqlOptionsForLevel(level).map((option) => Number(option.aqlValue));
      setEditDraft({
        ...editDraft,
        inspectionLevel: level,
        aql: editDraft.aql != null && availableAqlValues.includes(Number(editDraft.aql)) ? editDraft.aql : null,
      });
    } else if (field === 'inspectionType') {
      const v = value as string;
      setEditDraft({
        ...editDraft,
        inspectionType: v,
        sampleMethod: v === 'AQL' ? 'AQL' : 'FIXED',
        sampleQty: v === 'AQL' ? null : editDraft.sampleQty,
      });
    } else {
      setEditDraft({ ...editDraft, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!itemCode) return;
    setSaving(true);
    try {
      await api.post('/master/iqc-part-specs', {
        itemCode,
        sampleQty: spec.sampleQty,
        isDest: spec.isDest,
        useYn: spec.useYn,
        items: spec.items
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
      setDirty(false);
      await loadSpec(itemCode);
    } catch (err) {
      console.error('IQC 기준 저장 실패:', err);
    } finally {
      setSaving(false);
    }
  };

  const isDraftAqlStandardValid = (draft: IqcSpecRow) => {
    const inspectionType = draft.inspectionType ?? 'AQL';
    if (inspectionType !== 'AQL' || draft.aql == null || !draft.inspectionLevel) return true;
    return availableAqlOptionsForLevel(draft.inspectionLevel)
      .some((option) => Number(option.aqlValue) === Number(draft.aql));
  };

  const applyTemplate = (items: IqcSpecRow[], sampleQty: number, isDest: string) => {
    setSpec((prev) => ({ ...prev, sampleQty, isDest, items }));
    setDirty(true);
    setEditingIdx(-1);
    setEditDraft(null);
  };

  if (!itemCode) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        {t("master.iqcItem.selectItemHint", "좌측에서 품목을 선택하세요.")}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* 검사항목 DataGrid (헤더 컨트롤을 툴바에 통합) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden border border-border rounded-lg bg-bg">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-text">{t("master.iqcItem.inspItem", "검사항목")}</span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-muted whitespace-nowrap">{t("master.iqcItem.defaultSampleQty", "기본 시료수")}</label>
            <input
              type="number"
              min={1}
              value={spec.sampleQty}
              onChange={(e) => updateHeader('sampleQty', Number(e.target.value))}
              className="w-16 border border-border rounded px-2 py-1 text-sm bg-bg text-text"
            />
            <span className="text-sm text-text-muted">{t("master.iqcTemplate.itemsUnit", "개")}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-muted whitespace-nowrap">{t("master.iqcItem.destInspection", "파괴검사")}</label>
            <button
              onClick={() => updateHeader('isDest', spec.isDest === 'Y' ? 'N' : 'Y')}
              className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                spec.isDest === 'Y'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-bg text-text-muted border-border hover:border-text-muted'
              }`}
            >
              {spec.isDest === 'Y' ? t("master.iqcItem.destructive", "파괴") : t("master.iqcItem.nonDestructive", "비파괴")}
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)} className="flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" />
              {t("master.iqcItem.templateManage", "템플릿 불러오기/관리")}
            </Button>
            <Button size="sm" variant="outline" onClick={addRow} className="flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              {t("master.iqcItem.addItem", "항목 추가")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              {saving ? t("common.saving", "저장 중…") : t("common.save", "저장")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            {t("common.loading", "불러오는 중…")}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs [&_th]:border-r [&_td]:border-r [&_th]:border-border/60 [&_td]:border-border/60 [&_tr>*:last-child]:border-r-0">
              <thead className="sticky top-0 bg-primary/10 border-b border-primary/30">
                <tr>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-10">{t("master.iqcItem.seq", "순서")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium">{t("master.iqcItem.inspItem", "검사항목")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-20">{t("master.iqcItem.type", "종류")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-24">{t("master.iqcItem.inspectionType", "검사유형")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-20">{t("master.iqcItem.sampleQtyCol", "샘플수")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-24">{t("master.iqcItem.defectGrade", "불량등급")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-20">{t("master.iqcItem.inspectionLevel", "검사수준")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-20">AQL</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-24">{t("master.iqcItem.lsl", "하한(LSL)")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-24">{t("master.iqcItem.usl", "상한(USL)")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium">{t("master.iqcItem.judgeCriteria", "판정기준")}</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium w-14">{t("common.unit", "단위")}</th>
                  <th className="px-2 py-1.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {spec.items.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-text-muted text-sm">
                      {t("master.iqcItem.noInspItems", "검사항목이 없습니다. [항목 추가]를 눌러 추가하세요.")}
                    </td>
                  </tr>
                )}
                {spec.items.map((row, idx) => {
                  const isEditing = editingIdx === idx;
                  const draft = isEditing ? editDraft! : row;
                  const isMeasure = draft.judgeMethod === 'MEASURE';
                  const draftAqlOptions = availableAqlOptionsForLevel(draft.inspectionLevel);
                  const canConfirmDraft = isDraftAqlStandardValid(draft);

                  if (isEditing) {
                    return (
                      <tr key={idx} className="border-b border-primary/30 bg-primary/5">
                        <td className="px-2 py-1.5 text-text-muted text-center">{row.seq}</td>
                        <td className="px-2 py-1.5">
                          <select
                            value={draft.inspItemCode}
                            onChange={(e) => updateDraft('inspItemCode', e.target.value)}
                            className="w-full border border-border rounded px-2 py-1 bg-surface text-text text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="">{t("master.iqcItem.selectOption", "-- 선택 --")}</option>
                            {poolItems.filter((p) => p.useYn === 'Y').map((p) => (
                              <option key={p.inspItemCode} value={p.inspItemCode}>
                                {p.inspItemCode} {p.inspItemName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          {draft.judgeMethod ? (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isMeasure
                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                              {isMeasure ? t("master.iqcItem.typeMeasure", "측정형") : t("master.iqcItem.typeVisual", "판정형")}
                            </span>
                          ) : <span className="text-text-muted text-xs">-</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={draft.inspectionType ?? 'AQL'}
                            onChange={(e) => updateDraft('inspectionType', e.target.value)}
                            className="w-full border border-border rounded px-2 py-1 bg-surface text-text text-sm focus:border-primary focus:outline-none"
                          >
                            {inspectTypeOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          {(draft.inspectionType === 'DESTRUCTIVE' || draft.inspectionType === 'FULL' || draft.sampleMethod === 'FIXED') ? (
                            <input
                              type="number"
                              min={1}
                              value={draft.sampleQty ?? ''}
                              onChange={(e) => updateDraft('sampleQty', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full border border-border rounded px-2 py-1 text-sm bg-surface text-text focus:border-primary focus:outline-none"
                              placeholder={t("master.iqcItem.fixedQtyPlaceholder", "고정수")}
                            />
                          ) : <span className="text-text-muted text-xs">{t("master.iqcItem.auto", "자동")}</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={draft.defectGrade ?? ''}
                            onChange={(e) => updateDraft('defectGrade', e.target.value || null)}
                            className="w-full border border-border rounded px-2 py-1 bg-surface text-text text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="">-</option>
                            {defectGradeOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={draft.inspectionLevel ?? ''}
                            onChange={(e) => updateDraft('inspectionLevel', e.target.value || null)}
                            className="w-full border border-border rounded px-2 py-1 bg-surface text-text text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="">-</option>
                            {aqlLevelOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={draft.aql == null ? '' : String(draft.aql)}
                            onChange={(e) => updateDraft('aql', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full border border-border rounded px-2 py-1 bg-surface text-text text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="">-</option>
                            {draft.inspectionLevel && draftAqlOptions.length === 0 && (
                              <option value="" disabled>{t("master.iqcItem.registerAqlStandardFirst", "AQL 기준관리에서 먼저 등록하세요")}</option>
                            )}
                            {draftAqlOptions.map((o) => (
                              <option key={o.aqlCode} value={String(o.aqlValue)}>
                                {aqlOptions.find((option) => Number(option.value) === Number(o.aqlValue))?.label ?? o.aqlName ?? o.aqlValue}
                              </option>
                            ))}
                          </select>
                          {!canConfirmDraft && (
                            <div className="mt-1 text-[10px] text-red-600">
                              {t("master.iqcItem.registerAqlStandardFirst", "AQL 기준관리에서 먼저 등록하세요")}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {isMeasure ? (
                            <input
                              type="number"
                              value={draft.lsl ?? ''}
                              onChange={(e) => updateDraft('lsl', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full border border-border rounded px-2 py-1 text-sm bg-surface text-text focus:border-primary focus:outline-none"
                              placeholder={t("master.iqcItem.lslPlaceholder", "하한")}
                            />
                          ) : <span className="text-text-muted text-xs">-</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {isMeasure ? (
                            <input
                              type="number"
                              value={draft.usl ?? ''}
                              onChange={(e) => updateDraft('usl', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full border border-border rounded px-2 py-1 text-sm bg-surface text-text focus:border-primary focus:outline-none"
                              placeholder={t("master.iqcItem.uslPlaceholder", "상한")}
                            />
                          ) : <span className="text-text-muted text-xs">-</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={draft.judgeCriteria ?? ''}
                            onChange={(e) => updateDraft('judgeCriteria', e.target.value === '' ? null : e.target.value)}
                            placeholder={t("master.iqcItem.judgeCriteriaPlaceholder", "판정기준 입력")}
                            className="w-full border border-border rounded px-2 py-1 text-sm bg-surface text-text focus:border-primary focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-text-muted text-xs">{draft.unit ?? '-'}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={confirmEdit}
                              disabled={!canConfirmDraft}
                              className="flex items-center gap-0.5 rounded bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                              title={t("master.iqcItem.confirm", "확인")}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {t("master.iqcItem.confirm", "확인")}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-0.5 rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text transition-colors"
                              title={t("common.cancel", "취소")}
                            >
                              <X className="w-3.5 h-3.5" />
                              {t("common.cancel", "취소")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="border-b border-border hover:bg-bg-elevated transition-colors">
                      <td className="px-2 py-1.5 text-text-muted text-center">{row.seq}</td>
                      <td className="px-2 py-1.5 font-medium text-text">
                        {row.inspItemName || row.inspItemCode || <span className="text-text-muted italic">{t("master.iqcItem.notSelected", "미선택")}</span>}
                        {row.inspItemCode && (
                          <span className="ml-1.5 text-xs text-text-muted">({row.inspItemCode})</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.judgeMethod ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            row.judgeMethod === 'MEASURE'
                              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {row.judgeMethod === 'MEASURE' ? t("master.iqcItem.typeMeasure", "측정형") : t("master.iqcItem.typeVisual", "판정형")}
                          </span>
                        ) : <span className="text-text-muted text-xs">-</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.inspectionType && row.inspectionType !== 'AQL'
                          ? <ComCodeBadge groupCode="IQC_ITEM_INSP_TYPE" code={row.inspectionType} />
                          : <span className="text-text-muted text-xs">AQL</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text">
                        {(row.inspectionType === 'DESTRUCTIVE' || row.inspectionType === 'FULL')
                          ? (row.sampleQty ?? <span className="text-text-muted text-xs">-</span>)
                          : <span className="text-text-muted text-xs">{t("master.iqcItem.auto", "자동")}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.defectGrade
                          ? <ComCodeBadge groupCode="DEFECT_GRADE" code={row.defectGrade} className="!rounded px-2.5 py-1" />
                          : <span className="text-text-muted text-xs">-</span>}
                      </td>
                      <td className="px-2 py-1.5 text-text font-medium">
                        {row.inspectionLevel || <span className="text-text-muted text-xs">-</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text">
                        {row.aql != null ? row.aql : <span className="text-text-muted text-xs">-</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text">
                        {row.lsl !== null ? row.lsl : <span className="text-text-muted text-xs">-</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text">
                        {row.usl !== null ? row.usl : <span className="text-text-muted text-xs">-</span>}
                      </td>
                      <td className="px-2 py-1.5 text-text max-w-[200px]">
                        <span className="block truncate" title={row.judgeCriteria ?? undefined}>
                          {row.judgeCriteria || <span className="text-text-muted text-xs">-</span>}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-text-muted text-xs">{row.unit ?? '-'}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(idx)}
                            disabled={editingIdx !== -1}
                            className="flex items-center gap-0.5 rounded border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t("common.edit", "수정")}
                          >
                            <Pencil className="w-3 h-3" />
                            {t("common.edit", "수정")}
                          </button>
                          <button
                            onClick={() => removeRow(idx)}
                            disabled={editingIdx !== -1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1"
                            aria-label={t("master.iqcItem.deleteRow", "행 삭제")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IqcTemplatePickerModal
        isOpen={templateOpen}
        onClose={() => setTemplateOpen(false)}
        itemName={itemName}
        currentSampleQty={spec.sampleQty}
        currentIsDest={spec.isDest}
        currentItems={spec.items}
        onApply={applyTemplate}
      />
    </div>
  );
}
