export type AiPageToolRiskLevel = 'read' | 'draft' | 'propose' | 'write';
export type AiPageToolSource = 'backend' | 'frontend';
export type AiPageToolExecutionLevel = 'draft-only' | 'approval-required' | 'write-enabled';

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

export type AiPageToolConfirmationReason =
  | 'none'
  | 'not_found'
  | 'single_name_match'
  | 'multiple_candidates';

export interface AiPageToolCandidateResult<TCandidate = Record<string, unknown>> {
  status: 'ok';
  candidates: TCandidate[];
  confirmation: {
    required: boolean;
    reason: AiPageToolConfirmationReason;
  };
}
