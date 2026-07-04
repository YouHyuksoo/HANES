/**
 * @file src/modules/ai-knowledge/workflow-parser.ts
 * @description docs/workflows/*.md 워크플로우 정의 문서 파서. frontmatter(YAML)를 그래프 구조로 검증/변환한다.
 */
import { parse as parseYaml } from 'yaml';

export interface WorkflowStep {
  menu: string;
  requires: string[];
  transitions?: string;
  produces: string[];
}

export interface WorkflowTrouble {
  symptom: string;
  causes: string[];
  resolutions: string[];
}

export interface WorkflowDoc {
  workflowId: string;
  title: string;
  steps: WorkflowStep[];
  troubleshooting: WorkflowTrouble[];
  relatedWorkflows: string[];
  sourcePath: string;
  body: string;
}

export interface WorkflowParseResult {
  doc: WorkflowDoc | null;
  errors: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function parseWorkflowDoc(raw: string, sourcePath: string): WorkflowParseResult {
  const errors: string[] = [];
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { doc: null, errors: [`${sourcePath}: frontmatter(---)가 없습니다.`] };
  }

  let meta: Record<string, unknown>;
  try {
    const parsed = parseYaml(match[1]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { doc: null, errors: [`${sourcePath}: frontmatter가 객체가 아닙니다.`] };
    }
    meta = parsed as Record<string, unknown>;
  } catch (error: unknown) {
    return { doc: null, errors: [`${sourcePath}: YAML 파싱 실패 — ${error instanceof Error ? error.message : String(error)}`] };
  }

  const workflowId = typeof meta.workflowId === 'string' ? meta.workflowId.trim() : '';
  if (!workflowId) errors.push(`${sourcePath}: workflowId가 필요합니다.`);
  else if (!/^[A-Z][A-Z0-9_]*$/.test(workflowId)) errors.push(`${sourcePath}: workflowId는 대문자 스네이크여야 합니다: ${workflowId}`);

  const title = typeof meta.title === 'string' ? meta.title.trim() : '';
  if (!title) errors.push(`${sourcePath}: title이 필요합니다.`);

  const rawSteps = Array.isArray(meta.steps) ? meta.steps : [];
  const steps: WorkflowStep[] = [];
  rawSteps.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`${sourcePath}: steps[${index}]가 객체가 아닙니다.`);
      return;
    }
    const step = entry as Record<string, unknown>;
    const menu = typeof step.menu === 'string' ? step.menu.trim() : '';
    if (!menu) {
      errors.push(`${sourcePath}: steps[${index}].menu가 필요합니다.`);
      return;
    }
    steps.push({
      menu,
      requires: toStringArray(step.requires),
      transitions: typeof step.transitions === 'string' && step.transitions.trim() ? step.transitions.trim() : undefined,
      produces: toStringArray(step.produces),
    });
  });
  if (steps.length === 0) errors.push(`${sourcePath}: steps에 최소 1개 단계가 필요합니다.`);

  const rawTroubles = Array.isArray(meta.troubleshooting) ? meta.troubleshooting : [];
  const troubleshooting: WorkflowTrouble[] = [];
  rawTroubles.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`${sourcePath}: troubleshooting[${index}]가 객체가 아닙니다.`);
      return;
    }
    const trouble = entry as Record<string, unknown>;
    const symptom = typeof trouble.symptom === 'string' ? trouble.symptom.trim() : '';
    if (!symptom) {
      errors.push(`${sourcePath}: troubleshooting[${index}].symptom이 필요합니다.`);
      return;
    }
    troubleshooting.push({
      symptom,
      causes: toStringArray(trouble.causes),
      resolutions: toStringArray(trouble.resolutions),
    });
  });

  if (errors.length > 0) return { doc: null, errors };

  return {
    doc: {
      workflowId,
      title,
      steps,
      troubleshooting,
      relatedWorkflows: toStringArray(meta.relatedWorkflows),
      sourcePath: sourcePath.replace(/\\/g, '/'),
      body: (match[2] ?? '').trim(),
    },
    errors,
  };
}
