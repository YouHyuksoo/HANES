"use client";

/**
 * @file components/SgLabelPrintHost.tsx
 * @description 키오스크 SG(반제품) 라벨 자동 출력 호스트.
 *
 * 동작:
 * - 마운트 시 /master/label-templates?category=sg 의 기본 템플릿(없으면 기본 디자인)을 로드.
 * - printByResultNo(resultNo): 해당 생산실적에서 발행된 SG_LABELS를 조회해, 발행분이 있으면
 *   오프스크린 LabelPrintRenderer로 렌더 → PNG 변환 → HANES Print Agent(printAgentPng)로 모달 없이 출력.
 * - 라우팅 ISSUE_LABEL_TYPE 이 SG/BUNDLE 이 아닌 공정은 백엔드에서 SG를 발행하지 않으므로 조회 결과가 비어 자동으로 출력하지 않는다.
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

/** 생산실적별 SG 라벨 조회 응답 행(필요 필드만) */
interface SgLabelRow {
  sgBarcode: string;
  itemCode: string;
  orderNo: string;
  resultNo: string;
  issueProcessCode?: string;
  initQty?: number;
  issuedAt?: string;
}

interface PrintItem {
  key: string;
  data: Record<string, unknown>;
}

/** 실적 채번 전(발행 직후) 출력용 — 바코드 + 라벨 컨텍스트를 직접 전달 */
export interface SgPrintRow {
  sgBarcode: string;
  itemCode?: string;
  orderNo?: string;
  initQty?: number;
  issueProcessCode?: string;
}

export interface SgLabelPrintHandle {
  /** 생산실적에서 발행된 SG 라벨을 조회해 에이전트로 출력(발행분 없으면 무동작) */
  printByResultNo: (resultNo: string) => Promise<void>;
  /** 실적 채번 전 발행된 SG 라벨을 바코드+컨텍스트로 직접 출력(빈 배열이면 무동작) */
  printBySgBarcodes: (rows: SgPrintRow[]) => Promise<void>;
}

function loadSgLabelDesign(raw: string | LabelDesign | undefined): LabelDesign {
  if (!raw) return createDefaultLabelDesign("sg");
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return ensureObjectLabelDesign(parsed, "sg");
}

const SgLabelPrintHost = forwardRef<SgLabelPrintHandle>(function SgLabelPrintHost(_props, ref) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [design, setDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("sg"));
  const [items, setItems] = useState<PrintItem[]>([]);

  // 기본 SG 라벨 템플릿 로드(없으면 기본 디자인 유지)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/master/label-templates", { params: { category: "sg" } });
        const templates: Array<{ designData: string | LabelDesign; isDefault?: boolean }> = res.data?.data ?? [];
        const preferred = templates.find((tpl) => tpl.isDefault) ?? templates[0];
        if (cancelled) return;
        setDesign(loadSgLabelDesign(preferred?.designData));
      } catch {
        if (!cancelled) setDesign(createDefaultLabelDesign("sg"));
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
          throw new Error(t("kiosk.sgLabel.prepareFailed", "SG 라벨 출력 화면을 준비하지 못했습니다."));
        }
        await printLabelNodesViaAgent(
          nodes.map((node, index) => ({ node, jobId: `SG-${printItems[index].key}` })),
          design.labelWidth,
          design.labelHeight,
        );
        toast.success(t("kiosk.sgLabel.printSent", "SG 라벨 {{count}}건을 프린터로 전송했습니다.", { count: printItems.length }));
      } catch (error: unknown) {
        const message = error instanceof PrintAgentUnavailableError
          ? t("kiosk.sgLabel.agentUnavailable", "라벨 프린트 에이전트에 연결할 수 없습니다. PC에 HANES Print Agent가 설치·실행 중인지 확인한 뒤 다시 시도하세요.")
          : error instanceof Error && error.message
            ? error.message
            : t("kiosk.sgLabel.printError", "SG 라벨 출력 중 오류가 발생했습니다.");
        toast.error(message);
      } finally {
        setItems([]);
      }
    },
    [design.labelHeight, design.labelWidth, t],
  );

  const printByResultNo = useCallback(async (resultNo: string) => {
    if (!resultNo) return;
    let labels: SgLabelRow[] = [];
    try {
      const res = await api.get(`/production/subprocess-kitting/sg-labels-by-result/${encodeURIComponent(resultNo)}`);
      labels = Array.isArray(res.data?.data) ? (res.data.data as SgLabelRow[]) : [];
    } catch {
      // 조회 실패는 실적 저장에 영향 없음 — 출력만 건너뛴다.
      return;
    }
    if (labels.length === 0) return;

    await printItemsViaAgent(
      labels.map((sg) => ({
        key: sg.sgBarcode,
        data: {
          sgBarcode: sg.sgBarcode,
          itemCode: sg.itemCode,
          orderNo: sg.orderNo,
          initQty: sg.initQty,
          issueProcessCode: sg.issueProcessCode,
          issuedAt: sg.issuedAt,
        },
      })),
    );
  }, [printItemsViaAgent]);

  const printBySgBarcodes = useCallback(async (rows: SgPrintRow[]) => {
    if (!rows || rows.length === 0) return;
    await printItemsViaAgent(
      rows.map((row) => ({
        key: row.sgBarcode,
        data: {
          sgBarcode: row.sgBarcode,
          itemCode: row.itemCode,
          orderNo: row.orderNo,
          initQty: row.initQty,
          issueProcessCode: row.issueProcessCode,
        },
      })),
    );
  }, [printItemsViaAgent]);

  useImperativeHandle(ref, () => ({ printByResultNo, printBySgBarcodes }), [printByResultNo, printBySgBarcodes]);

  return <LabelPrintRenderer ref={printRef} items={items} design={design} visible={items.length > 0} />;
});

export default SgLabelPrintHost;
