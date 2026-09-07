"use client";

/**
 * @file production/repair/components/RepairFormModal.tsx
 * @description 수리 등록/수정 모달 - 마스터 폼 + 사용부품 테이블
 *
 * 초보자 가이드:
 * 1. editData가 null이면 신규등록, 객체이면 수정모드
 * 2. FG_BARCODE 입력란에서 Enter → 바코드 스캔 처리
 * 3. 모든 구분값은 ComCodeSelect 사용 (includeAll=false)
 * 4. 사용부품은 PartSearchModal로 품목 선택 후 행 추가
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Search } from "lucide-react";
import { Modal, Button, Input } from "@/components/ui";
import {
  BarcodeScanInput,
  ComCodeSelect,
  ProcessSelect,
  WorkerSelect,
  PartSearchModal,
  QtyInput,
} from "@/components/shared";
import type { PartItem } from "@/components/shared/PartSearchModal";
import { repairStage } from '@harness/shared';
import { formatDateOnly } from '@/utils/date';
import RepairWorkflowPanel from './RepairWorkflowPanel';
import { useRepairText } from '../repairText';
import api from "@/services/api";

/** 사용부품 행 타입 */
interface UsedPartRow {
  itemCode: string;
  itemName: string;
  prdUid: string;
  qty: number;
  remark: string;
}

/** 수리오더 데이터 타입 */
export interface RepairOrderData {
  repairDate: string;
  seq: number;
  status: string;
  fgBarcode: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  prdUid: string | null;
  sourceProcess: string | null;
  returnProcess: string | null;
  repairResult: string | null;
  genuineType: string | null;
  defectType: string | null;
  defectCause: string | null;
  defectPosition: string | null;
  disposition: string | null;
  workerId: string | null;
  remark: string | null;
  usedParts?: UsedPartRow[];
}

interface RepairFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: RepairOrderData | null;
}

