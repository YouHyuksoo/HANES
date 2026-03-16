"use client";

/**
 * @file src/app/(authenticated)/master/routing/components/RoutingTreePanel.tsx
 * @description 라우팅 좌측 트리 패널 - 품목 검색 → BOM 구조 + 라우팅 그룹 공정 트리뷰
 *
 * 초보자 가이드:
 * 1. 좌측 품목(제품/반제품) 목록에서 품목 선택
 * 2. 선택된 품목의 BOM 하위 반제품 + 각 품목의 라우팅(공정순서) 트리 표시
 * 3. 배지: F(완제품/보라), S(반제품/노랑), P(공정/회색)
 * 4. 공정(P) 클릭 → 우측 양품조건 표시
 * 5. 공정추가/삭제 → 라우팅 그룹 API 사용
 */
import { useState, useCallback, useEffect, useMemo, Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, ChevronRight, ChevronDown, Plus, Trash2, RefreshCw, Route,
} from "lucide-react";
import { Input, Button, ConfirmModal, Modal } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import type { SelectedProcess } from "../types";

/** 품목 아이템 */
interface PartItem {
  itemCode: string;
  itemName: string;
  itemNo?: string;
  itemType: string;
}

/** 공정 아이템 */
interface ProcessItem {
  routingCode: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: string | null;
}

/** 트리 노드 (품목 + 공정) */
interface TreeNode {
  itemCode: string;
  itemName: string;
  itemNo: string | null;
  itemType: string;
  routingCode: string | null;
  processes: ProcessItem[];
  children: TreeNode[];
}

/** 배지 스타일 */
const badgeConfig: Record<string, { label: string; bg: string; text: string }> = {
  FINISHED: { label: "F", bg: "bg-purple-600 dark:bg-purple-500", text: "text-white" },
  SEMI_PRODUCT: { label: "S", bg: "bg-amber-500 dark:bg-amber-400", text: "text-white dark:text-gray-900" },
  PROCESS: { label: "P", bg: "bg-gray-400 dark:bg-gray-500", text: "text-white" },
};

interface RoutingTreePanelProps {
  selectedProcess: SelectedProcess | null;
  onSelectProcess: (process: SelectedProcess | null) => void;
}

