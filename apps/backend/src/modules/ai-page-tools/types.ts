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

/** write 도구 실행 결과 (등록/수정 등) */
export interface AiPageToolWriteResult {
  status: 'ok';
  toolName: string;
  summary: string;
  result?: Record<string, unknown>;
}

export type AiPageToolResult = AiPageToolCandidateResult | AiPageToolWriteResult;

export interface PageToolContext {
  company?: string;
  plant?: string;
}

/**
 * 페이지별 도구 묶음. 각 페이지는 이 인터페이스를 구현한 Provider 하나로
 * 매니페스트(도구 정의) + 실행 로직 + 의존 서비스를 자기완결적으로 보유한다.
 * 새 페이지 도구 추가 = Provider 1개 작성 + 모듈 등록 1줄(중앙 코드 불변).
 */
export interface PageToolProvider {
  readonly pageId: string;
  readonly manifest: AiPageToolManifest;
  execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolResult>;
}

/** PageToolProvider 다중 주입용 DI 토큰 */
export const PAGE_TOOL_PROVIDER = Symbol('PAGE_TOOL_PROVIDER');
