export const PRINT_AGENT_BASE_URL = process.env.NEXT_PUBLIC_PRINT_AGENT_URL ?? "http://127.0.0.1:37111";

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
}

export interface PrintAgentResult {
  jobId: string;
  printerName: string;
  copies: number;
  status: "queued" | string;
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
  const res = await fetch(`${PRINT_AGENT_BASE_URL}/health`, { method: "GET" });
  return parseAgentResponse<PrintAgentHealth>(res);
}

export async function getPrintAgentPrinters(): Promise<string[]> {
  const res = await fetch(`${PRINT_AGENT_BASE_URL}/printers`, { method: "GET" });
  const payload = await parseAgentResponse<{ printers: string[] }>(res);
  return payload.printers;
}

export async function getPrintAgentConfig(): Promise<PrintAgentConfig> {
  const res = await fetch(`${PRINT_AGENT_BASE_URL}/config`, { method: "GET" });
  return parseAgentResponse<PrintAgentConfig>(res);
}

export async function savePrintAgentConfig(config: PrintAgentConfig): Promise<PrintAgentConfig> {
  const res = await fetch(`${PRINT_AGENT_BASE_URL}/config`, {
    method: "POST",
    headers: printAgentHeaders(),
    body: JSON.stringify(config),
  });
  return parseAgentResponse<PrintAgentConfig>(res);
}

export async function printAgentPng(job: PrintAgentPngJob): Promise<PrintAgentResult> {
  const res = await fetch(`${PRINT_AGENT_BASE_URL}/print`, {
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
