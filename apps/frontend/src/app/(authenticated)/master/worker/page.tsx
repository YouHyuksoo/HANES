"use client";

/**
 * @file src/app/(authenticated)/master/worker/page.tsx
 * @description 작업자관리 페이지 - 작업자 CRUD + 유형별 관리
 *
 * 초보자 가이드:
 * 1. **작업자 목록**: DataGrid에 사진/아바타 + 유형 배지 표시
 * 2. **작업자유형**: CUTTING(절단), CRIMPING(압착), ASSEMBLY(조립), INSPECTOR(검사), PACKING(포장), LEADER(반장)
 * 3. **사진등록**: 크롭 모달로 위치 조정 후 DataURL 저장
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, Download, Users } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, ConfirmModal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { WorkerAvatar } from "@/components/worker/WorkerSelector";
import WorkerPhotoUpload from "@/components/worker/WorkerPhotoUpload";
import { Worker, WorkerType, seedWorkers } from "./types";
import { ComCodeBadge } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";

interface FormState {
  workerCode: string;
  workerName: string;
  workerType: WorkerType;
  dept: string;
  qrCode: string;
  useYn: string;
}

const EMPTY_FORM: FormState = { workerCode: "", workerName: "", workerType: "ASSEMBLY", dept: "", qrCode: "", useYn: "Y" };

export default function WorkerPage() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>(seedWorkers);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);

  const comCodeTypeOptions = useComCodeOptions("WORKER_TYPE");
  const typeOptions = useMemo(() => [
    { value: "", label: t("common.all") }, ...comCodeTypeOptions
  ], [t, comCodeTypeOptions]);

  const deptOptions = useMemo(() => [
    { value: "절단팀", label: t("master.worker.deptCutting", "절단팀") },
    { value: "압착팀", label: t("master.worker.deptCrimping", "압착팀") },
    { value: "조립팀", label: t("master.worker.deptAssembly", "조립팀") },
    { value: "품질팀", label: t("master.worker.deptQuality", "품질팀") },
    { value: "포장팀", label: t("master.worker.deptPacking", "포장팀") },
  ], [t]);

  const filtered = useMemo(() => {
    return workers.filter(w => {
      if (typeFilter && w.workerType !== typeFilter) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!w.workerCode.toLowerCase().includes(s) && !w.workerName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [workers, typeFilter, searchText]);

  const openModal = (worker: Worker | null) => {
    setEditingId(worker?.id ?? null);
    setForm({
      workerCode: worker?.workerCode ?? "",
      workerName: worker?.workerName ?? "",
      workerType: worker?.workerType ?? "ASSEMBLY",
      dept: worker?.dept ?? "",
      qrCode: worker?.qrCode ?? "",
      useYn: worker?.useYn ?? "Y",
    });
    setPhotoUrl(worker?.photoUrl ?? null);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setPhotoUrl(null); };

  const handleSave = () => {
    if (!form.workerCode.trim() || !form.workerName.trim()) return;
    const data: Worker = {
      id: editingId || `w${Date.now()}`,
      workerCode: form.workerCode.trim(), workerName: form.workerName.trim(),
      workerType: form.workerType, dept: form.dept.trim() || null,
      qrCode: form.qrCode.trim() || null, photoUrl: photoUrl || null,
      processIds: null, useYn: form.useYn,
    };
    if (editingId) {
      setWorkers(prev => prev.map(w => w.id === editingId ? data : w));
    } else {
      setWorkers(prev => [...prev, data]);
    }
    closeModal();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setWorkers(prev => prev.filter(w => w.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const columns = useMemo<ColumnDef<Worker>[]>(() => [
    {
      id: "photo", header: t("master.worker.photo", "사진"), size: 60,
      cell: ({ row }) => <WorkerAvatar name={row.original.workerName} dept={row.original.dept ?? ""} photoUrl={row.original.photoUrl} />,
    },
    { accessorKey: "workerCode", header: t("master.worker.workerCode", "작업자코드"), size: 100 },
    { accessorKey: "workerName", header: t("master.worker.workerName", "작업자명"), size: 100 },
    {
      accessorKey: "workerType", header: t("master.worker.workerType", "작업자유형"), size: 110,
      cell: ({ getValue }) => <ComCodeBadge groupCode="WORKER_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "dept", header: t("master.worker.dept", "부서"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "qrCode", header: t("master.worker.qrCode", "QR코드"), size: 110, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "useYn", header: t("master.worker.use", "사용"), size: 60,
      cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />,
    },
    {
      id: "actions", header: t("common.actions"), size: 80,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openModal(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />{t("master.worker.title", "작업자 관리")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.worker.subtitle", "작업자 등록 및 유형별 관리")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t("common.excel")}</Button>
          <Button size="sm" onClick={() => openModal(null)}><Plus className="w-4 h-4 mr-1" />{t("master.worker.addWorker", "작업자 추가")}</Button>
        </div>
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input placeholder={t("master.worker.searchPlaceholder", "작업자코드/이름 검색")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <div className="w-40">
            <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
          </div>
        </div>
        <DataGrid data={filtered} columns={columns} pageSize={15} />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? t("master.worker.editWorker", "작업자 수정") : t("master.worker.addWorker", "작업자 추가")} size="md">
        <div className="flex gap-6">
          <div className="shrink-0"><WorkerPhotoUpload value={photoUrl} onChange={setPhotoUrl} /></div>
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t("master.worker.workerCode", "작업자코드")} placeholder="W-001" value={form.workerCode} onChange={e => setForm(p => ({ ...p, workerCode: e.target.value }))} fullWidth disabled={!!editingId} />
              <Input label={t("master.worker.workerName", "작업자명")} placeholder="김작업" value={form.workerName} onChange={e => setForm(p => ({ ...p, workerName: e.target.value }))} fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t("master.worker.workerType", "작업자유형")} options={typeOptions.filter(o => o.value)} value={form.workerType} onChange={v => setForm(p => ({ ...p, workerType: v as WorkerType }))} fullWidth />
              <Select label={t("master.worker.dept", "부서")} options={deptOptions} value={form.dept} onChange={v => setForm(p => ({ ...p, dept: v }))} fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t("master.worker.qrCode", "QR코드")} placeholder="QR-W001" value={form.qrCode} onChange={e => setForm(p => ({ ...p, qrCode: e.target.value }))} fullWidth />
              <Select label={t("master.worker.use", "사용")} options={[{ value: "Y", label: "Y" }, { value: "N", label: "N" }]} value={form.useYn} onChange={v => setForm(p => ({ ...p, useYn: v }))} fullWidth />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={closeModal}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!form.workerCode.trim() || !form.workerName.trim()}>{editingId ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title={t("common.delete")} message={`${deleteTarget?.workerName} (${deleteTarget?.workerCode})${t("master.worker.deleteConfirm", "을(를) 삭제하시겠습니까?")}`} variant="danger" />
    </div>
  );
}
