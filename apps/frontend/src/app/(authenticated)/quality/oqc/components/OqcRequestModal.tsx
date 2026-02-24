"use client";

/**
 * @file src/app/(authenticated)/quality/oqc/components/OqcRequestModal.tsx
 * @description OQC 의뢰 생성 모달 - 품목 선택 + 검사 가능 박스 선택
 *
 * 초보자 가이드:
 * 1. **품목 선택**: 품번/품명으로 필터링
 * 2. **박스 목록**: GET /quality/oqc/available-boxes?partId={id}
 * 3. **체크박스 선택**: 검사 대상 박스 다중 선택
 * 4. **등록**: POST /quality/oqc (boxIds 전송)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Modal, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface AvailableBox {
  id: string;
  boxNo: string;
  partId: string;
  qty: number;
  status: string;
  part?: { partCode?: string; partName?: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OqcRequestModal({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [boxes, setBoxes] = useState<AvailableBox[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [partId, setPartId] = useState("");
  const [customer, setCustomer] = useState("");
  const [sampleSize, setSampleSize] = useState("");
  const [parts, setParts] = useState<{ value: string; label: string }[]>([]);

  /** 품목 목록 조회 */
  const fetchParts = useCallback(async () => {
    try {
      const res = await api.get("/master/parts", { params: { limit: "5000", partType: "FG" } });
      const items = res.data?.data ?? [];
      setParts(items.map((p: any) => ({ value: p.id, label: `${p.partCode} - ${p.partName}` })));
    } catch { setParts([]); }
  }, []);

  /** 검사 가능 박스 조회 */
  const fetchBoxes = useCallback(async () => {
    if (!partId) { setBoxes([]); return; }
    setLoading(true);
    try {
      const res = await api.get("/quality/oqc/available-boxes", { params: { partId } });
      setBoxes(res.data?.data ?? []);
    } catch { setBoxes([]); }
    finally { setLoading(false); }
  }, [partId]);

  useEffect(() => { if (isOpen) fetchParts(); }, [isOpen, fetchParts]);
  useEffect(() => { fetchBoxes(); }, [fetchBoxes]);

  /** 박스 체크박스 토글 */
  const toggleBox = useCallback((boxId: string) => {
    setSelectedBoxIds(prev => {
      const next = new Set(prev);
      if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
      return next;
    });
  }, []);

  /** 전체 선택/해제 */
  const toggleAll = useCallback(() => {
    if (selectedBoxIds.size === boxes.length) {
      setSelectedBoxIds(new Set());
    } else {
      setSelectedBoxIds(new Set(boxes.map(b => b.id)));
    }
  }, [boxes, selectedBoxIds]);

  const selectedQty = useMemo(() =>
    boxes.filter(b => selectedBoxIds.has(b.id)).reduce((sum, b) => sum + b.qty, 0),
  [boxes, selectedBoxIds]);

  /** 의뢰 등록 */
  const handleSubmit = useCallback(async () => {
    if (selectedBoxIds.size === 0) return;
    setSaving(true);
    try {
      await api.post("/quality/oqc", {
        partId,
        boxIds: Array.from(selectedBoxIds),
        customer: customer || undefined,
        sampleSize: sampleSize ? parseInt(sampleSize, 10) : undefined,
      });
      handleClose();
      onSuccess();
    } catch (e) {
      console.error("OQC request creation failed:", e);
    } finally { setSaving(false); }
  }, [partId, selectedBoxIds, customer, sampleSize, onSuccess]);

  const handleClose = useCallback(() => {
    setPartId("");
    setCustomer("");
    setSampleSize("");
    setSelectedBoxIds(new Set());
    setBoxes([]);
    onClose();
  }, [onClose]);

  const columns = useMemo<ColumnDef<AvailableBox>[]>(() => [
    {
      id: "select", header: () => (
        <input type="checkbox" checked={boxes.length > 0 && selectedBoxIds.size === boxes.length}
          onChange={toggleAll} className="rounded" />
      ), size: 40, meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <input type="checkbox" checked={selectedBoxIds.has(row.original.id)}
          onChange={() => toggleBox(row.original.id)} className="rounded" />
      ),
    },
    {
      accessorKey: "boxNo", header: t("quality.oqc.boxNo"), size: 160, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "qty", header: t("quality.oqc.qty"), size: 80, meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span>,
    },
  ], [t, selectedBoxIds, boxes, toggleAll, toggleBox]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("quality.oqc.createRequest")} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Select
            label={t("quality.oqc.selectPart")}
            options={[{ value: "", label: t("quality.oqc.selectPartPlaceholder") }, ...parts]}
            value={partId}
            onChange={setPartId}
            fullWidth
          />
          <Input
            label={t("quality.oqc.customer")}
            placeholder={t("quality.oqc.customerPlaceholder")}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            fullWidth
          />
          <Input
            label={t("quality.oqc.sampleSize")}
            type="number"
            placeholder={t("quality.oqc.sampleSizePlaceholder")}
            value={sampleSize}
            onChange={(e) => setSampleSize(e.target.value)}
            fullWidth
          />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium text-text mb-2">
            {t("quality.oqc.availableBoxes")}
            {boxes.length > 0 && <span className="text-text-muted ml-2">({boxes.length}{t("common.count")})</span>}
          </h3>
          <div className="max-h-[400px] overflow-auto">
            <DataGrid data={boxes} columns={columns} isLoading={loading} />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div className="text-sm text-text-muted">
            {t("quality.oqc.selectedInfo", {
              boxCount: selectedBoxIds.size,
              totalQty: selectedQty.toLocaleString(),
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={saving || selectedBoxIds.size === 0}>
              {saving ? t("common.saving") : t("common.register")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
