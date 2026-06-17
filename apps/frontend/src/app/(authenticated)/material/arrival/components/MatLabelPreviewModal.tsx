"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 입하 등록 후 발급된 자재 LOT 라벨 미리보기 + 로컬 print-agent 출력
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Printer } from "lucide-react";
import { Modal, Button, Select } from "@/components/ui";
import { printAgentPng } from "@/services/print-agent";
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

  const handlePrint = useCallback(() => {
    if (printing || labelItems.length === 0) return;
    setActivePrintItems(labelItems);
    setPrinting(true);
    const loadingToast = toast.loading(`${labelItems.length}개 입하 라벨을 agent로 전송 준비 중입니다.`);

    window.setTimeout(async () => {
      try {
        const labelNodes = Array.from(printRef.current?.children ?? [])
          .filter((node): node is HTMLElement => node instanceof HTMLElement);
        if (labelNodes.length !== labelItems.length) {
          throw new Error("라벨 출력 화면을 준비하지 못했습니다.");
        }

        for (let index = 0; index < labelItems.length; index += 1) {
          const item = labelItems[index];
          const contentBase64 = await renderLabelNodeToPngBase64(
            labelNodes[index],
            labelDesign.labelWidth,
            labelDesign.labelHeight,
          );
          await printAgentPng({
            jobId: `MAT-ARRIVAL-${item.key}`,
            widthMm: labelDesign.labelWidth,
            heightMm: labelDesign.labelHeight,
            copies: 1,
            contentBase64,
          });
        }

        toast.success(`${labelItems.length}개 입하 라벨을 agent로 전송했습니다.`, { id: loadingToast });
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "agent 출력 중 오류가 발생했습니다.";
        toast.error(message, { id: loadingToast });
      } finally {
        setPrinting(false);
        setActivePrintItems([]);
      }
    }, 500);
  }, [labelDesign.labelHeight, labelDesign.labelWidth, labelItems, printing]);

  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.label.title')} size="xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="w-80 max-w-full">
          <Select
            aria-label="입하 라벨 템플릿"
            options={templateOptions}
            value={selectedTemplateKey}
            onChange={handleTemplateChange}
            fullWidth
          />
        </div>
        <Button onClick={handlePrint} disabled={printing || labelItems.length === 0}>
          <Printer className="w-4 h-4 mr-1" />
          {printing ? "출력중" : t('material.arrival.label.print')}
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
