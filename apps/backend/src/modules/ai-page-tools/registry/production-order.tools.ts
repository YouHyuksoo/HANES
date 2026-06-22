import { AiPageToolManifest } from '../types';

export const PRODUCTION_ORDER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'production.order',
  route: '/production/order',
  title: '작업지시관리',
  executionLevel: 'draft-only',
  tools: [
    {
      name: 'resolveItemCandidates',
      label: '품목 후보 조회',
      description: '품목코드, 품목명, 차종, 고객품번으로 작업지시 대상 품목 후보를 조회한다.',
      riskLevel: 'read',
      source: 'backend',
      inputSchema: {
        query: { type: 'string', required: true },
      },
      outputSchema: {
        candidates: 'ItemCandidate[]',
      },
      confirmationPolicy: 'multiple_candidates_require_user_selection',
    },
    {
      name: 'resolveLineCandidates',
      label: '라인 후보 조회',
      description: '작업지시에 지정할 생산 라인 후보를 조회한다.',
      riskLevel: 'read',
      source: 'backend',
      inputSchema: {
        query: { type: 'string', required: false },
      },
      outputSchema: {
        candidates: 'LineCandidate[]',
      },
      confirmationPolicy: 'multiple_candidates_require_user_selection',
    },
    {
      name: 'resolveProcessCandidates',
      label: '공정 후보 조회',
      description: '작업지시에 지정할 공정 후보를 조회한다.',
      riskLevel: 'read',
      source: 'backend',
      inputSchema: {
        query: { type: 'string', required: false },
      },
      outputSchema: {
        candidates: 'ProcessCandidate[]',
      },
      confirmationPolicy: 'multiple_candidates_require_user_selection',
    },
    {
      name: 'resolveEquipmentCandidates',
      label: '설비 후보 조회',
      description: '선택 공정에 매핑된 설비 후보를 조회한다.',
      riskLevel: 'read',
      source: 'backend',
      inputSchema: {
        processCode: { type: 'string', required: true },
        query: { type: 'string', required: false },
      },
      outputSchema: {
        candidates: 'EquipmentCandidate[]',
      },
      confirmationPolicy: 'multiple_candidates_require_user_selection',
    },
    {
      name: 'buildJobOrderDraft',
      label: '작업지시 초안 생성',
      description: '확정된 기준정보와 자연어 요청을 작업지시 초안으로 정리한다.',
      riskLevel: 'propose',
      source: 'frontend',
      neverPersists: true,
      requiresConfirmation: true,
    },
    {
      name: 'applyJobOrderDraft',
      label: '작업지시 초안 화면 적용',
      description: '확정된 작업지시 초안을 우측 등록 패널에 입력한다.',
      riskLevel: 'draft',
      source: 'frontend',
      neverPersists: true,
      requiresConfirmation: true,
    },
  ],
};
