"use client";

/**
 * @file src/app/(authenticated)/shipping/pack/page.tsx
 * @description 제품포장관리 페이지 - 박스 단위 포장 관리
 *
 * 워크플로우:
 * 1. **박스 생성(발번)**: 포장할 품목을 선택해 박스를 먼저 생성 (boxNo 자동 채번, qty=0)
 * 2. **박스 구성(시리얼 추가)**: 검사 합격 FG 시리얼을 박스에 담는다.
 *    품목 마스터의 박스 구성단위(packUnit)를 초과할 수 없고, 미만은 허용된다.
 * 3. **박스 완료(마감)**: 마감하면 박스 1개가 완성된다 (CLOSED + OQC 자동 생성)
 *    필요 시 재오픈 가능.
 *
 * API: /shipping/boxes (자연키 boxNo 기준)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Package, Plus, Search, RefreshCw, XCircle, Lock, LockOpen,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select } from "@/components/ui";
import PartSelect from "@/components/shared/PartSelect";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";
import api from "@/services/api";

/** 박스 (백엔드 BOX_MASTERS 자연키 boxNo, 시리얼은 serialList JSON) */
interface Box {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  status: BoxStatus;
  serialList: string | null;
  closeAt: string | null;
  palletNo: string | null;
  oqcStatus: string | null;
  /** 품목 마스터의 박스 구성단위 (없으면 제한 없음) */
  packUnit: number | null;
  createdAt: string;
}

