"use client";

/**
 * @file src/app/(authenticated)/master/worker/components/WorkerLabelPrintModal.tsx
 * @description 작업자 인식 바코드 라벨 발행 모달 — 라벨디자인(category=worker) 템플릿으로 선택 작업자 라벨을 출력한다.
 *
 * 초보자 가이드:
 * 1. 템플릿은 /master/label-templates?category=worker 에서 불러오고, 기본(isDefault) 템플릿을 먼저 고른다.
 * 2. 바코드 값은 템플릿 설계(기본 workerCode)를 따른다. 스캔 조회(by-qr)는 QR코드 → 사번 순으로 찾는다.
 * 3. 출력 방식(브라우저 인쇄 / Print Agent)은 PC 공통 설정(LabelPrintMethodSelect)을 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Printer } from "lucide-react";
import { Modal, Button, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import LabelPrintMethodSelect, { useLabelPrintMethod } from "@/components/shared/LabelPrintMethodSelect";
import { api } from "@/services/api";
import { PrintAgentUnavailableError } from "@/services/print-agent";
import { printLabelNodesViaAgent, printLabelNodesViaBrowser } from "@/services/label-print";
import { LabelDesign, createDefaultLabelDesign, ensureObjectLabelDesign } from "../../label/types";
import { LabelDesignRenderer, LabelPrintRenderer } from "../../label/components/LabelDesignRenderer";
import { Worker } from "../types";

interface TemplateInfo {
  templateKey: string;
  templateName: string;
  printMode: string;
  designData: LabelDesign;
  isDefault?: boolean;
}

interface Props {
  isOpen: boolean;
  workers: Worker[];
  onClose: () => void;
}

const DEFAULT_TEMPLATE_KEY = "__default__";

function toLabelData(worker: Worker): Record<string, unknown> {
  return {
    workerCode: worker.workerCode,
    workerName: worker.workerName,
    engName: worker.engName ?? "",
    dept: worker.dept ?? "",
    position: worker.position ?? "",
    phone: worker.phone ?? "",
    qrCode: worker.qrCode ?? "",
  };
}

export default function WorkerLabelPrintModal({ isOpen, workers, onClose }: Props) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("worker"));
  const [printMethod, setPrintMethod] = useLabelPrintMethod();
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/master/label-templates", { params: { category: "worker" } });
        const rawTemplates: Array<{
          templateKey?: string;
          templateName: string;
          category: string;
          printMode?: string;
          designData: string | LabelDesign;
          isDefault?: boolean;
        }> = res.data?.data ?? [];
        const nextTemplates: TemplateInfo[] = rawTemplates.map((tpl) => {
          const rawDesign = typeof tpl.designData === "string" ? JSON.parse(tpl.designData) : tpl.designData;
          return {
            templateKey: tpl.templateKey ?? `${tpl.templateName}::${tpl.category}`,
            templateName: tpl.templateName,
            printMode: tpl.printMode ?? "BROWSER",
            designData: ensureObjectLabelDesign(rawDesign, "worker"),
            isDefault: tpl.isDefault,
          };
        });
        if (cancelled) return;
        setTemplates(nextTemplates);
        const preferred = nextTemplates.find((item) => item.isDefault) ?? nextTemplates[0];
        setSelectedTemplateKey(preferred?.templateKey ?? DEFAULT_TEMPLATE_KEY);
        setLabelDesign(preferred?.designData ?? createDefaultLabelDesign("worker"));
      } catch {
        if (cancelled) return;
        setTemplates([]);
        setSelectedTemplateKey(DEFAULT_TEMPLATE_KEY);
        setLabelDesign(createDefaultLabelDesign("worker"));
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const templateOptions = useMemo<SelectOption[]>(() => [
    { value: DEFAULT_TEMPLATE_KEY, label: t("master.worker.labelDefaultDesign", "기본 디자인") },
    ...templates.map((tpl) => ({
      value: tpl.templateKey,
      label: `${tpl.templateName}${tpl.printMode ? ` / ${tpl.printMode}` : ""}`,
    })),
  ], [templates, t]);

  const handleTemplateChange = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    const tpl = templates.find((item) => item.templateKey === templateKey);
    setLabelDesign(tpl?.designData ?? createDefaultLabelDesign("worker"));
  }, [templates]);

  const printItems = useMemo(
    () => workers.map((worker) => ({ key: worker.workerCode, data: toLabelData(worker) })),
    [workers],
  );

  const handlePrint = useCallback(async () => {
    if (printItems.length === 0) return;
    setPrinting(true);
    try {
      const nodes = Array.from(printRef.current?.children ?? [])
        .filter((node): node is HTMLElement => node instanceof HTMLElement);
      if (nodes.length !== printItems.length) {
        throw new Error(t("master.worker.labelPrepareFailed", "작업자 라벨 출력 화면을 준비하지 못했습니다."));
      }
      if (printMethod === "BROWSER") {
        await printLabelNodesViaBrowser(nodes, t("master.worker.labelPrintTitle", "작업자 라벨"), labelDesign.labelWidth, labelDesign.labelHeight);
        toast.success(t("labelPrint.browserOpened", "{{count}}개 라벨 인쇄 대화상자를 열었습니다. 프린터를 선택해 인쇄하세요.", { count: printItems.length }));
      } else {
        await printLabelNodesViaAgent(
          nodes.map((node, index) => ({ node, jobId: `WORKER-${printItems[index].key}` })),
          labelDesign.labelWidth,
          labelDesign.labelHeight,
        );
        toast.success(t("master.worker.labelPrintSent", "작업자 라벨 {{count}}건을 프린터로 전송했습니다.", { count: printItems.length }));
      }
      onClose();
    } catch (error: unknown) {
      const message = error instanceof PrintAgentUnavailableError
        ? t("labelPrint.agentUnavailableHint", "라벨 프린트 에이전트에 연결할 수 없습니다. 출력 방식을 '브라우저 인쇄'로 바꾸면 에이전트 없이 출력할 수 있습니다.")
        : error instanceof Error && error.message
          ? error.message
          : t("master.worker.labelPrintError", "작업자 라벨 출력 중 오류가 발생했습니다.");
      toast.error(message);
    } finally {
      setPrinting(false);
    }
  }, [printItems, printMethod, labelDesign.labelWidth, labelDesign.labelHeight, onClose, t]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t("master.worker.labelPrintModalTitle", "작업자 인식 라벨 발행")}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={onClose} disabled={printing}>{t("common.close", "닫기")}</Button>
            <Button onClick={handlePrint} disabled={printItems.length === 0 || printing}>
              <Printer className="w-4 h-4 mr-1" />
              {printing
                ? t("master.worker.labelPrinting", "출력중")
                : t("master.worker.labelPrintCount", "{{count}}건 출력", { count: printItems.length })}
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Select
                aria-label={t("master.worker.labelTemplate", "라벨 템플릿")}
                options={templateOptions}
                value={selectedTemplateKey}
                onChange={handleTemplateChange}
                fullWidth
              />
            </div>
            <LabelPrintMethodSelect className="w-48" value={printMethod} onChange={setPrintMethod} />
            <span className="text-xs text-text-muted">
              {t("master.worker.labelSize", "라벨 크기 {{width}} × {{height}} mm", {
                width: labelDesign.labelWidth,
                height: labelDesign.labelHeight,
              })}
            </span>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface p-4">
            <div className="flex flex-wrap gap-4">
              {printItems.map((item) => (
                <div key={item.key} className="flex flex-col items-center gap-1">
                  <div className="bg-white">
                    <LabelDesignRenderer design={labelDesign} data={item.data} unit="mm" />
                  </div>
                  <span className="font-mono text-xs text-text-muted">{item.key}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal 의 transform 영향을 받지 않도록 바깥 오프스크린에 실물 크기(mm) 라벨을 그린다 */}
      <LabelPrintRenderer ref={printRef} items={printItems} design={labelDesign} visible={isOpen} />
    </>
  );
}
