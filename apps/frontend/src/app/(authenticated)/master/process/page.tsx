"use client";

/**
 * @file src/app/(authenticated)/master/process/page.tsx
 * @description 공정관리 페이지 - 좌측 공정 목록 + 우측 배치 설비 목록
 *
 * 초보자 가이드:
 * 1. 좌측(3칸): 공정 목록 - 클릭 시 해당 공정 선택
 * 2. 우측(9칸): 선택된 공정에 배치된 설비 DataGrid
 * 3. 공정 CRUD는 모달로 처리
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Workflow, RefreshCw } from "lucide-react";
import { Button, Modal, Input, Select, ConfirmModal } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import ProcessList, { type Process } from "./components/ProcessList";
import ProcessEquipGrid from "./components/ProcessEquipGrid";

interface Equipment {
  equipCode: string;
  equipName: string;
  equipType: string | null;
  modelName: string | null;
  maker: string | null;
  lineCode: string | null;
  status: string;
  useYn: string;
}

export default function ProcessPage() {
  const { t } = useTranslation();

  /* ── 공정 목록 상태 ── */
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");

  /* ── 설비 목록 상태 ── */
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [equipLoading, setEquipLoading] = useState(false);
  const [allEquipCounts, setAllEquipCounts] = useState<Record<string, number>>(
    {},
  );

  /* ── 모달 상태 ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Process | null>(null);
  const [formData, setFormData] = useState<Partial<Process>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Process | null>(null);

  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");
  const processCategoryOptions = useMemo(
    () => [
      { value: "ASSY", label: t("master.process.catAssy") },
      { value: "INSP", label: t("master.process.catInsp") },
      { value: "CUTTING", label: t("master.process.catCutting") },
      { value: "WELDING", label: t("master.process.catWelding") },
      { value: "PACKING", label: t("master.process.catPacking") },
    ],
    [t],
  );

  /* ── 공정 목록 조회 ── */
  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/processes", {
        params: { limit: "5000" },
      });
      if (res.data.success) {
        const data: Process[] = res.data.data || [];
        setProcesses(data);
        if (!selectedCode && data.length > 0) {
          setSelectedCode(data[0].processCode);
        }
      }
    } catch {
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── 전체 설비 수 카운트 (공정별) ── */
  const fetchEquipCounts = useCallback(async () => {
    try {
      const res = await api.get("/equipment/equips", {
        params: { limit: "10000" },
      });
      if (res.data.success) {
        const all: Equipment[] = res.data.data || [];
        const counts: Record<string, number> = {};
        all.forEach((eq: any) => {
          if (eq.processCode) {
            counts[eq.processCode] = (counts[eq.processCode] || 0) + 1;
          }
        });
        setAllEquipCounts(counts);
      }
    } catch {
      setAllEquipCounts({});
    }
  }, []);

  /* ── 선택된 공정의 설비 목록 조회 ── */
  const fetchEquipments = useCallback(async (processCode: string) => {
    if (!processCode) {
      setEquipments([]);
      return;
    }
    setEquipLoading(true);
    try {
      const res = await api.get("/equipment/equips", {
        params: { processCode, limit: "5000" },
      });
      if (res.data.success) {
        setEquipments(res.data.data || []);
      }
    } catch {
      setEquipments([]);
    } finally {
      setEquipLoading(false);
    }
  }, []);

  /* ── 초기 로드 ── */
  useEffect(() => {
    fetchProcesses();
    fetchEquipCounts();
  }, [fetchProcesses, fetchEquipCounts]);

  /* ── 공정 선택 시 설비 조회 ── */
  useEffect(() => {
    if (selectedCode) {
      fetchEquipments(selectedCode);
    }
  }, [selectedCode, fetchEquipments]);

  /* ── 선택된 공정의 이름 ── */
  const selectedProcess = useMemo(
    () => processes.find((p) => p.processCode === selectedCode),
    [processes, selectedCode],
  );

  /* ── CRUD 핸들러 ── */
  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setFormData({ useYn: "Y", sortOrder: 0 });
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((item: Process) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.processCode || !formData.processName || !formData.processType)
      return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(
          `/master/processes/${editingItem.processCode}`,
          formData,
        );
      } else {
        await api.post("/master/processes", formData);
      }
      setIsModalOpen(false);
      fetchProcesses();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingItem, fetchProcesses]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/processes/${deleteTarget.processCode}`);
      setDeleteTarget(null);
      if (selectedCode === deleteTarget.processCode) {
        setSelectedCode("");
        setEquipments([]);
      }
      fetchProcesses();
      fetchEquipCounts();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, [deleteTarget, selectedCode, fetchProcesses, fetchEquipCounts]);

  const handleRefresh = useCallback(() => {
    fetchProcesses();
    fetchEquipCounts();
    if (selectedCode) fetchEquipments(selectedCode);
  }, [fetchProcesses, fetchEquipCounts, fetchEquipments, selectedCode]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Workflow className="w-7 h-7 text-primary" />
            {t("master.process.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("master.process.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw
              className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 본문: 좌측 공정 + 우측 설비 */}
      <div className="grid grid-cols-12 gap-6 min-h-0 flex-1">
        <div className="col-span-7 flex flex-col min-h-0">
          <ProcessList
            processes={processes}
            selectedCode={selectedCode}
            onSelect={setSelectedCode}
            isLoading={loading}
            equipCounts={allEquipCounts}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
          />
        </div>
        <div className="col-span-5 flex flex-col min-h-0">
          <ProcessEquipGrid
            processCode={selectedCode}
            processName={selectedProcess?.processName ?? ""}
            equipments={equipments}
            isLoading={equipLoading}
          />
        </div>
      </div>

      {/* 공정 추가/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingItem
            ? t("master.process.editProcess")
            : t("master.process.addProcess")
        }
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("master.process.processCode")}
            placeholder="CUT-01"
            value={formData.processCode || ""}
            onChange={(e) =>
              setFormData((p) => ({ ...p, processCode: e.target.value }))
            }
            disabled={!!editingItem}
            fullWidth
          />
          <Select
            label={t("master.process.processType")}
            options={processTypeOptions}
            value={formData.processType || ""}
            onChange={(v) => setFormData((p) => ({ ...p, processType: v }))}
            fullWidth
          />
          <div className="col-span-2">
            <Input
              label={t("master.process.processName")}
              placeholder={t("master.process.processName")}
              value={formData.processName || ""}
              onChange={(e) =>
                setFormData((p) => ({ ...p, processName: e.target.value }))
              }
              fullWidth
            />
          </div>
          <Select
            label={t("master.process.processCategory")}
            options={processCategoryOptions}
            value={formData.processCategory || ""}
            onChange={(v) =>
              setFormData((p) => ({ ...p, processCategory: v }))
            }
            fullWidth
          />
          <Input
            label={t("master.process.sortOrder")}
            type="number"
            placeholder="0"
            value={formData.sortOrder?.toString() || "0"}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                sortOrder: parseInt(e.target.value) || 0,
              }))
            }
            fullWidth
          />
          <Input
            label={t("common.remark")}
            placeholder={t("common.remark")}
            value={formData.remark || ""}
            onChange={(e) =>
              setFormData((p) => ({ ...p, remark: e.target.value }))
            }
            fullWidth
          />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? t("common.saving")
              : editingItem
                ? t("common.edit")
                : t("common.add")}
          </Button>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("common.deleteConfirm", { defaultValue: "삭제 확인" })}
        message={`${deleteTarget?.processCode} (${deleteTarget?.processName}) ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        confirmText={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}
