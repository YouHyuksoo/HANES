"use client";

/**
 * @file src/app/(authenticated)/master/worker/page.tsx
 * @description 작업자관리 페이지 - API 연동 CRUD + Oracle TM_EHR 데이터
 *
 * 초보자 가이드:
 * 1. **작업자 목록**: DataGrid에 사진/아바타 + 유형 배지 표시
 * 2. **API 연동**: /master/workers 엔드포인트 사용
 * 3. **사진등록**: 크롭 모달로 위치 조정 후 DataURL 저장
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, RefreshCw, Users } from "lucide-react";
import { Card, CardHeader, CardContent, Button, Input, Modal, ConfirmModal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { WorkerAvatar } from "@/components/worker/WorkerSelector";
import WorkerPhotoUpload from "@/components/worker/WorkerPhotoUpload";
import { Worker } from "./types";
import { ComCodeBadge } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import { api } from "@/services/api";

interface FormState {
  workerCode: string;
  workerName: string;
  engName: string;
  dept: string;
  position: string;
  phone: string;
  email: string;
  hireDate: string;
  quitDate: string;
  qrCode: string;
  remark: string;
  useYn: string;
}

const EMPTY_FORM: FormState = {
  workerCode: "", workerName: "", engName: "", dept: "", position: "",
  phone: "", email: "", hireDate: "", quitDate: "", qrCode: "", remark: "", useYn: "Y",
};

export default function WorkerPage() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);

  const comCodeTypeOptions = useComCodeOptions("WORKER_TYPE");

  const useYnOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "Y", label: t("common.yes", "사용") },
    { value: "N", label: t("common.no", "미사용") },
  ], [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/workers", {
        params: { search: searchText || undefined, useYn: useYnFilter || undefined, limit: 200 },
      });
      const result = res.data?.data ?? res.data;
      setWorkers(Array.isArray(result) ? result : result?.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [searchText, useYnFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (worker: Worker | null) => {
    setEditing(worker);
    setForm({
      workerCode: worker?.workerCode ?? "",
      workerName: worker?.workerName ?? "",
      engName: worker?.engName ?? "",
      dept: worker?.dept ?? "",
      position: worker?.position ?? "",
      phone: worker?.phone ?? "",
      email: worker?.email ?? "",
      hireDate: worker?.hireDate ?? "",
      quitDate: worker?.quitDate ?? "",
      qrCode: worker?.qrCode ?? "",
      remark: worker?.remark ?? "",
      useYn: worker?.useYn ?? "Y",
    });
    setPhotoUrl(worker?.photoUrl ?? null);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); setForm(EMPTY_FORM); setPhotoUrl(null); };

  const handleSave = async () => {
    setFormError("");
    if (!form.workerCode.trim() || !form.workerName.trim()) {
      setFormError(t("common.requiredField", "필수 항목을 입력하세요."));
      return;
    }
    try {
      const payload = {
        workerCode: form.workerCode.trim(),
        workerName: form.workerName.trim(),
        engName: form.engName.trim() || undefined,
        dept: form.dept.trim() || undefined,
        position: form.position.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        hireDate: form.hireDate.trim() || undefined,
        quitDate: form.quitDate.trim() || undefined,
        qrCode: form.qrCode.trim() || undefined,
        photoUrl: photoUrl || undefined,
        remark: form.remark.trim() || undefined,
        useYn: form.useYn,
      };
      if (editing) {
        await api.put(`/master/workers/${editing.id}`, payload);
      } else {
        await api.post("/master/workers", payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || t("common.saveFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/workers/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch { /* ignore */ }
  };

  const columns = useMemo<ColumnDef<Worker>[]>(() => [
    {
      id: "photo", header: t("master.worker.photo", "사진"), size: 60,
      cell: ({ row }) => <WorkerAvatar name={row.original.workerName} dept={row.original.dept ?? ""} photoUrl={row.original.photoUrl} />,
    },
    { accessorKey: "workerCode", header: t("master.worker.workerCode", "작업자코드"), size: 100 },
    { accessorKey: "workerName", header: t("master.worker.workerName", "작업자명"), size: 100 },
    { accessorKey: "engName", header: t("master.worker.engName", "영문명"), size: 100, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "dept", header: t("master.worker.dept", "부서"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "position", header: t("master.worker.position", "직급"), size: 80, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "phone", header: t("master.worker.phone", "전화번호"), size: 120, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "useYn", header: t("master.worker.use", "사용"), size: 60,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${
            v === "Y"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}>
            {v === "Y" ? t("common.yes", "사용") : t("common.no", "미사용")}
          </span>
        );
      },
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
          <p className="text-text-muted mt-1">{t("master.worker.subtitle", "작업자 등록 및 관리")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t("master.worker.searchPlaceholder", "코드/이름 검색")}
            value={searchText} onChange={e => setSearchText(e.target.value)}
            className="w-48"
          />
          <div className="w-28">
            <Select options={useYnOptions} value={useYnFilter} onChange={setUseYnFilter} fullWidth />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => openModal(null)}>
            <Plus className="w-4 h-4 mr-1" />{t("master.worker.addWorker", "작업자 추가")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title={t("master.worker.workerList", "작업자 목록")}
          subtitle={t("master.worker.totalCount", { count: workers.length, defaultValue: `총 ${workers.length}건` })}
        />
        <CardContent>
          <DataGrid data={workers} columns={columns} pageSize={15} isLoading={loading} emptyMessage={t("master.worker.emptyMessage", "등록된 작업자가 없습니다.")} />
        </CardContent>
      </Card>

      {/* 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? t("master.worker.editWorker", "작업자 수정") : t("master.worker.addWorker", "작업자 추가")} size="lg">
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
          <div className="flex gap-6">
            <div className="shrink-0"><WorkerPhotoUpload value={photoUrl} onChange={setPhotoUrl} /></div>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label={t("master.worker.workerCode", "작업자코드")} value={form.workerCode} onChange={e => setForm(p => ({ ...p, workerCode: e.target.value }))} fullWidth disabled={!!editing} required />
                <Input label={t("master.worker.workerName", "작업자명")} value={form.workerName} onChange={e => setForm(p => ({ ...p, workerName: e.target.value }))} fullWidth required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t("master.worker.engName", "영문명")} value={form.engName} onChange={e => setForm(p => ({ ...p, engName: e.target.value }))} fullWidth />
                <Input label={t("master.worker.dept", "부서")} value={form.dept} onChange={e => setForm(p => ({ ...p, dept: e.target.value }))} fullWidth />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t("master.worker.position", "직급")} value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} fullWidth />
                <Input label={t("master.worker.phone", "전화번호")} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} fullWidth />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t("master.worker.email", "이메일")} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} fullWidth />
                <Input label={t("master.worker.qrCode", "QR코드")} value={form.qrCode} onChange={e => setForm(p => ({ ...p, qrCode: e.target.value }))} fullWidth />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label={t("master.worker.hireDate", "입사일")} placeholder="YYYYMMDD" value={form.hireDate} onChange={e => setForm(p => ({ ...p, hireDate: e.target.value }))} fullWidth />
                <Input label={t("master.worker.quitDate", "퇴사일")} placeholder="YYYYMMDD" value={form.quitDate} onChange={e => setForm(p => ({ ...p, quitDate: e.target.value }))} fullWidth />
                <Select label={t("master.worker.use", "사용")} options={[{ value: "Y", label: t("common.yes", "사용") }, { value: "N", label: t("common.no", "미사용") }]} value={form.useYn} onChange={v => setForm(p => ({ ...p, useYn: v }))} fullWidth />
              </div>
              <Input label={t("master.worker.remark", "비고")} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={closeModal}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{editing ? t("common.edit") : t("common.add")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title={t("common.delete")} message={`${deleteTarget?.workerName} (${deleteTarget?.workerCode})${t("master.worker.deleteConfirm", "을(를) 삭제하시겠습니까?")}`} variant="danger" />
    </div>
  );
}
