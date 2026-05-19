"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, ChevronDown, ChevronRight, CircleDot, Edit2, Package, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, ConfirmModal, Input, Modal } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import type { RoutingGroupItem, RoutingProcessItem, SelectedProcess } from "../types";

interface Props {
  selectedProcess: SelectedProcess | null;
  onSelectProcess: (process: SelectedProcess | null) => void;
}

interface ProcessOption {
  processCode: string;
  processName: string;
}

interface PartOption {
  itemCode: string;
  itemName: string;
  itemType: string;
}

interface BomTreeItem {
  id: string;
  level: number;
  itemCode: string;
  itemNo?: string | null;
  itemName: string;
  itemType: string;
  qtyPer: number;
  unit: string;
  revision: string;
  seq: number;
  processCode?: string;
  childItemCode?: string;
  children?: BomTreeItem[];
  isRoot?: boolean;
}

interface BomTarget {
  itemCode: string;
  itemName: string;
  itemType: string;
  breadcrumb: string;
}

interface RoutingInfo extends RoutingGroupItem {
  processes?: RoutingProcessItem[];
}

const EMPTY_GROUP = { routingCode: "", routingName: "", itemCode: "", description: "", useYn: "Y" };
const EMPTY_PROCESS = { seq: "10", processCode: "", processName: "", processType: "", equipType: "", stdTime: "", setupTime: "", sampleInspectYn: "N" };

const partTypeIcon = (itemType?: string) => {
  if (itemType === "FINISHED" || itemType === "FG") return Package;
  if (itemType === "SEMI_PRODUCT" || itemType === "WIP" || itemType === "S") return Boxes;
  return CircleDot;
};

