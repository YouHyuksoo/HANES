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
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Workflow, RefreshCw } from "lucide-react";
import { Button, Modal, Select, ConfirmModal } from "@/components/ui";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import api from "@/services/api";
import ProcessList, { type Process } from "./components/ProcessList";
import ProcessEquipGrid from "./components/ProcessEquipGrid";
import { FieldComCodeSelect, FieldInput } from "./components/ProcessFieldHelp";

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
  usePageAiTools("master.process");

  /* ── 공정 목록 상태 ── */
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");

  /* ── 설비 목록 상태 ── */
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [allEquipments, setAllEquipments] = useState<Equipment[]>([]);
  const [equipLoading, setEquipLoading] = useState(false);
  const [allEquipCounts, setAllEquipCounts] = useState<Record<string, number>>(
    {},
  );

  /* ── 패널 상태 ── */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Process | null>(null);
  const [formData, setFormData] = useState<Partial<Process>>({});
  const [saving, setSaving] = useState(false);
  const initialFormRef = useRef<Partial<Process>>({});
  const panelAnimateRef = useRef(true);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();
  const [deleteTarget, setDeleteTarget] = useState<Process | null>(null);
  const [removeEquipmentTarget, setRemoveEquipmentTarget] = useState<Equipment | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignEquipCode, setAssignEquipCode] = useState("");


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
      const res = await api.get("/master/processes/equipment-counts");
      if (res.data.success) {
        setAllEquipCounts(res.data.data || {});
      }
    } catch {
      setAllEquipCounts({});
    }
  }, []);

  const fetchAllEquipments = useCallback(async () => {
    try {
      const res = await api.get("/equipment/equips", {
        params: { limit: "10000", useYn: "Y" },
      });
      if (res.data.success) {
        setAllEquipments(res.data.data || []);
      }
    } catch {
      setAllEquipments([]);
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
      const res = await api.get(`/master/processes/${encodeURIComponent(processCode)}/equipments`);
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
    fetchAllEquipments();
  }, [fetchProcesses, fetchEquipCounts, fetchAllEquipments]);

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
    guard(() => {
      panelAnimateRef.current = true;
      const init: Partial<Process> = { useYn: "Y", sortOrder: 0 };
      setEditingItem(null);
      setFormData(init);
      initialFormRef.current = init;
      setIsPanelOpen(true);
    });
  }, [guard]);

  const handleEdit = useCallback((item: Process) => {
    guard(() => {
      const init = { ...item };
      setEditingItem(item);
      setFormData(init);
      initialFormRef.current = init;
      setIsPanelOpen(true);
    });
  }, [guard]);

  // 작성 중(저장 안 됨) 여부 계산 후 보고 — 항목 전환 시 유실 방어
  const dirty = useMemo(
    () => isPanelOpen && JSON.stringify(formData) !== JSON.stringify(initialFormRef.current),
    [isPanelOpen, formData],
  );
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleSave = useCallback(async () => {
    if (!formData.processCode || !formData.processName || !formData.processType || !formData.processCategory || !formData.lineType)
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
      markDirty(false);
      setIsPanelOpen(false);
      fetchProcesses();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingItem, fetchProcesses, markDirty]);

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
    fetchAllEquipments();
    if (selectedCode) fetchEquipments(selectedCode);
  }, [fetchProcesses, fetchEquipCounts, fetchAllEquipments, fetchEquipments, selectedCode]);

  const handleOpenAssign = useCallback(() => {
    setAssignEquipCode("");
    setAssignModalOpen(true);
  }, []);

  const handleAssignEquipment = useCallback(async () => {
    if (!selectedCode || !assignEquipCode) return;
    try {
      await api.post(`/master/processes/${encodeURIComponent(selectedCode)}/equipments`, {
        equipCode: assignEquipCode,
      });
      setAssignModalOpen(false);
      setAssignEquipCode("");
      fetchEquipments(selectedCode);
      fetchEquipCounts();
    } catch (e: any) {
      console.error("Assign equipment failed:", e);
    }
  }, [selectedCode, assignEquipCode, fetchEquipments, fetchEquipCounts]);

  const confirmEquipmentRemoval = useCallback(async () => {
    if (!selectedCode || !removeEquipmentTarget) return;
    try {
      await api.delete(`/master/processes/${encodeURIComponent(selectedCode)}/equipments/${encodeURIComponent(removeEquipmentTarget.equipCode)}`);
      setRemoveEquipmentTarget(null);
      fetchEquipments(selectedCode);
      fetchEquipCounts();
    } catch (e: any) {
      console.error("Remove equipment failed:", e);
    }
  }, [selectedCode, removeEquipmentTarget, fetchEquipments, fetchEquipCounts]);

  const assignOptions = useMemo(
    () => allEquipments
      .filter((equipment) => !equipments.some((assigned) => assigned.equipCode === equipment.equipCode))
      .map((equipment) => ({
        value: equipment.equipCode,
        label: `${equipment.equipCode} - ${equipment.equipName}`,
      })),
    [allEquipments, equipments],
  );

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

      {/* 본문: 좌측 공정 + 우측 설비 + 슬라이드 패널 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-6">
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
              onAdd={handleOpenAssign}
              onRemove={setRemoveEquipmentTarget}
            />
          </div>
        </div>

        {/* 공정 추가/수정 슬라이드 패널 */}
        {isPanelOpen && (
          <div className={`w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${panelAnimateRef.current ? "animate-slide-in-right" : ""}`}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-bold text-text">
                {editingItem ? t("master.process.editProcess") : t("master.process.addProcess")}
              </h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => guard(() => setIsPanelOpen(false))}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !formData.processCode || !formData.processName || !formData.processType || !formData.processCategory || !formData.lineType}>
                  {saving ? t("common.saving") : t("common.save", "저장")}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FieldInput
                  field="processCode"
                  label={t("master.process.processCode")}
                  value={formData.processCode || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, processCode: e.target.value }))}
                  disabled={!!editingItem}
                  required
                />
                <FieldComCodeSelect
                  field="processType"
                  groupCode="PROCESS_TYPE"
                  includeAll={false}
                  label={t("master.process.processType")}
                  value={formData.processType || ""}
                  onChange={(v) => setFormData((p) => ({ ...p, processType: v }))}
                  required
                />
                <FieldInput
                  field="processName"
                  label={t("master.process.processName")}
                  value={formData.processName || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, processName: e.target.value }))}
                  required
                  wrapperClassName="col-span-2"
                />
                <FieldComCodeSelect
                  field="processCategory"
                  groupCode="PROCESS_CATEGORY"
                  includeAll={false}
                  label={t("master.process.processCategory")}
                  value={formData.processCategory || ""}
                  onChange={(v) => setFormData((p) => ({ ...p, processCategory: v }))}
                  required
                />
                <FieldComCodeSelect
                  field="lineType"
                  label={t("master.process.lineType", { defaultValue: "라인구분" })}
                  groupCode="LINE_TYPE"
                  includeAll={false}
                  value={formData.lineType || ""}
                  onChange={(v) => setFormData((p) => ({ ...p, lineType: v }))}
                  required
                />
                <FieldInput
                  field="sortOrder"
                  label={t("master.process.sortOrder")}
                  type="number"
                  value={formData.sortOrder?.toString() || "0"}
                  onChange={(e) => setFormData((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
                <FieldInput
                  field="remark"
                  label={t("common.remark")}
                  value={formData.remark || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, remark: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 삭제 확인 */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={t("master.process.assignEquipment", "설비 배치")}
        size="md"
      >
        <div className="space-y-4">
          <div className="text-sm text-text-muted">
            {selectedProcess?.processCode} ({selectedProcess?.processName})
          </div>
          <Select
            label={t("equipment.master.equipName", { defaultValue: "설비" })}
            options={assignOptions}
            value={assignEquipCode}
            onChange={setAssignEquipCode}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAssignEquipment} disabled={!assignEquipCode}>
              {t("common.add")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("common.deleteConfirm", { defaultValue: "삭제 확인" })}
        message={`${deleteTarget?.processCode} (${deleteTarget?.processName}) ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        confirmText={t("common.delete")}
        variant="danger"
      />
      <ConfirmModal
        isOpen={!!removeEquipmentTarget}
        onClose={() => setRemoveEquipmentTarget(null)}
        onConfirm={confirmEquipmentRemoval}
        title={t("common.deleteConfirm", { defaultValue: "삭제 확인" })}
        message={`${removeEquipmentTarget?.equipCode ?? ""} (${removeEquipmentTarget?.equipName ?? ""}) ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        confirmText={t("common.delete")}
        variant="danger"
      />
      <ConfirmModal {...guardModalProps} />
    </div>
  );
}
