/**
 * @file src/modules/ai/knowledge-pipeline.service.ts
 * @description 지식 검색 풀 파이프라인: 질의이해(LLM) → 멀티질의 하이브리드 검색+RRF → 그래프 확장 → 리랭크(LLM) → 구조화 컨텍스트.
 *
 * 모든 LLM 단계는 실패해도 폴백으로 진행한다 — 파이프라인 오류가 채팅 실패로 전파되지 않는다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import {
  AiKnowledgeService,
  KnowledgeSearchResult,
  TroubleshootingHit,
} from '../ai-knowledge/ai-knowledge.service';
import { AiKnowledgeContextDto } from './dto/ai-chat.dto';

export type KnowledgeIntent = 'usage' | 'workflow' | 'troubleshoot' | 'engineer';

export interface KnowledgePipelineResult {
  chunks: KnowledgeSearchResult[];
  prompt: string;
  intent: KnowledgeIntent;
}

interface QueryUnderstanding {
  intent: KnowledgeIntent;
  queries: string[];
  menus: string[];
}

const UNDERSTAND_PROMPT = `당신은 MES 도움말 검색을 위한 질의 분석기입니다. 사용자 질문을 분석해 JSON만 출력하세요.
{"intent":"usage|workflow|troubleshoot|engineer","queries":["검색질의1","검색질의2"],"menus":["언급된 메뉴코드"]}
- intent: usage=단일 화면 사용법, workflow=업무 흐름/전후관계("다음에 뭐", "전에 뭘"), troubleshoot=안 됨/오류/원인, engineer=테이블/API/로직 구조.
- queries: 검색에 유리하게 재작성한 한국어 질의 1~3개. 동의어/업무용어를 반영하되 질문의 의미를 바꾸지 마세요.
- menus: 질문에 명시된 화면/메뉴가 있으면 메뉴코드 추정값(모르면 빈 배열).
JSON 외 다른 텍스트 금지.`;

const RERANK_PROMPT = `당신은 검색 결과 리랭커입니다. 질문과 후보 문서 목록을 보고, 질문에 답하는 데 유용한 순서로 후보 번호를 JSON 배열로만 출력하세요. 관련 없는 후보는 제외하세요. 예: [3,1,5]`;

const RRF_K = 60;
const PER_QUERY_TOP_K = 12;
const RERANK_INPUT_LIMIT = 20;
const FINAL_TOP_K = 8;

@Injectable()
export class KnowledgePipelineService {
  private readonly logger = new Logger(KnowledgePipelineService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly knowledge: AiKnowledgeService,
  ) {}

  async retrieve(userMessage: string, context?: AiKnowledgeContextDto): Promise<KnowledgePipelineResult> {
    const understanding = await this.understand(userMessage);

    // [2] 멀티질의 하이브리드 검색 + RRF 융합
    const fused = await this.searchWithRrf(understanding.queries, context);

    // [3] 그래프 확장 — 관계를 점수가 아니라 컨텍스트로 포함한다
    const menuCodes = this.collectMenuCodes(fused, understanding, context);
    const audience = context?.persona === 'operator' ? 'operator' : 'user';
    const graphChunks: KnowledgeSearchResult[] = [];
    const workflowLines: string[] = [];
    const workflowIds = new Set<string>();
    for (const menuCode of menuCodes.slice(0, 3)) {
      const wfCtx = this.knowledge.getWorkflowContext(menuCode);
      for (const wf of wfCtx.workflows) {
        workflowIds.add(wf.workflowId);
        workflowLines.push(`- ${menuCode}: ${wf.title} ${wf.stepIndex}/${wf.totalSteps}단계`);
      }
      if (wfCtx.prevMenus.length > 0) workflowLines.push(`  선행 메뉴: ${wfCtx.prevMenus.join(', ')}`);
      if (wfCtx.nextMenus.length > 0) workflowLines.push(`  후행 메뉴: ${wfCtx.nextMenus.join(', ')}`);
      if (wfCtx.requires.length > 0) workflowLines.push(`  선행 조건: ${wfCtx.requires.join(', ')}`);
      const neighborMenus = [...wfCtx.prevMenus, ...wfCtx.nextMenus].filter((menu) => menu !== menuCode);
      graphChunks.push(...this.knowledge.getMenuOverviewChunks(neighborMenus, audience, 4));
    }
    if (understanding.intent === 'workflow' || understanding.intent === 'troubleshoot') {
      graphChunks.push(...this.knowledge.getWorkflowDocChunks(Array.from(workflowIds), 4));
    }
    let troubles: TroubleshootingHit[] = [];
    if (understanding.intent === 'troubleshoot') {
      troubles = this.knowledge.searchTroubleshooting(userMessage, 4);
    }

    // [4] 리랭크 — 그래프 확장 청크는 리랭크와 무관하게 유지
    const reranked = await this.rerank(userMessage, fused);
    const chunks = this.mergeUnique([...reranked.slice(0, FINAL_TOP_K), ...graphChunks]);

    // [5] 구조화 컨텍스트
    const prompt = this.buildStructuredPrompt(chunks, reranked.slice(0, FINAL_TOP_K), graphChunks, workflowLines, troubles, context);
    return { chunks, prompt, intent: understanding.intent };
  }

  /** [1] 질의 이해. 실패 시 원문 단일 질의 + usage 의도로 폴백. */
  private async understand(userMessage: string): Promise<QueryUnderstanding> {
    const fallback: QueryUnderstanding = { intent: 'usage', queries: [userMessage], menus: [] };
    try {
      const res = await this.aiService.complete([
        { role: 'system', content: UNDERSTAND_PROMPT },
        { role: 'user', content: userMessage },
      ]);
      const start = res.indexOf('{');
      const end = res.lastIndexOf('}');
      if (start === -1 || end === -1) return fallback;
      const parsed = JSON.parse(res.slice(start, end + 1)) as Partial<QueryUnderstanding>;
      const intent: KnowledgeIntent = ['usage', 'workflow', 'troubleshoot', 'engineer'].includes(parsed.intent as string)
        ? (parsed.intent as KnowledgeIntent)
        : 'usage';
      const queries = Array.isArray(parsed.queries)
        ? parsed.queries.map((q) => String(q).trim()).filter(Boolean).slice(0, 3)
        : [];
      const menus = Array.isArray(parsed.menus) ? parsed.menus.map((m) => String(m).trim()).filter(Boolean) : [];
      return { intent, queries: queries.length > 0 ? queries : [userMessage], menus };
    } catch (error: unknown) {
      this.logger.warn(`질의 이해 실패, 원문 폴백: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  /** [2] 질의별 검색 결과를 RRF(1/(k+rank))로 융합한다. 단일 질의 내부 점수 체계는 knowledge.search가 담당. */
  private async searchWithRrf(queries: string[], context?: AiKnowledgeContextDto): Promise<KnowledgeSearchResult[]> {
    const rrf = new Map<string, { chunk: KnowledgeSearchResult; score: number }>();
    for (const query of queries) {
      let rows: KnowledgeSearchResult[] = [];
      try {
        rows = await this.knowledge.search(query, context ?? {}, PER_QUERY_TOP_K);
      } catch (error: unknown) {
        this.logger.warn(`지식 검색 실패(질의 스킵): ${error instanceof Error ? error.message : String(error)}`);
      }
      rows.forEach((row, rank) => {
        const entry = rrf.get(row.chunkId) ?? { chunk: row, score: 0 };
        entry.score += 1 / (RRF_K + rank + 1);
        rrf.set(row.chunkId, entry);
      });
    }
    return Array.from(rrf.values())
      .sort((a, b) => b.score - a.score)
      .map((entry) => ({ ...entry.chunk, score: entry.score }));
  }

  /** [4] LLM 리랭크. 실패 시 RRF 순서 그대로. */
  private async rerank(userMessage: string, candidates: KnowledgeSearchResult[]): Promise<KnowledgeSearchResult[]> {
    if (candidates.length < 2) return candidates;
    const input = candidates.slice(0, RERANK_INPUT_LIMIT);
    try {
      const list = input
        .map((c, i) => `${i + 1}. [${c.title ?? c.menuCode ?? c.docType}] ${c.heading ?? ''} — ${(c.summary ?? c.content).slice(0, 200)}`)
        .join('\n');
      const res = await this.aiService.complete([
        { role: 'system', content: RERANK_PROMPT },
        { role: 'user', content: `## 질문\n${userMessage}\n\n## 후보\n${list}` },
      ]);
      const start = res.indexOf('[');
      const end = res.lastIndexOf(']');
      if (start === -1 || end === -1) return candidates;
      const order = (JSON.parse(res.slice(start, end + 1)) as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= input.length);
      if (order.length === 0) return candidates;
      const picked = order.map((n) => input[n - 1]);
      const rest = input.filter((c) => !picked.includes(c));
      return [...picked, ...rest, ...candidates.slice(RERANK_INPUT_LIMIT)];
    } catch (error: unknown) {
      this.logger.warn(`리랭크 실패, RRF 순서 유지: ${error instanceof Error ? error.message : String(error)}`);
      return candidates;
    }
  }

  private collectMenuCodes(
    fused: KnowledgeSearchResult[],
    understanding: QueryUnderstanding,
    context?: AiKnowledgeContextDto,
  ): string[] {
    const menus = new Set<string>();
    if (context?.menuCode) menus.add(context.menuCode);
    for (const menu of understanding.menus) menus.add(menu);
    for (const chunk of fused.slice(0, 5)) if (chunk.menuCode) menus.add(chunk.menuCode);
    return Array.from(menus);
  }

  private mergeUnique(chunks: KnowledgeSearchResult[]): KnowledgeSearchResult[] {
    const seen = new Set<string>();
    const out: KnowledgeSearchResult[] = [];
    for (const chunk of chunks) {
      if (seen.has(chunk.chunkId)) continue;
      seen.add(chunk.chunkId);
      out.push(chunk);
    }
    return out;
  }

  /** [5] 답변 LLM이 관계를 명시적으로 인지하도록 섹션을 구분해 컨텍스트를 구성한다. */
  private buildStructuredPrompt(
    all: KnowledgeSearchResult[],
    primary: KnowledgeSearchResult[],
    graphChunks: KnowledgeSearchResult[],
    workflowLines: string[],
    troubles: TroubleshootingHit[],
    context?: AiKnowledgeContextDto,
  ): string {
    if (all.length === 0) return '';
    const graphIds = new Set(graphChunks.map((c) => c.chunkId));
    const currentMenu = context?.menuCode;
    const sections: string[] = [];

    const current = primary.filter((c) => !graphIds.has(c.chunkId) && (!currentMenu || c.menuCode === currentMenu || !c.menuCode));
    const related = primary.filter((c) => !graphIds.has(c.chunkId) && currentMenu && c.menuCode && c.menuCode !== currentMenu);
    if (current.length > 0) sections.push(`## 현재 화면/주제 문서\n${this.knowledge.formatContext(current)}`);
    if (workflowLines.length > 0 || graphChunks.length > 0) {
      const parts = [
        workflowLines.length > 0 ? `### 워크플로우 위치\n${workflowLines.join('\n')}` : '',
        graphChunks.length > 0 ? this.knowledge.formatContext(graphChunks) : '',
      ].filter(Boolean);
      sections.push(`## 워크플로우 전후 단계\n${parts.join('\n\n')}`);
    }
    if (troubles.length > 0) {
      const lines = troubles.map(
        (t) => `- 증상: ${t.symptom}\n  원인 후보: ${t.causes.join(' / ') || '-'}\n  조치: ${t.resolutions.join(' / ') || '-'}`,
      );
      sections.push(`## 문제 해결\n${lines.join('\n')}`);
    }
    if (related.length > 0) sections.push(`## 관련 화면 문서\n${this.knowledge.formatContext(related)}`);
    return sections.join('\n\n');
  }
}