export default function RoutingTreePanel({ selectedProcess, onSelectProcess }: RoutingTreePanelProps) {
  const { t } = useTranslation();

  /* 품목 목록 */
  const [parts, setParts] = useState<PartItem[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  /* 트리 */
  const [selectedPart, setSelectedPart] = useState<PartItem | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedNodeKey, setSelectedNodeKey] = useState("");

  /* 공정 추가 모달 */
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processModalRoutingCode, setProcessModalRoutingCode] = useState("");
  const [processModalItemCode, setProcessModalItemCode] = useState("");
  const [processForm, setProcessForm] = useState({ seq: "10", processCode: "", processName: "", processType: "", equipType: "", stdTime: "", setupTime: "" });
  const [processSaving, setProcessSaving] = useState(false);
  const [processOptions, setProcessOptions] = useState<{ processCode: string; processName: string }[]>([]);
  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");
  const equipTypeOptions = useComCodeOptions("EQUIP_TYPE");

  /* 공정 삭제 */
  const [deletingProcess, setDeletingProcess] = useState<{ routingCode: string; seq: number; processName: string } | null>(null);

  /** 품목 목록 조회 (제품+반제품) */
  const fetchParts = useCallback(async () => {
    setPartsLoading(true);
    try {
      const res = await api.get("/master/parts", { params: { limit: 5000 } });
      const all: PartItem[] = res.data?.data ?? [];
      setParts(all.filter((p) => p.itemType === "FINISHED" || p.itemType === "SEMI_PRODUCT"));
    } catch { setParts([]); }
    finally { setPartsLoading(false); }
  }, []);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  const filteredParts = useMemo(() => {
    let result = parts;
    if (typeFilter) result = result.filter((p) => p.itemType === typeFilter);
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter((p) =>
        p.itemCode.toLowerCase().includes(q) || p.itemName.toLowerCase().includes(q) || (p.itemNo && p.itemNo.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [parts, typeFilter, searchText]);

  /** 트리 데이터 구성: BOM 계층 + 각 품목의 라우팅 */
  const fetchTree = useCallback(async (part: PartItem) => {
    setTreeLoading(true);
    try {
      // BOM 계층 조회 (원재료 제외)
      let bomChildren: TreeNode[] = [];
      try {
        const bomRes = await api.get(`/master/boms/hierarchy/${part.itemCode}`, { params: { depth: 5 } });
        if (bomRes.data?.success) {
          const flatItems = bomRes.data.data || [];
          // BOM 트리에서 반제품만 추출 (1레벨)
          bomChildren = await Promise.all(
            flatItems
              .filter((item: any) => item.itemType === "SEMI_PRODUCT")
              .map(async (item: any) => {
                let childProcesses: ProcessItem[] = [];
                let childRoutingCode: string | null = null;
                try {
                  const rRes = await api.get(`/master/routing-groups/by-item/${item.childItemCode || item.itemCode}`);
                  if (rRes.data?.data) {
                    childRoutingCode = rRes.data.data.routingCode;
                    childProcesses = (rRes.data.data.processes || []).map((p: any) => ({ ...p, routingCode: rRes.data.data.routingCode }));
                  }
                } catch { /* 라우팅 없을 수 있음 */ }
                return {
                  itemCode: item.childItemCode || item.itemCode,
                  itemName: item.itemName,
                  itemNo: item.itemNo,
                  itemType: item.itemType,
                  routingCode: childRoutingCode,
                  processes: childProcesses,
                  children: [],
                } as TreeNode;
              }),
          );
        }
      } catch { /* BOM 없을 수 있음 */ }

      // 루트 품목의 라우팅 조회
      let rootProcesses: ProcessItem[] = [];
      let rootRoutingCode: string | null = null;
      try {
        const rRes = await api.get(`/master/routing-groups/by-item/${part.itemCode}`);
        if (rRes.data?.data) {
          rootRoutingCode = rRes.data.data.routingCode;
          rootProcesses = (rRes.data.data.processes || []).map((p: any) => ({ ...p, routingCode: rRes.data.data.routingCode }));
        }
      } catch { /* 라우팅 없을 수 있음 */ }

      const tree: TreeNode = {
        itemCode: part.itemCode,
        itemName: part.itemName,
        itemNo: part.itemNo || null,
        itemType: part.itemType,
        routingCode: rootRoutingCode,
        processes: rootProcesses,
        children: bomChildren,
      };

      setTreeData(tree);
      setExpanded(new Set([part.itemCode]));
      onSelectProcess(null);
      setSelectedNodeKey("");
    } catch {
      setTreeData(null);
    } finally {
      setTreeLoading(false);
    }
  }, [onSelectProcess]);

  /** 품목 선택 → 트리 조회 */
  const handleSelectPart = useCallback((part: PartItem) => {
    setSelectedPart(part);
    fetchTree(part);
  }, [fetchTree]);

  /** 트리 노드 토글 */
  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);

  /** 공정 클릭 → 우측 양품조건 */
  const handleProcessClick = useCallback((node: TreeNode, proc: ProcessItem) => {
    const key = `${proc.routingCode}::${proc.seq}`;
    setSelectedNodeKey(key);
    onSelectProcess({
      routingCode: proc.routingCode,
      routingName: node.itemName,
      seq: proc.seq,
      processCode: proc.processCode,
      processName: proc.processName,
    });
  }, [onSelectProcess]);

  /** 공정마스터 조회 */
  const fetchProcessMasters = useCallback(async () => {
    try {
      const res = await api.get("/master/processes", { params: { limit: 5000, useYn: "Y" } });
      setProcessOptions((res.data?.data ?? []).map((p: any) => ({ processCode: p.processCode, processName: p.processName })));
    } catch { setProcessOptions([]); }
  }, []);

  /** 라우팅 그룹 자동 생성 */
  const ensureRoutingGroup = useCallback(async (itemCode: string, itemName: string): Promise<string | null> => {
    try {
      const res = await api.get(`/master/routing-groups/by-item/${itemCode}`);
      if (res.data?.data) return res.data.data.routingCode;
    } catch { /* */ }
    const code = `RT-${itemCode}`;
    try {
      await api.post("/master/routing-groups", { routingCode: code, routingName: `${itemName} 라우팅`, itemCode });
      return code;
    } catch { return null; }
  }, []);

  /** 공정 추가 */
  const handleAddProcess = useCallback(async () => {
    if (!treeData) return;
    fetchProcessMasters();
    let targetItemCode = treeData.itemCode;
    let targetItemName = treeData.itemName;
    if (selectedNodeKey && !selectedNodeKey.includes("::")) {
      // 품목 노드 선택됨
      const findNode = (node: TreeNode): TreeNode | null => {
        if (node.itemCode === selectedNodeKey) return node;
        for (const c of node.children) { const r = findNode(c); if (r) return r; }
        return null;
      };
      const found = findNode(treeData);
      if (found) { targetItemCode = found.itemCode; targetItemName = found.itemName; }
    } else if (selectedNodeKey.includes("::")) {
      const rc = selectedNodeKey.split("::")[0];
      // routingCode에서 품목 찾기
      const findByRouting = (node: TreeNode): TreeNode | null => {
        if (node.routingCode === rc) return node;
        for (const c of node.children) { const r = findByRouting(c); if (r) return r; }
        return null;
      };
      const found = findByRouting(treeData);
      if (found) { targetItemCode = found.itemCode; targetItemName = found.itemName; }
    }

    // 현재 공정 목록에서 최대 seq 계산
    const findProcesses = (node: TreeNode): ProcessItem[] => {
      if (node.itemCode === targetItemCode) return node.processes;
      for (const c of node.children) { const r = findProcesses(c); if (r.length) return r; }
      return [];
    };
    const currentProcs = findProcesses(treeData);
    const maxSeq = currentProcs.length > 0 ? Math.max(...currentProcs.map((p) => p.seq)) : 0;

    setProcessModalItemCode(targetItemCode);
    setProcessForm({ seq: String(maxSeq + 10), processCode: "", processName: "", processType: "", equipType: "", stdTime: "", setupTime: "" });
    // 라우팅 그룹 확보
    const rc = await ensureRoutingGroup(targetItemCode, targetItemName);
    if (rc) setProcessModalRoutingCode(rc);
    setIsProcessModalOpen(true);
  }, [treeData, selectedNodeKey, fetchProcessMasters, ensureRoutingGroup]);

  const handleProcessCodeSelect = useCallback((code: string) => {
    const found = processOptions.find((p) => p.processCode === code);
    setProcessForm((prev) => ({ ...prev, processCode: code, processName: found?.processName || prev.processName }));
  }, [processOptions]);

  const saveProcess = useCallback(async () => {
    if (!processModalRoutingCode || !processForm.processCode) return;
    setProcessSaving(true);
    try {
      await api.post(`/master/routing-groups/${processModalRoutingCode}/processes`, {
        routingCode: processModalRoutingCode,
        seq: Number(processForm.seq),
        processCode: processForm.processCode,
        processName: processForm.processName,
        processType: processForm.processType || undefined,
        equipType: processForm.equipType || undefined,
        stdTime: processForm.stdTime ? Number(processForm.stdTime) : undefined,
        setupTime: processForm.setupTime ? Number(processForm.setupTime) : undefined,
        useYn: "Y",
      });
      setIsProcessModalOpen(false);
      if (selectedPart) fetchTree(selectedPart);
    } catch { /* */ }
    finally { setProcessSaving(false); }
  }, [processModalRoutingCode, processForm, selectedPart, fetchTree]);

  /** 공정 삭제 */
  const handleDeleteProcess = useCallback(() => {
    if (!selectedNodeKey.includes("::")) return;
    const [routingCode, seqStr] = selectedNodeKey.split("::");
    const seq = parseInt(seqStr, 10);
    let processName = "";
    const find = (node: TreeNode) => {
      const proc = node.processes.find((p) => p.routingCode === routingCode && p.seq === seq);
      if (proc) processName = proc.processName;
      node.children.forEach(find);
    };
    if (treeData) find(treeData);
    setDeletingProcess({ routingCode, seq, processName });
  }, [selectedNodeKey, treeData]);

  const confirmDelete = useCallback(async () => {
    if (!deletingProcess) return;
    try {
      await api.delete(`/master/routing-groups/${deletingProcess.routingCode}/processes/${deletingProcess.seq}`);
      setDeletingProcess(null);
      onSelectProcess(null);
      setSelectedNodeKey("");
      if (selectedPart) fetchTree(selectedPart);
    } catch { /* */ }
  }, [deletingProcess, selectedPart, fetchTree, onSelectProcess]);

  /** 재귀 트리 렌더링 */
  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(node.itemCode);
    const hasChildren = node.processes.length > 0 || node.children.length > 0;
    const badge = badgeConfig[node.itemType] || badgeConfig.FINISHED;
    const isItemSelected = selectedNodeKey === node.itemCode;

    return (
      <Fragment key={node.itemCode}>
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded transition-colors text-xs
            ${isItemSelected ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-surface-hover dark:hover:bg-gray-700"}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => { setSelectedNodeKey(node.itemCode); if (hasChildren) toggleExpand(node.itemCode); }}
        >
          {hasChildren ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />) : <span className="w-3.5 shrink-0" />}
          <span className={`${badge.bg} ${badge.text} w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0`}>{badge.label}</span>
          <span className="font-medium text-text dark:text-gray-200 truncate">{node.itemName || node.itemCode}</span>
          <span className="text-text-muted dark:text-gray-400 text-[10px] shrink-0">[{node.itemNo || node.itemCode}]</span>
        </div>
        {isExpanded && (
          <>
            {node.processes.map((proc) => {
              const procKey = `${proc.routingCode}::${proc.seq}`;
              const isSelected = selectedNodeKey === procKey;
              return (
                <div key={procKey}
                  className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded transition-colors text-xs
                    ${isSelected ? "bg-primary text-white dark:bg-primary" : "hover:bg-surface-hover dark:hover:bg-gray-700"}`}
                  style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
                  onClick={() => handleProcessClick(node, proc)}
                >
                  <span className="w-3.5 shrink-0" />
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isSelected ? "bg-white/20 text-white" : `${badgeConfig.PROCESS.bg} ${badgeConfig.PROCESS.text}`}`}>P</span>
                  <span className={`font-medium ${isSelected ? "text-white" : "text-text dark:text-gray-200"}`}>{proc.seq}</span>
                  <span className={`truncate ${isSelected ? "text-white/90" : "text-text dark:text-gray-300"}`}>{proc.processName}</span>
                  <span className={`text-[10px] shrink-0 ${isSelected ? "text-white/70" : "text-text-muted dark:text-gray-400"}`}>[{proc.processCode}]</span>
                </div>
              );
            })}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </>
        )}
      </Fragment>
    );
  };

  const selectCls = "w-full px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* 품목 검색 + 유형 필터 */}
      <div className="shrink-0 space-y-2 mb-2">
        <Input placeholder={t("master.routing.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setTypeFilter("")} className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${!typeFilter ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:border-primary/50"}`}>{t("common.all")}</button>
          {[{ value: "FINISHED", label: t("master.routing.finished") }, { value: "SEMI_PRODUCT", label: t("master.routing.semiProduct") }].map((opt) => (
            <button key={opt.value} onClick={() => setTypeFilter(opt.value)} className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${typeFilter === opt.value ? "bg-primary text-white border-primary" : "bg-surface text-text-muted border-border hover:border-primary/50"}`}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* 트리가 없을 때: 품목 목록 / 있을 때: 트리 */}
      {!treeData ? (
        <div className="flex-1 overflow-y-auto min-h-0 border border-border dark:border-gray-600 rounded-lg">
          {partsLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
          ) : filteredParts.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted dark:text-gray-400">{t("common.noData")}</div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-surface dark:bg-gray-800">
                  <tr className="border-b border-border dark:border-gray-600 text-text-muted dark:text-gray-400">
                    <th className="text-center py-1.5 px-1 font-medium w-10"></th>
                    <th className="text-left py-1.5 px-2 font-medium">{t("master.part.partNo")}</th>
                    <th className="text-left py-1.5 px-2 font-medium">{t("master.part.partName")}</th>
                    <th className="text-center py-1.5 px-1 font-medium w-10">{t("master.part.partType")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map((part) => (
                    <tr key={part.itemCode}
                      className="border-b border-border/50 dark:border-gray-700 hover:bg-surface-hover dark:hover:bg-gray-700 text-text dark:text-gray-200">
                      <td className="py-1.5 px-1 text-center">
                        <button onClick={() => handleSelectPart(part)} className="p-1 hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors" title={t("master.routing.viewRouting")}>
                          <Route className="w-3.5 h-3.5 text-primary" />
                        </button>
                      </td>
                      <td className="py-1.5 px-2 font-medium whitespace-nowrap">{part.itemNo || part.itemCode}</td>
                      <td className="py-1.5 px-2 truncate max-w-[120px] text-text-muted dark:text-gray-400">{part.itemName}</td>
                      <td className="py-1.5 px-1 text-center">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${part.itemType === "FINISHED" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          {part.itemType === "FINISHED" ? "F" : "S"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="py-2 text-center text-[11px] text-text-muted dark:text-gray-500">
                {t("master.routing.viewRoutingHint")}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 선택된 품목 정보 + 뒤로가기 */}
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <button onClick={() => { setTreeData(null); setSelectedPart(null); onSelectProcess(null); setSelectedNodeKey(""); }}
              className="px-2 py-0.5 text-[11px] rounded border border-border dark:border-gray-600 text-text-muted hover:text-primary hover:border-primary transition-colors">
              ← {t("common.list")}
            </button>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${badgeConfig[treeData.itemType]?.bg} ${badgeConfig[treeData.itemType]?.text}`}>
              {treeData.itemType === "FINISHED" ? t("master.routing.finished") : t("master.routing.semiProduct")}
            </span>
            <span className="text-xs text-text dark:text-gray-200 font-medium truncate">{treeData.itemName}</span>
          </div>

          {/* 공정삭제/공정추가 */}
          <div className="flex gap-2 mb-2 shrink-0">
            <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={handleDeleteProcess} disabled={!selectedNodeKey.includes("::")}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />{t("master.routing.deleteProcess")}
            </Button>
            <Button size="sm" className="flex-1 text-xs" onClick={handleAddProcess}>
              <Plus className="w-3.5 h-3.5 mr-1" />{t("master.routing.addProcess")}
            </Button>
          </div>

          {/* 트리 */}
          <div className="flex-1 overflow-y-auto min-h-0 border border-border dark:border-gray-600 rounded-lg">
            {treeLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-primary animate-spin" /></div>
            ) : (
              <div className="p-1">{renderNode(treeData)}</div>
            )}
          </div>
        </>
      )}

      {/* 공정 추가 모달 */}
      <Modal isOpen={isProcessModalOpen} onClose={() => setIsProcessModalOpen(false)} title={t("master.routing.addProcess")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={t("master.routing.seq")} type="number" step="10" value={processForm.seq} onChange={(e) => setProcessForm((f) => ({ ...f, seq: e.target.value }))} fullWidth />
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.routing.processCode")}</label>
              <select value={processForm.processCode} onChange={(e) => handleProcessCodeSelect(e.target.value)} className={selectCls}>
                <option value="">-- {t("common.select")} --</option>
                {processOptions.map((p) => <option key={p.processCode} value={p.processCode}>[{p.processCode}] {p.processName}</option>)}
              </select>
            </div>
            <Input label={t("master.routing.processName")} value={processForm.processName} onChange={(e) => setProcessForm((f) => ({ ...f, processName: e.target.value }))} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.routing.processType")}</label>
              <select value={processForm.processType} onChange={(e) => setProcessForm((f) => ({ ...f, processType: e.target.value }))} className={selectCls}>
                <option value="">-- {t("common.select")} --</option>
                {processTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-gray-300 mb-1">{t("master.routing.equipType")}</label>
              <select value={processForm.equipType} onChange={(e) => setProcessForm((f) => ({ ...f, equipType: e.target.value }))} className={selectCls}>
                <option value="">-- {t("common.select")} --</option>
                {equipTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("master.routing.stdTimeSec")} type="number" step="0.1" value={processForm.stdTime} onChange={(e) => setProcessForm((f) => ({ ...f, stdTime: e.target.value }))} fullWidth />
            <Input label={t("master.routing.setupTimeSec")} type="number" step="0.1" value={processForm.setupTime} onChange={(e) => setProcessForm((f) => ({ ...f, setupTime: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsProcessModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={saveProcess} disabled={processSaving || !processForm.processCode || !processForm.processName}>
            {processSaving ? t("common.loading") : t("common.add")}
          </Button>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmModal isOpen={!!deletingProcess} onClose={() => setDeletingProcess(null)} onConfirm={confirmDelete}
        title={t("common.delete")} message={`${deletingProcess?.processName} ${t("master.routing.deleteConfirm")}`} variant="danger" />
    </div>
  );
}
