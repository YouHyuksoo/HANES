"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/RoutingFormModal.tsx
 * @description 라우팅 추가/수정 폼 모달 - API 연동 (POST/PUT /master/routings)
 *
 * 초보자 가이드:
 * 1. **editingItem = null**: 추가 모드 → POST /master/routings
 * 2. **editingItem != null**: 수정 모드 → PUT /master/routings/:itemCode/:seq
 * 3. 공정코드는 공정마스터(GET /master/processes)에서 셀렉트로 선택
 * 4. 공정유형/설비유형은 ComCode 셀렉트 사용
 * 5. seq는 추가 모드일 때 기존 라우팅의 마지막 seq + 10으로 자동 설정
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, Input } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { RoutingItem } from "../types";

interface ProcessOption {
  processCode: string;
  processName: string;
}

interface RoutingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingItem: RoutingItem | null;
  itemCode: string;
}

export default function RoutingFormModal({ isOpen, onClose, onSave, editingItem, itemCode }: RoutingFormModalProps) {
  const { t } = useTranslation();
  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");
  const equipTypeOptions = useComCodeOptions("EQUIP_TYPE");

  const [saving, setSaving] = useState(false);
  const [seq, setSeq] = useState("10");
  const [processCode, setProcessCode] = useState("");
  const [processName, setProcessName] = useState("");
  const [processType, setProcessType] = useState("");
  const [equipType, setEquipType] = useState("");
  const [stdTime, setStdTime] = useState("");
  const [setupTime, setSetupTime] = useState("");
  const [wireLength, setWireLength] = useState("");
  const [stripLength, setStripLength] = useState("");
  const [crimpHeight, setCrimpHeight] = useState("");
  const [crimpWidth, setCrimpWidth] = useState("");
  const [weldCondition, setWeldCondition] = useState("");

  /* 공정마스터 목록 */
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([]);

  /** 공정마스터 조회 */
  const fetchProcesses = useCallback(async () => {
    try {
      const res = await api.get("/master/processes", { params: { limit: 5000, useYn: "Y" } });
      const data = res.data?.data ?? [];
      setProcessOptions(data.map((p: any) => ({
        processCode: p.processCode,
        processName: p.processName,
      })));
    } catch {
      setProcessOptions([]);
    }
  }, []);

  /** 기존 라우팅의 마지막 seq 조회 */
  const fetchNextSeq = useCallback(async () => {
    if (!itemCode) return;
    try {
      const res = await api.get("/master/routings", {
        params: { itemCode, limit: 5000 },
      });
      const data: RoutingItem[] = res.data?.data ?? [];
      if (data.length > 0) {
        const maxSeq = Math.max(...data.map((r) => r.seq));
        setSeq(String(maxSeq + 10));
      } else {
        setSeq("10");
      }
    } catch {
      setSeq("10");
    }
  }, [itemCode]);

  useEffect(() => {
    if (!isOpen) return;
    fetchProcesses();
    if (editingItem) {
      setSeq(String(editingItem.seq));
      setProcessCode(editingItem.processCode);
      setProcessName(editingItem.processName);
      setProcessType(editingItem.processType || "");
      setEquipType(editingItem.equipType || "");
      setStdTime(editingItem.stdTime != null ? String(editingItem.stdTime) : "");
      setSetupTime(editingItem.setupTime != null ? String(editingItem.setupTime) : "");
      setWireLength(editingItem.wireLength != null ? String(editingItem.wireLength) : "");
      setStripLength(editingItem.stripLength != null ? String(editingItem.stripLength) : "");
      setCrimpHeight(editingItem.crimpHeight != null ? String(editingItem.crimpHeight) : "");
      setCrimpWidth(editingItem.crimpWidth != null ? String(editingItem.crimpWidth) : "");
      setWeldCondition(editingItem.weldCondition || "");
    } else {
      fetchNextSeq();
      setProcessCode(""); setProcessName(""); setProcessType("");
      setEquipType(""); setStdTime(""); setSetupTime(""); setWireLength("");
      setStripLength(""); setCrimpHeight(""); setCrimpWidth(""); setWeldCondition("");
    }
  }, [isOpen, editingItem, fetchProcesses, fetchNextSeq]);

  /** 공정 선택 시 공정명 자동 채움 */
  const handleProcessSelect = useCallback((code: string) => {
    setProcessCode(code);
    const found = processOptions.find((p) => p.processCode === code);
    if (found) setProcessName(found.processName);
  }, [processOptions]);

  const toNum = (v: string) => v ? Number(v) : undefined;

  const handleSave = async () => {
    if (!processCode || !processName) return;
    setSaving(true);
    try {
      const body = {
        itemCode, seq: Number(seq), processCode, processName,
        processType: processType || undefined, equipType: equipType || undefined,
        stdTime: toNum(stdTime), setupTime: toNum(setupTime),
        wireLength: toNum(wireLength), stripLength: toNum(stripLength),
        crimpHeight: toNum(crimpHeight), crimpWidth: toNum(crimpWidth),
        weldCondition: weldCondition || undefined, useYn: "Y",
      };
      if (editingItem) {
        await api.put(`/master/routings/${editingItem.itemCode}/${editingItem.seq}`, body);
      } else {
        await api.post("/master/routings", body);
      }
      onSave();
      onClose();
    } catch { /* API 에러는 인터셉터에서 처리 */ }
    finally { setSaving(false); }
  };

  const selectCls = "w-full px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? t("master.routing.editRouting") : t("master.routing.addRouting")} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* 순서 */}
          <Input label={t("master.routing.seq")} type="number" step="10" value={seq} onChange={(e) => setSeq(e.target.value)} fullWidth />

          {/* 공정코드 - 셀렉트 */}
          <div>
            <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">
              {t("master.routing.processCode")}
            </label>
            <select
              value={processCode}
              onChange={(e) => handleProcessSelect(e.target.value)}
              className={selectCls}
            >
              <option value="">-- {t("common.select")} --</option>
              {processOptions.map((p) => (
                <option key={p.processCode} value={p.processCode}>
                  [{p.processCode}] {p.processName}
                </option>
              ))}
            </select>
          </div>

          {/* 공정명 - 자동 채움, 수정 가능 */}
          <Input label={t("master.routing.processName")} value={processName} onChange={(e) => setProcessName(e.target.value)} fullWidth />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 공정유형 - ComCode 셀렉트 */}
          <div>
            <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">
              {t("master.routing.processType")}
            </label>
            <select
              value={processType}
              onChange={(e) => setProcessType(e.target.value)}
              className={selectCls}
            >
              <option value="">-- {t("common.select")} --</option>
              {processTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 설비유형 - ComCode 셀렉트 */}
          <div>
            <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">
              {t("master.routing.equipType")}
            </label>
            <select
              value={equipType}
              onChange={(e) => setEquipType(e.target.value)}
              className={selectCls}
            >
              <option value="">-- {t("common.select")} --</option>
              {equipTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.routing.stdTimeSec")} type="number" step="0.1" value={stdTime} onChange={(e) => setStdTime(e.target.value)} placeholder="5.5" fullWidth />
          <Input label={t("master.routing.setupTimeSec")} type="number" step="0.1" value={setupTime} onChange={(e) => setSetupTime(e.target.value)} placeholder="10" fullWidth />
        </div>

        <div className="border-t border-border dark:border-gray-600 pt-3">
          <p className="text-xs font-medium text-text-muted dark:text-gray-400 mb-3">{t("master.routing.processDetailTitle")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("master.routing.wireLength")} type="number" step="0.1" value={wireLength} onChange={(e) => setWireLength(e.target.value)} fullWidth />
            <Input label={t("master.routing.stripLength")} type="number" step="0.1" value={stripLength} onChange={(e) => setStripLength(e.target.value)} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label={t("master.routing.crimpHeight")} type="number" step="0.01" value={crimpHeight} onChange={(e) => setCrimpHeight(e.target.value)} fullWidth />
            <Input label={t("master.routing.crimpWidth")} type="number" step="0.01" value={crimpWidth} onChange={(e) => setCrimpWidth(e.target.value)} fullWidth />
          </div>
          <div className="mt-4">
            <Input label={t("master.routing.weldCondition")} value={weldCondition} onChange={(e) => setWeldCondition(e.target.value)}
              placeholder={t("master.routing.weldConditionPlaceholder")} fullWidth />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !processCode || !processName}>
          {saving ? t("common.loading") : editingItem ? t("common.edit") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
