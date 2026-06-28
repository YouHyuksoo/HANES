"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { CheckCircle2, CopyPlus, FileSpreadsheet, Maximize2, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import DataGrid from "@/components/data-grid/DataGrid";
import { Button, Card, CardContent, Input, Modal, Select } from "@/components/ui";
import api from "@/services/api";
import {
  createSpecificationSetupGridColumns,
  type HarnessCircuitSpec,
  type HarnessDrawing,
  type HarnessDrawingRevision,
} from "./specificationSetupColumns";

interface BomOption {
  childItemCode: string;
  childItemName?: string | null;
  childItemNo?: string | null;
  qtyPer?: number;
  unit?: string | null;
  productType?: string | null;
}

interface BomApiRow {
  childItemCode: string;
  qtyPer?: number;
  childPart?: {
    itemName?: string | null;
    itemNo?: string | null;
    unit?: string | null;
    productType?: string | null;
  } | null;
}

const emptyCircuit = (index: number): HarnessCircuitSpec => ({
  circuitNo: String(index + 1),
  wireItemCode: "",
  wireSpec: "",
  wireSize: "",
  colorCode: "",
  colorName: "",
  lengthMm: "",
  stripA: "",
  stripB: "",
  endAHousing: "",
  endATerminal: "",
  connectionSymbol: "STRAIGHT",
  endBTerminal: "",
  endBHousing: "",
  tubeSpec: "",
  subNo: "",
  remark: "",
});

