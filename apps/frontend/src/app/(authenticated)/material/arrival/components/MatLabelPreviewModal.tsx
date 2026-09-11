"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 입하 등록 후 발급된 자재 LOT 라벨 미리보기 + 출력.
 *   출력 방식(services/label-print 공유, PC 별 localStorage 기억):
 *   - BROWSER(기본): 라벨 PNG 를 숨은 iframe 에 넣어 인쇄 대화상자 — Print Agent 없이 동작.
 *   - AGENT: 로컬 HANES Print Agent(127.0.0.1:37111)로 PNG 전송. http 공인 주소에서는 브라우저 정책으로 막힌다.
 *   두 경로 모두 renderLabelNodeToPngBase64(바코드 준비 대기 + 3배 래스터)를 거친 PNG 만 쓴다.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Printer, ClipboardList } from "lucide-react";
import { Modal, Button, Select } from "@/components/ui";
import { printAgentPng, PrintAgentUnavailableError } from "@/services/print-agent";
import { printPngLabelsInBrowser, renderLabelNodeToPngBase64, type LabelPrintMethod } from "@/services/label-print";
import LabelPrintMethodSelect, { useLabelPrintMethod } from "@/components/shared/LabelPrintMethodSelect";
import type { SelectOption } from "@/components/ui";
import { LabelDesign, createDefaultLabelDesign } from "../../../master/label/types";
import { LabelDesignRenderer, LabelPrintRenderer } from "../../../master/label/components/LabelDesignRenderer";
import type { PoLineReceiptResponse } from "./types";

interface Props {
  isOpen: boolean;
  data: PoLineReceiptResponse | null;
  itemName?: string;
  mfgPartnerLabel?: string;
  receivedDate?: string;
  labelDesign?: LabelDesign;
  templateOptions?: SelectOption[];
  selectedTemplateKey?: string;
  onTemplateChange?: (templateKey: string) => void;
  /** 입하 직후 IQC 검사의뢰서 출력(다음 부서 의뢰). 없으면 버튼 미표시 */
  onPrintIqcRequest?: () => void;
  onClose: () => void;
}

interface PrintItem {
  key: string;
  data: Record<string, unknown>;
}

const DEFAULT_TEMPLATE_KEY = "__default__";

