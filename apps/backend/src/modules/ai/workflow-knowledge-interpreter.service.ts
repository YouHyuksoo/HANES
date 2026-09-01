import { Injectable } from '@nestjs/common';
import {
  KNOWLEDGE_RELATION_KINDS,
  searchKnowledge,
  type KnowledgeRelationKind,
} from '@harness/shared';
import { AiService } from './ai.service';

const SHORTLIST_LIMIT = 12;
const REASON_LIMIT = 300;

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
    const shortlist = searchKnowledge(query).slice(0, SHORTLIST_LIMIT).map(({ node }) => ({
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
    return value.candidates.flatMap((candidate): WorkflowKnowledgeCandidate[] => {
      if (!allowedNodeIds.has(candidate.nodeId)) return [];
      const relationKinds = candidate.relationKinds.filter(
        (kind): kind is KnowledgeRelationKind => allowedKinds.has(kind),
      );
      return [{
        nodeId: candidate.nodeId,
        reason: candidate.reason.trim().slice(0, REASON_LIMIT),
        relationKinds,
      }];
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
