"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { AlertCircle, CheckCircle2, PackagePlus, Scan, Trash2 } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import api from "@/services/api";

interface MountedRow {
  equipCode: string;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  availableQty: number;
}

interface BomItem {
  childItemCode: string;
  childItemName?: string | null;
  qtyPer: number;
  seq: number;
  childPart?: { itemType?: string | null; itemName?: string | null } | null;
}

export default function EquipMaterialMountPanel({
  equipCode,
  orderNo,
  itemCode,
  expectedItemTypes,
  autoFocusKey,
}: {
  equipCode: string;
  /** 지정 시 작업지시 BOM 오장착 검증 API로 스캔 장착한다. */
  orderNo?: string;
  /** 지정 시 작업지시 선택 직후 BOM 요구 품목을 미리 표시한다. */
  itemCode?: string;
  /** BOM 표시 품목유형 필터. 미지정 시 CONSUMABLE만 제외한다. */
  expectedItemTypes?: string[];
  /** 값이 바뀌면 스캔 입력으로 포커스를 이동한다. */
  autoFocusKey?: string;
}) {
  const { t } = useTranslation();

  const [rows, setRows] = useState<MountedRow[]>([]);
  const [waitingRows, setWaitingRows] = useState<MountedRow[]>([]);
  const [expectedItems, setExpectedItems] = useState<BomItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [mounting, setMounting] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const expectedItemTypesKey = expectedItemTypes?.join('|') ?? '';

  const fetchExpectedItems = useCallback(async () => {
    if (!itemCode) {
      setExpectedItems([]);
      return;
    }
    try {
      const res = await api.get(`/master/boms/parent/${encodeURIComponent(itemCode)}`);
      const bomRows = (res.data?.data as BomItem[] | undefined) ?? [];
      const filtered = bomRows.filter((item) => {
        const itemType = item.childPart?.itemType ?? null;
        const typeFilter = expectedItemTypesKey ? expectedItemTypesKey.split('|') : [];
        if (typeFilter.length > 0) {
          return itemType ? typeFilter.includes(itemType) : false;
        }
        return itemType !== "CONSUMABLE";
      });
      setExpectedItems(filtered);
    } catch {
      setExpectedItems([]);
    }
  }, [expectedItemTypesKey, itemCode]);

  useEffect(() => {
    void fetchExpectedItems();
  }, [fetchExpectedItems]);

  useEffect(() => {
    if (!autoFocusKey) return;
    const timer = window.setTimeout(() => scanRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [autoFocusKey]);

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

  const mountedByItem = useMemo(() => {
    const map = new Map<string, MountedRow[]>();
    for (const row of rows) {
      if ((row.availableQty ?? 0) <= 0) continue;
      const list = map.get(row.itemCode) ?? [];
      list.push(row);
      map.set(row.itemCode, list);
    }
    return map;
  }, [rows]);

  const coveredExpectedCount = expectedItems.filter((item) => mountedByItem.has(item.childItemCode)).length;
  const waitingRowsToShow = useMemo(() => {
    if (expectedItems.length === 0) return waitingRows;
    const expectedCodes = new Set(expectedItems.map((item) => item.childItemCode));
    return waitingRows.filter((row) => expectedCodes.has(row.itemCode));
  }, [expectedItems, waitingRows]);

  const mountMaterial = useCallback(
    async (raw: string) => {
      const matUid = raw.trim();
      if (!matUid || !equipCode) return;

      setMounting(true);
      try {
        const res = orderNo
          ? await api.post(
              `/production/job-orders/${encodeURIComponent(orderNo)}/material-mounts/scan`,
              { equipCode, matUid },
            )
          : await api.post("/production/equip-material/mount", {
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
    [equipCode, fetchMounted, fetchWaiting, orderNo, t],
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* 고정 영역: 제목 + 스캔 입력만. 목록류는 아래 스크롤 영역에 둔다(내용이 많아도 패널 밖으로 넘치지 않음). */}
      <div className="flex-shrink-0 border-b border-border bg-slate-100 dark:bg-slate-800 px-3 py-2">
        <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text">
          <PackagePlus className="h-3.5 w-3.5 text-primary" />
          {t("production.equipMaterial.mountTitle", "설비 자재 장착 (지속)")}
          <span className="ml-auto tabular-nums text-text-muted">{rows.length}</span>
        </h2>
        <BarcodeScanInput
          ref={scanRef}
          value={scanInput}
          onChange={setScanInput}
          onScan={mountMaterial}
          className="!h-8 !text-xs"
          placeholder={t("production.equipMaterial.scanPlaceholder", "자재 바코드 스캔 또는 입력 후 Enter")}
          disabled={!equipCode || mounting || (Boolean(orderNo) && expectedItems.length === 0)}
          maintainFocus={Boolean(equipCode)}
          fullWidth
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!equipCode ? (
          <p className="m-3 rounded border border-dashed border-border py-6 text-center text-xs text-text-muted">
            {t("production.equipMaterial.selectEquipFirst", "설비를 먼저 선택하세요")}
          </p>
        ) : (
          <>
            {expectedItems.length > 0 && (
              <section>
                <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
                  <PackagePlus className="h-3.5 w-3.5 text-primary" />
                  <span>{t("production.equipMaterial.expectedBom", "작업지시 BOM 장착 품목")}</span>
                  <span className="ml-auto tabular-nums text-text-muted">
                    {coveredExpectedCount}/{expectedItems.length}
                  </span>
                </div>
                <ul className="divide-y divide-border/40">
                  {expectedItems.map((item) => {
                    const mounts = mountedByItem.get(item.childItemCode) ?? [];
                    const mounted = mounts.length > 0;
                    const firstUid = mounts[0]?.matUid;
                    const extra = mounts.length - 1;
                    return (
                      <li key={`${item.childItemCode}-${item.seq}`} className="flex items-center gap-2 px-3 py-1.5">
                        {mounted
                          ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                          : <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-1">
                            <span className="truncate text-[11px] font-bold leading-none text-text">{item.childItemCode}</span>
                            <span className="shrink-0 text-[11px] font-bold leading-none tabular-nums text-text">{Number(item.qtyPer ?? 0).toLocaleString()}</span>
                          </div>
                          <div className={`mt-0.5 truncate text-[10px] leading-none ${mounted ? "text-green-700 dark:text-green-300" : "italic text-red-400"}`}>
                            {mounted
                              ? `${firstUid}${extra > 0 ? t("kiosk.material.andMore", { count: extra }) : ""}`
                              : t("kiosk.material.noLot", "미장착")}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {waitingRowsToShow.length > 0 && (
              <section className="border-t-2 border-border">
                <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
                  <Scan className="h-3.5 w-3.5 text-primary" />
                  <span>{t("production.equipMaterial.waitingTitle", "장착 대기 (공정재고)")}</span>
                  <span className="ml-auto tabular-nums text-text-muted">{waitingRowsToShow.length}</span>
                </div>
                <div className="flex flex-wrap gap-1 px-3 py-2">
                  {waitingRowsToShow.map((w) => (
                    <button
                      key={w.matUid}
                      type="button"
                      disabled={mounting}
                      onClick={() => mountMaterial(w.matUid)}
                      title={`${w.itemName ?? w.itemCode} · ${w.availableQty.toLocaleString()}`}
                      className="inline-flex max-w-full items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] leading-tight text-text hover:border-primary disabled:opacity-50"
                    >
                      <span className="truncate font-mono">{w.matUid}</span>
                      <span className="shrink-0 tabular-nums text-text-muted">({w.availableQty.toLocaleString()})</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="border-t-2 border-border">
              <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>{t("production.equipMaterial.mountedList", "장착 자재")}</span>
                <span className="ml-auto tabular-nums text-text-muted">{rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-text-muted">
                  {t("production.equipMaterial.noMounted", "장착된 자재가 없습니다.")}
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {rows.map((row) => {
                    const depleted = row.availableQty === 0;
                    return (
                      <li
                        key={row.matUid}
                        className={`flex items-center gap-2 px-3 py-1.5 ${depleted ? "border-l-2 border-l-orange-500" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-bold leading-none text-text">
                            {row.itemName ?? "-"}
                            <span className="font-normal text-text-muted"> · {row.itemCode}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] leading-none">
                            <span className="truncate font-mono text-text">{row.matUid}</span>
                            <span className="shrink-0 tabular-nums text-text-muted">
                              {t("production.equipMaterial.remainQty", "잔량")} {row.availableQty.toLocaleString()}
                            </span>
                            {depleted && (
                              <span className="shrink-0 text-orange-500">
                                {t("production.equipMaterial.refillScan", "보충 스캔")}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => unmountMaterial(row.matUid)}
                          title={t("production.equipMaterial.unmount", "해제")}
                          aria-label={t("production.equipMaterial.unmount", "해제")}
                          className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
