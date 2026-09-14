"use client";

/**
 * @file src/app/(authenticated)/consumables/mount/page.tsx
 * @description 소모품 장착관리 페이지 — 실물 롯트(conUid) 단위 장착현황 조회 + 강제해제/수리 처리
 *
 * 초보자 가이드:
 * 1. **장착은 여기서 하지 않는다.** 현장 키오스크(실적입력) 소모품 스캔에서만 장착된다.
 *    이 화면은 "지금 무엇이 어느 설비에 붙어 있는가"를 보고, 현장에서 내리지 못한 건을
 *    관리자가 강제로 해제하는 예외 창구다.
 * 2. **강제해제**: 장착중 롯트를 설비에서 내린다. 해제 후 상태(공정대기/창고반납/수리중)를 고른다.
 * 3. **수리전환 / 수리완료**: 정비가 필요한 실물을 수리중으로 돌리고, 끝나면 창고로 복귀시킨다.
 * 4. **이력조회**: 행을 클릭하면 우측 패널에 그 실물 UID의 장착/해제 이력(CONSUMABLE_MOUNT_LOGS)이
 *    전건 열린다. 다른 행을 클릭하면 패널을 다시 만들지 않고 내용만 교체한다(기준정보 우측패널 표준).
 * 5. API: 목록 GET /consumables/stocks, 액션 POST /equipment/consumables/{conUid}/...
 *    (2026-09 전환: 마스터 코드 단위 → 실물 롯트 conUid 단위)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { History, RefreshCw, Search, Settings2 } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import Modal from "@/components/ui/Modal";
import api from "@/services/api";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  createConsumableMountGridColumns,
  type ConsumableItem,
  type ActionType,
} from "./consumableMountColumns";
import { Field, FieldInput } from "./consumableMountFieldHelp";

interface MountLog {
  mountDate: string;
  seq: number;
  conUid: string | null;
  consumableCode: string;
  equipCode: string;
  action: string;
  workerId: string | null;
  remark: string | null;
  createdAt: string;
}

/** 강제 해제 후 되돌릴 상태 */
const RETURN_TO_OPTIONS = ["PROC_WAIT", "ACTIVE", "REPAIR"] as const;

