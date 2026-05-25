"use client";
/**
 * @file components/IqcSpecPanel.tsx
 * @description 품목별 IQC 기준 우측 패널 — 시료수/파괴검사 헤더 + 검사항목 인라인 DataGrid
 *
 * 초보자 가이드:
 * 1. 선택된 품목(itemCode)에 대한 IQC 기준을 표시/편집
 * 2. 헤더: 시료수(number), 파괴검사여부(Y/N 토글)
 * 3. 검사항목 DataGrid: 행 추가/삭제 + 인라인 편집 (검사항목 선택 + LSL/USL)
 * 4. [저장] 한 번에 POST /master/iqc-part-specs
 */
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save, ClipboardList } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import type { IqcPoolItem, IqcPartSpec, IqcSpecRow } from "../types";
import IqcTemplatePickerModal from "./IqcTemplatePickerModal";
import api from "@/services/api";

interface Props {
  itemCode: string | null;
  itemName: string;
  poolItems: IqcPoolItem[];
}

const EMPTY_SPEC: IqcPartSpec = {
  itemCode: '',
  sampleQty: 1,
  isDest: 'N',
  useYn: 'Y',
  items: [],
};

export default function IqcSpecPanel({ itemCode, itemName, poolItems }: Props) {
  const [spec, setSpec] = useState<IqcPartSpec>(EMPTY_SPEC);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const loadSpec = useCallback(async (code: string) => {
    setLoading(true);
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
    setSpec((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { seq: maxSeq + 1, inspItemCode: '', lsl: null, usl: null, judgeCriteria: null, useYn: 'Y' },
      ],
    }));
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setSpec((prev) => {
      const newItems = prev.items
        .filter((_, i) => i !== idx)
        .map((it, i) => ({ ...it, seq: i + 1 }));
      return { ...prev, items: newItems };
    });
    setDirty(true);
  };

  const updateRow = (idx: number, field: keyof IqcSpecRow, value: unknown) => {
    setSpec((prev) => {
      const items = [...prev.items];
      if (field === 'inspItemCode') {
        const pool = poolItems.find((p) => p.inspItemCode === value);
        items[idx] = {
          ...items[idx],
          inspItemCode: value as string,
          inspItemName: pool?.inspItemName ?? '',
          judgeMethod: pool?.judgeMethod,
          unit: pool?.unit ?? null,
          lsl: null,
          usl: null,
          judgeCriteria: null,
        };
      } else {
        items[idx] = { ...items[idx], [field]: value };
      }
      return { ...prev, items };
    });
    setDirty(true);
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

  // 템플릿 적용 — 현재 품목 항목을 통째로 대체 (로컬 상태, [저장]으로 확정)
  const applyTemplate = (items: IqcSpecRow[], sampleQty: number, isDest: string) => {
    setSpec((prev) => ({ ...prev, sampleQty, isDest, items }));
    setDirty(true);
  };

  if (!itemCode) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        좌측에서 품목을 선택하세요.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* 헤더 카드 */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="font-semibold text-text min-w-0 truncate max-w-xs">
              {itemName}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">기본 시료수</label>
              <input
                type="number"
                min={1}
                value={spec.sampleQty}
                onChange={(e) => updateHeader('sampleQty', Number(e.target.value))}
                className="w-20 border border-border rounded px-2 py-1 text-sm bg-bg text-text"
              />
              <span className="text-sm text-text-muted">개</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">파괴검사</label>
              <button
                onClick={() => updateHeader('isDest', spec.isDest === 'Y' ? 'N' : 'Y')}
                className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                  spec.isDest === 'Y'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-bg text-text-muted border-border hover:border-text-muted'
                }`}
              >
                {spec.isDest === 'Y' ? '파괴' : '비파괴'}
              </button>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 검사항목 DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden border border-border rounded-lg bg-bg">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-text">검사항목</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)} className="flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" />
              템플릿 불러오기/관리
            </Button>
            <Button size="sm" variant="outline" onClick={addRow} className="flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              항목 추가
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            불러오는 중…
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg-elevated border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-12">순서</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">검사항목</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-20">종류</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-28">하한(LSL)</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-28">상한(USL)</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">판정기준</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium w-16">단위</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {spec.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-muted text-sm">
                      검사항목이 없습니다. [항목 추가]를 눌러 추가하세요.
                    </td>
                  </tr>
                )}
                {spec.items.map((row, idx) => {
                  const isMeasure = row.judgeMethod === 'MEASURE';
                  return (
                    <tr key={idx} className="border-b border-border hover:bg-bg-elevated transition-colors">
                      <td className="px-3 py-1.5 text-text-muted text-center">{row.seq}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={row.inspItemCode}
                          onChange={(e) => updateRow(idx, 'inspItemCode', e.target.value)}
                          className="w-full border border-border rounded px-2 py-1 bg-bg text-text text-sm"
                        >
                          <option value="">-- 선택 --</option>
                          {poolItems.filter((p) => p.useYn === 'Y').map((p) => (
                            <option key={p.inspItemCode} value={p.inspItemCode}>
                              {p.inspItemCode} {p.inspItemName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        {row.judgeMethod ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            row.judgeMethod === 'MEASURE'
                              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {row.judgeMethod === 'MEASURE' ? '측정형' : '판정형'}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {isMeasure ? (
                          <input
                            type="number"
                            value={row.lsl ?? ''}
                            onChange={(e) => updateRow(idx, 'lsl', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full border border-border rounded px-2 py-1 text-sm bg-bg text-text"
                          />
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {isMeasure ? (
                          <input
                            type="number"
                            value={row.usl ?? ''}
                            onChange={(e) => updateRow(idx, 'usl', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full border border-border rounded px-2 py-1 text-sm bg-bg text-text"
                          />
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {!isMeasure ? (
                          <input
                            type="text"
                            value={row.judgeCriteria ?? ''}
                            onChange={(e) => updateRow(idx, 'judgeCriteria', e.target.value === '' ? null : e.target.value)}
                            placeholder="판정기준"
                            className="w-full border border-border rounded px-2 py-1 text-sm bg-bg text-text"
                          />
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-text-muted text-xs">
                        {row.unit ?? '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => removeRow(idx)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          aria-label="행 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
