"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button, ConfirmModal, Input, Modal } from "@/components/ui";
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

const EMPTY_GROUP = { routingCode: "", routingName: "", description: "", useYn: "Y" };
const EMPTY_PROCESS = { seq: "10", processCode: "", processName: "", processType: "", equipType: "", stdTime: "", setupTime: "" };

export default function RoutingGroupManager({ selectedProcess, onSelectProcess }: Props) {
  const { t } = useTranslation();
  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");
  const equipTypeOptions = useComCodeOptions("EQUIP_TYPE");

  const [groups, setGroups] = useState<RoutingGroupItem[]>([]);
  const [processes, setProcesses] = useState<RoutingProcessItem[]>([]);
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<RoutingGroupItem | null>(null);
  const [search, setSearch] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingProcesses, setLoadingProcesses] = useState(false);

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

  const fetchProcesses = useCallback(async () => {
    if (!selectedGroup) {
      setProcesses([]);
      onSelectProcess(null);
      return;
    }
    setLoadingProcesses(true);
    try {
      const res = await api.get(`/master/routing-groups/${selectedGroup.routingCode}/processes`);
      setProcesses(res.data?.data || []);
      onSelectProcess(null);
    } catch {
      setProcesses([]);
    } finally {
      setLoadingProcesses(false);
    }
  }, [onSelectProcess, selectedGroup]);

  const fetchProcessOptions = useCallback(async () => {
    try {
      const res = await api.get("/master/processes", { params: { limit: 5000, useYn: "Y" } });
      setProcessOptions((res.data?.data || []).map((p: any) => ({ processCode: p.processCode, processName: p.processName })));
    } catch {
      setProcessOptions([]);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);
  useEffect(() => { fetchProcessOptions(); }, [fetchProcessOptions]);

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
      description: group.description || "",
      useYn: group.useYn || "Y",
    });
    setGroupModalOpen(true);
  };

  const saveGroup = async () => {
    const body = {
      routingCode: groupForm.routingCode.trim(),
      routingName: groupForm.routingName.trim(),
      description: groupForm.description || undefined,
      useYn: groupForm.useYn,
    };
    if (!body.routingCode || !body.routingName) return;
    if (editingGroup) {
      await api.put(`/master/routing-groups/${editingGroup.routingCode}`, body);
    } else {
      await api.post("/master/routing-groups", body);
    }
    setGroupModalOpen(false);
    await fetchGroups();
  };

  const openNewProcess = () => {
    if (!selectedGroup) return;
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
    });
    setProcessModalOpen(true);
  };

  const handleProcessSelect = (code: string) => {
    const found = processOptions.find((process) => process.processCode === code);
    setProcessForm((prev) => ({ ...prev, processCode: code, processName: found?.processName || prev.processName }));
  };

  const saveProcess = async () => {
    if (!selectedGroup || !processForm.processCode || !processForm.processName) return;
    const body = {
      routingCode: selectedGroup.routingCode,
      seq: Number(processForm.seq),
      processCode: processForm.processCode,
      processName: processForm.processName,
      processType: processForm.processType || undefined,
      equipType: processForm.equipType || undefined,
      stdTime: processForm.stdTime ? Number(processForm.stdTime) : undefined,
      setupTime: processForm.setupTime ? Number(processForm.setupTime) : undefined,
      useYn: "Y",
    };
    if (editingProcess) {
      await api.put(`/master/routing-groups/${selectedGroup.routingCode}/processes/${editingProcess.seq}`, body);
    } else {
      await api.post(`/master/routing-groups/${selectedGroup.routingCode}/processes`, body);
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
    if (!selectedGroup || !deleteProcess) return;
    await api.delete(`/master/routing-groups/${selectedGroup.routingCode}/processes/${deleteProcess.seq}`);
    setDeleteProcess(null);
    await fetchProcesses();
  };

  const selectCls = "w-full px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="grid grid-cols-12 gap-5 h-full min-h-0">
      <div className="col-span-5 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-text dark:text-gray-100">{t("master.routing.routingGroupList")}</div>
          <Button size="sm" onClick={openNewGroup}><Plus className="w-4 h-4 mr-1" />{t("master.routing.addRouting")}</Button>
        </div>
        <Input placeholder={t("master.routing.searchGroupPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth className="mb-2" />
        <div className="flex-1 overflow-y-auto border border-border dark:border-gray-600 rounded-lg min-h-0">
          {loadingGroups ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {groups.map((group) => (
                  <tr key={group.routingCode} onClick={() => setSelectedGroup(group)}
                    className={`border-b border-border/50 cursor-pointer ${selectedGroup?.routingCode === group.routingCode ? "bg-primary text-white" : "hover:bg-surface-hover text-text"}`}>
                    <td className="px-2 py-2 font-mono font-semibold whitespace-nowrap">{group.routingCode}</td>
                    <td className="px-2 py-2 truncate">{group.routingName}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <button onClick={(e) => { e.stopPropagation(); openEditGroup(group); }} className="p-1 rounded hover:bg-white/20"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteGroup(group); }} className="p-1 rounded hover:bg-white/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="col-span-7 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text dark:text-gray-100">{t("master.routing.processSequenceTitle")}</div>
            {selectedGroup && <div className="text-xs text-text-muted truncate">{selectedGroup.routingCode} - {selectedGroup.routingName}</div>}
          </div>
          <Button size="sm" onClick={openNewProcess} disabled={!selectedGroup}><Plus className="w-4 h-4 mr-1" />{t("master.routing.addProcess")}</Button>
        </div>
        <div className="flex-1 overflow-y-auto border border-border dark:border-gray-600 rounded-lg min-h-0">
          {loadingProcesses ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface dark:bg-gray-800">
                <tr className="border-b border-border text-text-muted">
                  <th className="text-center py-2 w-14">{t("master.routing.seq")}</th>
                  <th className="text-left py-2">{t("master.routing.processName")}</th>
                  <th className="text-center py-2 w-28">{t("master.routing.processCode")}</th>
                  <th className="text-right py-2 px-2 w-24">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => {
                  const isSelected = selectedProcess?.routingCode === process.routingCode && selectedProcess.seq === process.seq;
                  return (
                    <tr key={`${process.routingCode}-${process.seq}`} onClick={() => onSelectProcess({
                      routingCode: process.routingCode,
                      routingName: selectedGroup?.routingName || process.routingCode,
                      seq: process.seq,
                      processCode: process.processCode,
                      processName: process.processName,
                    })}
                      className={`border-b border-border/50 cursor-pointer ${isSelected ? "bg-primary text-white" : "hover:bg-surface-hover text-text"}`}>
                      <td className="py-2 text-center font-mono">{process.seq}</td>
                      <td className="py-2 font-medium truncate">{process.processName}</td>
                      <td className="py-2 text-center font-mono">{process.processCode}</td>
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
      </div>

      <Modal isOpen={groupModalOpen} onClose={() => setGroupModalOpen(false)} title={editingGroup ? t("master.routing.editRouting") : t("master.routing.addRouting")} size="md">
        <div className="space-y-4">
          <Input label={t("master.routing.routingCode")} value={groupForm.routingCode} disabled={!!editingGroup} onChange={(e) => setGroupForm((f) => ({ ...f, routingCode: e.target.value }))} fullWidth />
          <Input label={t("master.routing.routingName")} value={groupForm.routingName} onChange={(e) => setGroupForm((f) => ({ ...f, routingName: e.target.value }))} fullWidth />
          <Input label={t("common.description", { defaultValue: "설명" })} value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setGroupModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={saveGroup} disabled={!groupForm.routingCode || !groupForm.routingName}>{t("common.save")}</Button>
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
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("master.routing.stdTimeSec")} type="number" step="0.1" value={processForm.stdTime} onChange={(e) => setProcessForm((f) => ({ ...f, stdTime: e.target.value }))} fullWidth />
            <Input label={t("master.routing.setupTimeSec")} type="number" step="0.1" value={processForm.setupTime} onChange={(e) => setProcessForm((f) => ({ ...f, setupTime: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setProcessModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={saveProcess} disabled={!processForm.processCode || !processForm.processName}>{t("common.save")}</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteGroup} onClose={() => setDeleteGroup(null)} onConfirm={confirmDeleteGroup}
        title={t("common.delete")} message={`${deleteGroup?.routingCode || ""} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`} variant="danger" />
      <ConfirmModal isOpen={!!deleteProcess} onClose={() => setDeleteProcess(null)} onConfirm={confirmDeleteProcess}
        title={t("common.delete")} message={`${deleteProcess?.processName || ""} ${t("master.routing.deleteConfirm")}`} variant="danger" />
    </div>
  );
}
