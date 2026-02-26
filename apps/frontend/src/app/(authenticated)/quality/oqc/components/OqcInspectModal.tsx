"use client";

/**
 * @file src/app/(authenticated)/quality/oqc/components/OqcInspectModal.tsx
 * @description OQC 검사 실행 모달 - 의뢰 상세 조회 + 검사 판정(PASS/FAIL)
 *
 * 초보자 가이드:
 * 1. **의뢰 정보**: 읽기전용 카드로 표시
 * 2. **박스 목록**: DataGrid + 샘플 체크박스
 * 3. **검사 판정**: PASS/FAIL 버튼
 * 4. API: GET /quality/oqc/:id, POST /quality/oqc/:id/execute
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, XCircle } from "lucide-react";
import { Modal, Button, Input, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface OqcBox {
  id: string;
  boxId: string;
  boxNo: string | null;
  qty: number;
  isSample: string;
}

interface OqcDetail {
  id: string;
  requestNo: string;
  itemCode: string;
  customer: string | null;
  requestDate: string;
  totalBoxCount: number;
  totalQty: number;
  sampleSize: number | null;
  status: string;
  result: string | null;
  inspectorName: string | null;
  remark: string | null;
  boxes: OqcBox[];
  part?: { itemCode?: string; itemName?: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  onSuccess: () => void;
}

export default function OqcInspectModal({ isOpen, onClose, requestId, onSuccess }: Props) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<OqcDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inspectorName, setInspectorName] = useState("");
  const [remark, setRemark] = useState("");
  const [sampleBoxIds, setSampleBoxIds] = useState<Set<string>>(new Set());

  const fetchDetail = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const res = await api.get(`/quality/oqc/${requestId}`);
      const d = res.data?.data;
      setDetail(d);
      setInspectorName(d?.inspectorName || "");
      setRemark(d?.remark || "");
      // 기존 샘플 박스 복원
      if (d?.boxes) {
        setSampleBoxIds(new Set(d.boxes.filter((b: OqcBox) => b.isSample === "Y").map((b: OqcBox) => b.boxId)));
      }
    } catch { setDetail(null); }
    finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => { if (isOpen) fetchDetail(); }, [isOpen, fetchDetail]);

  const toggleSample = useCallback((boxId: string) => {
    setSampleBoxIds(prev => {
      const next = new Set(prev);
      if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
      return next;
    });
  }, []);

  const handleExecute = useCallback(async (result: "PASS" | "FAIL") => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.post(`/quality/oqc/${detail.id}/execute`, {
        result,
        inspectorName: inspectorName || undefined,
        sampleBoxIds: sampleBoxIds.size > 0 ? Array.from(sampleBoxIds) : undefined,
      });
      onClose();
      onSuccess();
    } catch (e) {
      console.error("OQC inspection failed:", e);
    } finally { setSaving(false); }
  }, [detail, inspectorName, sampleBoxIds, onClose, onSuccess]);

  const isEditable = detail?.status === "PENDING" || detail?.status === "IN_PROGRESS";

  const columns = useMemo<ColumnDef<OqcBox>[]>(() => [
    {
      id: "sample", header: t("quality.oqc.sample"), size: 60, meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={sampleBoxIds.has(row.original.boxId)}
          onChange={() => toggleSample(row.original.boxId)}
          disabled={!isEditable}
          className="rounded"
        />
      ),
    },
    {
      accessorKey: "boxNo", header: t("quality.oqc.boxNo"), size: 180, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "qty", header: t("quality.oqc.qty"), size: 80, meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "isSample", header: t("quality.oqc.isSample"), size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          getValue() === "Y"
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }`}>
          {getValue() === "Y" ? t("quality.oqc.sampleYes") : "-"}
        </span>
      ),
    },
  ], [t, sampleBoxIds, isEditable, toggleSample]);

  if (loading || !detail) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={t("quality.oqc.inspectTitle")} size="xl">
        <div className="flex items-center justify-center py-12 text-text-muted">{t("common.loading")}</div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("quality.oqc.inspectTitle")} size="xl">
      <div className="space-y-4">
        {/* 의뢰 정보 카드 */}
        <div className="p-4 bg-background rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-text-muted">{t("quality.oqc.requestNo")}</div>
            <div className="font-medium text-text">{detail.requestNo}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("common.partCode")}</div>
            <div className="font-medium text-text">{detail.part?.itemCode || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("common.partName")}</div>
            <div className="font-medium text-text">{detail.part?.itemName || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("common.status")}</div>
            <ComCodeBadge groupCode="OQC_STATUS" code={detail.status} />
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("quality.oqc.customer")}</div>
            <div className="text-text">{detail.customer || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("quality.oqc.requestDate")}</div>
            <div className="text-text">{new Date(detail.requestDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("quality.oqc.boxCount")}</div>
            <div className="font-mono text-text">{detail.totalBoxCount}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">{t("quality.oqc.totalQty")}</div>
            <div className="font-mono text-text">{detail.totalQty.toLocaleString()}</div>
          </div>
        </div>

        {/* 박스 목록 */}
        <div>
          <h3 className="text-sm font-medium text-text mb-2">{t("quality.oqc.linkedBoxes")}</h3>
          <div className="max-h-[300px] overflow-auto">
            <DataGrid data={detail.boxes || []} columns={columns} />
          </div>
        </div>

        {/* 검사자/비고 입력 */}
        {isEditable && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("quality.oqc.inspector")}
              placeholder={t("quality.oqc.inspectorPlaceholder")}
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              fullWidth
            />
            <Input
              label={t("common.remark")}
              placeholder={t("quality.oqc.remarkPlaceholder")}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              fullWidth
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t("common.close")}</Button>
          {isEditable && (
            <>
              <Button
                variant="secondary"
                onClick={() => handleExecute("FAIL")}
                disabled={saving}
                className="!border-red-300 !text-red-600 hover:!bg-red-50 dark:!border-red-700 dark:!text-red-400 dark:hover:!bg-red-950"
              >
                <XCircle className="w-4 h-4 mr-1" /> {t("quality.oqc.fail")}
              </Button>
              <Button onClick={() => handleExecute("PASS")} disabled={saving}>
                <CheckCircle className="w-4 h-4 mr-1" /> {t("quality.oqc.pass")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
