"use client";

/**
 * @file inspection/result/components/ConsumablePanel.tsx
 * @description 통전검사 화면 소모성 설비부품 — 매핑 표시 + conUid 스캔 장착
 *
 * 초보자 가이드:
 * - 선택된 작업지시(모델 itemCode + 설비 equipCode)에 매핑된 소모품을 조회한다.
 * - 실제 소모품 롯트의 바코드(conUid)를 스캔하면 그 롯트를 설비에 장착(MOUNTED)한다.
 * - input-kiosk와 동일한 키오스크 소모품 API 3종을 그대로 재사용한다(백엔드 변경 없음).
 * - 매핑 소모품이 모두 장착되어야 검사(PASS/FAIL)가 가능하도록 onStatusChange로 부모에 보고한다.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { AlertTriangle, AlertCircle, CheckCircle2, ScanLine, X } from "lucide-react";
import { Card, CardContent, ConfirmModal } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import api from "@/services/api";

/** 매핑 기반 소모품 행 (백엔드 KioskConsumableRow) */
interface ConsumableMapRow {
  consumableCode: string;
  name: string;
  usagePerUnit: number;
  expectedLife: number | null;
  warningCount: number | null;
  mountedConUid: string | null;
  currentCount: number | null;
  lotStatus: string | null;
}

interface Props {
  orderNo: string;
  /** 선택된 검사기(설비). 미지정 시 소모품을 조회하지 않는다. */
  equipCode?: string;
  /** 매핑 소모품 장착 완료 여부(매핑 0건이면 true) + 미장착 수량을 부모에 보고 */
  onStatusChange: (allMounted: boolean, unmountedCount: number) => void;
}