export default function MatLabelPreviewModal({
  isOpen,
  data,
  itemName = '',
  mfgPartnerLabel = '',
  receivedDate = '',
  labelDesign = createDefaultLabelDesign("mat_lot"),
  templateOptions = [{ value: DEFAULT_TEMPLATE_KEY, label: "기본 디자인" }],
  selectedTemplateKey = DEFAULT_TEMPLATE_KEY,
  onTemplateChange: handleTemplateChange = () => undefined,
  onPrintIqcRequest,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [activePrintItems, setActivePrintItems] = useState<PrintItem[]>([]);
  const [printMethod, setPrintMethod] = useLabelPrintMethod();

  const labelItems = useMemo<PrintItem[]>(() => {
    if (!data) return [];
    return data.serials.map((serial) => ({
      key: serial.matUid,
      data: {
        matUid: serial.matUid,
        itemCode: serial.itemCode,
        itemName,
        qty: serial.initQty,
        unit: "EA",
        vendor: mfgPartnerLabel,
        lotNo: data.arrivalNo,
        arrivalNo: data.arrivalNo,
        arrivalSeq: serial.arrivalSeq,
        arrivalDate: receivedDate,
        receivedDate,
        mfgPartner: mfgPartnerLabel,
      },
    }));
  }, [data, itemName, mfgPartnerLabel, receivedDate]);

  /** 라벨 노드를 PNG(base64) 목록으로 래스터화 — BROWSER/AGENT 공통 */
  const renderAllLabelsToPng = useCallback(async (): Promise<string[]> => {
    const labelNodes = Array.from(printRef.current?.children ?? [])
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (labelNodes.length !== labelItems.length) {
      throw new Error(t("material.arrival.label.errorPrepareScreen", "라벨 출력 화면을 준비하지 못했습니다."));
    }
    const result: string[] = [];
    for (const node of labelNodes) {
      result.push(await renderLabelNodeToPngBase64(node, labelDesign.labelWidth, labelDesign.labelHeight));
    }
    return result;
  }, [labelDesign.labelHeight, labelDesign.labelWidth, labelItems.length, t]);

  const handlePrint = useCallback(() => {
    if (printing || labelItems.length === 0) return;

    setActivePrintItems(labelItems);
    setPrinting(true);
    const loadingToast = toast.loading(
      printMethod === "BROWSER"
        ? t("labelPrint.browserPreparing", "{{count}}개 라벨 인쇄 화면을 준비 중입니다.", { count: labelItems.length })
        : t("material.arrival.label.toastPreparing", "{{count}}개 입하 라벨을 agent로 전송 준비 중입니다.", { count: labelItems.length }),
    );

    window.setTimeout(async () => {
      try {
        const pngList = await renderAllLabelsToPng();

        if (printMethod === "BROWSER") {
          toast.success(t("labelPrint.browserOpened", "{{count}}개 라벨 인쇄 대화상자를 열었습니다. 프린터를 선택해 인쇄하세요.", { count: labelItems.length }), { id: loadingToast });
          await printPngLabelsInBrowser(t("material.arrival.label.title", "자재 라벨 미리보기"), pngList, labelDesign.labelWidth, labelDesign.labelHeight);
          return;
        }

        for (let index = 0; index < labelItems.length; index += 1) {
          const item = labelItems[index];
          await printAgentPng({
            jobId: `MAT-ARRIVAL-${item.key}`,
            widthMm: labelDesign.labelWidth,
            heightMm: labelDesign.labelHeight,
            copies: 1,
            contentBase64: pngList[index],
          });
        }
        toast.success(t("material.arrival.label.toastSent", "{{count}}개 입하 라벨을 agent로 전송했습니다.", { count: labelItems.length }), { id: loadingToast });
      } catch (err: unknown) {
        const message = err instanceof PrintAgentUnavailableError
          ? t("labelPrint.agentUnavailableHint", "라벨 프린트 에이전트에 연결할 수 없습니다. 출력 방식을 '브라우저 인쇄'로 바꾸면 에이전트 없이 출력할 수 있습니다.")
          : err instanceof Error && err.message
            ? err.message
            : t("material.arrival.label.toastError", "agent 출력 중 오류가 발생했습니다.");
        toast.error(message, { id: loadingToast });
      } finally {
        setPrinting(false);
        setActivePrintItems([]);
      }
    }, 500);
  }, [labelDesign.labelHeight, labelDesign.labelWidth, labelItems, printMethod, printing, renderAllLabelsToPng, t]);

  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.label.title')} size="xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-80 max-w-full">
            <Select
              aria-label={t('material.arrival.labelTemplate', '입하 라벨 템플릿')}
              options={templateOptions}
              value={selectedTemplateKey}
              onChange={handleTemplateChange}
              fullWidth
            />
          </div>
          <LabelPrintMethodSelect
            className="w-44 max-w-full"
            value={printMethod}
            onChange={(next: LabelPrintMethod) => setPrintMethod(next)}
          />
        </div>
        <Button onClick={handlePrint} disabled={printing || labelItems.length === 0} disabledReason={printing ? t('material.disabledHelp.printing', '라벨을 출력하고 있습니다.') : t('material.disabledHelp.noLabels', '출력할 자재 LOT 라벨이 없습니다.')}>
          <Printer className="w-4 h-4 mr-1" />
          {printing ? t('material.arrival.label.printing', '출력중') : t('material.arrival.label.print')}
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-white p-3">
        <div className="flex flex-wrap gap-3">
          {labelItems.map((item) => (
            <div key={item.key} className="rounded border border-slate-200 bg-white p-2">
              <LabelDesignRenderer design={labelDesign} data={item.data} unit="px" scale={6} />
            </div>
          ))}
        </div>
      </div>
      <LabelPrintRenderer ref={printRef} items={activePrintItems} design={labelDesign} visible={printing} />
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <div>
          {onPrintIqcRequest && (
            <Button variant="secondary" onClick={onPrintIqcRequest} leftIcon={<ClipboardList className="w-4 h-4" />}>
              {t('material.iqc.request.printButton', '검사의뢰서 출력')}
            </Button>
          )}
        </div>
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
