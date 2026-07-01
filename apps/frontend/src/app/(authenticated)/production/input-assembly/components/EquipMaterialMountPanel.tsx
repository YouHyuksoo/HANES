"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { PackagePlus, Scan, Trash2 } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button } from "@/components/ui";
import api from "@/services/api";

interface MountedRow {
  equipCode: string;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  availableQty: number;
}

export default function EquipMaterialMountPanel({ equipCode }: { equipCode: string }) {
  const { t } = useTranslation();

  const [rows, setRows] = useState<MountedRow[]>([]);
  const [waitingRows, setWaitingRows] = useState<MountedRow[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [mounting, setMounting] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);

  const fetchMounted = useCallback(async () => {
    if (!equipCode) {
      setRows([]);
      return;
    }
    try {
      const res = await api.get("/production/equip-material/mounted", {
        params: { equipCode },
      });
      setRows((res.data?.data as MountedRow[]) ?? []);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("production.equipMaterial.loadFailed", "장착 자재 조회에 실패했습니다.");
      toast.error(message);
    }
  }, [equipCode, t]);

  // 설비 공정의 장착 대기 공정재고 목록(스캔 없이 선택 장착용)
  const fetchWaiting = useCallback(async () => {
    if (!equipCode) {
      setWaitingRows([]);
      return;
    }
    try {
      const res = await api.get("/production/equip-material/proc-waiting", {
        params: { equipCode },
      });
      setWaitingRows((res.data?.data as MountedRow[]) ?? []);
    } catch {
      setWaitingRows([]);
    }
  }, [equipCode]);

  useEffect(() => {
    if (!equipCode) {
      setRows([]);
      setWaitingRows([]);
      setScanInput("");
      return;
    }
    void fetchMounted();
    void fetchWaiting();
  }, [equipCode, fetchMounted, fetchWaiting]);

  const mountMaterial = useCallback(
    async (raw: string) => {
      const matUid = raw.trim();
      if (!matUid || !equipCode) return;

      setMounting(true);
      try {
        const res = await api.post("/production/equip-material/mount", {
          equipCode,
          matUid,
        });
        const row = res.data?.data as MountedRow | undefined;
        if (row) {
          setRows((prev) => {
            const filtered = prev.filter((r) => r.matUid !== row.matUid);
            return [...filtered, row];
          });
        } else {
          await fetchMounted();
        }
        void fetchWaiting();
        setScanInput("");
        toast.success(t("production.equipMaterial.mountSuccess", "자재가 장착되었습니다."));
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.equipMaterial.mountFailed", "자재 장착에 실패했습니다.");
        toast.error(message);
      } finally {
        setMounting(false);
        scanRef.current?.focus();
      }
    },
    [equipCode, fetchMounted, fetchWaiting, t],
  );

  const unmountMaterial = useCallback(
    async (matUid: string) => {
      if (!equipCode) return;
      try {
        await api.post("/production/equip-material/unmount", {
          equipCode,
          matUid,
        });
        await fetchMounted();
        void fetchWaiting();
        toast.success(t("production.equipMaterial.unmountSuccess", "자재가 해제되었습니다."));
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.equipMaterial.unmountFailed", "자재 해제에 실패했습니다.");
        toast.error(message);
      }
    },
    [equipCode, fetchMounted, fetchWaiting, t],
  );

  return (
    <div className="flex flex-col h-full min-h-0 border border-border rounded">
      <div className="p-4 flex-shrink-0 border-b border-border">
        <h2 className="font-bold text-text mb-3 flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-primary" />
          {t("production.equipMaterial.mountTitle", "설비 자재 장착 (지속)")}
        </h2>
        <BarcodeScanInput
          ref={scanRef}
          value={scanInput}
          onChange={setScanInput}
          onScan={mountMaterial}
          placeholder={t("production.equipMaterial.scanPlaceholder", "자재 바코드 스캔 또는 입력 후 Enter")}
          disabled={!equipCode || mounting}
          fullWidth
        />
        {equipCode && waitingRows.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-text-muted mb-1.5">
              {t("production.equipMaterial.waitingTitle", "장착 대기 (공정재고)")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {waitingRows.map((w) => (
                <button
                  key={w.matUid}
                  type="button"
                  disabled={mounting}
                  onClick={() => mountMaterial(w.matUid)}
                  title={`${w.itemName ?? w.itemCode} · ${w.availableQty.toLocaleString()}`}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text hover:border-primary disabled:opacity-50"
                >
                  <span className="font-mono">{w.matUid}</span>
                  <span className="text-text-muted">({w.availableQty.toLocaleString()})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!equipCode ? (
          <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border rounded">
            {t("production.equipMaterial.selectEquipFirst", "설비를 먼저 선택하세요")}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border rounded">
            {t("production.equipMaterial.noMounted", "장착된 자재가 없습니다.")}
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const depleted = row.availableQty === 0;
              return (
                <div
                  key={row.matUid}
                  className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${
                    depleted ? "border-orange-500" : "border-border"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text">
                      {row.itemName ?? "-"}
                      <span className="text-text-muted"> · {row.itemCode}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs">
                      <span className="text-text-muted">
                        {t("production.equipMaterial.lot", "LOT")}:{" "}
                        <span className="font-mono text-text">{row.matUid}</span>
                      </span>
                      <span className="text-text-muted">
                        {t("production.equipMaterial.remainQty", "잔량")}:{" "}
                        <span className="tabular-nums text-text">
                          {row.availableQty.toLocaleString()}
                        </span>
                      </span>
                      {depleted && (
                        <span className="text-orange-500">
                          {t("production.equipMaterial.refillScan", "보충 스캔")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => unmountMaterial(row.matUid)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    {t("production.equipMaterial.unmount", "해제")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
