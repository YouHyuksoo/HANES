/**
 * @file src/services/label-print.ts
 * @description 라벨 DOM 노드를 PNG(base64)로 변환해 로컬 HANES Print Agent로 출력하는 공유 유틸.
 *
 * 출력 경로: LabelDesignRenderer로 렌더된 라벨 노드 → SVG(foreignObject) → canvas → PNG base64 →
 *           printAgentPng(/print). 모달/window.print() 없이 에이전트로 직접 전송한다.
 * (material/arrival의 MatLabelPreviewModal과 동일한 변환 로직을 재사용 가능하도록 분리)
 */
import { printAgentPng } from "./print-agent";

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const CSS_PX_PER_MM = 96 / 25.4;
const AGENT_PRINT_SCALE = 3;

function dataUrlPayload(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? "";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

/** 바코드/이미지 렌더가 끝날 때까지 대기(미완료 시 예외) */
async function waitForLabelRenderReady(root: HTMLElement): Promise<void> {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    if (!root.querySelector("[data-label-barcode-pending='true']")) {
      await waitForLabelImages(root);
      if (!root.querySelector("[data-label-barcode-pending='true']")) return;
    }
    await wait(50);
  }
  throw new Error("바코드 생성이 완료되지 않았습니다.");
}

/** 단일 라벨 DOM 노드를 PNG(base64, 헤더 제외)로 변환 */
export async function renderLabelNodeToPngBase64(node: HTMLElement, widthMm: number, heightMm: number): Promise<string> {
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

export interface AgentLabelPrintJob {
  /** 출력 대상 라벨 노드(LabelDesignRenderer 결과) */
  node: HTMLElement;
  /** 작업 식별자 — 프린트 로그/큐 구분용 */
  jobId: string;
}

/** 여러 라벨 노드를 순차적으로 PNG 변환 후 에이전트로 출력 */
export async function printLabelNodesViaAgent(
  jobs: AgentLabelPrintJob[],
  widthMm: number,
  heightMm: number,
  copies = 1,
): Promise<void> {
  for (const job of jobs) {
    const contentBase64 = await renderLabelNodeToPngBase64(job.node, widthMm, heightMm);
    await printAgentPng({
      jobId: job.jobId,
      widthMm,
      heightMm,
      copies,
      contentBase64,
    });
  }
}