/** serialList(JSON 문자열) → 배열 */
function parseSerials(box: Box | null): string[] {
  if (!box?.serialList) return [];
  try {
    const parsed = JSON.parse(box.serialList);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function PackPage() {
  const { t } = useTranslation();
  const comCodeOptions = useComCodeOptions("BOX_STATUS");
  const statusOptions = useMemo(
    () => [{ value: "", label: t("common.allStatus") }, ...comCodeOptions],
    [t, comCodeOptions],
  );
  const [data, setData] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [createItemCode, setCreateItemCode] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [lastAddedSerial, setLastAddedSerial] = useState("");
  const [isAddingSerial, setIsAddingSerial] = useState(false);
  const serialInputRef = useRef<HTMLInputElement>(null);

  const focusSerialInput = useCallback(() => {
    window.setTimeout(() => {
      const input = serialInputRef.current;
      if (input && !input.disabled) {
        input.focus();
      }
    }, 0);
  }, []);

  const fetchData = useCallback(async (): Promise<Box[]> => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/boxes", { params });
      const list: Box[] = res.data?.data ?? [];
      setData(list);
      return list;
    } catch (e) {
      setPageError(errMsg(e, t("shipping.pack.loadError")));
      setData([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openSerialModal = useCallback((box: Box) => {
    setSelectedBox(box);
    setSerialInput("");
    setModalError("");
    setLastAddedSerial("");
    setIsSerialModalOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!createItemCode) { setModalError(t("shipping.pack.selectItemFirst")); return; }
    setSaving(true);
    setModalError("");
    try {
      // qty는 시리얼 추가 시 자동 채워짐 → 생성은 품목만
      await api.post("/shipping/boxes", { itemCode: createItemCode });
      setIsCreateModalOpen(false);
      setCreateItemCode("");
      fetchData();
    } catch (e) {
      setModalError(errMsg(e, t("shipping.pack.createError")));
    } finally {
      setSaving(false);
    }
  }, [createItemCode, fetchData, t]);

  const refreshSelected = useCallback(async (boxNo: string) => {
    const list = await fetchData();
    setSelectedBox(list.find((b) => b.boxNo === boxNo) ?? null);
  }, [fetchData]);

  const handleAddSerial = useCallback(async (rawSerial?: string) => {
    const nextSerial = (rawSerial ?? serialInput).replace(/[\r\n]+/g, "").trim();
    if (!nextSerial || !selectedBox || isAddingSerial) return;
    setIsAddingSerial(true);
    setModalError("");
    try {
      await api.post(`/shipping/boxes/${selectedBox.boxNo}/serials`, { serials: [nextSerial] });
      setSerialInput("");
      setLastAddedSerial(nextSerial);
      await refreshSelected(selectedBox.boxNo);
      focusSerialInput();
    } catch (e) {
      setModalError(errMsg(e, t("shipping.pack.addSerialError")));
      focusSerialInput();
    } finally {
      setIsAddingSerial(false);
    }
  }, [serialInput, selectedBox, isAddingSerial, refreshSelected, focusSerialInput, t]);

  const handleRemoveSerial = useCallback(async (serial: string) => {
    if (!selectedBox) return;
    setModalError("");
    try {
      await api.delete(`/shipping/boxes/${selectedBox.boxNo}/serials`, { data: { serials: [serial] } });
      if (lastAddedSerial === serial) {
        setLastAddedSerial("");
      }
      await refreshSelected(selectedBox.boxNo);
      focusSerialInput();
    } catch (e) {
      setModalError(errMsg(e, t("shipping.pack.removeSerialError")));
      focusSerialInput();
    }
  }, [selectedBox, lastAddedSerial, refreshSelected, focusSerialInput, t]);

  const handleCloseBox = useCallback(async (box: Box) => {
    setPageError("");
    try {
      await api.post(`/shipping/boxes/${box.boxNo}/close`);
      fetchData();
    } catch (e) {
      setPageError(errMsg(e, t("shipping.pack.closeError")));
    }
  }, [fetchData, t]);

  const handleReopenBox = useCallback(async (box: Box) => {
    setPageError("");
    try {
      await api.post(`/shipping/boxes/${box.boxNo}/reopen`);
      fetchData();
    } catch (e) {
      setPageError(errMsg(e, t("shipping.pack.reopenError")));
    }
  }, [fetchData, t]);

  const columns = useMemo<ColumnDef<Box>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 130, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const box = row.original;
        return (
          <div className="flex gap-1 justify-center">
            <button className="p-1 hover:bg-surface rounded disabled:opacity-40" title={t("shipping.pack.addSerial")} disabled={box.status !== "OPEN"} onClick={() => openSerialModal(box)}>
              <Plus className={`w-4 h-4 ${box.status === "OPEN" ? "text-primary" : "text-text-muted"}`} />
            </button>
            {box.status === "CLOSED" ? (
              <button className="p-1 hover:bg-surface rounded" title={t("shipping.pack.reopenBox")} disabled={!!box.palletNo} onClick={() => handleReopenBox(box)}>
                <LockOpen className={`w-4 h-4 ${box.palletNo ? "text-text-muted" : "text-amber-500"}`} />
              </button>
            ) : (
              <button className="p-1 hover:bg-surface rounded disabled:opacity-40" title={t("shipping.pack.closeBox")} disabled={box.status !== "OPEN"} onClick={() => handleCloseBox(box)}>
                <Lock className={`w-4 h-4 ${box.status === "OPEN" ? "text-primary" : "text-text-muted"}`} />
              </button>
            )}
          </div>
        );
      },
    },
    { accessorKey: "boxNo", header: t("shipping.pack.boxNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "qty", header: t("shipping.pack.packedQty"), size: 110, meta: { align: "center" as const, filterType: "number" as const },
      cell: ({ row }) => {
        const { qty, packUnit } = row.original;
        return <span className="font-medium">{(qty ?? 0).toLocaleString()}{packUnit ? <span className="text-text-muted"> / {packUnit.toLocaleString()}</span> : null}</span>;
      },
    },
    { accessorKey: "status", header: t("common.status"), size: 100, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <BoxStatusBadge status={getValue() as BoxStatus} /> },
    { accessorKey: "closeAt", header: t("shipping.pack.closedAt"), size: 150, meta: { filterType: "date" as const }, cell: ({ getValue }) => (getValue() ? String(getValue()).replace("T", " ").slice(0, 16) : "-") },
  ], [t, openSerialModal, handleCloseBox, handleReopenBox]);

  // 시리얼 모달 용량 계산
  const modalSerials = parseSerials(selectedBox);
  const modalPackUnit = selectedBox?.packUnit ?? null;
  const atLimit = modalPackUnit != null && modalSerials.length >= modalPackUnit;

  useEffect(() => {
    if (isSerialModalOpen) {
      focusSerialInput();
    }
  }, [isSerialModalOpen, selectedBox?.boxNo, modalSerials.length, focusSerialInput]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t("shipping.pack.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.pack.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => { setCreateItemCode(""); setModalError(""); setIsCreateModalOpen(true); }}><Plus className="w-4 h-4 mr-1" /> {t("shipping.pack.createBox")}</Button>
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /><span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError("")}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("shipping.pack.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.pack.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          }
        sqlQuery={`SELECT *\nFROM BOX_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      {/* 박스 생성: 품목만 선택 (qty는 시리얼로 채움) */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t("shipping.pack.createBox")} size="lg">
        <div className="space-y-4">
          {modalError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /><span>{modalError}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("shipping.pack.selectItem")}</label>
            <PartSelect partType="FINISHED" value={createItemCode} onChange={setCreateItemCode} fullWidth />
          </div>
          <p className="text-xs text-text-muted">{t("shipping.pack.createHint")}</p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving || !createItemCode}>
              {saving ? t("common.saving") : t("shipping.pack.createBox")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 박스 구성: 시리얼 추가/제거 */}
      <Modal isOpen={isSerialModalOpen} onClose={() => setIsSerialModalOpen(false)} title={t("shipping.pack.addSerial")} size="2xl">
        <div className="space-y-4">
          {selectedBox && (
            <div className="p-3 bg-background rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">{t("shipping.pack.box")}: <span className="font-medium text-text">{selectedBox.boxNo}</span></p>
                <p className="text-sm text-text-muted">{selectedBox.itemName ?? selectedBox.itemCode}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">{t("shipping.pack.capacity")}</p>
                <p className={`text-lg font-bold ${atLimit ? "text-amber-500" : "text-primary"}`}>
                  {modalSerials.length}{modalPackUnit != null ? ` / ${modalPackUnit}` : ""}
                </p>
              </div>
            </div>
          )}
          {modalError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /><span>{modalError}</span>
            </div>
          )}
          {atLimit && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm">
              {t("shipping.pack.packLimitReached")}
            </div>
          )}
          {lastAddedSerial && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <span className="min-w-0 truncate text-text">
                {t("shipping.pack.justAdded", "방금 추가")}: <span className="font-mono font-semibold">{lastAddedSerial}</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleRemoveSerial(lastAddedSerial)}
                disabled={selectedBox?.status !== "OPEN"}
              >
                {t("common.cancel", "취소")}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              ref={serialInputRef}
              placeholder={t("shipping.pack.serialPlaceholder")}
              value={serialInput}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (/[\r\n]/.test(nextValue)) {
                  handleAddSerial(nextValue);
                  return;
                }
                setSerialInput(nextValue);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !atLimit) {
                  e.preventDefault();
                  handleAddSerial(e.currentTarget.value);
                }
              }}
              disabled={atLimit || selectedBox?.status !== "OPEN" || isAddingSerial}
              fullWidth
            />
            <Button onClick={() => handleAddSerial()} disabled={atLimit || !serialInput.trim() || selectedBox?.status !== "OPEN" || isAddingSerial}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="max-h-52 overflow-y-auto border border-border rounded-lg p-2">
            {modalSerials.length === 0 && (
              <p className="text-xs text-text-muted text-center py-4">{t("shipping.pack.noSerials")}</p>
            )}
            {modalSerials.map((serial, idx) => (
              <div key={serial} className="flex items-center justify-between py-1 px-2 hover:bg-background rounded">
                <span className="text-sm font-mono">{idx + 1}. {serial}</span>
                <button title={t("shipping.pack.removeSerial")} onClick={() => handleRemoveSerial(serial)}>
                  <XCircle className="w-4 h-4 text-text-muted cursor-pointer hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setIsSerialModalOpen(false)}>{t("common.close")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
