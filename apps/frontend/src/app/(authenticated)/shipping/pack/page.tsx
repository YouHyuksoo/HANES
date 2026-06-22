"use client";

/**
 * @file src/app/(authenticated)/shipping/pack/page.tsx
 * @description 제품포장관리 페이지 - 박스 단위 포장 관리
 *
 * 워크플로우:
 * 1. **박스 생성(발번)**: 포장할 품목을 선택해 박스를 먼저 생성 (boxNo 자동 채번, qty=0)
 * 2. **박스 구성(시리얼 추가)**: 검사 합격 FG 시리얼을 박스에 담는다.
 *    품목 마스터의 박스입수량(boxQty)를 초과할 수 없고, 미만은 허용된다.
 * 3. **박스 완료(마감)**: 마감하면 박스 1개가 완성된다 (CLOSED + OQC 자동 생성)
 *    필요 시 재오픈 가능.
 *
 * API: /shipping/boxes (자연키 boxNo 기준)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Package, Plus, Search, RefreshCw, XCircle,
  AlertTriangle, Printer, Lock, LockOpen, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, Button, ConfirmModal, Input, Modal, Select } from "@/components/ui";
import PartSelect from "@/components/shared/PartSelect";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";
import api from "@/services/api";
import BoxLabelModal from "./components/BoxLabelModal";

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
  /** 품목 마스터의 박스입수량 (없으면 제한 없음) */
  boxQty: number | null;
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

/** findBoxItems API 응답 */
interface BoxItem {
  seq: number;
  fgBarcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  equipCode: string | null;
  workerId: string | null;
  lineCode: string | null;
  status: string;
  inspectPassYn: string | null;
  issuedAt: string | null;
  missingLabel: boolean;
}

function isEmptyBox(box: Box): boolean {
  return (box.qty ?? 0) <= 0 && parseSerials(box).length === 0;
}

