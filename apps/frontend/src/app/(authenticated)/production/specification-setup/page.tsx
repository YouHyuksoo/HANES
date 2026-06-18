"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { CheckCircle2, CopyPlus, FileSpreadsheet, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/data-grid/DataGrid";
import { Button, Card, CardContent, Input, Modal, Select } from "@/components/ui";
import api from "@/services/api";

type RevisionStatus = "DRAFT" | "APPROVED" | "OBSOLETE";

interface HarnessCircuitSpec {
  circuitId?: number;
  circuitNo: string;
  wireSpec?: string;
  wireSize?: string;
  colorCode?: string;
  colorName?: string;
  lengthMm?: number | "";
  stripA?: number | "";
  stripB?: number | "";
  endAHousing?: string;
  endATerminal?: string;
  connectionSymbol?: string;
  endBTerminal?: string;
  endBHousing?: string;
  tubeSpec?: string;
  subNo?: string;
  remark?: string;
}

interface HarnessDrawingRevision {
  revisionId: number;
  drawingId: number;
  revisionCode: string;
  status: RevisionStatus;
  changeReason?: string | null;
  circuits?: HarnessCircuitSpec[];
}

interface HarnessDrawing {
  drawingId: number;
  drawingNo: string;
  itemCode: string;
  itemName?: string | null;
  erpItemNo?: string | null;
  customerPartNo?: string | null;
  remark?: string | null;
  revisions?: HarnessDrawingRevision[];
  revision?: HarnessDrawingRevision;
}

const emptyCircuit = (index: number): HarnessCircuitSpec => ({
  circuitNo: String(index + 1),
  wireSpec: "",
  wireSize: "",
  colorCode: "",
  colorName: "",
  lengthMm: "",
  stripA: "",
  stripB: "",
  endAHousing: "",
  endATerminal: "",
  connectionSymbol: "LINE",
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
  { value: "BRIDGE", label: "분기" },
  { value: "ONE_SIDE", label: "단측" },
  { value: "LINE", label: "라인" },
];

const normalizeConnectionSymbol = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "STRAIGHT" || normalized === "BRIDGE" || normalized === "ONE_SIDE" || normalized === "LINE") {
    return normalized;
  }
  return "LINE";
};

