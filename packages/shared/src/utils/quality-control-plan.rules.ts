import type { QualityPlanValidationIssue } from '../types/quality-control-plan';

export interface QualityPlanRulePfdRow {
  id: number;
  processNo: string;
}

export interface QualityPlanRulePfmeaRow {
  id: number;
  processFlowRowId: number;
  specialCharacteristicCode?: string | null;
}

export interface QualityPlanRuleControlPlanRow {
  id: number;
  processFlowRowId: number;
  pfmeaRowId?: number | null;
  sampleSize?: string | null;
  sampleFrequency?: string | null;
}

export interface QualityPlanRuleInput {
  revisionId?: number | null;
  processFlowRows: QualityPlanRulePfdRow[];
  pfmeaRows: QualityPlanRulePfmeaRow[];
  controlPlanRows: QualityPlanRuleControlPlanRow[];
}

export function calculateRpn(severity: number, occurrence: number, detection: number): number {
  return severity * occurrence * detection;
}

export function nextRevisionCode(currentRevisionCode: string): string {
  if (!/^\d+$/.test(currentRevisionCode)) {
    throw new Error('Revision 코드는 숫자 형식이어야 합니다.');
  }

  const next = Number.parseInt(currentRevisionCode, 10) + 1;
  return String(next).padStart(Math.max(2, currentRevisionCode.length), '0');
}

function issue(
  code: string,
  documentType: QualityPlanValidationIssue['documentType'],
  revisionId: number | null,
  rowId: number,
  field: string,
  message: string,
): QualityPlanValidationIssue {
  return { severity: 'ERROR', code, documentType, revisionId, rowId, field, message };
}

function isHundredPercent(sampleSize?: string | null): boolean {
  return sampleSize?.replace(/\s/g, '').toUpperCase() === '100%';
}

export function validateQualityPlan(input: QualityPlanRuleInput): QualityPlanValidationIssue[] {
  const revisionId = input.revisionId ?? null;
  const pfdIds = new Set(input.processFlowRows.map((row) => row.id));
  const pfmeaIds = new Set(input.pfmeaRows.map((row) => row.id));
  const issues: QualityPlanValidationIssue[] = [];

  for (const row of input.pfmeaRows) {
    if (!pfdIds.has(row.processFlowRowId)) {
      issues.push(issue(
        'PFMEA_PROCESS_NOT_IN_PFD',
        'PFMEA',
        revisionId,
        row.id,
        'processFlowRowId',
        'PFMEA가 참조한 공정이 PFD에 없습니다.',
      ));
    }

    if (row.specialCharacteristicCode) {
      const controlled = input.controlPlanRows.some((controlRow) => controlRow.pfmeaRowId === row.id);
      if (!controlled) {
        issues.push(issue(
          'SPECIAL_CHARACTERISTIC_NOT_CONTROLLED',
          'CONTROL_PLAN',
          revisionId,
          row.id,
          'pfmeaRowId',
          '특별특성 PFMEA 항목이 Control Plan에 연결되지 않았습니다.',
        ));
      }
    }
  }

  for (const row of input.controlPlanRows) {
    if (!pfdIds.has(row.processFlowRowId)) {
      issues.push(issue(
        'CP_PROCESS_NOT_IN_PFD',
        'CONTROL_PLAN',
        revisionId,
        row.id,
        'processFlowRowId',
        'Control Plan이 참조한 공정이 PFD에 없습니다.',
      ));
    }

    if (row.pfmeaRowId != null && !pfmeaIds.has(row.pfmeaRowId)) {
      issues.push(issue(
        'CONTROL_PLAN_PFMEA_REFERENCE_MISMATCH',
        'CONTROL_PLAN',
        revisionId,
        row.id,
        'pfmeaRowId',
        'Control Plan이 참조한 PFMEA 항목이 현재 PFMEA Revision에 없습니다.',
      ));
    }

    if (isHundredPercent(row.sampleSize) && row.sampleFrequency?.trim()) {
      issues.push(issue(
        'CP_FREQUENCY_WITH_100_PERCENT',
        'CONTROL_PLAN',
        revisionId,
        row.id,
        'sampleFrequency',
        '100% 검사에는 별도 검사주기를 입력할 수 없습니다.',
      ));
    }
  }

  return issues;
}
