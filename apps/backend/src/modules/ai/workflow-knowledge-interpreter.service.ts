import { Injectable } from '@nestjs/common';
import {
  KNOWLEDGE_RELATION_KINDS,
  searchKnowledge,
  workflowKnowledgeCatalog,
  type KnowledgeNode,
  type KnowledgeRelationKind,
} from '@harness/shared';
import { AiService } from './ai.service';

const SHORTLIST_LIMIT = 12;
const RESULT_LIMIT = 5;
const REASON_LIMIT = 300;
const QUERY_STOP_WORDS = new Set(['어떤', '무엇', '뭐', '쓰나요', '사용하나요', '알려줘', '알려주세요']);
const KOREAN_PARTICLES = ['에서', '으로', '에게', '부터', '까지', '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만'];

export interface WorkflowKnowledgeCandidate {
  nodeId: string;
  reason: string;
  relationKinds: KnowledgeRelationKind[];
}

interface RawWorkflowKnowledgeCandidate {
  nodeId: string;
  reason: string;
  relationKinds: string[];
}

export type WorkflowKnowledgeInterpretResult =
  | { candidates: WorkflowKnowledgeCandidate[]; interpreted: true }
  | { candidates: []; interpreted: false; errorCode: 'AI_UNAVAILABLE' | 'INVALID_RESPONSE' };

@Injectable()
export class WorkflowKnowledgeInterpreterService {
  constructor(private readonly aiService: AiService) {}

  async interpret(query: string): Promise<WorkflowKnowledgeInterpretResult> {
    if (!query.trim()) return { interpreted: true, candidates: [] };
    const shortlist = this.buildShortlist(query).map((node) => ({
      nodeId: node.id,
      title: node.label,
      aliases: node.aliases ?? [],
    }));
    if (shortlist.length === 0) return { interpreted: true, candidates: [] };

    let content: string;
    try {
      content = await this.aiService.complete([
        {
          role: 'system',
          content: [
            'Return strict JSON only in this shape: {"candidates":[{"nodeId":"string","reason":"string","relationKinds":["kind"]}]}.',
            'Choose only nodeId values from candidates and relationKinds from allowedRelationKinds. Never create nodes or relation kinds.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({ query, candidates: shortlist, allowedRelationKinds: KNOWLEDGE_RELATION_KINDS }),
        },
      ]);
    } catch {
      return { interpreted: false, candidates: [], errorCode: 'AI_UNAVAILABLE' };
    }

    const parsed = this.parse(content, new Set(shortlist.map((candidate) => candidate.nodeId)));
    if (!parsed) return { interpreted: false, candidates: [], errorCode: 'INVALID_RESPONSE' };
    return { interpreted: true, candidates: parsed };
  }

  private parse(content: string, allowedNodeIds: ReadonlySet<string>): WorkflowKnowledgeCandidate[] | null {
    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch {
      return null;
    }
    if (!this.isRecord(value) || !Array.isArray(value.candidates)) return null;
    if (!value.candidates.every((candidate): candidate is RawWorkflowKnowledgeCandidate => (
      this.isRecord(candidate)
      && typeof candidate.nodeId === 'string'
      && typeof candidate.reason === 'string'
      && Array.isArray(candidate.relationKinds)
      && candidate.relationKinds.every((kind) => typeof kind === 'string')
    ))) return null;

    const allowedKinds = new Set<string>(KNOWLEDGE_RELATION_KINDS);
    const seenNodeIds = new Set<string>();
    const candidates: WorkflowKnowledgeCandidate[] = [];
    for (const candidate of value.candidates) {
      if (!allowedNodeIds.has(candidate.nodeId)) continue;
      if (seenNodeIds.has(candidate.nodeId)) continue;
      seenNodeIds.add(candidate.nodeId);
      const relationKinds = [...new Set(candidate.relationKinds)].filter(
        (kind): kind is KnowledgeRelationKind => allowedKinds.has(kind),
      );
      candidates.push({
        nodeId: candidate.nodeId,
        reason: candidate.reason.trim().slice(0, REASON_LIMIT),
        relationKinds,
      });
      if (candidates.length >= RESULT_LIMIT) break;
    }
    return candidates;
  }

  private buildShortlist(query: string): KnowledgeNode[] {
    const normalized = query.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}_:/.-]+/gu, ' ').trim();
    if (!normalized) return [];
    const tokens = normalized.split(/\s+/).map((token) => this.stripKoreanParticle(token))
      .filter((token) => token.length >= 2 && !QUERY_STOP_WORDS.has(token));
    const phrases = tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`);
    const terms = [...new Set([normalized, ...phrases, ...tokens])];
    const nodes: KnowledgeNode[] = [];
    const seen = new Set<string>();
    const append = (node: KnowledgeNode) => {
      if (nodes.length < SHORTLIST_LIMIT && !seen.has(node.id)) {
        seen.add(node.id);
        nodes.push(node);
      }
    };
    for (const term of terms) {
      for (const { node } of searchKnowledge(term)) {
        append(node);
        for (const relation of workflowKnowledgeCatalog.relations) {
          if (relation.source !== node.id && relation.target !== node.id) continue;
          const relatedId = relation.source === node.id ? relation.target : relation.source;
          const related = workflowKnowledgeCatalog.nodes.find((item) => item.id === relatedId);
          if (related?.kind === 'data') append(related);
        }
        if (nodes.length >= SHORTLIST_LIMIT) return nodes;
      }
    }
    return nodes;
  }

  private stripKoreanParticle(token: string): string {
    const particle = KOREAN_PARTICLES.find((suffix) => token.length > suffix.length + 1 && token.endsWith(suffix));
    return particle ? token.slice(0, -particle.length) : token;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
