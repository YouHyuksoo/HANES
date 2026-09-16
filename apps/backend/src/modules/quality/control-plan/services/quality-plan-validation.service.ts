import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateRpn, validateQualityPlan, type QualityPlanValidationIssue } from '@harness/shared';
import type { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import {
  CONTROL_PLAN_REQUIRED_FIELDS,
  type ControlPlanRawRow,
  type PfmeaRawRow,
  type ProcessFlowRawRow,
  isQualityPlanDocumentType,
  type QualityPlanRawRowBase,
  type RevisionContextRawRow,
  type ScalarRawRow,
} from '../types/raw-rows';

@Injectable()
export class QualityPlanValidationService {
  constructor(private readonly tx: TransactionService) {}

  async validateRevision(revisionId: number, company: string, plant: string, userId: string) {
    return this.tx.run((qr) => this.validateInTx(qr, revisionId, company, plant, userId));
  }

  async validateInTx(qr: QueryRunner, revisionId: number, company: string, plant: string, userId: string) {
    const contextRows: RevisionContextRawRow[] = await qr.query(
      `SELECT D.PACKAGE_ID,D.DOCUMENT_TYPE,R.REVISION_CODE,R.CHANGE_REASON,R.CHANGE_DESCRIPTION,
              R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID,
              PR.STATUS AS REF_PFD_STATUS,PD.PACKAGE_ID AS REF_PFD_PACKAGE_ID,PD.DOCUMENT_TYPE AS REF_PFD_TYPE,
              FR.STATUS AS REF_PFMEA_STATUS,FD.PACKAGE_ID AS REF_PFMEA_PACKAGE_ID,FD.DOCUMENT_TYPE AS REF_PFMEA_TYPE
         FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
        ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
        LEFT JOIN QUALITY_PLAN_REVISIONS PR ON PR.COMPANY=R.COMPANY AND PR.PLANT_CD=R.PLANT_CD AND PR.REVISION_ID=R.REF_PFD_REVISION_ID
        LEFT JOIN QUALITY_PLAN_DOCUMENTS PD ON PD.COMPANY=PR.COMPANY AND PD.PLANT_CD=PR.PLANT_CD AND PD.DOCUMENT_ID=PR.DOCUMENT_ID
        LEFT JOIN QUALITY_PLAN_REVISIONS FR ON FR.COMPANY=R.COMPANY AND FR.PLANT_CD=R.PLANT_CD AND FR.REVISION_ID=R.REF_PFMEA_REVISION_ID
        LEFT JOIN QUALITY_PLAN_DOCUMENTS FD ON FD.COMPANY=FR.COMPANY AND FD.PLANT_CD=FR.PLANT_CD AND FD.DOCUMENT_ID=FR.DOCUMENT_ID
       WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3`, [revisionId, company, plant],
    );
    if (!contextRows.length) throw new NotFoundException('검증할 Revision을 찾을 수 없습니다.');
    const context = contextRows[0];
    const rawDocumentType = context.DOCUMENT_TYPE ?? context.document_type;
    // 모르는 문서유형을 조용히 CONTROL_PLAN 분기로 흘려보내면 엉뚱한 검증 결과가 발행된다.
    if (!isQualityPlanDocumentType(rawDocumentType)) {
      throw new NotFoundException(`알 수 없는 관리계획 문서유형입니다: ${rawDocumentType ?? '(없음)'}`);
    }
    const documentType = rawDocumentType;
    const pfdRevisionId = documentType === 'PFD' ? revisionId : Number(context.REF_PFD_REVISION_ID ?? 0);
    const pfmeaRevisionId = documentType === 'PFMEA' ? revisionId : documentType === 'CONTROL_PLAN' ? Number(context.REF_PFMEA_REVISION_ID ?? 0) : 0;
    const cpRevisionId = documentType === 'CONTROL_PLAN' ? revisionId : 0;
    const pfdRows: ProcessFlowRawRow[] = pfdRevisionId ? await qr.query(this.revisionRowsSql('QUALITY_PROCESS_FLOW_ROWS'), [pfdRevisionId, company, plant]) : [];
    const pfmeaRows: PfmeaRawRow[] = pfmeaRevisionId ? await qr.query(this.revisionRowsSql('QUALITY_PFMEA_ROWS'), [pfmeaRevisionId, company, plant]) : [];
    const cpRows: ControlPlanRawRow[] = cpRevisionId ? await qr.query(this.revisionRowsSql('QUALITY_CONTROL_PLAN_ROWS'), [cpRevisionId, company, plant]) : [];

    const pfd = pfdRows.map((row) => ({ id: Number(row.ROW_ID), processNo: String(row.PROCESS_NO ?? '') }));
    const pfmea = pfmeaRows.map((row) => ({
      id: Number(row.ROW_ID), processFlowRowId: Number(row.PROCESS_FLOW_ROW_ID),
      specialCharacteristicCode: row.SPECIAL_CHAR_CODE ?? undefined,
    }));
    const cp = cpRows.map((row) => ({
      id: Number(row.ROW_ID), processFlowRowId: Number(row.PROCESS_FLOW_ROW_ID), pfmeaRowId: row.PFMEA_ROW_ID == null ? null : Number(row.PFMEA_ROW_ID),
      sampleSize: row.SAMPLE_SIZE ?? undefined, sampleFrequency: row.SAMPLE_FREQUENCY ?? undefined,
    }));
    let issues = validateQualityPlan({ revisionId, processFlowRows: pfd, pfmeaRows: pfmea, controlPlanRows: cp });
    if (documentType !== 'CONTROL_PLAN') issues = issues.filter((issue) => issue.code !== 'SPECIAL_CHARACTERISTIC_NOT_CONTROLLED');
    const currentRows: QualityPlanRawRowBase[] = documentType === 'PFD' ? pfdRows : documentType === 'PFMEA' ? pfmeaRows : cpRows;
    if (!currentRows.length) issues.push(this.issue('ERROR', 'DOCUMENT_EMPTY', documentType, revisionId, 0, 'rows', '행이 없는 문서는 발행할 수 없습니다.'));
    this.addReferenceIssues(context, documentType, revisionId, issues);
    if (String(context.REVISION_CODE ?? '00') !== '00') {
      if (!String(context.CHANGE_REASON ?? '').trim()) issues.push(this.issue('ERROR', 'REVISION_REASON_REQUIRED', documentType, revisionId, 0, 'changeReason', 'REV.01 이상은 개정사유가 필요합니다.'));
      if (!String(context.CHANGE_DESCRIPTION ?? '').trim()) issues.push(this.issue('ERROR', 'REVISION_DESCRIPTION_REQUIRED', documentType, revisionId, 0, 'changeDescription', 'REV.01 이상은 변경내용이 필요합니다.'));
    }
    this.addDuplicatePfdIssues(pfdRows, revisionId, issues);
    this.addPfmeaIssues(pfmeaRows, revisionId, issues);
    this.addControlPlanIssues(cpRows, revisionId, issues);
    await this.addOldReferenceWarnings(qr, [pfdRevisionId, pfmeaRevisionId].filter(Boolean), company, plant, revisionId, issues);

    const validationId = await this.nextId(qr);
    const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
    const warningCount = issues.length - errorCount;
    await qr.query(
      `INSERT INTO QUALITY_PLAN_VALIDATIONS
       (VALIDATION_ID,REVISION_ID,COMPANY,PLANT_CD,IS_VALID,ERROR_COUNT,WARNING_COUNT,ISSUES_JSON,VALIDATED_BY)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9)`,
      [validationId, revisionId, company, plant, errorCount ? 'N' : 'Y', errorCount, warningCount, JSON.stringify(issues), userId],
    );
    return { valid: errorCount === 0, validationId, errorCount, warningCount, issues };
  }

  private revisionRowsSql(table: string) {
    return `SELECT X.* FROM ${table} X WHERE X.REVISION_ID=:1 AND X.COMPANY=:2 AND X.PLANT_CD=:3 ORDER BY X.ROW_SEQ`;
  }

  private addReferenceIssues(context: RevisionContextRawRow, documentType: 'PFD' | 'PFMEA' | 'CONTROL_PLAN', revisionId: number,
    issues: QualityPlanValidationIssue[]) {
    const references = documentType === 'PFMEA'
      ? [{ id: context.REF_PFD_REVISION_ID, status: context.REF_PFD_STATUS, packageId: context.REF_PFD_PACKAGE_ID, type: context.REF_PFD_TYPE, expectedType: 'PFD', field: 'refPfdRevisionId' }]
      : documentType === 'CONTROL_PLAN'
        ? [
            { id: context.REF_PFD_REVISION_ID, status: context.REF_PFD_STATUS, packageId: context.REF_PFD_PACKAGE_ID, type: context.REF_PFD_TYPE, expectedType: 'PFD', field: 'refPfdRevisionId' },
            { id: context.REF_PFMEA_REVISION_ID, status: context.REF_PFMEA_STATUS, packageId: context.REF_PFMEA_PACKAGE_ID, type: context.REF_PFMEA_TYPE, expectedType: 'PFMEA', field: 'refPfmeaRevisionId' },
          ] : [];
    for (const reference of references) {
      if (!reference.id || !reference.status) {
        issues.push(this.issue('ERROR', 'REFERENCE_REVISION_REQUIRED', documentType, revisionId, 0, reference.field, `${reference.expectedType} 참조 Revision이 필요합니다.`));
        continue;
      }
      if (reference.type !== reference.expectedType) issues.push(this.issue('ERROR', 'REFERENCE_TYPE_MISMATCH', documentType, revisionId, 0, reference.field, `${reference.expectedType} 문서 Revision만 참조할 수 있습니다.`));
      if (Number(reference.packageId) !== Number(context.PACKAGE_ID)) issues.push(this.issue('ERROR', 'REFERENCE_PACKAGE_MISMATCH', documentType, revisionId, 0, reference.field, '같은 문서 묶음의 Revision만 참조할 수 있습니다.'));
      if (!['PUBLISHED', 'SUPERSEDED'].includes(String(reference.status))) issues.push(this.issue('ERROR', 'REFERENCE_REVISION_MUTABLE', documentType, revisionId, 0, reference.field, '발행되어 변경할 수 없는 상위 Revision만 참조할 수 있습니다.'));
    }
  }

  private async addOldReferenceWarnings(qr: QueryRunner, referenceIds: number[], company: string, plant: string, revisionId: number,
    issues: QualityPlanValidationIssue[]) {
    for (const referenceId of referenceIds) {
      const rows: ScalarRawRow[] = await qr.query(
        `SELECT COUNT(*) AS "CNT" FROM QUALITY_PLAN_REVISIONS REF JOIN QUALITY_PLAN_REVISIONS NEWER
           ON NEWER.COMPANY=REF.COMPANY AND NEWER.PLANT_CD=REF.PLANT_CD AND NEWER.DOCUMENT_ID=REF.DOCUMENT_ID
          WHERE REF.REVISION_ID=:1 AND REF.COMPANY=:2 AND REF.PLANT_CD=:3
            AND NEWER.STATUS='PUBLISHED' AND NEWER.REVISION_CODE>REF.REVISION_CODE`, [referenceId, company, plant],
      );
      if (Number(rows[0]?.CNT ?? 0) > 0) issues.push(this.issue('WARNING', 'OLD_REFERENCE_REVISION', 'CONTROL_PLAN', revisionId, 0, 'referenceRevision', '참조 문서에 더 최신 발행 Revision이 있습니다.'));
    }
  }

  private addDuplicatePfdIssues(rows: ProcessFlowRawRow[], revisionId: number, issues: QualityPlanValidationIssue[]) {
    const seen = new Set<string>();
    for (const row of rows) {
      const processNo = String(row.PROCESS_NO ?? '');
      if (seen.has(processNo)) issues.push(this.issue('ERROR', 'PFD_PROCESS_DUPLICATE', 'PFD', revisionId, row.ROW_ID, 'processNo', 'PFD 공정번호가 중복되었습니다.'));
      seen.add(processNo);
    }
  }

  private addPfmeaIssues(rows: PfmeaRawRow[], revisionId: number, issues: QualityPlanValidationIssue[]) {
    for (const row of rows) {
      const expected = calculateRpn(Number(row.SEVERITY), Number(row.OCCURRENCE), Number(row.DETECTION));
      if (expected !== Number(row.RPN)) issues.push(this.issue('ERROR', 'PFMEA_RPN_MISMATCH', 'PFMEA', revisionId, row.ROW_ID, 'rpn', 'PFMEA RPN 계산값이 일치하지 않습니다.'));
      if (expected >= 100 && !String(row.RECOMMENDED_ACTION ?? '').trim()) {
        issues.push(this.issue('WARNING', 'PFMEA_HIGH_RPN_NO_ACTION', 'PFMEA', revisionId, row.ROW_ID, 'recommendedAction', 'RPN 100 이상 항목에 권고조치가 없습니다.'));
      }
    }
  }

  private addControlPlanIssues(rows: ControlPlanRawRow[], revisionId: number, issues: QualityPlanValidationIssue[]) {
    for (const row of rows) {
      for (const field of CONTROL_PLAN_REQUIRED_FIELDS) if (!String(row[field] ?? '').trim()) {
        issues.push(this.issue('ERROR', 'CP_REQUIRED_FIELD_MISSING', 'CONTROL_PLAN', revisionId, row.ROW_ID, field.toLowerCase(), 'Control Plan 필수 관리정보가 누락되었습니다.'));
      }
      if ((row.EQUIPMENT_CODE || row.EVALUATION_METHOD) && row.CALIBRATION_CONFIRMED !== 'Y') {
        issues.push(this.issue('WARNING', 'MEASUREMENT_SYSTEM_NOT_CONFIRMED', 'CONTROL_PLAN', revisionId, row.ROW_ID, 'evaluationMethod', '측정장비 검교정 또는 MSA 확인이 필요합니다.'));
      }
    }
  }

  private issue(severity: 'ERROR' | 'WARNING', code: string, documentType: 'PFD' | 'PFMEA' | 'CONTROL_PLAN', revisionId: number,
    rowId: number, field: string, message: string): QualityPlanValidationIssue {
    return { severity, code, documentType, revisionId, rowId: Number(rowId), field, message };
  }

  private async nextId(qr: QueryRunner) {
    const rows: ScalarRawRow[] = await qr.query('SELECT SEQ_QUALITY_PLAN_VALIDATION.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
    return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq);
  }
}
