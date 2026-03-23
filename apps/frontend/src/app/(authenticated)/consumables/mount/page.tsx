"use client";

/**
 * @file src/app/(authenticated)/consumables/mount/page.tsx
 * @description 소모품 장착/분리 관리 페이지
 *
 * 초보자 가이드:
 * 1. **장착**: 소모품(금형/지그/공구)을 설비에 장착 등록
 * 2. **해제**: 장착된 소모품을 설비에서 분리
 * 3. **수리전환**: 소모품을 수리 상태로 전환 (장착중이면 자동 해제)
 * 4. **이력조회**: 개별 소모품의 장착/해제 이력 확인
 * 5. API: /equipment/consumables 경로 사용
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshCw, Link2, Unlink, Wrench, History, Search,
  ArrowRightLeft, Settings2, CheckCircle,
} from "lucide-react";
import {
  Card, CardContent, Button, Input, StatCard, ComCodeBadge,
} from "@/components/ui";
import { ComCodeSelect, EquipSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import Modal from "@/components/ui/Modal";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ConsumableItem {
  consumableCode: string;
  consumableName: string;
  category: string;
  operStatus: string;
  mountedEquipCode: string | null;
  status: string;
  currentCount: number;
  expectedLife: number | null;
  location: string | null;
}

interface MountLog {
  mountDate: string;
  seq: number;
  consumableCode: string;
  equipCode: string;
  action: string;
  workerId: string | null;
  remark: string | null;
  createdAt: string;
}

type ActionType = "mount" | "unmount" | "repair" | "completeRepair" | null;

export default function ConsumableMountPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [operStatusFilter, setOperStatusFilter] = useState("");

  /* action modal */
  const [actionType, setActionType] = useState<ActionType>(null);
  const [selectedItem, setSelectedItem] = useState<ConsumableItem | null>(null);
  const [equipCode, setEquipCode] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  /* history modal */
  const [historyItem, setHistoryItem] = useState<ConsumableItem | null>(null);
  const [historyData, setHistoryData] = useState<MountLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (operStatusFilter) params.operStatus = operStatusFilter;
      const res = await api.get("/equipment/consumables", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, operStatusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    mounted: data.filter((d) => d.operStatus === "MOUNTED").length,
    warehouse: data.filter((d) => d.operStatus === "WAREHOUSE").length,
    repair: data.filter((d) => d.operStatus === "REPAIR").length,
  }), [data]);

  /* action handlers */
  const openAction = (type: ActionType, item: ConsumableItem) => {
    setActionType(type);
    setSelectedItem(item);
    setEquipCode("");
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
      const code = selectedItem.consumableCode;
      if (actionType === "mount") {
        await api.post(`/equipment/consumables/${code}/mount`, { equipCode, remark: remark || undefined });
      } else if (actionType === "unmount") {
        await api.post(`/equipment/consumables/${code}/unmount`, { remark: remark || undefined });
      } else if (actionType === "repair") {
        await api.post(`/equipment/consumables/${code}/repair`, { remark: remark || undefined });
      } else if (actionType === "completeRepair") {
        await api.post(`/equipment/consumables/${code}/complete-repair`, { remark: remark || undefined });
      }
      closeAction();
      fetchData();
    } catch { /* api interceptor */ } finally {
      setSaving(false);
    }
  };

  /* history */
  const openHistory = async (item: ConsumableItem) => {
    setHistoryItem(item);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/equipment/consumables/${item.consumableCode}/mount-logs`);
      setHistoryData(res.data?.data ?? []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getOperStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      WAREHOUSE: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: t("consumables.mount.statusWarehouse") },
      MOUNTED: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: t("consumables.mount.statusMounted") },
      REPAIR: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", label: t("consumables.mount.statusRepair") },
    };
    const s = map[status] ?? map.WAREHOUSE;
    return <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const columns = useMemo<ColumnDef<ConsumableItem>[]>(() => [
    {
      id: "actions", header: t("common.manage"), size: 140, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-1">
            {item.operStatus === "WAREHOUSE" && (
              <Button size="sm" variant="secondary" onClick={() => openAction("mount", item)} title={t("consumables.mount.mountAction")}>
                <Link2 className="w-3 h-3" />
              </Button>
            )}
            {item.operStatus === "MOUNTED" && (
              <Button size="sm" variant="secondary" onClick={() => openAction("unmount", item)} title={t("consumables.mount.unmountAction")}>
                <Unlink className="w-3 h-3" />
              </Button>
            )}
            {item.operStatus !== "REPAIR" && (
              <Button size="sm" variant="secondary" onClick={() => openAction("repair", item)} title={t("consumables.mount.repairAction")}>
                <Wrench className="w-3 h-3" />
              </Button>
            )}
            {item.operStatus === "REPAIR" && (
              <Button size="sm" variant="secondary" onClick={() => openAction("completeRepair", item)} title={t("consumables.mount.completeRepairAction")}>
                <CheckCircle className="w-3 h-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => openHistory(item)} title={t("consumables.mount.historyAction")}>
              <History className="w-3 h-3" />
            </Button>
          </div>
        );
      },
    },
    { accessorKey: "operStatus", header: t("consumables.mount.operStatus"), size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => getOperStatusBadge(getValue() as string) },
    { accessorKey: "consumableCode", header: t("consumables.comp.consumableCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "consumableName", header: t("consumables.comp.consumableName"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "category", header: t("consumables.comp.category"), size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} /> },
    { accessorKey: "mountedEquipCode", header: t("consumables.mount.mountedEquip"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "status", header: t("consumables.mount.lifeStatus"), size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_STATUS" code={getValue() as string} /> },
    {
      id: "lifeProgress", header: t("consumables.life.lifeLabel"), size: 100, meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const { currentCount, expectedLife } = row.original;
        const pct = expectedLife ? Math.round((currentCount / expectedLife) * 100) : 0;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs text-text-muted">{pct}%</span>
          </div>
        );
      },
    },
    { accessorKey: "location", header: t("consumables.comp.location"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
  ], [t]);

  const actionTitle = actionType === "mount"
    ? t("consumables.mount.mountTitle")
    : actionType === "unmount"
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
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("common.total")} value={stats.total} icon={ArrowRightLeft} color="blue" />
        <StatCard label={t("consumables.mount.statusMounted")} value={stats.mounted} icon={Link2} color="green" />
        <StatCard label={t("consumables.mount.statusWarehouse")} value={stats.warehouse} icon={Unlink} color="gray" />
        <StatCard label={t("consumables.mount.statusRepair")} value={stats.repair} icon={Wrench} color="orange" />
      </div>

      {/* Grid */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
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
                <div className="w-28 flex-shrink-0">
                  <ComCodeSelect groupCode="CONSUMABLE_OPER_STATUS" value={operStatusFilter} onChange={setOperStatusFilter} labelPrefix={t("consumables.mount.operStatus")} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Action Modal */}
      {actionType && selectedItem && (
        <Modal isOpen onClose={closeAction} title={actionTitle} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-muted">{t("consumables.comp.consumableCode")}</span>
                <p className="font-medium text-text">{selectedItem.consumableCode}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("consumables.comp.consumableName")}</span>
                <p className="font-medium text-text">{selectedItem.consumableName}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("consumables.mount.operStatus")}</span>
                <p>{getOperStatusBadge(selectedItem.operStatus)}</p>
              </div>
              {selectedItem.mountedEquipCode && (
                <div>
                  <span className="text-text-muted">{t("consumables.mount.mountedEquip")}</span>
                  <p className="font-medium text-text">{selectedItem.mountedEquipCode}</p>
                </div>
              )}
            </div>

            {actionType === "mount" && (
              <EquipSelect
                label={t("consumables.mount.targetEquip")}
                value={equipCode}
                onChange={setEquipCode}
                fullWidth
                required
              />
            )}

            <Input
              label={t("common.remark")}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={t("consumables.mount.remarkPlaceholder")}
              fullWidth
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeAction}>{t("common.cancel")}</Button>
              <Button
                onClick={handleSubmitAction}
                disabled={saving || (actionType === "mount" && !equipCode)}
              >
                {saving ? t("common.saving") : actionTitle}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* History Modal */}
      {historyItem && (
        <Modal isOpen onClose={() => setHistoryItem(null)} title={`${t("consumables.mount.historyTitle")} - ${historyItem.consumableCode}`} size="lg">
          <div className="max-h-[400px] overflow-auto">
            {historyLoading ? (
              <p className="text-center py-8 text-text-muted">{t("common.loading")}</p>
            ) : historyData.length === 0 ? (
              <p className="text-center py-8 text-text-muted">{t("common.noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="border-b border-border bg-surface dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("consumables.mount.logDate")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("consumables.mount.logAction")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("consumables.comp.equipment")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("consumables.mount.worker")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("common.remark")}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((log, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-text">{log.createdAt?.split("T")[0]}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          log.action === "MOUNT" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {log.action === "MOUNT" ? t("consumables.mount.actionMount") : t("consumables.mount.actionUnmount")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text">{log.equipCode || "-"}</td>
                      <td className="px-3 py-2 text-text">{log.workerId || "-"}</td>
                      <td className="px-3 py-2 text-text-muted">{log.remark || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setHistoryItem(null)}>{t("common.close")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