function canDeleteEmptyBox(box: Box): boolean {
  return box.status === "OPEN" && !box.palletNo && !box.oqcStatus && isEmptyBox(box);
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
  const [removeSerialTarget, setRemoveSerialTarget] = useState("");
  const [deleteBoxTarget, setDeleteBoxTarget] = useState<Box | null>(null);
  const [isAddingSerial, setIsAddingSerial] = useState(false);
  // 박스 라벨 출력/재발행 모달
  const [labelBox, setLabelBox] = useState<Box | null>(null);
  const [labelAutoPrint, setLabelAutoPrint] = useState(false);
  const [boxItems, setBoxItems] = useState<BoxItem[]>([]);
  const [boxItemsLoading, setBoxItemsLoading] = useState(false);
  const serialInputRef = useRef<HTMLInputElement>(null);

  /** 라벨 재발행(수동) — 자동출력 없이 라벨 모달만 연다 */
  const openLabel = useCallback((box: Box) => {
    setLabelAutoPrint(false);
    setLabelBox(box);
  }, []);

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

  const activePackingBoxNo = isSerialModalOpen ? selectedBox?.boxNo ?? "" : "";

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

  const refreshSelected = useCallback(async (boxNo: string): Promise<Box | null> => {
    const list = await fetchData();
    const found = list.find((b) => b.boxNo === boxNo) ?? null;
    setSelectedBox(found);
    return found;
  }, [fetchData]);

  /** 포장 완료 — 박스 마감(OPEN인 경우) 후 라벨 자동 출력 */
  const triggerPackComplete = useCallback(async (box: Box) => {
    setPageError("");
    try {
      if (box.status === "OPEN") {
        await api.post(`/shipping/boxes/${box.boxNo}/close`);
      }
    } catch (e) {
      // 마감 실패해도 라벨은 출력하되 원인은 표시한다.
      setPageError(errMsg(e, t("shipping.pack.closeError")));
    }
    setIsSerialModalOpen(false);
    const list = await fetchData();
    const finalBox = list.find((b) => b.boxNo === box.boxNo) ?? box;
    setLabelAutoPrint(true);
    setLabelBox(finalBox);
  }, [fetchData, t]);

  const handleAddSerial = useCallback(async (rawSerial?: string) => {
    const nextSerial = (rawSerial ?? serialInput).replace(/[\r\n]+/g, "").trim();
    if (!nextSerial || !selectedBox || isAddingSerial) return;
    setIsAddingSerial(true);
    setModalError("");
    try {
      await api.post(`/shipping/boxes/${selectedBox.boxNo}/serials`, { serials: [nextSerial] });
      setSerialInput("");
      setLastAddedSerial(nextSerial);
      const updated = await refreshSelected(selectedBox.boxNo);
      // 박스입수량 도달 → 자동 마감 + 박스라벨 자동 출력
      if (updated && updated.boxQty != null && parseSerials(updated).length >= updated.boxQty) {
        await triggerPackComplete(updated);
        return;
      }
      focusSerialInput();
    } catch (e) {
      setModalError(errMsg(e, t("shipping.pack.addSerialError")));
      focusSerialInput();
    } finally {
      setIsAddingSerial(false);
    }
  }, [serialInput, selectedBox, isAddingSerial, refreshSelected, triggerPackComplete, focusSerialInput, t]);

  const handleRemoveSerial = useCallback(async () => {
    if (!selectedBox || !removeSerialTarget) return;
    setModalError("");
    try {
      await api.delete(`/shipping/boxes/${selectedBox.boxNo}/serials`, { data: { serials: [removeSerialTarget] } });
      if (lastAddedSerial === removeSerialTarget) {
        setLastAddedSerial("");
      }
      setRemoveSerialTarget("");
      await refreshSelected(selectedBox.boxNo);
      focusSerialInput();
    } catch (e) {
      setModalError(errMsg(e, t("shipping.pack.removeSerialError")));
      focusSerialInput();
    }
  }, [selectedBox, removeSerialTarget, lastAddedSerial, refreshSelected, focusSerialInput, t]);

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

  const handleDeleteEmptyBox = useCallback(async () => {
    if (!deleteBoxTarget) return;
    setPageError("");
    try {
      await api.delete(`/shipping/boxes/${deleteBoxTarget.boxNo}`);
      if (selectedBox?.boxNo === deleteBoxTarget.boxNo) {
        setSelectedBox(null);
        setIsSerialModalOpen(false);
      }
      setDeleteBoxTarget(null);
      fetchData();
    } catch (e) {
      setPageError(errMsg(e, t("shipping.pack.deleteBoxError", "빈 박스 삭제에 실패했습니다.")));
    }
  }, [deleteBoxTarget, fetchData, selectedBox?.boxNo, t]);

  const columns = useMemo<ColumnDef<Box>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 150, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const box = row.original;
        const iconBtn = "h-8 w-8 inline-flex items-center justify-center rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
        const isOpen = box.status === "OPEN";
        const canReopen = box.status === "CLOSED" && !box.palletNo;
        const canPrintLabel = (box.qty ?? 0) > 0;
        const canDelete = canDeleteEmptyBox(box);
        return (
          <div className="grid grid-cols-4 gap-1 justify-items-center w-[148px] mx-auto">
            <button
              type="button"
              className={`${iconBtn} border-primary/50 text-primary hover:bg-primary/10`}
              title={t("shipping.pack.packProducts", "제품 담기")}
              aria-label={t("shipping.pack.packProducts", "제품 담기")}
              disabled={!isOpen}
              onClick={() => openSerialModal(box)}
            >
              <Plus className="w-4 h-4" />
            </button>
            {box.status === "CLOSED" ? (
              <button
                type="button"
                className={`${iconBtn} border-amber-400/60 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10`}
                title={t("shipping.pack.reopenBox")}
                aria-label={t("shipping.pack.reopenBox")}
                disabled={!canReopen}
                onClick={() => handleReopenBox(box)}
              >
                <LockOpen className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                className={`${iconBtn} border-border text-text hover:bg-surface`}
                title={t("shipping.pack.closeBox")}
                aria-label={t("shipping.pack.closeBox")}
                disabled={!isOpen}
                onClick={() => handleCloseBox(box)}
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              className={`${iconBtn} border-primary/50 text-primary hover:bg-primary/10`}
              title={t("shipping.pack.reprintLabel", "라벨 재발행")}
              aria-label={t("shipping.pack.reprintLabel", "라벨 재발행")}
              disabled={!canPrintLabel}
              onClick={() => openLabel(box)}
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`${iconBtn} border-red-400/60 text-red-600 dark:text-red-400 hover:bg-red-500/10`}
              title={t("shipping.pack.deleteEmptyBox", "빈 박스 삭제")}
              aria-label={t("shipping.pack.deleteEmptyBox", "빈 박스 삭제")}
              disabled={!canDelete}
              onClick={() => setDeleteBoxTarget(box)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
        const { qty, boxQty } = row.original;
        return <span className="font-medium">{(qty ?? 0).toLocaleString()}{boxQty ? <span className="text-text-muted"> / {boxQty.toLocaleString()}</span> : null}</span>;
      },
    },
    { accessorKey: "status", header: t("common.status"), size: 100, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <BoxStatusBadge status={getValue() as BoxStatus} /> },
    { accessorKey: "closeAt", header: t("shipping.pack.closedAt"), size: 150, meta: { filterType: "date" as const }, cell: ({ getValue }) => (getValue() ? String(getValue()).replace("T", " ").slice(0, 16) : "-") },
  ], [t, openSerialModal, handleCloseBox, handleReopenBox, openLabel]);

  // 시리얼 모달 용량 계산
  const modalSerials = parseSerials(selectedBox);
  const modalPackUnit = selectedBox?.boxQty ?? null;
  const atLimit = modalPackUnit != null && modalSerials.length >= modalPackUnit;

  const refreshBoxItems = useCallback(async (boxNo: string) => {
    setBoxItemsLoading(true);
    try {
      const res = await api.get(`/shipping/boxes/${boxNo}/items`);
      setBoxItems(res.data?.data ?? []);
    } catch {
      setBoxItems([]);
    } finally {
      setBoxItemsLoading(false);
    }
  }, []);

  // selectedBox 변경 시 boxItems 조회
  useEffect(() => {
    if (selectedBox) {
      refreshBoxItems(selectedBox.boxNo);
    } else {
      setBoxItems([]);
    }
  }, [selectedBox?.boxNo, refreshBoxItems]);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-auto">
        <div className="lg:col-span-2">
          <Card className="h-full min-h-0" padding="none"><CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("shipping.pack.title")}
              rowClassName={(row) => row.boxNo === activePackingBoxNo ? "ring-2 ring-primary bg-primary/5" : ""}
              onRowClick={(row) => setSelectedBox(row)}
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
        </div>

        {/* 우측: 선택 박스의 시리얼 구성 내역 */}
        <Card>
          <CardHeader title={t("shipping.pack.boxDetail", "박스 구성")} subtitle={selectedBox ? selectedBox.boxNo : t("shipping.pack.selectBox", "박스를 선택하세요")} />
          <CardContent>
            {selectedBox ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="text-xs text-text-muted">{t("common.partName", "품목")}</p>
                    <p className="text-sm font-medium text-text">{selectedBox.itemName ?? selectedBox.itemCode}</p>
                    <p className="text-xs text-text-muted font-mono">{selectedBox.itemCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-muted">{t("shipping.pack.capacity", "용량")}</p>
                    <p className="text-lg font-bold text-primary">
                      {(selectedBox.qty ?? 0).toLocaleString()}{selectedBox.boxQty ? ` / ${selectedBox.boxQty.toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="text-xs font-semibold text-text-muted mb-2">
                    {t("shipping.pack.serialList", "시리얼 목록")} ({boxItems.length})
                  </p>
                  {boxItemsLoading ? (
                    <div className="text-center py-6 text-text-muted text-sm">{t("common.loading", "로딩 중...")}</div>
                  ) : boxItems.length === 0 ? (
                    <div className="text-center py-6 text-text-muted text-sm">{t("shipping.pack.noSerials", "담긴 시리얼이 없습니다.")}</div>
                  ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {boxItems.map((item, idx) => (
                        <div key={item.fgBarcode} className="flex items-center justify-between py-1.5 px-2 bg-background rounded text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${item.inspectPassYn === "Y" ? "bg-green-500" : "bg-red-500"}`} />
                            <span className="font-mono text-text truncate">{idx + 1}. {item.fgBarcode}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-medium ${item.inspectPassYn === "Y" ? "text-green-600" : "text-red-600"}`}>
                              {item.inspectPassYn === "Y" ? "합격" : "불합격"}
                            </span>
                            {selectedBox.status === "OPEN" && (
                              <button title={t("shipping.pack.removeSerial")} onClick={() => setRemoveSerialTarget(item.fgBarcode)}>
                                <XCircle className="w-4 h-4 text-text-muted hover:text-red-500 shrink-0" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-text-muted pt-2 border-t border-border">
                  <span className={`inline-block w-2 h-2 rounded-full ${selectedBox.status === "OPEN" ? "bg-blue-500" : "bg-gray-400"}`} />
                  <BoxStatusBadge status={selectedBox.status as BoxStatus} />
                  {selectedBox.palletNo && <><span className="mx-1">·</span><span className="font-mono">{t("shipping.pack.palletNo", "팔레트")}: {selectedBox.palletNo}</span></>}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t("shipping.pack.selectBoxHint", "박스를 선택하면 구성 내역을 확인할 수 있습니다.")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
            <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-primary tracking-wide">{t("shipping.pack.currentBox", "현재 담는 박스")}</p>
                <p className="text-2xl font-bold text-text font-mono">{selectedBox.boxNo}</p>
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
                onClick={() => setRemoveSerialTarget(lastAddedSerial)}
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
                <button title={t("shipping.pack.removeSerial")} onClick={() => setRemoveSerialTarget(serial)}>
                  <XCircle className="w-4 h-4 text-text-muted cursor-pointer hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="primary"
              onClick={() => selectedBox && triggerPackComplete(selectedBox)}
              disabled={!selectedBox || selectedBox.status !== "OPEN" || modalSerials.length === 0}
            >
              <Printer className="w-4 h-4 mr-1" />{t("shipping.pack.completeAndPrint", "포장 완료 · 라벨 출력")}
            </Button>
            <Button variant="secondary" onClick={() => setIsSerialModalOpen(false)}>{t("common.close")}</Button>
          </div>
        </div>
      </Modal>

      {/* 박스 라벨 출력/재발행 */}
      <BoxLabelModal
        isOpen={!!labelBox}
        box={labelBox}
        autoPrint={labelAutoPrint}
        onClose={() => { setLabelBox(null); setLabelAutoPrint(false); }}
      />

      <ConfirmModal
        isOpen={!!removeSerialTarget}
        onClose={() => setRemoveSerialTarget("")}
        onConfirm={handleRemoveSerial}
        title={t("common.deleteConfirm", "삭제 확인")}
        message={`${removeSerialTarget} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!deleteBoxTarget}
        onClose={() => setDeleteBoxTarget(null)}
        onConfirm={handleDeleteEmptyBox}
        title={t("shipping.pack.deleteEmptyBox", "빈 박스 삭제")}
        message={`${deleteBoxTarget?.boxNo ?? ""} ${t("shipping.pack.deleteEmptyBoxConfirm", { defaultValue: "박스를 삭제하시겠습니까? 제품이 담기지 않은 OPEN 박스만 삭제됩니다." })}`}
        variant="danger"
      />
    </div>
  );
}