export default function ConsumableMountPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* action modal */
  const [actionType, setActionType] = useState<ActionType>(null);
  const [selectedItem, setSelectedItem] = useState<ConsumableItem | null>(null);
  const [returnTo, setReturnTo] = useState<string>("PROC_WAIT");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  /* history panel — 행 선택 시 우측에서 열리고, 다른 행을 고르면 내용만 교체된다 */
  const [historyItem, setHistoryItem] = useState<ConsumableItem | null>(null);
  const [historyData, setHistoryData] = useState<MountLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/consumables/stocks", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* action handlers */
  const openAction = (type: ActionType, item: ConsumableItem) => {
    setActionType(type);
    setSelectedItem(item);
    setReturnTo("PROC_WAIT");
    setRemark("");
  };

  const closeAction = () => {
    setActionType(null);
    setSelectedItem(null);
  };

  const handleSubmitAction = async () => {
    if (!selectedItem || !actionType) return;
    setSaving(true);
    try {
      const uid = encodeURIComponent(selectedItem.conUid);
      if (actionType === "unmount") {
        await api.post(`/equipment/consumables/${uid}/unmount`, { returnTo, remark: remark || undefined });
      } else if (actionType === "repair") {
        await api.post(`/equipment/consumables/${uid}/repair`, { remark: remark || undefined });
      } else if (actionType === "completeRepair") {
        await api.post(`/equipment/consumables/${uid}/complete-repair`, { remark: remark || undefined });
      }
      closeAction();
      fetchData();
    } catch { /* api interceptor */ } finally {
      setSaving(false);
    }
  };

  /* history — 우측 패널 내용 교체 (같은 행을 다시 누르면 닫는다) */
  const openHistory = useCallback(async (item: ConsumableItem) => {
    setHistoryItem((prev) => (prev?.conUid === item.conUid ? null : item));
    if (historyItem?.conUid === item.conUid) return;
    setHistoryData([]);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/equipment/consumables/${encodeURIComponent(item.conUid)}/mount-logs`);
      setHistoryData(res.data?.data ?? []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyItem]);

  const columns = useMemo(() => createConsumableMountGridColumns({
    t,
    onAction: openAction,
    onHistory: openHistory,
  }), [t, openHistory]);

  const actionTitle = actionType === "unmount"
    ? t("consumables.mount.unmountTitle")
    : actionType === "completeRepair"
      ? t("consumables.mount.completeRepairTitle")
      : t("consumables.mount.repairTitle");

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-text">{t("consumables.mount.title")}</h1>
          <span className="text-xs text-text-muted">{t("consumables.mount.mountHint")}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      {/* Body: 목록 + 우측 이력 패널 */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
      <Card className="flex-1 min-w-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            onRowClick={openHistory}
            getRowId={(row) => row.conUid}
            selectedRowId={historyItem?.conUid}
            enableColumnFilter
            enableExport
            exportFileName={t("consumables.mount.title")}
            toolbarLeft={
              <div className="flex gap-2 items-center flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("consumables.mount.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-3.5 h-3.5" />} fullWidth />
                </div>
                <div className="w-28 flex-shrink-0">
                  <ComCodeSelect groupCode="CONSUMABLE_CATEGORY" value={categoryFilter} onChange={setCategoryFilter} labelPrefix={t("consumables.comp.category")} fullWidth />
                </div>
                <div className="w-32 flex-shrink-0">
                  <ComCodeSelect groupCode="CON_STOCK_STATUS" value={statusFilter} onChange={setStatusFilter} labelPrefix={t("consumables.mount.lotStatus")} fullWidth />
                </div>
              </div>
            }
            sqlQuery={`SELECT s.*, m.NAME, m.CATEGORY, m.EXPECTED_LIFE\nFROM CONSUMABLE_STOCKS s\nJOIN CONSUMABLE_MASTERS m ON m.CONSUMABLE_CODE = s.CONSUMABLE_CODE\nWHERE s.COMPANY = '40'\n  AND s.PLANT_CD = '1000'\n  AND s.STATUS = :status\n  AND m.CATEGORY = :category\nORDER BY s.CREATED_AT DESC`}
          />
        </CardContent>
      </Card>

      {/* 우측 이력 패널 — 선택한 실물 롯트의 장착/해제 이력 전건 */}
      {historyItem && (
        <Card className="w-[420px] flex-shrink-0 overflow-hidden animate-slide-in-right" padding="none">
          <div className="h-full flex flex-col">
            {/* 액션은 상단에 둔다(우측 패널 표준) */}
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border flex-shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary flex-shrink-0" />
                  <h2 className="text-sm font-bold text-text truncate">{t("consumables.mount.historyTitle")}</h2>
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {t("common.total")} {historyData.length}{t("common.count")}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-text truncate">{historyItem.conUid}</p>
                <p className="text-xs text-text-muted truncate">
                  {historyItem.consumableName} ({historyItem.consumableCode})
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setHistoryItem(null)}>
                {t("common.close")}
              </Button>
            </div>

            {/* 이력 본문 — 잘라내지 않고 전건을 스크롤로 보여준다 */}
            <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
              {historyLoading ? (
                <p className="text-center py-8 text-xs text-text-muted">{t("common.loading")}</p>
              ) : historyData.length === 0 ? (
                <p className="text-center py-8 text-xs text-text-muted">{t("common.noData")}</p>
              ) : (
                <ul className="space-y-2">
                  {historyData.map((log, i) => {
                    const isMount = log.action === "MOUNT";
                    return (
                      <li
                        key={`${log.mountDate}-${log.seq}-${i}`}
                        className={`border-l-2 pl-3 py-1 ${isMount ? "border-l-primary" : "border-l-border"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${isMount ? "text-primary" : "text-text-muted"}`}>
                            {isMount ? t("consumables.mount.actionMount") : t("consumables.mount.actionUnmount")}
                          </span>
                          <span className="text-xs text-text-muted font-mono">
                            {log.createdAt?.replace("T", " ").slice(0, 16)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-text">
                          {t("consumables.comp.equipment")}: {log.equipCode || "-"}
                          <span className="text-text-muted"> · {t("consumables.mount.worker")}: {log.workerId || "-"}</span>
                        </div>
                        {log.remark && <p className="mt-0.5 text-xs text-text-muted break-words">{log.remark}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}
      </div>

      {/* Action Modal */}
      {actionType && selectedItem && (
        <Modal isOpen onClose={closeAction} title={actionTitle} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-muted">{t("consumables.mount.conUid")}</span>
                <p className="font-mono font-medium text-text">{selectedItem.conUid}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("consumables.comp.consumableName")}</span>
                <p className="font-medium text-text">{selectedItem.consumableName} ({selectedItem.consumableCode})</p>
              </div>
              <div>
                <span className="text-text-muted">{t("consumables.mount.lotStatus")}</span>
                <p><StatusBadge codeType="CON_STOCK_STATUS" value={selectedItem.status} /></p>
              </div>
              {selectedItem.mountedEquipCode && (
                <div>
                  <span className="text-text-muted">{t("consumables.mount.mountedEquip")}</span>
                  <p className="font-medium text-text">{selectedItem.mountedEquipCode}</p>
                </div>
              )}
            </div>

            {actionType === "unmount" && (
              <Field field="returnTo" label={t("consumables.mount.returnTo")} required>
                <Select
                  value={returnTo}
                  onChange={setReturnTo}
                  fullWidth
                  options={RETURN_TO_OPTIONS.map((v) => ({
                    value: v,
                    label: t(`consumables.mount.returnTo_${v}`),
                  }))}
                />
              </Field>
            )}

            <FieldInput
              field="remark"
              label={t("common.remark")}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={t("consumables.mount.remarkPlaceholder")}
              fullWidth
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeAction}>{t("common.cancel")}</Button>
              <Button onClick={handleSubmitAction} disabled={saving}>
                {saving ? t("common.saving") : actionTitle}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
