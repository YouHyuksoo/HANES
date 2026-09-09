"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 입하 등록 후 발급된 자재 LOT 라벨 미리보기 + 출력.
 *   출력 방식 2가지(선택은 이 PC의 localStorage 에 기억):
 *   - BROWSER(기본): 라벨을 PNG 로 래스터화한 뒤 새 창에 <img> 로 넣어 window.print() — Print Agent 없이 동작.
 *     과거 DOM 마크업 복사 방식은 PDF 프린터에서 바코드가 깨졌으므로, 에이전트와 같은 PNG 파이프라인
 *     (renderLabelNodeToPngBase64 = 바코드 준비 대기 + 3배 래스터)을 그대로 쓴다.
 *   - AGENT: 로컬 HANES Print Agent(127.0.0.1:37111)로 PNG 전송. http 공인 주소에서는 브라우저 정책으로 막힌다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Printer } from "lucide-react";
import { Modal, Button, Select } from "@/components/ui";
import { printAgentPng, PrintAgentUnavailableError } from "@/services/print-agent";
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
  onClose: () => void;
}

interface PrintItem {
  key: string;
  data: Record<string, unknown>;
}

const DEFAULT_TEMPLATE_KEY = "__default__";
const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const CSS_PX_PER_MM = 96 / 25.4;
const AGENT_PRINT_SCALE = 3;

export type MatLabelPrintMethod = "BROWSER" | "AGENT";
/** 이 PC 에서 마지막으로 고른 출력 방식(개인 편의용, 없으면 BROWSER) */
export const MAT_LABEL_PRINT_METHOD_STORAGE_KEY = "hanes.matLabel.printMethod";

function readStoredPrintMethod(): MatLabelPrintMethod {
  try {
    const v = window.localStorage.getItem(MAT_LABEL_PRINT_METHOD_STORAGE_KEY);
    return v === "AGENT" ? "AGENT" : "BROWSER";
  } catch {
    return "BROWSER";
  }
}

function storePrintMethod(method: MatLabelPrintMethod): void {
  try {
    window.localStorage.setItem(MAT_LABEL_PRINT_METHOD_STORAGE_KEY, method);
  } catch {
    /* 저장 실패는 무시(사설 창 등) */
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch
  ));
}

/**
 * 브라우저 인쇄용 문서: 라벨 1장 = 페이지 1장(@page 크기 = 라벨 크기, 여백 0).
 * 이미지는 PNG data URL 이라 프린터 드라이버(PDF 포함)에서 바코드가 그대로 유지된다.
 */
export function buildBrowserPrintDocument(
  title: string,
  pngBase64List: string[],
  widthMm: number,
  heightMm: number,
): string {
  const pages = pngBase64List
    .map((b64) => `<div class="page"><img src="data:image/png;base64,${b64}" alt="label" /></div>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
@page{size:${widthMm}mm ${heightMm}mm;margin:0}
.page{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.page img{display:block;width:${widthMm}mm;height:${heightMm}mm}
</style></head><body>${pages}</body></html>`;
}

/** 새 창의 이미지가 모두 로드된 뒤 인쇄 대화상자를 연다. 인쇄가 끝나면(또는 취소) 창을 닫는다. */
function printDocumentInWindow(win: Window, html: string): void {
  win.document.open();
  win.document.write(html);
  win.document.close();
  const images = Array.from(win.document.images);
  const ready = Promise.all(images.map((img) => (
    img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    })
  )));
  void ready.then(() => {
    win.addEventListener("afterprint", () => win.close(), { once: true });
    win.focus();
    win.print();
  });
}

function dataUrlPayload(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? "";
}

async function waitForLabelImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      window.setTimeout(done, 800);
    });
  }));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForLabelRenderReady(root: HTMLElement): Promise<void> {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    if (!root.querySelector("[data-label-barcode-pending='true']")) {
      await waitForLabelImages(root);
      if (!root.querySelector("[data-label-barcode-pending='true']")) return;
    }
    await wait(50);
  }
  throw new Error("바코드 생성이 완료되지 않았습니다. 미리보기에서 라벨을 확인한 뒤 다시 출력하세요.");
}