export default function ConsumablePanel({ orderNo, equipCode, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ConsumableMapRow[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [refreshSeq, setRefreshSeq] = useState(0);
  /** 강제 장착 해제 확인 대상 */
  const [unmountTarget, setUnmountTarget] = useState<ConsumableMapRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 검사기 미선택 시 소모품 조회하지 않음(설비 기준 조회이므로)
    if (!orderNo || !equipCode) {
      setItems([]);
      return;
    }
    api
      // includeMounted: 검사기에 장착된 소모품은 작업지시(품목)가 바뀌어도 계속 표시(설비 귀속 영속)
      .get(`/production/job-orders/${orderNo}/consumables`, { params: { equipCode, includeMounted: 1 } })
      .then((res) => setItems(res.data?.data ?? []))
      .catch(() => setItems([]));
  }, [orderNo, equipCode, refreshSeq]);

  // 장착 현황을 부모(InspectPanel)에 보고 — 인터락 판단에 사용
  // 검사기 미선택은 별도(상위 equipRequired)에서 차단하므로 소모품 자체는 미적용(true)으로 보고
  useEffect(() => {
    if (!equipCode) {
      onStatusChange(true, 0);
      return;
    }
    const unmounted = items.filter((c) => c.mountedConUid == null).length;
    onStatusChange(items.length === 0 || unmounted === 0, unmounted);
  }, [items, equipCode, onStatusChange]);

  const mountedCount = items.filter((c) => c.mountedConUid != null).length;

  const handleScan = useCallback(
    async (rawConUid?: string) => {
      const conUid = (rawConUid ?? scanInput).replace(/\r?\n|\r/g, "").trim();
      if (!conUid || !orderNo || !equipCode) return;
      setScanInput("");
      try {
        const res = await api.post(`/production/job-orders/${orderNo}/consumables/scan`, { conUid, equipCode });
        const lot = res.data?.data as { consumableCode: string };
        toast.success(`✓ ${lot.consumableCode}`, { duration: 1000 });
        setRefreshSeq((s) => s + 1);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
        toast.error(msg || t("inspection.result.consumableScanPlaceholder"));
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [scanInput, orderNo, equipCode, t],
  );

  /** 강제 장착 해제 실행(확인 모달에서 호출) — 롯트를 설비에서 분리(ACTIVE 복귀) */
  const handleConfirmUnmount = useCallback(
    async () => {
      const item = unmountTarget;
      setUnmountTarget(null);
      if (!orderNo || !item?.mountedConUid) return;
      try {
        await api.delete(`/production/job-orders/${orderNo}/consumables/${item.mountedConUid}`);
        toast.success(t("inspection.result.consumableUnmounted"), { duration: 1000 });
        setRefreshSeq((s) => s + 1);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
        toast.error(msg || t("common.error"));
      }
    },
    [orderNo, unmountTarget, t],
  );

  return (
    <Card padding="sm">
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-text">{t("inspection.result.consumablesTitle")}</span>
          <span className="ml-auto text-xs text-text-muted tabular-nums">
            {mountedCount}/{items.length}
          </span>
        </div>

        {/* 스캔 입력 (검사기 미선택 시 비활성) */}
        <div className={`mb-2 ${!equipCode ? "opacity-50" : ""}`}>
          <BarcodeScanInput
            ref={inputRef}
            value={scanInput}
            onChange={setScanInput}
            onScan={handleScan}
            disabled={!equipCode}
            placeholder={t("inspection.result.consumableScanPlaceholder")}
            className="text-sm"
            fullWidth
          />
        </div>

        {!equipCode ? (
          <p className="text-xs text-text-muted text-center py-3">{t("inspection.result.selectEquipFirst")}</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-3">{t("inspection.result.noConsumables")}</p>
        ) : (
          <ul className="divide-y divide-border/40 max-h-44 overflow-y-auto">
            {items.map((item) => {
              const isMounted = Boolean(item.mountedConUid);
              const over =
                item.expectedLife != null && item.currentCount != null && item.currentCount >= item.expectedLife;
              const warn =
                !over &&
                item.warningCount != null &&
                item.currentCount != null &&
                item.currentCount >= item.warningCount;
              return (
                <li
                  key={item.consumableCode}
                  className={[
                    "flex items-center gap-1.5 px-2 py-1.5 border-l-2 transition-colors",
                    !isMounted
                      ? "border-l-red-400"
                      : over
                        ? "border-l-red-500"
                        : warn
                          ? "border-l-orange-400"
                          : "border-l-green-500",
                  ].join(" ")}
                >
                  {!isMounted ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : over ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  ) : warn ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-bold text-text truncate leading-none">{item.consumableCode}</span>
                      {isMounted && item.expectedLife != null && (
                        <span
                          className={`text-[11px] font-bold tabular-nums shrink-0 leading-none ${over ? "text-red-600 dark:text-red-400" : warn ? "text-orange-600 dark:text-orange-400" : "text-text-muted"}`}
                        >
                          {(item.currentCount ?? 0).toLocaleString()}/{item.expectedLife.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-0.5">
                      {isMounted ? (
                        <>
                          <span className="text-[11px] text-green-700 dark:text-green-300 truncate leading-none">
                            {item.mountedConUid}
                          </span>
                          <span className="text-[11px] font-medium text-green-700 dark:text-green-300 shrink-0 leading-none">
                            {t("inspection.result.consumableMounted")}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-red-400 italic leading-none truncate">{item.name}</span>
                      )}
                    </div>
                  </div>
                  {isMounted && (
                    <button
                      onClick={() => setUnmountTarget(item)}
                      className="shrink-0 inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted transition-colors hover:border-red-400 hover:text-red-500"
                      title={t("inspection.result.consumableUnmount")}
                    >
                      <X className="w-3 h-3" />
                      {t("inspection.result.consumableUnmount")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* 강제 장착 해제 확인 */}
      <ConfirmModal
        isOpen={unmountTarget !== null}
        onClose={() => setUnmountTarget(null)}
        onConfirm={handleConfirmUnmount}
        title={t("inspection.result.consumableUnmount")}
        message={t("inspection.result.consumableUnmountConfirm", { code: unmountTarget?.consumableCode ?? "" })}
        variant="danger"
      />
    </Card>
  );
}
