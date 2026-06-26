"use client";

/**
 * @file components/FgLabelPrintHost.tsx
 * @description 조립 FG(완제품) 라벨 자동 출력 호스트.
 *
 * 동작:
 * - 마운트 시 /master/label-templates?category=fg 의 기본 템플릿(없으면 기본 디자인)을 로드.
 * - printByFgBarcodes(rows): 조립(kit/confirmAssembly)에서 발행된 FG 바코드를 바코드+컨텍스트로 직접
 *   오프스크린 LabelPrintRenderer로 렌더 → PNG 변환 → HANES Print Agent(printAgentPng)로 모달 없이 출력.
 * - FG 데이터(FgLabel)는 조립 시 항상 발행되며, 인쇄 여부는 호출 측에서 백엔드 응답의 printFg(라우팅
 *   ISSUE_FG_LABEL_YN='Y')로 판정해 true일 때만 이 호스트를 호출한다(여기서는 라우팅을 보지 않음).
 * - FgLabel 엔티티에 resultNo가 없으므로 resultNo 역조회는 하지 않는다.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import { printLabelNodesViaAgent } from "@/services/label-print";
import { PrintAgentUnavailableError } from "@/services/print-agent";
import {
  LabelDesign,
  createDefaultLabelDesign,
  ensureObjectLabelDesign,
} from "../../../master/label/types";
import { LabelPrintRenderer } from "../../../master/label/components/LabelDesignRenderer";

interface PrintItem {
  key: string;
  data: Record<string, unknown>;
}

/** 발행 직후 출력용 — FG 바코드 + 라벨 컨텍스트를 직접 전달 */
export interface FgPrintRow {
  fgBarcode: string;
  itemCode?: string;
  orderNo?: string;
  equipCode?: string;
  lineCode?: string;
}

export interface FgLabelPrintHandle {
  /** 조립에서 발행된 FG 라벨을 바코드+컨텍스트로 직접 출력(빈 배열이면 무동작) */
  printByFgBarcodes: (rows: FgPrintRow[]) => Promise<void>;
}

function loadFgLabelDesign(raw: string | LabelDesign | undefined): LabelDesign {
  if (!raw) return createDefaultLabelDesign("fg");
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return ensureObjectLabelDesign(parsed, "fg");
}

const FgLabelPrintHost = forwardRef<FgLabelPrintHandle>(function FgLabelPrintHost(_props, ref) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [design, setDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("fg"));
  const [items, setItems] = useState<PrintItem[]>([]);

  // 기본 FG 라벨 템플릿 로드(없으면 기본 디자인 유지)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/master/label-templates", { params: { category: "fg" } });
        const templates: Array<{ designData: string | LabelDesign; isDefault?: boolean }> = res.data?.data ?? [];
        const preferred = templates.find((tpl) => tpl.isDefault) ?? templates[0];
        if (cancelled) return;
        setDesign(loadFgLabelDesign(preferred?.designData));
      } catch {
        if (!cancelled) setDesign(createDefaultLabelDesign("fg"));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 오프스크린 렌더 → PNG → Print Agent 전송 코어(공통). 빈 배열이면 무동작.
  const printItemsViaAgent = useCallback(
    async (printItems: PrintItem[]) => {
      if (printItems.length === 0) return;

      setItems(printItems);
      // LabelPrintRenderer가 오프스크린에 라벨 노드를 그릴 때까지 한 프레임 이상 대기
      await new Promise<void>((resolve) => window.setTimeout(resolve, 400));

      try {
        const nodes = Array.from(printRef.current?.children ?? [])
          .filter((node): node is HTMLElement => node instanceof HTMLElement);
        if (nodes.length !== printItems.length) {
          throw new Error(t("production.fgLabel.prepareFailed", "FG 라벨 출력 화면을 준비하지 못했습니다."));
        }
        await printLabelNodesViaAgent(
          nodes.map((node, index) => ({ node, jobId: `FG-${printItems[index].key}` })),
          design.labelWidth,
          design.labelHeight,
        );
        toast.success(t("production.fgLabel.printSent", "FG 라벨 {{count}}건을 프린터로 전송했습니다.", { count: printItems.length }));
      } catch (error: unknown) {
        const message = error instanceof PrintAgentUnavailableError
          ? t("production.fgLabel.agentUnavailable", "라벨 프린트 에이전트에 연결할 수 없습니다. PC에 HANES Print Agent가 설치·실행 중인지 확인한 뒤 다시 시도하세요.")
          : error instanceof Error && error.message
            ? error.message
            : t("production.fgLabel.printError", "FG 라벨 출력 중 오류가 발생했습니다.");
        toast.error(message);
      } finally {
        setItems([]);
      }
    },
    [design.labelHeight, design.labelWidth, t],
  );

  const printByFgBarcodes = useCallback(async (rows: FgPrintRow[]) => {
    if (!rows || rows.length === 0) return;
    await printItemsViaAgent(
      rows.map((row) => ({
        key: row.fgBarcode,
        data: {
          fgBarcode: row.fgBarcode,
          itemCode: row.itemCode,
          orderNo: row.orderNo,
          equipCode: row.equipCode,
          lineCode: row.lineCode,
        },
      })),
    );
  }, [printItemsViaAgent]);

  useImperativeHandle(ref, () => ({ printByFgBarcodes }), [printByFgBarcodes]);

  return <LabelPrintRenderer ref={printRef} items={items} design={design} visible={items.length > 0} />;
});

export default FgLabelPrintHost;
