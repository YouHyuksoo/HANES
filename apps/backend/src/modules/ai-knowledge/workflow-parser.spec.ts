/**
 * @file src/modules/ai-knowledge/workflow-parser.spec.ts
 * @description docs/workflows/*.md frontmatter 파싱/검증 단위 테스트
 */
import { parseWorkflowDoc } from './workflow-parser';

const VALID_DOC = `---
workflowId: PROD_FLOW
title: 생산계획→작업지시→투입→입고 흐름
steps:
  - menu: PROD_PLAN
  - menu: JOB_ORDER
    requires: [PROD_PLAN]
    transitions: "WAITING→RUNNING"
  - menu: PROD_INPUT_KIOSK
    requires: [JOB_ORDER=RUNNING]
    produces: [FG_LABEL]
  - menu: FG_RECEIVE
    requires: [FG_LABEL, BOX_NO]
troubleshooting:
  - symptom: "라벨 발행이 안 됨"
    causes: [JOB_ORDER 상태가 RUNNING 아님, BOM 미등록]
    resolutions: [작업지시 화면에서 상태 확인]
relatedWorkflows: [QC_FLOW]
---
## 단계별 설명
본문입니다.
`;

describe('parseWorkflowDoc', () => {
  it('정상 문서를 파싱해 steps/troubleshooting/related를 구조화한다', () => {
    const { doc, errors } = parseWorkflowDoc(VALID_DOC, 'docs/workflows/production.md');
    expect(errors).toEqual([]);
    expect(doc?.workflowId).toBe('PROD_FLOW');
    expect(doc?.steps).toHaveLength(4);
    expect(doc?.steps[1]).toEqual({
      menu: 'JOB_ORDER',
      requires: ['PROD_PLAN'],
      transitions: 'WAITING→RUNNING',
      produces: [],
    });
    expect(doc?.steps[2].produces).toEqual(['FG_LABEL']);
    expect(doc?.troubleshooting[0].symptom).toBe('라벨 발행이 안 됨');
    expect(doc?.troubleshooting[0].causes).toHaveLength(2);
    expect(doc?.relatedWorkflows).toEqual(['QC_FLOW']);
    expect(doc?.body).toContain('단계별 설명');
  });

  it('workflowId 누락 시 doc=null과 오류를 반환한다', () => {
    const raw = VALID_DOC.replace('workflowId: PROD_FLOW\n', '');
    const { doc, errors } = parseWorkflowDoc(raw, 'docs/workflows/production.md');
    expect(doc).toBeNull();
    expect(errors.some((e) => e.includes('workflowId'))).toBe(true);
  });

  it('steps가 비어 있으면 오류를 반환한다', () => {
    const raw = `---\nworkflowId: X_FLOW\ntitle: 제목\nsteps: []\n---\n본문`;
    const { doc, errors } = parseWorkflowDoc(raw, 'docs/workflows/x.md');
    expect(doc).toBeNull();
    expect(errors.some((e) => e.includes('steps'))).toBe(true);
  });

  it('frontmatter가 없으면 오류를 반환한다', () => {
    const { doc, errors } = parseWorkflowDoc('# 그냥 마크다운', 'docs/workflows/y.md');
    expect(doc).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