export default function RoutingGroupManager({ selectedProcess, onSelectProcess }: Props) {
  const { t } = useTranslation();
  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");
  const equipTypeOptions = useComCodeOptions("EQUIP_TYPE");

  const [groups, setGroups] = useState<RoutingGroupItem[]>([]);
  const [processes, setProcesses] = useState<RoutingProcessItem[]>([]);
  const [bomTree, setBomTree] = useState<BomTreeItem[]>([]);
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([]);
  const [partOptions, setPartOptions] = useState<PartOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<RoutingGroupItem | null>(null);
  const [selectedBomItem, setSelectedBomItem] = useState<BomTarget | null>(null);
  const [routingInfo, setRoutingInfo] = useState<RoutingInfo | null>(null);
  const [search, setSearch] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingBomTree, setLoadingBomTree] = useState(false);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [expandedBomIds, setExpandedBomIds] = useState<Set<string>>(new Set());

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RoutingGroupItem | null>(null);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);

  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<RoutingProcessItem | null>(null);
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS);
  const [deleteGroup, setDeleteGroup] = useState<RoutingGroupItem | null>(null);
  const [deleteProcess, setDeleteProcess] = useState<RoutingProcessItem | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await api.get("/master/routing-groups", { params: { limit: 5000, search: search || undefined, useYn: "Y" } });
      const data = res.data?.data || [];
      setGroups(data);
      setSelectedGroup((prev) => prev ?? data[0] ?? null);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, [search]);

  const rootBomTree = useMemo<BomTreeItem[]>(() => {
    if (!selectedGroup?.itemCode) return [];
    return [{
      id: `ROOT::${selectedGroup.itemCode}`,
      level: 0,
      itemCode: selectedGroup.itemCode,
      itemName: selectedGroup.itemName || selectedGroup.routingName,
      itemType: selectedGroup.itemType || "FINISHED",
      qtyPer: 1,
      unit: "EA",
      revision: "-",
      seq: 0,
      children: bomTree,
      isRoot: true,
    }];
  }, [bomTree, selectedGroup]);

  const fetchBomTree = useCallback(async () => {
    if (!selectedGroup?.itemCode) {
      setBomTree([]);
      setSelectedBomItem(null);
      setRoutingInfo(null);
      setProcesses([]);
      onSelectProcess(null);
      return;
    }
    setLoadingBomTree(true);
    try {
      const res = await api.get(`/master/boms/hierarchy/${selectedGroup.itemCode}`, { params: { depth: 5 } });
      const data = res.data?.data || [];
      setBomTree(data);
      const rootId = `ROOT::${selectedGroup.itemCode}`;
      setExpandedBomIds(new Set([rootId]));
      setSelectedBomItem({
        itemCode: selectedGroup.itemCode,
        itemName: selectedGroup.itemName || selectedGroup.routingName,
        itemType: selectedGroup.itemType || "FINISHED",
        breadcrumb: selectedGroup.itemCode,
      });
    } catch {
      setBomTree([]);
      setSelectedBomItem({
        itemCode: selectedGroup.itemCode,
        itemName: selectedGroup.itemName || selectedGroup.routingName,
        itemType: selectedGroup.itemType || "FINISHED",
        breadcrumb: selectedGroup.itemCode,
      });
    } finally {
      setLoadingBomTree(false);
    }
  }, [onSelectProcess, selectedGroup]);

  const fetchProcesses = useCallback(async () => {
    if (!selectedBomItem?.itemCode) {
      setRoutingInfo(null);
      setProcesses([]);
      onSelectProcess(null);
      return;
    }
    setLoadingProcesses(true);
    try {
      const res = await api.get(`/master/routing-groups/by-item/${selectedBomItem.itemCode}`);
      const data: RoutingInfo | null = res.data?.data ?? null;
      const nextProcesses = data?.processes || [];
      setRoutingInfo(data);
      setProcesses(nextProcesses);
      if (data && nextProcesses.length > 0) {
        const first = nextProcesses[0];
        onSelectProcess({
          routingCode: first.routingCode,
          routingName: data.routingName,
          seq: first.seq,
          processCode: first.processCode,
          processName: first.processName,
        });
      } else {
        onSelectProcess(null);
      }
    } catch {
      setRoutingInfo(null);
      setProcesses([]);
      onSelectProcess(null);
    } finally {
      setLoadingProcesses(false);
    }
  }, [onSelectProcess, selectedBomItem]);

  const fetchProcessOptions = useCallback(async () => {
    try {
      const res = await api.get("/master/processes", { params: { limit: 5000, useYn: "Y" } });
      setProcessOptions((res.data?.data || []).map((p: any) => ({ processCode: p.processCode, processName: p.processName })));
    } catch {
      setProcessOptions([]);
    }
  }, []);

  const fetchPartOptions = useCallback(async () => {
    try {
      const res = await api.get("/master/parts", { params: { limit: 5000, useYn: "Y" } });
      setPartOptions((res.data?.data || []).map((p: any) => ({ itemCode: p.itemCode, itemName: p.itemName, itemType: p.itemType })));
    } catch {
      setPartOptions([]);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { fetchBomTree(); }, [fetchBomTree]);
  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);
  useEffect(() => { fetchProcessOptions(); }, [fetchProcessOptions]);
  useEffect(() => { fetchPartOptions(); }, [fetchPartOptions]);

  const nextSeq = useMemo(() => {
    if (processes.length === 0) return "10";
    return String(Math.max(...processes.map((process) => process.seq)) + 10);
  }, [processes]);

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupForm(EMPTY_GROUP);
    setGroupModalOpen(true);
  };

  const openEditGroup = (group: RoutingGroupItem) => {
    setEditingGroup(group);
    setGroupForm({
      routingCode: group.routingCode,
      routingName: group.routingName,
      itemCode: group.itemCode || "",
      description: group.description || "",
      useYn: group.useYn || "Y",
    });
    setGroupModalOpen(true);
  };

  const saveGroup = async () => {
    const body = {
      routingCode: groupForm.routingCode.trim(),
      routingName: groupForm.routingName.trim(),
      itemCode: groupForm.itemCode || undefined,
      description: groupForm.description || undefined,
      useYn: groupForm.useYn,
    };
    if (!body.routingCode || !body.routingName || !body.itemCode) return;
    if (editingGroup) {
      await api.put(`/master/routing-groups/${editingGroup.routingCode}`, body);
    } else {
      await api.post("/master/routing-groups", body);
    }
    setGroupModalOpen(false);
    await fetchGroups();
  };

  const openNewProcess = () => {
    if (!routingInfo) return;
    setEditingProcess(null);
    setProcessForm({ ...EMPTY_PROCESS, seq: nextSeq });
    setProcessModalOpen(true);
  };

  const openEditProcess = (process: RoutingProcessItem) => {
    setEditingProcess(process);
    setProcessForm({
      seq: String(process.seq),
      processCode: process.processCode,
      processName: process.processName,
      processType: process.processType || "",
      equipType: process.equipType || "",
      stdTime: process.stdTime != null ? String(process.stdTime) : "",
      setupTime: process.setupTime != null ? String(process.setupTime) : "",
      sampleInspectYn: process.sampleInspectYn || "N",
    });
    setProcessModalOpen(true);
  };

  const handleProcessSelect = (code: string) => {
    const found = processOptions.find((process) => process.processCode === code);
    setProcessForm((prev) => ({ ...prev, processCode: code, processName: found?.processName || prev.processName }));
  };

  const saveProcess = async () => {
    if (!routingInfo || !processForm.processCode || !processForm.processName) return;
    const body = {
      routingCode: routingInfo.routingCode,
      seq: Number(processForm.seq),
      processCode: processForm.processCode,
      processName: processForm.processName,
      processType: processForm.processType || undefined,
      equipType: processForm.equipType || undefined,
      stdTime: processForm.stdTime ? Number(processForm.stdTime) : undefined,
      setupTime: processForm.setupTime ? Number(processForm.setupTime) : undefined,
      sampleInspectYn: processForm.sampleInspectYn || "N",
      useYn: "Y",
    };
    if (editingProcess) {
      await api.put(`/master/routing-groups/${routingInfo.routingCode}/processes/${editingProcess.seq}`, body);
    } else {
      await api.post(`/master/routing-groups/${routingInfo.routingCode}/processes`, body);
    }
    setProcessModalOpen(false);
    await fetchProcesses();
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroup) return;
    await api.delete(`/master/routing-groups/${deleteGroup.routingCode}`);
    setDeleteGroup(null);
    setSelectedGroup(null);
    await fetchGroups();
  };

  const confirmDeleteProcess = async () => {
    if (!routingInfo || !deleteProcess) return;
    await api.delete(`/master/routing-groups/${routingInfo.routingCode}/processes/${deleteProcess.seq}`);
    setDeleteProcess(null);
    await fetchProcesses();
  };

  const selectProcess = (process: RoutingProcessItem) => {
    onSelectProcess({
      routingCode: process.routingCode,
      routingName: routingInfo?.routingName || process.routingCode,
      seq: process.seq,
      processCode: process.processCode,
      processName: process.processName,
    });
  };

  const toggleBomNode = (id: string) => {
    setExpandedBomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (group: RoutingGroupItem) => {
    setSelectedGroup(group);
    setSelectedBomItem(null);
    setRoutingInfo(null);
    setProcesses([]);
    onSelectProcess(null);
  };

  const selectCls = "w-full px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="grid grid-cols-12 gap-4 h-full min-h-0">
      <Card padding="none" className="col-span-5 flex flex-col min-h-0 rounded-lg">
        <CardContent className="flex flex-col min-h-0 h-full p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-text dark:text-gray-100">{t("master.routing.routingGroupList")}</div>
            <Button size="sm" onClick={openNewGroup}><Plus className="w-4 h-4 mr-1" />{t("master.routing.addRouting")}</Button>
          </div>
          <Input placeholder={t("master.routing.searchGroupPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth className="mb-3" />
          <div className="flex-1 overflow-y-auto border border-border dark:border-gray-600 rounded-lg min-h-0">
            {loadingGroups ? (
              <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.routingCode} onClick={() => selectGroup(group)}
                      className={`border-b border-border/50 cursor-pointer ${selectedGroup?.routingCode === group.routingCode ? "bg-primary text-white" : "hover:bg-surface-hover text-text"}`}>
                      <td className="px-3 py-3 font-mono font-semibold whitespace-nowrap">{group.routingCode}</td>
                      <td className="px-2 py-3 truncate">
                        <div className="font-medium truncate">{group.routingName}</div>
                        <div className="text-[11px] opacity-70 truncate">{group.itemCode || "-"} {group.itemName ? `- ${group.itemName}` : ""}</div>
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <button onClick={(e) => { e.stopPropagation(); openEditGroup(group); }} className="p-1 rounded hover:bg-white/20"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteGroup(group); }} className="p-1 rounded hover:bg-white/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="col-span-7 grid grid-rows-[minmax(0,1fr)_260px] gap-3 min-h-0">
        <Card padding="none" className="flex flex-col min-h-0 rounded-lg">
          <CardContent className="flex-1 min-h-0 p-3 overflow-y-auto">
            {selectedGroup ? (
              <div className="min-w-[420px]">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-text dark:text-gray-100">
                  <ChevronDown className="w-4 h-4 shrink-0" />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs">
                    {selectedGroup.itemType?.slice(0, 1) || "P"}
                  </span>
                  <span className="truncate">BOM 구조</span>
                  <span className="font-mono text-xs text-text-muted dark:text-gray-400">[{selectedGroup.itemCode || selectedGroup.routingCode}]</span>
                </div>
                <div className="mt-2">
                  {loadingBomTree ? (
                    <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
                  ) : (
                    <BomTreeRows
                      items={rootBomTree}
                      expanded={expandedBomIds}
                      onToggle={toggleBomNode}
                      selectedItemCode={selectedBomItem?.itemCode}
                      onSelectItem={setSelectedBomItem}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted dark:text-gray-400">
                {t("master.routing.selectItemPrompt")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card padding="none" className="flex flex-col min-h-0 rounded-lg">
          <CardContent className="flex flex-col min-h-0 h-full p-0">
            <div className="flex items-center justify-between border-b border-border dark:border-gray-700 px-4 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text dark:text-gray-100">{t("master.routing.processSequenceTitle")}</div>
                {selectedBomItem && (
                  <div className="text-xs text-text-muted truncate">
                    {selectedBomItem.breadcrumb} {routingInfo ? `- ${routingInfo.routingName}` : "- 라우팅 미등록"}
                  </div>
                )}
              </div>
              <Button size="sm" onClick={openNewProcess} disabled={!routingInfo}><Plus className="w-4 h-4 mr-1" />{t("master.routing.addProcess")}</Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
          {loadingProcesses ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
          ) : !routingInfo ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-muted dark:text-gray-400">
              선택한 품목에 등록된 라우팅이 없습니다.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface dark:bg-gray-800">
                <tr className="border-b border-border text-text-muted">
                  <th className="text-center py-2 w-14">{t("master.routing.seq")}</th>
                  <th className="text-left py-2">{t("master.routing.processName")}</th>
                  <th className="text-center py-2 w-28">{t("master.routing.processCode")}</th>
                  <th className="text-center py-2 w-20">{t("master.routing.sampleInspect")}</th>
                  <th className="text-right py-2 px-2 w-24">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-text-muted dark:text-gray-400">
                      선택한 품목의 라우팅에 등록된 공정이 없습니다.
                    </td>
                  </tr>
                )}
                {processes.map((process) => {
                  const isSelected = selectedProcess?.routingCode === process.routingCode && selectedProcess.seq === process.seq;
                  return (
                    <tr key={`${process.routingCode}-${process.seq}`} onClick={() => selectProcess(process)}
                      className={`border-b border-border/50 cursor-pointer ${isSelected ? "bg-primary text-white" : "hover:bg-surface-hover text-text"}`}>
                      <td className="py-2 text-center font-mono">{process.seq}</td>
                      <td className="py-2 font-medium truncate">{process.processName}</td>
                      <td className="py-2 text-center font-mono">{process.processCode}</td>
                      <td className="py-2 text-center">
                        {process.sampleInspectYn === 'Y' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            필요
                          </span>
                        ) : (
                          <span className="text-text-muted text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <button onClick={(e) => { e.stopPropagation(); openEditProcess(process); }} className="p-1 rounded hover:bg-white/20"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteProcess(process); }} className="p-1 rounded hover:bg-white/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={groupModalOpen} onClose={() => setGroupModalOpen(false)} title={editingGroup ? t("master.routing.editRouting") : t("master.routing.addRouting")} size="md">
        <div className="space-y-4">
          <Input label={t("master.routing.routingCode")} value={groupForm.routingCode} disabled={!!editingGroup} onChange={(e) => setGroupForm((f) => ({ ...f, routingCode: e.target.value }))} fullWidth />
          <Input label={t("master.routing.routingName")} value={groupForm.routingName} onChange={(e) => setGroupForm((f) => ({ ...f, routingName: e.target.value }))} fullWidth />
          <div>
            <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.part.itemCode", { defaultValue: "품목" })}</label>
            <select
              value={groupForm.itemCode}
              onChange={(e) => setGroupForm((f) => ({ ...f, itemCode: e.target.value }))}
              className={selectCls}
            >
              <option value="">-- {t("common.select")} --</option>
              {partOptions.map((option) => (
                <option key={option.itemCode} value={option.itemCode}>
                  [{option.itemCode}] {option.itemName}
                </option>
              ))}
            </select>
          </div>
          <Input label={t("common.description", { defaultValue: "설명" })} value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setGroupModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={saveGroup} disabled={!groupForm.routingCode || !groupForm.routingName || !groupForm.itemCode}>{t("common.save")}</Button>
        </div>
      </Modal>

      <Modal isOpen={processModalOpen} onClose={() => setProcessModalOpen(false)} title={editingProcess ? t("master.routing.editProcess") : t("master.routing.addProcess")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={t("master.routing.seq")} type="number" step="10" value={processForm.seq} disabled={!!editingProcess} onChange={(e) => setProcessForm((f) => ({ ...f, seq: e.target.value }))} fullWidth />
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.routing.processCode")}</label>
              <select value={processForm.processCode} onChange={(e) => handleProcessSelect(e.target.value)} className={selectCls}>
                <option value="">-- {t("common.select")} --</option>
                {processOptions.map((option) => <option key={option.processCode} value={option.processCode}>[{option.processCode}] {option.processName}</option>)}
              </select>
            </div>
            <Input label={t("master.routing.processName")} value={processForm.processName} onChange={(e) => setProcessForm((f) => ({ ...f, processName: e.target.value }))} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.routing.processType")}</label>
              <select value={processForm.processType} onChange={(e) => setProcessForm((f) => ({ ...f, processType: e.target.value }))} className={selectCls}>
                <option value="">-- {t("common.select")} --</option>
                {processTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.routing.equipType")}</label>
              <select value={processForm.equipType} onChange={(e) => setProcessForm((f) => ({ ...f, equipType: e.target.value }))} className={selectCls}>
                <option value="">-- {t("common.select")} --</option>
                {equipTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t("master.routing.stdTimeSec")} type="number" step="0.1" value={processForm.stdTime} onChange={(e) => setProcessForm((f) => ({ ...f, stdTime: e.target.value }))} fullWidth />
            <Input label={t("master.routing.setupTimeSec")} type="number" step="0.1" value={processForm.setupTime} onChange={(e) => setProcessForm((f) => ({ ...f, setupTime: e.target.value }))} fullWidth />
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">
                {t("master.routing.sampleInspect")}
              </label>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={processForm.sampleInspectYn === "Y"}
                  onChange={(e) => setProcessForm((f) => ({ ...f, sampleInspectYn: e.target.checked ? "Y" : "N" }))}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">
                  {processForm.sampleInspectYn === "Y"
                    ? t("master.routing.sampleInspectRequired")
                    : t("master.routing.sampleInspectNotRequired")}
                </span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setProcessModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={saveProcess} disabled={!processForm.processCode || !processForm.processName}>{t("common.save")}</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteGroup} onClose={() => setDeleteGroup(null)} onConfirm={confirmDeleteGroup}
        title={t("common.delete")} message={`${deleteGroup?.routingCode || ""} ${t("common.deleteMessage", { defaultValue: "항목을 삭제하시겠습니까?" })}`} variant="danger" />
      <ConfirmModal isOpen={!!deleteProcess} onClose={() => setDeleteProcess(null)} onConfirm={confirmDeleteProcess}
        title={t("common.delete")} message={`${deleteProcess?.processName || ""} ${t("master.routing.deleteConfirm")}`} variant="danger" />
    </div>
  );
}

const RAW_TYPES = new Set(["RAW", "RAW_MATERIAL", "RM", "M"]);

function BomTreeRows({
  items,
  expanded,
  onToggle,
  selectedItemCode,
  onSelectItem,
  depth = 0,
  breadcrumb = "",
}: {
  items: BomTreeItem[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedItemCode?: string | null;
  onSelectItem: (item: BomTarget) => void;
  depth?: number;
  breadcrumb?: string;
}) {
  // 원자재(RAW_MATERIAL 등) 제외: 루트는 항상 표시
  const filtered = items.filter((item) => item.isRoot || !RAW_TYPES.has(item.itemType));
  return (
    <div className="space-y-1">
      {filtered.map((item) => {
        const itemCode = item.childItemCode || item.itemCode;
        const itemBreadcrumb = item.isRoot ? itemCode : breadcrumb ? `${breadcrumb} > ${itemCode}` : itemCode;
        const hasChildren = !!item.children?.length;
        const isExpanded = expanded.has(item.id);
        const isSelected = selectedItemCode === itemCode;
        const Icon = partTypeIcon(item.itemType);

        return (
          <Fragment key={item.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectItem({ itemCode, itemName: item.itemName, itemType: item.itemType, breadcrumb: itemBreadcrumb })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelectItem({ itemCode, itemName: item.itemName, itemType: item.itemType, breadcrumb: itemBreadcrumb });
                }
              }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                isSelected ? "bg-primary text-white" : "hover:bg-surface-hover text-text dark:text-gray-200"
              }`}
              style={{ marginLeft: depth * 20 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onToggle(item.id); }}
                  className={`rounded p-0.5 ${isSelected ? "hover:bg-white/15" : "hover:bg-surface"}`}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <span className="flex w-5 justify-center"><span className="h-1.5 w-1.5 rounded-full bg-border" /></span>
              )}
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-white/20" : "bg-surface"}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{item.itemName}</span>
                <span className={`ml-2 font-mono ${isSelected ? "text-white/75" : "text-text-muted dark:text-gray-400"}`}>[{itemCode}]</span>
              </span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-white/15 text-white" : "bg-surface text-text-muted"}`}>
                {item.itemType}
              </span>
            </div>
            {hasChildren && isExpanded && (
              <BomTreeRows
                items={item.children!}
                expanded={expanded}
                onToggle={onToggle}
                selectedItemCode={selectedItemCode}
                onSelectItem={onSelectItem}
                depth={depth + 1}
                breadcrumb={itemBreadcrumb}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