export default function RepairFormModal({
  isOpen,
  onClose,
  onSaved,
  editData: initialEditData,
}: RepairFormModalProps) {
  const { t } = useTranslation();
  const text = useRepairText();
  const [editData,setEditData] = useState<RepairOrderData | null>(initialEditData ?? null);
  const [error,setError] = useState('');
  useEffect(()=>{if(isOpen){setEditData(initialEditData ?? null);setError('');}},[isOpen,initialEditData]);
  const stage=editData?repairStage(editData):'received';
  const readOnly=stage==='completed'||stage==='inspection'||stage==='unknown';
  const barcodeRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editData;

  // 마스터 폼 상태
  const [fgBarcode, setFgBarcode] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState(1);
  const [prdUid, setPrdUid] = useState("");
  const [sourceProcess, setSourceProcess] = useState("");
  const [returnProcess, setReturnProcess] = useState("");
  const [genuineType, setGenuineType] = useState("");
  const [defectType, setDefectType] = useState("");
  const [defectCause, setDefectCause] = useState("");
  const [defectPosition, setDefectPosition] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  // 사용부품
  const [usedParts, setUsedParts] = useState<UsedPartRow[]>([]);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);

  // 모달 열릴 때 초기화 / 편집 데이터 로드
  useEffect(() => {
    if (!isOpen) return;
    if (editData) {
      setFgBarcode(editData.fgBarcode || "");
      setItemCode(editData.itemCode || "");
      setItemName(editData.itemName || "");
      setQty(editData.qty || 1);
      setPrdUid(editData.prdUid || "");
      setSourceProcess(editData.sourceProcess || "");
      setReturnProcess(editData.returnProcess || "");
      setGenuineType(editData.genuineType || "");
      setDefectType(editData.defectType || "");
      setDefectCause(editData.defectCause || "");
      setDefectPosition(editData.defectPosition || "");
      setWorkerId(editData.workerId || "");
      setRemark(editData.remark || "");
      setUsedParts(editData.usedParts || []);
    } else {
      setFgBarcode(""); setItemCode(""); setItemName("");
      setQty(1); setPrdUid("");
      setSourceProcess(""); setReturnProcess("");
      setGenuineType("");
      setDefectType(""); setDefectCause("");
      setDefectPosition("");
      setWorkerId(""); setRemark("");
      setUsedParts([]);
    }
  }, [isOpen, editData]);

  /** FG 스캔 시 서버에서 실제 라벨과 수리 대상 품목을 검증한다. */
  const handleBarcodeScan = useCallback(async (rawFgBarcode?: string) => {
    const scanned=(rawFgBarcode ?? fgBarcode).replace(/\r?\n|\r/g,'').trim();
    if(!scanned || stage!=='received')return;
    setError('');
    try {
      const response=await api.get('/production/repairs/barcode',{params:{barcode:scanned}});
      const product=response.data.data;
      setFgBarcode(product.fgBarcode);setPrdUid(product.prdUid);
      setItemCode(product.itemCode);setItemName(product.itemName);setQty(product.qty);
    } catch(err:unknown) {
      setFgBarcode('');setPrdUid('');setItemCode('');setItemName('');
      setError(String((err as {response?:{data?:{message?:string}}}).response?.data?.message??text.failed));
    }
  },[fgBarcode,stage,text.failed]);

  /** 품목 선택 (PartSearchModal) */
  const handlePartSelect = useCallback((part: PartItem) => {
    setItemCode(part.itemCode);
    setItemName(part.itemName);
  }, []);

  /** 사용부품 추가 */
  const handleAddUsedPart = useCallback((part: PartItem) => {
    setUsedParts(prev=>prev.some(p=>p.itemCode===part.itemCode)
      ?prev.map(p=>p.itemCode===part.itemCode?{...p,qty:p.qty+1}:p)
      :[...prev,{itemCode:part.itemCode,itemName:part.itemName,prdUid:'',qty:1,remark:''}]);
  }, []);

  /** 사용부품 삭제 */
  const handleRemoveUsedPart = useCallback((index: number) => {
    setUsedParts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** 사용부품 인라인 편집 */
  const handlePartFieldChange = useCallback(
    (index: number, field: keyof UsedPartRow, value: string | number) => {
      setUsedParts((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  const reloadDetail = async (date=editData?.repairDate,seq=editData?.seq) => {
    if(!date || seq==null)return;
    const response=await api.get(`/production/repairs/${date}/${seq}`);
    setEditData({...response.data.data,repairDate:date});
    onSaved();
  };
  const currentFields={fgBarcode,itemCode,itemName,qty,prdUid,sourceProcess,returnProcess,genuineType,defectType,defectCause,defectPosition,workerId,remark};
  const normalizeParts=(parts:UsedPartRow[])=>parts.map(p=>({itemCode:p.itemCode,itemName:p.itemName??'',prdUid:p.prdUid??'',qty:p.qty,remark:p.remark??''}));
  const dirty=!editData || Object.entries(currentFields).some(([key,value])=>String(value??'')!==String(editData[key as keyof RepairOrderData]??''))
    || JSON.stringify(normalizeParts(usedParts))!==JSON.stringify(normalizeParts(editData.usedParts??[]));

  /** 저장 */
  const handleSave = async () => {
    if (!itemCode || readOnly) return;
    setError('');
    setSaving(true);
    try {
      const body = {
        fgBarcode: fgBarcode || '',
        itemCode,
        itemName: itemName || '',
        qty,
        prdUid: prdUid || '',
        sourceProcess: sourceProcess || '',
        returnProcess: returnProcess || '',
        genuineType: genuineType || '',
        defectType: defectType || '',
        defectCause: defectCause || '',
        defectPosition: defectPosition || '',
        workerId: workerId || '',
        remark: remark || '',
        usedParts,
      };
      const response = isEdit && editData
        ? await api.put(`/production/repairs/${editData.repairDate}/${editData.seq}`, body)
        : await api.post('/production/repairs', body);
      const saved=response.data.data;
      await reloadDetail(formatDateOnly(saved.repairDate),saved.seq);
    } catch(err:unknown) {
      setError(String((err as {response?:{data?:{message?:string}}}).response?.data?.message??text.failed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? t("production.repair.editRepair") : t("production.repair.registerRepair")}
        size="xl"
      >
        <div className="space-y-4">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <fieldset disabled={readOnly || saving} className="space-y-4">
          {/* FG 바코드 스캔 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary dark:text-slate-400 mb-1">
              {t("production.repair.fgBarcode")}
            </label>
            <div>
              <BarcodeScanInput
                ref={barcodeRef}
                value={fgBarcode}
                onChange={value=>{setFgBarcode(value);if(!value)setPrdUid('');}}
                onScan={handleBarcodeScan}
                placeholder={t("production.repair.scanBarcode")}
                className="h-12 text-lg"
                fullWidth
                disabled={stage!=='received'}
                maintainFocus={false}
                blinkIndicator
                serialFocusedOnly
                refocusAfterScan
              />
            </div>
          </div>

          {/* 2열 그리드: 품목/수리 정보 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 품목 선택 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-slate-400 mb-1">
                {t("production.repair.itemCode")} *
              </label>
              <div className="flex gap-2">
                <Input value={itemCode} readOnly placeholder={t("production.repair.itemCode")} fullWidth />
                <Button variant="outline" size="sm" disabled={stage!=='received'||!!fgBarcode} onClick={() => setItemSearchOpen(true)}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {itemName && <p className="text-xs text-text-muted mt-1">{itemName}</p>}
            </div>

            <QtyInput disabled={stage!=='received'||!!fgBarcode} label={t("production.repair.qty")} value={qty} onChange={(n) => setQty(n)} fullWidth />
            <Input label={t("production.repair.prdUid")} value={prdUid} readOnly fullWidth />
            <ProcessSelect disabled={stage!=='received'} label={t("production.repair.sourceProcess")} value={sourceProcess} onChange={setSourceProcess} fullWidth />
            <ProcessSelect label={t("production.repair.returnProcess")} value={returnProcess} onChange={setReturnProcess} fullWidth />
            <WorkerSelect label={t("production.repair.worker")} value={workerId} onChange={setWorkerId} fullWidth />
            <ComCodeSelect groupCode="DEFECT_GENUINE" label={t("production.repair.genuineType")} value={genuineType} onChange={setGenuineType} includeAll={false} fullWidth />
            <ComCodeSelect groupCode="DEFECT_TYPE" label={t("production.repair.defectType")} value={defectType} onChange={setDefectType} includeAll={false} fullWidth />
            <ComCodeSelect groupCode="DEFECT_CAUSE" label={t("production.repair.defectCause")} value={defectCause} onChange={setDefectCause} includeAll={false} fullWidth />
            <ComCodeSelect groupCode="DEFECT_POSITION" label={t("production.repair.defectPosition")} value={defectPosition} onChange={setDefectPosition} includeAll={false} fullWidth />
            <Input label={t("production.repair.remark")} value={remark} onChange={(e) => setRemark(e.target.value)} fullWidth />
          </div>

          {/* 사용부품 섹션 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-text-primary dark:text-slate-200">
                {t("production.repair.usedParts")}
              </h4>
              <Button variant="outline" size="sm" onClick={() => setPartModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                {t("production.repair.addPart")}
              </Button>
            </div>
            <p className="text-xs text-text-muted mb-2">{text.partsHelp}</p>
            {usedParts.length > 0 ? (
              <div className="border border-border-default dark:border-slate-600 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">{t("production.repair.itemCode")}</th>
                      <th className="px-3 py-2 text-left">{t("production.repair.itemName")}</th>
                      <th className="px-3 py-2 text-center w-20">{t("production.repair.qty")}</th>
                      <th className="px-3 py-2 text-left">{t("production.repair.remark")}</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usedParts.map((part, idx) => (
                      <tr key={idx} className="border-t border-border-default dark:border-slate-600">
                        <td className="px-3 py-1.5 font-mono text-xs">{part.itemCode}</td>
                        <td className="px-3 py-1.5 text-xs">{part.itemName}</td>
                        <td className="px-3 py-1.5">
                          <QtyInput
                            value={part.qty}
                            onChange={(n) => handlePartFieldChange(idx, "qty", n)}
                            className="w-full px-2 py-1 text-xs text-center border border-border-default dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-text-primary dark:text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={part.remark}
                            onChange={(e) => handlePartFieldChange(idx, "remark", e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-border-default dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-text-primary dark:text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button onClick={() => handleRemoveUsedPart(idx)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-muted text-center py-4 border border-dashed border-border-default dark:border-slate-600 rounded-lg">
                {t("production.repair.addPart")}
              </p>
            )}
          </div>

          </fieldset>
          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !itemCode || readOnly || !dirty}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
          {editData && <RepairWorkflowPanel key={`${editData.seq}-${editData.status}-${editData.repairResult}-${editData.disposition}-${JSON.stringify(editData.usedParts)}`} order={editData} dirty={dirty} onDone={reloadDetail}/>}
        </div>
      </Modal>

      {/* 품목 선택 모달 (수리 대상) */}
      <PartSearchModal
        isOpen={itemSearchOpen}
        onClose={() => setItemSearchOpen(false)}
        onSelect={handlePartSelect}
        allowedItemTypes={["FINISHED","SEMI_PRODUCT"]}
      />

      {/* 사용부품 선택 모달 */}
      <PartSearchModal
        isOpen={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onSelect={handleAddUsedPart}
        allowedItemTypes={["RAW_MATERIAL"]}
      />
    </>
  );
}
