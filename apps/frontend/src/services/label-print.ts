/**
 * @file src/services/label-print.ts
 * @description 라벨 DOM 노드를 PNG(base64)로 변환해 출력하는 공유 유틸. 출력 방식 2가지.
 *
 * - AGENT  : PNG base64 → printAgentPng(/print, 127.0.0.1:37111). 모달 없이 에이전트로 직접 전송.
 * - BROWSER: 같은 PNG 를 숨은 iframe 문서(<img>, @page = 라벨 크기)에 넣고 iframe 창의 print() 호출.
 *            Print Agent 가 없거나 http 공인 주소(hswbs)처럼 브라우저 정책으로 에이전트 연결이 막힌 PC 용.
 *            과거 DOM 마크업 복사식 브라우저 인쇄는 PDF 프린터에서 바코드가 깨졌으므로, 반드시
 *            renderLabelNodeToPngBase64(바코드 준비 대기 + 3배 래스터)를 거친 이미지만 넣는다.
 *            iframe 방식은 팝업 차단과 무관해 키오스크 자동 출력(클릭 없음)에서도 동작한다.
 *
 * 출력 방식 선택은 PC 별 localStorage(LABEL_PRINT_METHOD_STORAGE_KEY, 기본 BROWSER)에 저장되고
 * 모든 라벨 화면·키오스크 호스트·헤더 에이전트 메뉴가 같은 값을 쓴다.
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

export type LabelPrintMethod = "BROWSER" | "AGENT";
/** 이 PC 의 라벨 출력 방식(개인 편의 설정, 없으면 BROWSER) */
export const LABEL_PRINT_METHOD_STORAGE_KEY = "hanes.label.printMethod";

export function readStoredLabelPrintMethod(): LabelPrintMethod {
  try {
    return window.localStorage.getItem(LABEL_PRINT_METHOD_STORAGE_KEY) === "AGENT" ? "AGENT" : "BROWSER";
  } catch {
    return "BROWSER";
  }
}

export function storeLabelPrintMethod(method: LabelPrintMethod): void {
  try {
    window.localStorage.setItem(LABEL_PRINT_METHOD_STORAGE_KEY, method);
  } catch {
    /* 사설 창 등 저장 불가는 무시 */
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch
  ));
}

/**
 * 브라우저 인쇄 문서: 라벨 1장 = 페이지 1장(@page 크기 = 라벨 크기, 여백 0).
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

const BROWSER_PRINT_CLEANUP_MS = 60_000;

/**
 * PNG 라벨 목록을 숨은 iframe 으로 인쇄한다(브라우저 인쇄 대화상자가 뜬다).
 * 팝업 차단과 무관하고 사용자 클릭 없이도 호출할 수 있다. 대화상자가 닫히면(afterprint) iframe 을 제거한다.
 */
export function printPngLabelsInBrowser(
  title: string,
  pngBase64List: string[],
  widthMm: number,
  heightMm: number,
): Promise<void> {
  if (pngBase64List.length === 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("data-label-print-frame", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.setTimeout(() => iframe.remove(), 0);
      resolve();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) {
        iframe.remove();
        reject(new Error("브라우저 인쇄 화면을 만들지 못했습니다."));
        return;
      }
      const images = Array.from(doc.images);
      void Promise.all(images.map((img) => (
        img.complete ? Promise.resolve() : new Promise<void>((done) => {
          img.addEventListener("load", () => done(), { once: true });
          img.addEventListener("error", () => done(), { once: true });
        })
      ))).then(() => {
        win.addEventListener("afterprint", finish, { once: true });
        win.focus();
        win.print();
        // afterprint 가 오지 않는 브라우저 대비 — 일정 시간 뒤 정리
        window.setTimeout(finish, BROWSER_PRINT_CLEANUP_MS);
      });
    };

    iframe.srcdoc = buildBrowserPrintDocument(title, pngBase64List, widthMm, heightMm);
    document.body.appendChild(iframe);
  });
}

/** 여러 라벨 노드를 PNG 로 변환해 브라우저 인쇄(iframe) — AGENT 경로의 printLabelNodesViaAgent 와 대칭 */
export async function printLabelNodesViaBrowser(
  nodes: HTMLElement[],
  title: string,
  widthMm: number,
  heightMm: number,
): Promise<void> {
  const pngList: string[] = [];
  for (const node of nodes) {
    pngList.push(await renderLabelNodeToPngBase64(node, widthMm, heightMm));
  }
  await printPngLabelsInBrowser(title, pngList, widthMm, heightMm);
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
