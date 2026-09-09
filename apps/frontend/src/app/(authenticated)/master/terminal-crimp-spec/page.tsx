"use client";

/**
 * @file src/app/(authenticated)/master/terminal-crimp-spec/page.tsx
 * @description 단자별 압착 규격 마스터 페이지 — 레이아웃·상태 배선만 담당
 *
 * 초보자 가이드:
 * 1. 좌: DataGrid(서버 페이징, 단자종류/사용여부/검색 필터) — 컬럼은 terminalCrimpSpecColumns.tsx
 * 2. 우: TerminalCrimpSpecFormPanel — 행 클릭 시 key 재마운트 없이 form 데이터만 교체, useUnsavedGuard로 작성중 유실 방어
 * 3. API: GET/POST /master/terminal-crimp-specs, PUT/DELETE /master/terminal-crimp-specs/:specId
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Search, Zap } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { createTerminalCrimpSpecGridColumns, type TerminalCrimpSpecRow } from "./terminalCrimpSpecColumns";
import TerminalCrimpSpecFormPanel, {
  emptyTerminalCrimpSpecForm,
  validateTerminalCrimpSpecForm,
  type TerminalCrimpSpecForm,
} from "./TerminalCrimpSpecFormPanel";

const PAGE_SIZE = 100;

const toNumberOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function TerminalCrimpSpecPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<TerminalCrimpSpecRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [terminalTypeFilter, setTerminalTypeFilter] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("Y");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<TerminalCrimpSpecRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<TerminalCrimpSpecRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TerminalCrimpSpecRow | null>(null);
  const [form, setForm] = useState<TerminalCrimpSpecForm>(() => emptyTerminalCrimpSpecForm());
  const initialFormRef = useRef<TerminalCrimpSpecForm>(emptyTerminalCrimpSpecForm());
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText.trim()) params.search = searchText.trim();
      if (terminalTypeFilter) params.terminalType = terminalTypeFilter;
      if (useYnFilter) params.useYn = useYnFilter;
      const res = await api.get("/master/terminal-crimp-specs", { params });
      setRows(res.data?.data ?? []);
      setTotal(Number(res.data?.total ?? res.data?.meta?.total ?? 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, terminalTypeFilter, useYnFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [searchText, terminalTypeFilter, useYnFilter]);

  const setField = useCallback((key: keyof TerminalCrimpSpecForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const openCreate = () => {
    setEditing(null);
    const blank = emptyTerminalCrimpSpecForm();
    setForm(blank);
    initialFormRef.current = blank;
    setPanelOpen(true);
  };

  const openEdit = (row: TerminalCrimpSpecRow) => {
    setEditing(row);
    setSelectedRow(row);
    const s = (v: number | null) => (v == null ? "" : String(v));
    const next: TerminalCrimpSpecForm = {
      terminalItemCode: row.terminalItemCode,
      terminalType: row.terminalType ?? "",
      wireSize: row.wireSize,
      wireItemCode: row.wireItemCode ?? "",
      crimpHeightLsl: s(row.crimpHeightLsl),
      crimpHeightUsl: s(row.crimpHeightUsl),
      crimpWidthLsl: s(row.crimpWidthLsl),
      crimpWidthUsl: s(row.crimpWidthUsl),
      insCrimpHeightLsl: s(row.insCrimpHeightLsl),
      insCrimpHeightUsl: s(row.insCrimpHeightUsl),
      pullForceMin: s(row.pullForceMin),
      stripLengthMin: s(row.stripLengthMin),
      stripLengthMax: s(row.stripLengthMax),
      applicatorCode: row.applicatorCode ?? "",
      remark: row.remark ?? "",
      useYn: row.useYn || "Y",
    };
    setForm(next);
    initialFormRef.current = next;
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
  };

  // 작성 중(저장 안 됨) 여부를 가드에 보고 — 행 전환/닫기 시 유실 방어
  const dirty = useMemo(
    () => panelOpen && JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [panelOpen, form],
  );
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleSave = async () => {
    if (!validateTerminalCrimpSpecForm(form)) return;
    setSaving(true);
    const payload = {
      terminalItemCode: form.terminalItemCode.trim(),
      terminalType: form.terminalType || null,
      wireSize: form.wireSize.trim(),
      wireItemCode: form.wireItemCode || null,
      crimpHeightLsl: toNumberOrNull(form.crimpHeightLsl),
      crimpHeightUsl: toNumberOrNull(form.crimpHeightUsl),
      crimpWidthLsl: toNumberOrNull(form.crimpWidthLsl),
      crimpWidthUsl: toNumberOrNull(form.crimpWidthUsl),
      insCrimpHeightLsl: toNumberOrNull(form.insCrimpHeightLsl),
      insCrimpHeightUsl: toNumberOrNull(form.insCrimpHeightUsl),
      pullForceMin: toNumberOrNull(form.pullForceMin),
      stripLengthMin: toNumberOrNull(form.stripLengthMin),
      stripLengthMax: toNumberOrNull(form.stripLengthMax),
      applicatorCode: form.applicatorCode.trim() || null,
      remark: form.remark.trim() || null,
      useYn: form.useYn,
    };
    try {
      if (editing) {
        await api.put(`/master/terminal-crimp-specs/${editing.specId}`, payload);
      } else {
        await api.post("/master/terminal-crimp-specs", payload);
      }
      await fetchData();
      closePanel();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/terminal-crimp-specs/${deleteTarget.specId}`);
      if (editing?.specId === deleteTarget.specId) closePanel();
      await fetchData();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(() => createTerminalCrimpSpecGridColumns({
    t,
    onEditSpec: (row) => guard(() => openEdit(row)),
    onDeleteSpec: setDeleteTarget,
  }), [t, guard]);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Zap className="w-7 h-7 text-primary" />
              {t("master.terminalCrimpSpec.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.terminalCrimpSpec.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => guard(openCreate)}>
              <Plus className="w-4 h-4 mr-1" />{t("common.add")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={rows} columns={columns} isLoading={loading} pageSize={PAGE_SIZE}
              enableColumnFilter enableExport
              exportFileName={t("master.terminalCrimpSpec.title")}
              getRowId={(row) => String((row as TerminalCrimpSpecRow).specId)}
              selectedRowId={selectedRow ? String(selectedRow.specId) : undefined}
              onRowClick={(row) => {
                const spec = row as TerminalCrimpSpecRow;
                if (panelOpen) guard(() => openEdit(spec));
                else setSelectedRow(spec);
              }}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="w-64">
                    <Input placeholder={t("master.terminalCrimpSpec.searchPlaceholder")} value={searchText}
                      onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <ComCodeSelect groupCode="TERMINAL_TYPE" value={terminalTypeFilter} onChange={setTerminalTypeFilter}
                    labelPrefix={t("master.terminalCrimpSpec.terminalType")} />
                  <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} />
                  <ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={loading} className="flex-shrink-0 ml-auto" />
                </div>
              }
              sqlQuery={`SELECT *\nFROM TERMINAL_CRIMP_SPECS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY TERMINAL_ITEM_CODE, WIRE_SIZE`} />
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <TerminalCrimpSpecFormPanel
          t={t}
          editing={!!editing}
          saving={saving}
          form={form}
          onChange={setField}
          onSave={handleSave}
          onCancel={() => guard(closePanel)}
        />
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        variant="danger" title={t("common.delete")}
        message={`${deleteTarget?.terminalItemCode ?? ""} / ${deleteTarget?.wireSize ?? ""}${t("common.deleteConfirm")}`} />
    </div>
  );
}