const toCircuitPayload = (circuit: HarnessCircuitSpec) => ({
  circuitNo: circuit.circuitNo.trim(),
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
  const [reviseReason, setReviseReason] = useState("");
  const [revising, setRevising] = useState(false);
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

  const columns = useMemo<ColumnDef<HarnessDrawing>[]>(() => [
    { accessorKey: "drawingNo", header: "도면번호", size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "erpItemNo", header: "ERP 품번", size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
  ], [t]);

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

  const buildCircuitsPayload = () => circuits
    .filter((circuit) => circuit.circuitNo.trim())
    .map(toCircuitPayload);

  const saveDrawing = async () => {
    if (!headerForm.drawingNo.trim() || !headerForm.itemCode.trim()) {
      toast.error("도면번호와 품목코드는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      if (selected?.drawingId && selectedRevisionId) {
        await api.put(`/production/specifications/${selected.drawingId}`, headerForm);
        await api.put(`/production/specifications/revisions/${selectedRevisionId}`, { circuits: buildCircuitsPayload() });
        toast.success("제품 도면을 저장했습니다.");
        await loadDetail(selected.drawingId, selectedRevisionId);
      } else {
        const res = await api.post("/production/specifications", { ...headerForm, circuits: buildCircuitsPayload() });
        toast.success("제품 도면을 생성했습니다.");
        await fetchDrawings();
        const newId = res.data?.data?.drawingId;
        if (newId) await loadDetail(Number(newId));
      }
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const approveRevision = async () => {
    if (!selectedRevisionId || !selected?.drawingId) return;
    await api.post(`/production/specifications/revisions/${selectedRevisionId}/approve`);
    toast.success("Revision을 승인했습니다.");
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
      toast.success("새 Revision을 생성했습니다.");
      setReviseModalOpen(false);
      await loadDetail(selected.drawingId, newRevisionId);
    } finally {
      setRevising(false);
    }
  };

  const deleteDrawing = async () => {
    if (!selected?.drawingId) return;
    if (!window.confirm("선택한 제품 도면을 삭제하시겠습니까?")) return;
    await api.delete(`/production/specifications/${selected.drawingId}`);
    toast.success("제품 도면을 삭제했습니다.");
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
              exportFileName="제품 도면관리"
              onRowClick={(row) => loadDetail(row.drawingId)}
              toolbarLeft={(
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="도면번호 / ERP 품번 / 품목 검색"
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
                  <h2 className="font-bold text-text">도면 Header</h2>
                  {selectedRevision && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      Rev {selectedRevision.revisionCode} / {selectedRevision.status}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDrawing} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>{t("common.save")}</Button>
                  <Button size="sm" variant="secondary" onClick={approveRevision} disabled={!selectedRevisionId || isApproved} leftIcon={<CheckCircle2 className="w-4 h-4" />}>승인</Button>
                  <Button size="sm" variant="secondary" onClick={openReviseModal} disabled={!selectedRevisionId} leftIcon={<CopyPlus className="w-4 h-4" />}>Rev 생성</Button>
                  <Button size="sm" variant="danger" onClick={deleteDrawing} disabled={!selected?.drawingId} leftIcon={<Trash2 className="w-4 h-4" />}>{t("common.delete")}</Button>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-3">
                <Input label="도면번호" value={headerForm.drawingNo} onChange={(e) => setHeaderForm((prev) => ({ ...prev, drawingNo: e.target.value }))} fullWidth />
                <Input label="ERP 품번" value={headerForm.erpItemNo} onChange={(e) => setHeaderForm((prev) => ({ ...prev, erpItemNo: e.target.value }))} fullWidth />
                <Input label={t("common.partCode")} value={headerForm.itemCode} onChange={(e) => setHeaderForm((prev) => ({ ...prev, itemCode: e.target.value }))} fullWidth />
                <Input label={t("common.partName")} value={headerForm.itemName} onChange={(e) => setHeaderForm((prev) => ({ ...prev, itemName: e.target.value }))} fullWidth />
                <Input label="고객 품번" value={headerForm.customerPartNo} onChange={(e) => setHeaderForm((prev) => ({ ...prev, customerPartNo: e.target.value }))} fullWidth />
                <Input label="최초 Rev" value={headerForm.revisionCode} onChange={(e) => setHeaderForm((prev) => ({ ...prev, revisionCode: e.target.value }))} disabled={!!selected} fullWidth />
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
                <h2 className="font-bold text-text">회로별 제작 사양</h2>
                <Button size="sm" variant="secondary" onClick={() => setCircuits((prev) => [...prev, emptyCircuit(prev.length)])} disabled={isApproved} leftIcon={<Plus className="w-4 h-4" />}>
                  회로 추가
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto border border-border rounded">
                <table className="min-w-[1320px] w-full text-xs">
                  <thead className="sticky top-0 bg-surface border-b border-border z-10">
                    <tr className="text-text-muted">
                      {["Circuit", "Wire Spec", "Size", "Color", "Length", "Strip A", "Strip B", "A Housing", "A Terminal", "연결", "B Terminal", "B Housing", "Tube", "Sub", "비고", ""].map((header) => (
                        <th key={header} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {circuits.map((row, index) => (
                      <tr key={`${row.circuitId ?? "new"}-${index}`} className="border-b border-border/70 hover:bg-surface/60">
                        <td className="p-1"><GridInput value={row.circuitNo} onChange={(v) => updateCircuit(index, "circuitNo", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.wireSpec ?? ""} onChange={(v) => updateCircuit(index, "wireSpec", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.wireSize ?? ""} onChange={(v) => updateCircuit(index, "wireSize", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.colorCode ?? ""} onChange={(v) => updateCircuit(index, "colorCode", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput type="number" value={row.lengthMm ?? ""} onChange={(v) => updateCircuit(index, "lengthMm", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput type="number" value={row.stripA ?? ""} onChange={(v) => updateCircuit(index, "stripA", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput type="number" value={row.stripB ?? ""} onChange={(v) => updateCircuit(index, "stripB", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.endAHousing ?? ""} onChange={(v) => updateCircuit(index, "endAHousing", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.endATerminal ?? ""} onChange={(v) => updateCircuit(index, "endATerminal", v)} disabled={isApproved} /></td>
                        <td className="p-1 min-w-[118px]">
                          <ConnectionSymbolControl
                            value={row.connectionSymbol ?? "LINE"}
                            onChange={(v) => updateCircuit(index, "connectionSymbol", v)}
                            disabled={isApproved}
                          />
                        </td>
                        <td className="p-1"><GridInput value={row.endBTerminal ?? ""} onChange={(v) => updateCircuit(index, "endBTerminal", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.endBHousing ?? ""} onChange={(v) => updateCircuit(index, "endBHousing", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.tubeSpec ?? ""} onChange={(v) => updateCircuit(index, "tubeSpec", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.subNo ?? ""} onChange={(v) => updateCircuit(index, "subNo", v)} disabled={isApproved} /></td>
                        <td className="p-1"><GridInput value={row.remark ?? ""} onChange={(v) => updateCircuit(index, "remark", v)} disabled={isApproved} /></td>
                        <td className="p-1 text-center">
                          <button type="button" className="p-1 rounded hover:bg-red-100 text-red-500 disabled:opacity-40" disabled={isApproved || circuits.length === 1} onClick={() => setCircuits((prev) => prev.filter((_, rowIndex) => rowIndex !== index))} title="회로 삭제">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={reviseModalOpen}
        onClose={() => setReviseModalOpen(false)}
        title="Rev 생성"
        size="md"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setReviseModalOpen(false)} disabled={revising}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmReviseDrawing} isLoading={revising} leftIcon={<CopyPlus className="w-4 h-4" />}>
              Rev 생성
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            현재 Revision의 회로 사양을 복제해 새 DRAFT Revision을 생성합니다.
          </p>
          <Input
            label="변경 사유"
            value={reviseReason}
            onChange={(event) => setReviseReason(event.target.value)}
            placeholder="변경 사유를 입력하세요"
            fullWidth
          />
        </div>
      </Modal>
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
  const symbol = normalizeConnectionSymbol(value);

  return (
    <div data-connection-symbol={symbol} className="flex min-w-[108px] flex-col gap-1">
      <div className="h-8 rounded border border-border bg-white px-1 shadow-inner">
        <svg viewBox="0 0 104 30" className="h-full w-full" role="img" aria-label={`연결 형태 ${symbol}`}>
          <line x1="4" y1="15" x2="100" y2="15" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
          {(symbol === "BRIDGE") && (
            <>
              <polyline points="20,15 52,4 84,15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
              <polyline points="20,15 52,26 84,15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
            </>
          )}
          {(symbol === "ONE_SIDE") && (
            <>
              <line x1="4" y1="15" x2="55" y2="15" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
              <line x1="55" y1="15" x2="55" y2="25" stroke="currentColor" strokeWidth="2.5" className="text-slate-900" />
            </>
          )}
          <circle cx="4" cy="15" r="2.5" className="fill-slate-900" />
          {(symbol !== "ONE_SIDE") && <circle cx="100" cy="15" r="2.5" className="fill-slate-900" />}
        </svg>
      </div>
      <select
        value={symbol}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 rounded border border-border bg-surface px-1 text-[11px] text-text outline-none focus:border-primary disabled:cursor-not-allowed disabled:text-text-muted"
        title="연결 형태"
      >
        {connectionSymbolOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
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
