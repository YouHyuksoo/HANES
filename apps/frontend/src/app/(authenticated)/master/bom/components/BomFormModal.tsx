"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/BomFormModal.tsx
 * @description BOM 추가/수정 폼 모달 - API 연동 (POST/PUT /master/boms)
 *
 * 초보자 가이드:
 * 1. **editingItem = null**: 추가 모드 → POST /master/boms
 * 2. **editingItem != null**: 수정 모드 → PUT /master/boms/:id
 * 3. 자품목은 API 검색으로 선택 (GET /master/parts?search=xxx)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button, Modal, Input } from "@/components/ui";
import api from "@/services/api";
import { BomTreeItem } from "../types";

interface BomFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingItem: BomTreeItem | null;
  parentPartId: string;
  parentPartCode: string;
}

interface PartOption {
  id: string;
  partCode: string;
  partName: string;
  partType: string;
}

export default function BomFormModal({ isOpen, onClose, onSave, editingItem, parentPartId, parentPartCode }: BomFormModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [childSearch, setChildSearch] = useState("");
  const [childOptions, setChildOptions] = useState<PartOption[]>([]);
  const [selectedChild, setSelectedChild] = useState<PartOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [qtyPer, setQtyPer] = useState("1");
  const [seq, setSeq] = useState("0");
  const [revision, setRevision] = useState("A");
  const [processCode, setProcessCode] = useState("");
  const [side, setSide] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setSelectedChild({ id: editingItem.childPartId || "", partCode: editingItem.partCode, partName: editingItem.partName, partType: editingItem.partType });
      setChildSearch(editingItem.partCode);
      setQtyPer(String(editingItem.qtyPer));
      setSeq(String(editingItem.seq));
      setRevision(editingItem.revision || "A");
      setProcessCode(editingItem.processCode || "");
      setSide(editingItem.side || "");
      setValidFrom(editingItem.validFrom ? editingItem.validFrom.split("T")[0] : "");
      setValidTo(editingItem.validTo ? editingItem.validTo.split("T")[0] : "");
      setRemark("");
    } else {
      setSelectedChild(null); setChildSearch(""); setQtyPer("1"); setSeq("0");
      setRevision("A"); setProcessCode(""); setSide(""); setValidFrom(""); setValidTo(""); setRemark("");
    }
  }, [isOpen, editingItem]);

  const searchParts = useCallback(async (keyword: string) => {
    if (keyword.length < 1) { setChildOptions([]); return; }
    try {
      const res = await api.get("/master/parts", { params: { search: keyword, limit: 20 } });
      setChildOptions(res.data?.data || []);
      setShowDropdown(true);
    } catch { setChildOptions([]); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (childSearch && !selectedChild) searchParts(childSearch); }, 300);
    return () => clearTimeout(timer);
  }, [childSearch, selectedChild, searchParts]);

  const handleSelectChild = (opt: PartOption) => {
    setSelectedChild(opt);
    setChildSearch(opt.partCode);
    setShowDropdown(false);
  };

  const handleSave = async () => {
    if (!selectedChild) return;
    setSaving(true);
    try {
      const body = {
        parentPartId, childPartId: selectedChild.id,
        qtyPer: Number(qtyPer), seq: Number(seq), revision,
        processCode: processCode || undefined, side: side || undefined,
        validFrom: validFrom || undefined, validTo: validTo || undefined,
        remark: remark || undefined, useYn: "Y",
      };
      if (editingItem) {
        await api.put(`/master/boms/${editingItem.id}`, body);
      } else {
        await api.post("/master/boms", body);
      }
      onSave();
      onClose();
    } catch { /* API 에러는 인터셉터에서 처리 */ }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? t("master.bom.editBom") : t("master.bom.addBom")} size="lg">
      <div className="space-y-4">
        <Input label={t("master.bom.parentPart")} value={parentPartCode} disabled fullWidth />
        <div className="relative">
          <Input label={t("master.bom.childPartCode")} value={childSearch}
            onChange={(e) => { setChildSearch(e.target.value); setSelectedChild(null); }}
            placeholder={t("master.bom.searchChildPlaceholder")}
            leftIcon={<Search className="w-4 h-4" />} fullWidth disabled={!!editingItem} />
          {showDropdown && childOptions.length > 0 && !selectedChild && (
            <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg">
              {childOptions.map((opt) => (
                <button key={opt.id} onClick={() => handleSelectChild(opt)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5 flex justify-between">
                  <span className="font-mono">{opt.partCode}</span>
                  <span className="text-text-muted">{opt.partName}</span>
                </button>
              ))}
            </div>
          )}
          {selectedChild && (
            <p className="text-xs text-text-muted mt-1">{selectedChild.partName} ({selectedChild.partType})</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label={t("master.bom.qtyPer")} type="number" step="0.01" value={qtyPer} onChange={(e) => setQtyPer(e.target.value)} fullWidth />
          <Input label={t("master.bom.seq", "순서")} type="number" value={seq} onChange={(e) => setSeq(e.target.value)} fullWidth />
          <Input label={t("master.bom.revision")} value={revision} onChange={(e) => setRevision(e.target.value)} fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.bom.processCode", "공정코드")} value={processCode} onChange={(e) => setProcessCode(e.target.value)} placeholder="CUT-01" fullWidth />
          <Input label={t("master.bom.side", "사이드")} value={side} onChange={(e) => setSide(e.target.value)} placeholder="N / L / R" fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.bom.validFrom")} type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} fullWidth />
          <Input label={t("master.bom.validTo")} type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} fullWidth />
        </div>
        <Input label={t("master.bom.remark")} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t("master.bom.remarkPlaceholder")} fullWidth />
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !selectedChild}>
          {saving ? t("common.loading") : editingItem ? t("common.edit") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
