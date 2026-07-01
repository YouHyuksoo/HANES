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
  AlertTriangle, Printer, Lock, LockOpen, Trash2, ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, Button, ConfirmModal, Input, Modal, Select } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import PartSelect from "@/components/shared/PartSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import OpenIncludedNotice from "@/components/shared/OpenIncludedNotice";
import { getTodayLocal } from "@/utils/date";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";
import api from "@/services/api";
import BoxLabelModal from "./components/BoxLabelModal";
import { createPackGridColumns, type Box } from "./packColumns";

/** 포장 대기 FG 시리얼(검사합격·박스 미배정) */
interface PackableSerial {
  fgBarcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  issuedAt: string | null;
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
  const [packable, setPackable] = useState<PackableSerial[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  // 작업 대상 목록 기본 필터: 당일 생성분 + 진행중(OPEN) 박스는 기간 무관 항상 노출
  const [createdFrom, setCreatedFrom] = useState(getTodayLocal());
  const [createdTo, setCreatedTo] = useState(getTodayLocal());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [isPackableModalOpen, setIsPackableModalOpen] = useState(false);
  const [packablePage, setPackablePage] = useState(1);
  const PACKABLE_PAGE_SIZE = 50;
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
      if (createdFrom) params.createdFrom = createdFrom;
      if (createdTo) params.createdTo = createdTo;
      // 상태 미지정 시 기간 밖이어도 미마감(OPEN) 박스는 항상 노출
      if (!statusFilter) params.includeOpen = "true";
      const res = await api.get("/shipping/boxes", { params });
      const list: Box[] = res.data?.data ?? [];
      setData(list);
      // 포장 대기 시리얼도 함께 갱신(박스 구성·마감 시 자동 반영)
      try {
        const pres = await api.get("/shipping/boxes/packable-serials");
        setPackable(pres.data?.data ?? []);
      } catch { setPackable([]); }
      return list;
    } catch (e) {
      setPageError(errMsg(e, t("shipping.pack.loadError")));
      setData([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, createdFrom, createdTo, t]);

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

  const columns = useMemo(() => createPackGridColumns({ t }), [t]);

  // 기간(생성일) 밖이지만 미마감(OPEN)이라 includeOpen으로 포함된 박스
  const outOfRangeNos = useMemo(() => {
    const set = new Set<string>();
    if (statusFilter) return set; // 상태 명시 시 includeOpen 미적용
    for (const b of data) {
      const d = (b.createdAt || "").slice(0, 10);
      const inRange = !!d && !!createdFrom && !!createdTo && d >= createdFrom && d <= createdTo;
      if (!inRange && b.status === "OPEN") set.add(b.boxNo);
    }
    return set;
  }, [data, statusFilter, createdFrom, createdTo]);

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
          <Button variant="secondary" size="sm" onClick={() => { setPackablePage(1); setIsPackableModalOpen(true); }}>
            <ClipboardList className="w-4 h-4 mr-1" />
            {t("shipping.pack.waitingTitle", "포장 대기")}
            {packable.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary text-white text-xs font-bold leading-none">
                {packable.length}
              </span>
            )}
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

