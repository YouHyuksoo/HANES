export type AiPageToolRiskLevel = "read" | "draft" | "propose" | "write";
export type AiPageToolSource = "backend" | "frontend";
export type AiPageToolExecutionLevel = "draft-only" | "approval-required" | "write-enabled";
export type AiPageToolTab = "chat" | "tools" | "log";

export interface AiPageToolDefinition {
  name: string;
  label: string;
  description: string;
  riskLevel: AiPageToolRiskLevel;
  source: AiPageToolSource;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  confirmationPolicy?: string;
  requiresConfirmation?: boolean;
  neverPersists?: boolean;
}

export interface AiPageToolManifest {
  pageId: string;
  route: string;
  title: string;
  executionLevel: AiPageToolExecutionLevel;
  tools: AiPageToolDefinition[];
}

export interface AiPageToolExecutionLog {
  id: string;
  pageId: string;
  toolName: string;
  input: unknown;
  status: "success" | "failed" | "blocked";
  summary: string;
  createdAt: string;
}

export type FrontendToolExecutor = (input: unknown) => Promise<unknown> | unknown;