async function renderLabelNodeToPngBase64(node: HTMLElement, widthMm: number, heightMm: number): Promise<string> {
  await waitForLabelRenderReady(node);
  const widthPx = Math.max(1, Math.round(widthMm * CSS_PX_PER_MM));
  const heightPx = Math.max(1, Math.round(heightMm * CSS_PX_PER_MM));
  const clone = node.cloneNode(true) as HTMLElement;
  clone.setAttribute("xmlns", XHTML_NS);
  clone.style.margin = "0";

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="${SVG_NS}" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
    <foreignObject width="100%" height="100%">${serialized}</foreignObject>
  </svg>`;
  const image = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("라벨 이미지를 PNG로 변환하지 못했습니다."));
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = widthPx * AGENT_PRINT_SCALE;
  canvas.height = heightPx * AGENT_PRINT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("라벨 출력용 canvas를 생성하지 못했습니다.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return dataUrlPayload(canvas.toDataURL("image/png"));
}

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
  onClose,
}: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [activePrintItems, setActivePrintItems] = useState<PrintItem[]>([]);
  const [printMethod, setPrintMethod] = useState<MatLabelPrintMethod>("BROWSER");

  useEffect(() => {
    setPrintMethod(readStoredPrintMethod());
  }, []);

  const handlePrintMethodChange = useCallback((value: string) => {
    const next: MatLabelPrintMethod = value === "AGENT" ? "AGENT" : "BROWSER";
    setPrintMethod(next);
    storePrintMethod(next);
  }, []);

  const printMethodOptions = useMemo<SelectOption[]>(() => [
    { value: "BROWSER", label: t("material.arrival.label.printMethodBrowser", "브라우저 인쇄") },
    { value: "AGENT", label: t("material.arrival.label.printMethodAgent", "Print Agent 출력") },
  ], [t]);

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

    // 브라우저 인쇄는 팝업 차단을 피하려고 클릭 핸들러 안에서 동기적으로 창을 먼저 연다.
    let browserWindow: Window | null = null;
    if (printMethod === "BROWSER") {
      browserWindow = window.open("", "_blank");
      if (!browserWindow) {
        toast.error(t("material.arrival.label.browserPopupBlocked", "인쇄 창이 팝업 차단에 막혔습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도하세요."));
        return;
      }
      browserWindow.document.write(`<p style="font-family:sans-serif;padding:16px">${escapeHtml(t("material.arrival.label.browserPreparing", "라벨을 준비하고 있습니다…"))}</p>`);
    }

    setActivePrintItems(labelItems);
    setPrinting(true);
    const loadingToast = toast.loading(
      printMethod === "BROWSER"
        ? t("material.arrival.label.toastBrowserPreparing", "{{count}}개 입하 라벨 인쇄 화면을 준비 중입니다.", { count: labelItems.length })
        : t("material.arrival.label.toastPreparing", "{{count}}개 입하 라벨을 agent로 전송 준비 중입니다.", { count: labelItems.length }),
    );

    window.setTimeout(async () => {
      try {
        const pngList = await renderAllLabelsToPng();

        if (printMethod === "BROWSER") {
          if (!browserWindow || browserWindow.closed) {
            throw new Error(t("material.arrival.label.browserWindowClosed", "인쇄 창이 닫혀 출력을 진행할 수 없습니다. 다시 시도하세요."));
          }
          printDocumentInWindow(
            browserWindow,
            buildBrowserPrintDocument(t("material.arrival.label.title", "자재 라벨 미리보기"), pngList, labelDesign.labelWidth, labelDesign.labelHeight),
          );
          toast.success(t("material.arrival.label.toastBrowserOpened", "{{count}}개 입하 라벨 인쇄 창을 열었습니다. 프린터를 선택해 인쇄하세요.", { count: labelItems.length }), { id: loadingToast });
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
        if (browserWindow && !browserWindow.closed) browserWindow.close();
        const message = err instanceof PrintAgentUnavailableError
          ? t("material.arrival.label.agentUnavailableHint", "라벨 프린트 에이전트에 연결할 수 없습니다. 출력 방식을 '브라우저 인쇄'로 바꾸면 에이전트 없이 출력할 수 있습니다.")
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
          <div className="w-44 max-w-full">
            <Select
              aria-label={t('material.arrival.label.printMethod', '출력 방식')}
              options={printMethodOptions}
              value={printMethod}
              onChange={handlePrintMethodChange}
              fullWidth
            />
          </div>
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
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
