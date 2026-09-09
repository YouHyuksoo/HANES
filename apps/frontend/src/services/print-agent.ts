export const PRINT_AGENT_BASE_URL = process.env.NEXT_PUBLIC_PRINT_AGENT_URL ?? "http://127.0.0.1:37111";

/**
 * MES 백엔드가 배포하는 Print Agent 실행파일 다운로드 경로(같은 origin → Next rewrite → 백엔드 @Public).
 * `<a href>` 직접 링크로 사용한다.
 */
export const PRINT_AGENT_DOWNLOAD_URL = "/api/print-agent/download";
/** 설치 파일 배포 가능 여부(백엔드 @Public GET /print-agent/info). 파일이 없으면 다운로드 링크 대신 안내를 보여준다. */
export const PRINT_AGENT_INFO_URL = "/api/print-agent/info";

export interface PrintAgentInstallerInfo {
  available: boolean;
  fileName: string;
  sizeBytes: number | null;
}

/**
 * 서버에 설치 파일이 배포돼 있는지 확인한다.
 * 배포 서버에 exe 가 없으면 /download 가 404 JSON 을 내려 브라우저가 download.json 을 저장하므로(2026-09-09 결함),
 * 링크를 그리기 전에 이 값을 보고 안내로 대체한다. 응답이 { success, data } 래핑이든 평문이든 모두 받는다.
 */
export async function fetchPrintAgentInstallerInfo(): Promise<PrintAgentInstallerInfo> {
  const res = await fetch(PRINT_AGENT_INFO_URL, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Print Agent info 조회 실패: HTTP ${res.status}`);
  }
  const payload = (await res.json()) as PrintAgentInstallerInfo | { data?: PrintAgentInstallerInfo };
  const info = "available" in payload ? payload : payload.data;
  if (!info || typeof info.available !== "boolean") {
    throw new Error("Print Agent info 응답 형식이 올바르지 않습니다.");
  }
  return info;
}

const PRINT_AGENT_TOKEN = process.env.NEXT_PUBLIC_PRINT_AGENT_TOKEN ?? "";

export interface PrintAgentHealth {
  ok: boolean;
  name: string;
  timestamp: string;
}

export interface PrintAgentConfig {
  listenAddress?: string;
  allowedOrigins?: string[];
  token?: string;
  tokenRequired?: boolean;
  defaultPrinter?: string;
  maxPayloadBytes?: number;
  logDir?: string;
}

export interface PrintAgentPngJob {
  jobId: string;
  printerName?: string;
  widthMm: number;
  heightMm: number;
  copies?: number;
  contentBase64: string;
  outputPath?: string;
}

export interface PrintAgentResult {
  jobId: string;
  printerName: string;
  copies: number;
  status: "queued" | string;
  outputPath?: string;
}

/**
 * 로컬 프린트 에이전트에 연결 자체가 실패한 경우(미실행/포트 차단 등) 던지는 에러.
 * 호출 측에서 `instanceof PrintAgentUnavailableError`로 구분해 안내 메시지를 표시할 수 있다.
 */
export class PrintAgentUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "로컬 프린트 에이전트(HANES Print Agent)에 연결할 수 없습니다. 에이전트가 실행 중인지 확인한 뒤 다시 시도하세요.",
    );
    this.name = "PrintAgentUnavailableError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * fetch 네트워크 실패(연결 거부 등 → TypeError)를 PrintAgentUnavailableError로 변환한다.
 * HTTP 응답을 받았으나 4xx/5xx인 경우는 그대로 통과시켜 parseAgentResponse가 처리한다.
 */
async function agentFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (cause: unknown) {
    throw new PrintAgentUnavailableError(cause);
  }
}

function printAgentHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (PRINT_AGENT_TOKEN) headers["X-HANES-Print-Token"] = PRINT_AGENT_TOKEN;
  return headers;
}

async function parseAgentResponse<T>(res: Response): Promise<T> {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Print agent request failed (${res.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function checkPrintAgent(): Promise<PrintAgentHealth> {
  const res = await agentFetch(`${PRINT_AGENT_BASE_URL}/health`, { method: "GET" });
  return parseAgentResponse<PrintAgentHealth>(res);
}

export async function getPrintAgentPrinters(): Promise<string[]> {
  const res = await agentFetch(`${PRINT_AGENT_BASE_URL}/printers`, { method: "GET" });
  const payload = await parseAgentResponse<{ printers: string[] }>(res);
  return payload.printers;
}

export async function getPrintAgentConfig(): Promise<PrintAgentConfig> {
  const res = await agentFetch(`${PRINT_AGENT_BASE_URL}/config`, { method: "GET" });
  return parseAgentResponse<PrintAgentConfig>(res);
}

export async function savePrintAgentConfig(config: PrintAgentConfig): Promise<PrintAgentConfig> {
  const res = await agentFetch(`${PRINT_AGENT_BASE_URL}/config`, {
    method: "POST",
    headers: printAgentHeaders(),
    body: JSON.stringify(config),
  });
  return parseAgentResponse<PrintAgentConfig>(res);
}

export async function printAgentPng(job: PrintAgentPngJob): Promise<PrintAgentResult> {
  const res = await agentFetch(`${PRINT_AGENT_BASE_URL}/print`, {
    method: "POST",
    headers: printAgentHeaders(),
    body: JSON.stringify({
      ...job,
      format: "png",
      copies: job.copies ?? 1,
    }),
  });
  return parseAgentResponse<PrintAgentResult>(res);
}