const toNumberOrUndefined = (value: number | "" | undefined) => {
  if (value === "" || value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toOptionalText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const connectionSymbolOptions = [
  { value: "STRAIGHT", label: "직선" },
  { value: "BOTH_CRIMP", label: "양단 압착" },
  { value: "SPLICE", label: "스플라이스" },
  { value: "BRIDGE", label: "분기" },
  { value: "ONE_SIDE", label: "단측" },
];

const connectionSymbolValues = connectionSymbolOptions.map((option) => option.value);

// 전선 드롭다운에서 제외할 부속자재 productType (터미널/하우징 등은 전용 컬럼에서 선택)
const ACCESSORY_PRODUCT_TYPES = ["TERMINAL", "HOUSING", "CONNECTOR", "SEAL", "HOLDER", "TAPE", "TUBE", "SHIELD", "CLIP", "GROMMET", "LABEL"];

const normalizeConnectionSymbol = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  // 구 "LINE"은 "직선(STRAIGHT)"으로 통합 — 기존 데이터 호환
  if (normalized === "LINE") return "STRAIGHT";
  if (normalized && connectionSymbolValues.includes(normalized)) return normalized;
  return "STRAIGHT";
};

const toCircuitPayload = (circuit: HarnessCircuitSpec) => ({
  circuitNo: circuit.circuitNo.trim(),
  wireItemCode: toOptionalText(circuit.wireItemCode),
  wireSpec: toOptionalText(circuit.wireSpec),
  wireSize: toOptionalText(circuit.wireSize),
  colorCode: toOptionalText(circuit.colorCode),
  colorName: toOptionalText(circuit.colorName),
  lengthMm: toNumberOrUndefined(circuit.lengthMm),
  stripA: toNumberOrUndefined(circuit.stripA),
  stripB: toNumberOrUndefined(circuit.stripB),
  endAHousing: toOptionalText(circuit.endAHousing),
  endATerminal: toOptionalText(circuit.endATerminal),
  connectionSymbol: normalizeConnectionSymbol(circuit.connectionSymbol),
  endBTerminal: toOptionalText(circuit.endBTerminal),
  endBHousing: toOptionalText(circuit.endBHousing),
  tubeSpec: toOptionalText(circuit.tubeSpec),
  subNo: toOptionalText(circuit.subNo),
  remark: toOptionalText(circuit.remark),
});

export default function ProductionSpecificationSetupPage() {
  const { t } = useTranslation();
  const [drawings, setDrawings] = useState<HarnessDrawing[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<HarnessDrawing | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [reviseReason, setReviseReason] = useState("");
  const [revising, setRevising] = useState(false);
  const [bomOptions, setBomOptions] = useState<BomOption[]>([]);
  const [headerForm, setHeaderForm] = useState({
    drawingNo: "",
    itemCode: "",
    itemName: "",
    erpItemNo: "",
    customerPartNo: "",
    revisionCode: "A",
    remark: "",
  });
  const [circuits, setCircuits] = useState<HarnessCircuitSpec[]>([emptyCircuit(0)]);

  const selectedRevision = useMemo(
    () => selected?.revisions?.find((revision) => revision.revisionId === selectedRevisionId) ?? selected?.revision,
    [selected, selectedRevisionId],
  );

  // BOM 자재를 productType으로 분류 — 전선/터미널/하우징 드롭다운에 각각 공급
  const wireOptions = useMemo(() => bomOptions.filter((o) => !ACCESSORY_PRODUCT_TYPES.includes(o.productType ?? "")), [bomOptions]);
  const terminalOptions = useMemo(() => bomOptions.filter((o) => o.productType === "TERMINAL"), [bomOptions]);
  const housingOptions = useMemo(() => bomOptions.filter((o) => o.productType === "HOUSING" || o.productType === "CONNECTOR"), [bomOptions]);
  const isApproved = selectedRevision?.status === "APPROVED";

  const fetchDrawings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/production/specifications", { params });
      setDrawings(res.data?.data ?? []);
    } catch {
      setDrawings([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  const loadDetail = useCallback(async (drawingId: number, preferredRevisionId?: number) => {
    const res = await api.get(`/production/specifications/${drawingId}`);
    const detail = res.data?.data as HarnessDrawing;
    const revisionSummary =
      detail.revisions?.find((item) => item.revisionId === preferredRevisionId) ??
      detail.revision;
    const revision = revisionSummary?.revisionId
      ? (await api.get(`/production/specifications/revisions/${revisionSummary.revisionId}`)).data?.data as HarnessDrawingRevision
      : undefined;
    setSelected({ ...detail, revision });
    setSelectedRevisionId(revision?.revisionId ?? null);
    setHeaderForm({
      drawingNo: detail.drawingNo ?? "",
      itemCode: detail.itemCode ?? "",
      itemName: detail.itemName ?? "",
      erpItemNo: detail.erpItemNo ?? "",
      customerPartNo: detail.customerPartNo ?? "",
      revisionCode: revision?.revisionCode ?? revisionSummary?.revisionCode ?? "A",
      remark: detail.remark ?? "",
    });
    setCircuits(revision?.circuits?.length ? revision.circuits : [emptyCircuit(0)]);
  }, []);

  useEffect(() => { fetchDrawings(); }, [fetchDrawings]);

  const loadBomOptions = useCallback(async (itemCode: string) => {
    const code = itemCode.trim();
    if (!code) {
      setBomOptions([]);
      return;
    }
    try {
      const res = await api.get("/master/boms", { params: { parentItemCode: code, limit: 5000 } });
      const rows = (res.data?.data ?? []) as BomApiRow[];
      setBomOptions(rows.map((row) => ({
        childItemCode: row.childItemCode,
        childItemName: row.childPart?.itemName ?? null,
        childItemNo: row.childPart?.itemNo ?? null,
        qtyPer: row.qtyPer,
        unit: row.childPart?.unit ?? null,
        productType: row.childPart?.productType ?? null,
      })));
    } catch {
      setBomOptions([]);
    }
  }, []);

  useEffect(() => {
    loadBomOptions(headerForm.itemCode);
  }, [headerForm.itemCode, loadBomOptions]);

  const columns = useMemo(() => createSpecificationSetupGridColumns({ t }), [t]);

  const resetNew = () => {
    setSelected(null);
    setSelectedRevisionId(null);
    setHeaderForm({ drawingNo: "", itemCode: "", itemName: "", erpItemNo: "", customerPartNo: "", revisionCode: "A", remark: "" });
    setCircuits([emptyCircuit(0)]);
  };

  const updateCircuit = (index: number, field: keyof HarnessCircuitSpec, value: string) => {
    setCircuits((prev) => prev.map((row, rowIndex) => (
      rowIndex === index
        ? { ...row, [field]: ["lengthMm", "stripA", "stripB"].includes(field) ? (value === "" ? "" : Number(value)) : value }
        : row
    )));
  };

  const addCircuit = () => setCircuits((prev) => [...prev, emptyCircuit(prev.length)]);
  const removeCircuit = (index: number) => setCircuits((prev) => prev.filter((_, rowIndex) => rowIndex !== index));

  const buildCircuitsPayload = () => circuits
    .filter((circuit) => circuit.circuitNo.trim())
    .map(toCircuitPayload);

  const saveDrawing = async () => {
    if (!headerForm.drawingNo.trim() || !headerForm.itemCode.trim()) {
      toast.error(t("production.specSetup.drawingNoItemRequired", "도면번호와 품목코드는 필수입니다."));
      return;
    }
    setSaving(true);
    try {
      if (selected?.drawingId && selectedRevisionId) {
        await api.put(`/production/specifications/${selected.drawingId}`, headerForm);
        await api.put(`/production/specifications/revisions/${selectedRevisionId}`, { circuits: buildCircuitsPayload() });
        toast.success(t("production.specSetup.savedDrawing", "제품 도면을 저장했습니다."));
        await loadDetail(selected.drawingId, selectedRevisionId);
      } else {
        const res = await api.post("/production/specifications", { ...headerForm, circuits: buildCircuitsPayload() });
        toast.success(t("production.specSetup.createdDrawing", "제품 도면을 생성했습니다."));
        await fetchDrawings();
        const newId = res.data?.data?.drawingId;
        if (newId) await loadDetail(Number(newId));
      }
    } catch {
      toast.error(t("production.specSetup.saveFailed", "저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const approveRevision = async () => {
    if (!selectedRevisionId || !selected?.drawingId) return;
    await api.post(`/production/specifications/revisions/${selectedRevisionId}/approve`);
    toast.success(t("production.specSetup.approvedRevision", "Revision을 승인했습니다."));
    await loadDetail(selected.drawingId, selectedRevisionId);
  };

  const openReviseModal = () => {
    if (!selectedRevisionId || !selected?.drawingId) return;
    setReviseReason(selectedRevision?.changeReason ?? "");
    setReviseModalOpen(true);
  };

  const confirmReviseDrawing = async () => {
    if (!selectedRevisionId || !selected?.drawingId) return;
    setRevising(true);
    try {
      const res = await api.post(`/production/specifications/revisions/${selectedRevisionId}/revise`, { changeReason: reviseReason });
      const newRevisionId = res.data?.data?.revision?.revisionId;
      toast.success(t("production.specSetup.createdRevision", "새 Revision을 생성했습니다."));
      setReviseModalOpen(false);
      await loadDetail(selected.drawingId, newRevisionId);
    } finally {
      setRevising(false);
    }
  };

  const deleteDrawing = async () => {
    if (!selected?.drawingId) return;
    if (!window.confirm(t("production.specSetup.deleteConfirm", "선택한 제품 도면을 삭제하시겠습니까?"))) return;
    await api.delete(`/production/specifications/${selected.drawingId}`);
    toast.success(t("production.specSetup.deletedDrawing", "제품 도면을 삭제했습니다."));
    resetNew();
    await fetchDrawings();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-5 gap-4 animate-fade-in bg-background">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            {t("production.specificationSetup", "제품 도면관리")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("production.specificationSetupDescription", "제품별 하네스 도면 Revision과 회로별 제작 사양을 관리합니다.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchDrawings} leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}>
            {t("common.refresh")}
          </Button>
          <Button size="sm" onClick={resetNew} leftIcon={<Plus className="w-4 h-4" />}>
            {t("common.create")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(360px,0.8fr)_minmax(720px,1.4fr)] gap-4 min-h-0 flex-1">
        <Card className="min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col gap-3">
            <DataGrid
              data={drawings}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("production.specificationSetup", "제품 도면관리")}
              onRowClick={(row) => loadDetail(row.drawingId)}
              toolbarLeft={(
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t("production.specSetup.searchPlaceholder", "도면번호 / ERP 품번 / 품목 검색")}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              )}
              sqlQuery={`SELECT *\nFROM HARNESS_DRAWING_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY UPDATED_AT DESC`}
            />
          </CardContent>
        </Card>

        <div className="min-h-0 flex flex-col gap-4">
          <Card className="flex-shrink-0" padding="none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-text">{t("production.specSetup.drawingHeader", "도면 Header")}</h2>
                  {selectedRevision && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      Rev {selectedRevision.revisionCode} / {selectedRevision.status}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDrawing} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>{t("common.save")}</Button>
                  <Button size="sm" variant="secondary" onClick={approveRevision} disabled={!selectedRevisionId || isApproved} leftIcon={<CheckCircle2 className="w-4 h-4" />}>{t("production.specSetup.approve", "승인")}</Button>
                  <Button size="sm" variant="secondary" onClick={openReviseModal} disabled={!selectedRevisionId} leftIcon={<CopyPlus className="w-4 h-4" />}>{t("production.specSetup.createRev", "Rev 생성")}</Button>
                  <Button size="sm" variant="danger" onClick={deleteDrawing} disabled={!selected?.drawingId} leftIcon={<Trash2 className="w-4 h-4" />}>{t("common.delete")}</Button>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-3">
                <Input label={t("production.specSetup.drawingNo", "도면번호")} value={headerForm.drawingNo} onChange={(e) => setHeaderForm((prev) => ({ ...prev, drawingNo: e.target.value }))} fullWidth />
                <Input label={t("production.specSetup.erpItemNo", "ERP 품번")} value={headerForm.erpItemNo} onChange={(e) => setHeaderForm((prev) => ({ ...prev, erpItemNo: e.target.value }))} fullWidth />
                <Input label={t("common.partCode")} value={headerForm.itemCode} onChange={(e) => setHeaderForm((prev) => ({ ...prev, itemCode: e.target.value }))} fullWidth />
                <Input label={t("common.partName")} value={headerForm.itemName} onChange={(e) => setHeaderForm((prev) => ({ ...prev, itemName: e.target.value }))} fullWidth />
                <Input label={t("production.specSetup.customerPartNo", "고객 품번")} value={headerForm.customerPartNo} onChange={(e) => setHeaderForm((prev) => ({ ...prev, customerPartNo: e.target.value }))} fullWidth />
                <Input label={t("production.specSetup.initialRev", "최초 Rev")} value={headerForm.revisionCode} onChange={(e) => setHeaderForm((prev) => ({ ...prev, revisionCode: e.target.value }))} disabled={!!selected} fullWidth />
              </div>
              <div className="grid grid-cols-[1fr_240px] gap-3 mt-3">
                <Input label={t("common.remark")} value={headerForm.remark} onChange={(e) => setHeaderForm((prev) => ({ ...prev, remark: e.target.value }))} fullWidth />
                <Select
                  label="Revision"
                  value={selectedRevisionId ?? ""}
                  onChange={(value) => {
                    const revisionId = Number(value);
                    setSelectedRevisionId(revisionId);
                    if (selected?.drawingId) loadDetail(selected.drawingId, revisionId);
                  }}
                  options={(selected?.revisions ?? []).map((revision) => ({
                    value: String(revision.revisionId),
                    label: `Rev ${revision.revisionCode} / ${revision.status}`,
                  }))}
                  fullWidth
                  disabled={!selected?.revisions?.length}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-0 flex-1 overflow-hidden" padding="none">
            <CardContent className="h-full p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-text">{t("production.specSetup.circuitSpecTitle", "회로별 제작 사양")}</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setExpandOpen(true)} leftIcon={<Maximize2 className="w-4 h-4" />}>
                    {t("production.specSetup.expandView", "크게 보기")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={addCircuit} disabled={isApproved} leftIcon={<Plus className="w-4 h-4" />}>
                    {t("production.specSetup.addCircuit", "회로 추가")}
                  </Button>
                </div>
              </div>
              <CircuitSpecTable
                circuits={circuits}
                wireOptions={wireOptions}
                terminalOptions={terminalOptions}
                housingOptions={housingOptions}
                isApproved={isApproved}
                onUpdate={updateCircuit}
                onRemove={removeCircuit}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={expandOpen}
        onClose={() => setExpandOpen(false)}
        title={t("production.specSetup.circuitSpecTitle", "회로별 제작 사양")}
        size="full"
        footer={(
          <Button variant="ghost" onClick={() => setExpandOpen(false)}>{t("common.close")}</Button>
        )}
      >
        <div className="flex flex-col gap-3 h-[74vh]">
          <div className="flex items-center justify-between flex-shrink-0">
            {selectedRevision && (
              <span className={`px-2 py-1 rounded text-xs font-semibold ${isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                Rev {selectedRevision.revisionCode} / {selectedRevision.status}
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={addCircuit} disabled={isApproved} leftIcon={<Plus className="w-4 h-4" />} className="ml-auto">
              {t("production.specSetup.addCircuit", "회로 추가")}
            </Button>
          </div>
          <CircuitSpecTable
            circuits={circuits}
            wireOptions={wireOptions}
            terminalOptions={terminalOptions}
            housingOptions={housingOptions}
            isApproved={isApproved}
            onUpdate={updateCircuit}
            onRemove={removeCircuit}
          />
        </div>
      </Modal>

      <Modal
        isOpen={reviseModalOpen}
        onClose={() => setReviseModalOpen(false)}
        title={t("production.specSetup.createRev", "Rev 생성")}
        size="md"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setReviseModalOpen(false)} disabled={revising}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmReviseDrawing} isLoading={revising} leftIcon={<CopyPlus className="w-4 h-4" />}>
              {t("production.specSetup.createRev", "Rev 생성")}
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            {t("production.specSetup.reviseGuide", "현재 Revision의 회로 사양을 복제해 새 DRAFT Revision을 생성합니다.")}
          </p>
          <Input
            label={t("production.specSetup.changeReason", "변경 사유")}
            value={reviseReason}
            onChange={(event) => setReviseReason(event.target.value)}
            placeholder={t("production.specSetup.changeReasonPlaceholder", "변경 사유를 입력하세요")}
            fullWidth
          />
        </div>
      </Modal>
    </div>
  );
}

function ItemRefSelect({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  options: BomOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const current = value ?? "";
  const missing = current !== "" && !options.some((option) => option.childItemCode === current);
  return (
    <select
      value={current}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary disabled:cursor-not-allowed disabled:text-text-muted"
    >
      <option value="">{placeholder}</option>
      {missing && <option value={current}>{current} {t("production.specSetup.unregistered", "(미등록)")}</option>}
      {options.map((item) => (
        <option key={item.childItemCode} value={item.childItemCode}>
          {item.childItemCode}{item.childItemName ? ` / ${item.childItemName}` : ""}
        </option>
      ))}
    </select>
  );
}

function CircuitSpecTable({
  circuits,
  wireOptions,
  terminalOptions,
  housingOptions,
  isApproved,
  onUpdate,
  onRemove,
}: {
  circuits: HarnessCircuitSpec[];
  wireOptions: BomOption[];
  terminalOptions: BomOption[];
  housingOptions: BomOption[];
  isApproved: boolean;
  onUpdate: (index: number, field: keyof HarnessCircuitSpec, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-0 flex-1 overflow-auto border border-border rounded">
      <table className="min-w-[1680px] w-full text-xs">
        <thead className="sticky top-0 bg-surface border-b border-border z-10">
          <tr className="text-text-muted">
            {["Circuit", "Wire Item", "Wire Spec", "Size", "Color", "Length", "Strip A", "Strip B", "A Housing/Conn", "A Terminal", t("production.specSetup.colConnection", "연결"), "B Terminal", "B Housing/Conn", "Tube", "Sub", t("common.remark"), ""].map((header) => (
              <th key={header} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {circuits.map((row, index) => (
            <tr key={`${row.circuitId ?? "new"}-${index}`} className="border-b border-border/70 hover:bg-surface/60">
              <td className="p-1"><GridInput value={row.circuitNo} onChange={(v) => onUpdate(index, "circuitNo", v)} disabled={isApproved} /></td>
              <td className="p-1 min-w-[180px]">
                <ItemRefSelect value={row.wireItemCode ?? ""} options={wireOptions} placeholder={t("production.specSetup.selectWire", "BOM 전선 선택")} disabled={isApproved} onChange={(v) => onUpdate(index, "wireItemCode", v)} />
              </td>
              <td className="p-1"><GridInput value={row.wireSpec ?? ""} onChange={(v) => onUpdate(index, "wireSpec", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput value={row.wireSize ?? ""} onChange={(v) => onUpdate(index, "wireSize", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput value={row.colorCode ?? ""} onChange={(v) => onUpdate(index, "colorCode", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput type="number" value={row.lengthMm ?? ""} onChange={(v) => onUpdate(index, "lengthMm", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput type="number" value={row.stripA ?? ""} onChange={(v) => onUpdate(index, "stripA", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput type="number" value={row.stripB ?? ""} onChange={(v) => onUpdate(index, "stripB", v)} disabled={isApproved} /></td>
              <td className="p-1 min-w-[150px]">
                <ItemRefSelect value={row.endAHousing ?? ""} options={housingOptions} placeholder={t("production.specSetup.selectHousing", "하우징/커넥터 선택")} disabled={isApproved} onChange={(v) => onUpdate(index, "endAHousing", v)} />
              </td>
              <td className="p-1 min-w-[150px]">
                <ItemRefSelect value={row.endATerminal ?? ""} options={terminalOptions} placeholder={t("production.specSetup.selectTerminal", "터미널 선택")} disabled={isApproved} onChange={(v) => onUpdate(index, "endATerminal", v)} />
              </td>
              <td className="p-1 min-w-[168px]">
                <ConnectionSymbolControl
                  value={row.connectionSymbol ?? "STRAIGHT"}
                  onChange={(v) => onUpdate(index, "connectionSymbol", v)}
                  disabled={isApproved}
                />
              </td>
              <td className="p-1 min-w-[150px]">
                <ItemRefSelect value={row.endBTerminal ?? ""} options={terminalOptions} placeholder={t("production.specSetup.selectTerminal", "터미널 선택")} disabled={isApproved} onChange={(v) => onUpdate(index, "endBTerminal", v)} />
              </td>
              <td className="p-1 min-w-[150px]">
                <ItemRefSelect value={row.endBHousing ?? ""} options={housingOptions} placeholder={t("production.specSetup.selectHousing", "하우징/커넥터 선택")} disabled={isApproved} onChange={(v) => onUpdate(index, "endBHousing", v)} />
              </td>
              <td className="p-1"><GridInput value={row.tubeSpec ?? ""} onChange={(v) => onUpdate(index, "tubeSpec", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput value={row.subNo ?? ""} onChange={(v) => onUpdate(index, "subNo", v)} disabled={isApproved} /></td>
              <td className="p-1"><GridInput value={row.remark ?? ""} onChange={(v) => onUpdate(index, "remark", v)} disabled={isApproved} /></td>
              <td className="p-1 text-center">
                <button type="button" className="p-1 rounded hover:bg-red-100 text-red-500 disabled:opacity-40" disabled={isApproved || circuits.length === 1} onClick={() => onRemove(index)} title={t("production.specSetup.removeCircuit", "회로 삭제")}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConnectionSymbolControl({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const symbol = normalizeConnectionSymbol(value);

  return (
    <div data-connection-symbol={symbol} className="flex items-center gap-1">
      <div className="h-8 w-[84px] shrink-0 rounded border border-border bg-white px-1 shadow-inner">
        <svg viewBox="0 0 104 30" className="h-full w-full" role="img" aria-label={t("production.specSetup.connectionTypeAria", "연결 형태 {{symbol}}", { symbol })}>
          {/* 메인 라인 */}
          {symbol === "ONE_SIDE" ? (
            <>
              <line x1="4" y1="15" x2="55" y2="15" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
              <line x1="55" y1="15" x2="55" y2="25" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
            </>
          ) : (
            <line x1="4" y1="15" x2="100" y2="15" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
          )}
          {(symbol === "BRIDGE") && (
            <>
              <polyline points="20,15 52,4 84,15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
              <polyline points="20,15 52,26 84,15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
            </>
          )}
          {(symbol === "SPLICE") && (
            <>
              {/* 중간 결선(스플라이스) 가지 + 분기점 */}
              <line x1="52" y1="15" x2="52" y2="3" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
              <circle cx="52" cy="3" r="2.5" className="fill-slate-900" />
              <circle cx="52" cy="15" r="4" className="fill-slate-900" />
            </>
          )}
          {/* 끝점 / 단자 */}
          {symbol === "BOTH_CRIMP" ? (
            <>
              {/* 양단 압착 단자 */}
              <rect x="1" y="8" width="11" height="14" rx="1.5" className="fill-slate-900" />
              <rect x="92" y="8" width="11" height="14" rx="1.5" className="fill-slate-900" />
            </>
          ) : (
            <>
              <circle cx="4" cy="15" r="2.5" className="fill-slate-900" />
              {(symbol !== "ONE_SIDE") && <circle cx="100" cy="15" r="2.5" className="fill-slate-900" />}
            </>
          )}
        </svg>
      </div>
      <select
        value={symbol}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 min-w-[60px] flex-1 rounded border border-border bg-surface px-1 text-[11px] text-text outline-none focus:border-primary disabled:cursor-not-allowed disabled:text-text-muted"
        title={t("production.specSetup.connectionType", "연결 형태")}
      >
        {connectionSymbolOptions.map((option) => (
          <option key={option.value} value={option.value}>{t(`production.specSetup.symbol.${option.value}`, option.label)}</option>
        ))}
      </select>
    </div>
  );
}

function GridInput({
  value,
  onChange,
  disabled,
  type = "text",
}: {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "number";
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full min-w-[72px] rounded border border-transparent bg-transparent px-2 font-mono text-xs text-text outline-none focus:border-primary focus:bg-surface disabled:cursor-not-allowed disabled:text-text-muted"
    />
  );
}