      <OpenIncludedNotice count={outOfRangeNos.size} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-auto">
        <div className="lg:col-span-2">
          <Card className="h-full min-h-0" padding="none"><CardContent className="h-full p-4 flex flex-col min-h-0">
            {/* 선택 행 공통 액션 툴바 */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
              <span className="text-xs text-text-muted">
                {selectedBox ? <>{t("shipping.pack.selectedBox", "선택")}: <span className="font-mono text-text">{selectedBox.boxNo}</span></> : t("shipping.pack.selectRowHint", "행을 선택하세요")}
              </span>
              <div className="flex gap-1 ml-auto flex-wrap">
                <Button size="sm" variant="secondary" disabled={!selectedBox || selectedBox.status !== "OPEN"} onClick={() => selectedBox && openSerialModal(selectedBox)}><Plus className="w-4 h-4 mr-1" />{t("shipping.pack.packProducts", "제품 담기")}</Button>
                <Button size="sm" variant="secondary" disabled={!selectedBox || selectedBox.status !== "OPEN"} onClick={() => selectedBox && handleCloseBox(selectedBox)}><Lock className="w-4 h-4 mr-1" />{t("shipping.pack.closeBox")}</Button>
                <Button size="sm" variant="secondary" disabled={!selectedBox || selectedBox.status !== "CLOSED" || !!selectedBox.palletNo} onClick={() => selectedBox && handleReopenBox(selectedBox)}><LockOpen className="w-4 h-4 mr-1" />{t("shipping.pack.reopenBox")}</Button>
                <Button size="sm" variant="secondary" disabled={!selectedBox || (selectedBox.qty ?? 0) <= 0} onClick={() => selectedBox && openLabel(selectedBox)}><Printer className="w-4 h-4 mr-1" />{t("shipping.pack.reprintLabel", "라벨 재발행")}</Button>
                <Button size="sm" variant="danger" disabled={!selectedBox || !canDeleteEmptyBox(selectedBox)} onClick={() => selectedBox && setDeleteBoxTarget(selectedBox)}><Trash2 className="w-4 h-4 mr-1" />{t("shipping.pack.deleteEmptyBox", "빈 박스 삭제")}</Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("shipping.pack.title")}
              rowClassName={(row) => {
                const sel = row.boxNo === activePackingBoxNo ? "ring-2 ring-primary bg-primary/5" : (row.boxNo === selectedBox?.boxNo ? "bg-primary/5" : "");
                return outOfRangeNos.has(row.boxNo) ? `${sel} border-l-2 border-l-amber-500` : sel;
              }}
              onRowClick={(row) => setSelectedBox(row)}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0 items-center flex-wrap">
                  <DateRangeFilter
                    from={createdFrom}
                    to={createdTo}
                    onFromChange={setCreatedFrom}
                    onToChange={setCreatedTo}
                    label={t("shipping.pack.createdDate", "생성일")}
                  />
                  <div className="flex-1 min-w-[12rem]">
                    <Input placeholder={t("shipping.pack.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                </div>
              }
            sqlQuery={`SELECT *\nFROM BOX_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
            </div>
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

      {/* 포장 대기 시리얼 목록 모달 (페이지네이션) */}
      {isPackableModalOpen && (() => {
        const totalPages = Math.max(1, Math.ceil(packable.length / PACKABLE_PAGE_SIZE));
        const pageItems = packable.slice((packablePage - 1) * PACKABLE_PAGE_SIZE, packablePage * PACKABLE_PAGE_SIZE);
        const grouped = pageItems.reduce<Record<string, PackableSerial[]>>((acc, p) => {
          (acc[p.itemCode] ??= []).push(p);
          return acc;
        }, {});
        return (
          <Modal
            isOpen
            onClose={() => setIsPackableModalOpen(false)}
            title={t("shipping.pack.waitingTitle", "포장 대기")}
            size="lg"
          >
            <div className="space-y-3">
              {/* 요약 + 페이지 정보 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">
                  {t("shipping.pack.waitingDesc", "검사 합격 후 미배정 FG 시리얼")}
                  <span className="ml-2 font-semibold text-text">{t("common.total", "총")} {packable.length}{t("common.countUnit", "건")}</span>
                </span>
                {totalPages > 1 && (
                  <span className="text-xs text-text-muted">{packablePage} / {totalPages} 페이지</span>
                )}
              </div>

              {packable.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
                  <Package className="w-10 h-10 opacity-30" />
                  <span className="text-sm">{t("shipping.pack.noWaiting", "포장 대기 제품 없음")}</span>
                </div>
              ) : (
                <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
                  {Object.entries(grouped).map(([itemCode, serials]) => (
                    <div key={itemCode} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-mono text-sm font-semibold text-text">{itemCode}</span>
                          {serials[0].itemName && <span className="ml-2 text-sm text-text-muted">{serials[0].itemName}</span>}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{serials.length}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {serials.map((s) => (
                          <li key={s.fgBarcode} className="flex items-baseline gap-3 text-xs py-1 border-b border-border/40 last:border-0">
                            <span className="font-mono text-text w-44 shrink-0">{s.fgBarcode}</span>
                            {s.orderNo && <span className="text-text-muted truncate">{s.orderNo}</span>}
                            {s.issuedAt && <span className="text-text-muted/60 shrink-0 ml-auto">{String(s.issuedAt).slice(0, 10)}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* 페이지네이션 + 닫기 */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" disabled={packablePage <= 1} onClick={() => setPackablePage(1)}>«</Button>
                    <Button size="sm" variant="secondary" disabled={packablePage <= 1} onClick={() => setPackablePage(p => p - 1)}>‹</Button>
                    <span className="px-3 text-sm text-text-muted">{packablePage} / {totalPages}</span>
                    <Button size="sm" variant="secondary" disabled={packablePage >= totalPages} onClick={() => setPackablePage(p => p + 1)}>›</Button>
                    <Button size="sm" variant="secondary" disabled={packablePage >= totalPages} onClick={() => setPackablePage(totalPages)}>»</Button>
                  </div>
                ) : <div />}
                <Button variant="secondary" onClick={() => setIsPackableModalOpen(false)}>{t("common.close")}</Button>
              </div>
            </div>
          </Modal>
        );
      })()}

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
            <BarcodeScanInput
              ref={serialInputRef}
              placeholder={t("shipping.pack.serialPlaceholder")}
              value={serialInput}
              onChange={setSerialInput}
              onScan={handleAddSerial}
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
