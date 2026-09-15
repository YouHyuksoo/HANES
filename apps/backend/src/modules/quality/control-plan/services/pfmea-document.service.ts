import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculateRpn } from '@harness/shared';
import type { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import type { CreatePfmeaRowDto, UpdatePfmeaRowDto } from '../dto/pfmea.dto';

@Injectable()
export class PfmeaDocumentService {
  constructor(private readonly tx: TransactionService) {}

  async findRows(revisionId: number, company: string, plant: string) {
    return this.tx.run((qr) => qr.query(
      `SELECT F.*, P.PROCESS_NO, P.PROCESS_CODE, P.PROCESS_NAME
         FROM QUALITY_PFMEA_ROWS F JOIN QUALITY_PROCESS_FLOW_ROWS P
           ON P.COMPANY=F.COMPANY AND P.PLANT_CD=F.PLANT_CD AND P.ROW_ID=F.PROCESS_FLOW_ROW_ID
        WHERE F.REVISION_ID=:1 AND F.COMPANY=:2 AND F.PLANT_CD=:3 ORDER BY F.ROW_SEQ`, [revisionId, company, plant],
    ));
  }

  async createRow(revisionId: number, dto: CreatePfmeaRowDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const revision = await this.getDraftRevision(qr, revisionId, company, plant);
      this.validateRanks(dto);
      if (!revision.REF_PFD_REVISION_ID) throw new BadRequestException('PFMEA에 참조 PFD Revision을 먼저 지정하세요.');
      const pfdRows = await qr.query(
        `SELECT ROW_ID FROM QUALITY_PROCESS_FLOW_ROWS WHERE ROW_ID=:1 AND REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`,
        [dto.processFlowRowId, revision.REF_PFD_REVISION_ID, company, plant],
      );
      if (!pfdRows.length) throw new NotFoundException('고정된 PFD Revision에서 공정 행을 찾을 수 없습니다.');
      if (dto.specialCharacteristicCode) await this.assertCode(qr, 'QC_SPECIAL_CHAR', dto.specialCharacteristicCode, company, plant);
      const rowId = await this.nextId(qr);
      const rowSeqRows = await qr.query(
        `SELECT NVL(MAX(ROW_SEQ),0)+1 AS "NEXT_ROW_SEQ" FROM QUALITY_PFMEA_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`,
        [revisionId, company, plant],
      );
      const rowSeq = Number(rowSeqRows[0]?.NEXT_ROW_SEQ ?? rowSeqRows[0]?.next_row_seq ?? 1);
      const rpn = calculateRpn(dto.severity, dto.occurrence, dto.detection);
      const actionRpn = dto.actionSeverity && dto.actionOccurrence && dto.actionDetection
        ? calculateRpn(dto.actionSeverity, dto.actionOccurrence, dto.actionDetection) : null;
      await qr.query(
        `INSERT INTO QUALITY_PFMEA_ROWS
         (ROW_ID,REVISION_ID,ROW_SEQ,COMPANY,PLANT_CD,PROCESS_FLOW_ROW_ID,PROCESS_FUNCTION,REQUIREMENT,FAILURE_MODE,FAILURE_EFFECT,
          SEVERITY,SPECIAL_CHAR_CODE,FAILURE_CAUSE,PREVENTION_CONTROL,OCCURRENCE,DETECTION_CONTROL,DETECTION,RPN,
          RECOMMENDED_ACTION,RESPONSIBLE_ORG,RESPONSIBLE_PERSON,TARGET_DATE,COMPLETED_ACTION,COMPLETION_DATE,
          ACTION_SEVERITY,ACTION_OCCURRENCE,ACTION_DETECTION,ACTION_RPN,CREATED_BY,UPDATED_BY)
         VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,:20,:21,
                 TO_DATE(:22,'YYYY-MM-DD'),:23,TO_DATE(:24,'YYYY-MM-DD'),:25,:26,:27,:28,:29,:30)`,
        [rowId,revisionId,rowSeq,company,plant,dto.processFlowRowId,dto.processFunction,dto.requirement,dto.potentialFailureMode,
          dto.potentialFailureEffect,dto.severity,dto.specialCharacteristicCode ?? null,dto.potentialCause,dto.preventionControl ?? null,
          dto.occurrence,dto.detectionControl ?? null,dto.detection,rpn,dto.recommendedAction ?? null,dto.responsibleOrganization ?? null,
          dto.responsiblePerson ?? null,dto.targetDate ?? null,dto.completedAction ?? null,dto.completionDate ?? null,
          dto.actionSeverity ?? null,dto.actionOccurrence ?? null,dto.actionDetection ?? null,actionRpn,userId,userId],
      );
      return { rowId, revisionId, rowSeq, ...dto, rpn, actionRpn };
    });
  }

  async updateRow(rowId: number, dto: UpdatePfmeaRowDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const current = await this.getDraftRow(qr, rowId, company, plant);
      if (dto.processFlowRowId != null && Number(dto.processFlowRowId) !== Number(current.PROCESS_FLOW_ROW_ID)) {
        const pfdRows = await qr.query(
          `SELECT ROW_ID FROM QUALITY_PROCESS_FLOW_ROWS WHERE ROW_ID=:1 AND REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`,
          [dto.processFlowRowId, current.REF_PFD_REVISION_ID, company, plant],
        );
        if (!pfdRows.length) throw new NotFoundException('고정된 PFD Revision에서 공정 행을 찾을 수 없습니다.');
        await qr.query(
          `UPDATE QUALITY_PFMEA_ROWS SET PROCESS_FLOW_ROW_ID=:1,UPDATED_BY=:2,UPDATED_AT=SYSTIMESTAMP
            WHERE ROW_ID=:3 AND COMPANY=:4 AND PLANT_CD=:5`,
          [dto.processFlowRowId, userId, rowId, company, plant],
        );
      }
      const merged = {
        severity: dto.severity ?? Number(current.SEVERITY), occurrence: dto.occurrence ?? Number(current.OCCURRENCE),
        detection: dto.detection ?? Number(current.DETECTION), actionSeverity: dto.actionSeverity ?? current.ACTION_SEVERITY,
        actionOccurrence: dto.actionOccurrence ?? current.ACTION_OCCURRENCE, actionDetection: dto.actionDetection ?? current.ACTION_DETECTION,
      };
      this.validateRanks(merged as CreatePfmeaRowDto);
      if (dto.specialCharacteristicCode) await this.assertCode(qr, 'QC_SPECIAL_CHAR', dto.specialCharacteristicCode, company, plant);
      const rpn = calculateRpn(merged.severity, merged.occurrence, merged.detection);
      const actionRpn = merged.actionSeverity && merged.actionOccurrence && merged.actionDetection
        ? calculateRpn(Number(merged.actionSeverity), Number(merged.actionOccurrence), Number(merged.actionDetection)) : null;
      await qr.query(
        `UPDATE QUALITY_PFMEA_ROWS SET
          PROCESS_FUNCTION=COALESCE(:1,PROCESS_FUNCTION), REQUIREMENT=COALESCE(:2,REQUIREMENT),
          FAILURE_MODE=COALESCE(:3,FAILURE_MODE), FAILURE_EFFECT=COALESCE(:4,FAILURE_EFFECT), SEVERITY=:5,
          SPECIAL_CHAR_CODE=COALESCE(:6,SPECIAL_CHAR_CODE), FAILURE_CAUSE=COALESCE(:7,FAILURE_CAUSE),
          PREVENTION_CONTROL=COALESCE(:8,PREVENTION_CONTROL), OCCURRENCE=:9,
          DETECTION_CONTROL=COALESCE(:10,DETECTION_CONTROL), DETECTION=:11, RPN=:12,
          RECOMMENDED_ACTION=COALESCE(:13,RECOMMENDED_ACTION), RESPONSIBLE_ORG=COALESCE(:14,RESPONSIBLE_ORG),
          RESPONSIBLE_PERSON=COALESCE(:15,RESPONSIBLE_PERSON), TARGET_DATE=COALESCE(TO_DATE(:16,'YYYY-MM-DD'),TARGET_DATE),
          COMPLETED_ACTION=COALESCE(:17,COMPLETED_ACTION), COMPLETION_DATE=COALESCE(TO_DATE(:18,'YYYY-MM-DD'),COMPLETION_DATE),
          ACTION_SEVERITY=:19,ACTION_OCCURRENCE=:20,ACTION_DETECTION=:21,ACTION_RPN=:22,UPDATED_BY=:23,UPDATED_AT=SYSTIMESTAMP
         WHERE ROW_ID=:24 AND COMPANY=:25 AND PLANT_CD=:26`,
        [dto.processFunction ?? null,dto.requirement ?? null,dto.potentialFailureMode ?? null,dto.potentialFailureEffect ?? null,
          merged.severity,dto.specialCharacteristicCode ?? null,dto.potentialCause ?? null,dto.preventionControl ?? null,
          merged.occurrence,dto.detectionControl ?? null,merged.detection,rpn,dto.recommendedAction ?? null,
          dto.responsibleOrganization ?? null,dto.responsiblePerson ?? null,dto.targetDate ?? null,dto.completedAction ?? null,
          dto.completionDate ?? null,merged.actionSeverity ?? null,merged.actionOccurrence ?? null,merged.actionDetection ?? null,
          actionRpn,userId,rowId,company,plant],
      );
      return { rowId, rpn, actionRpn };
    });
  }

  async deleteRow(rowId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      await this.getDraftRow(qr, rowId, company, plant);
      const links = await qr.query(`SELECT COUNT(*) AS "CNT" FROM QUALITY_CONTROL_PLAN_ROWS WHERE PFMEA_ROW_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [rowId, company, plant]);
      if (Number(links[0]?.CNT ?? 0) > 0) throw new BadRequestException('Control Plan에서 참조 중인 PFMEA 행은 삭제할 수 없습니다.');
      await qr.query(`DELETE FROM QUALITY_PFMEA_ROWS WHERE ROW_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [rowId, company, plant]);
      return { rowId };
    });
  }

  private async getDraftRevision(qr: QueryRunner, revisionId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT R.STATUS, R.REF_PFD_REVISION_ID, D.DOCUMENT_TYPE, D.PACKAGE_ID
         FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
           ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
        WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3 FOR UPDATE`, [revisionId, company, plant],
    );
    if (!rows.length) throw new NotFoundException('PFMEA Revision을 찾을 수 없습니다.');
    if (rows[0].STATUS !== 'DRAFT' || rows[0].DOCUMENT_TYPE !== 'PFMEA') throw new BadRequestException('DRAFT PFMEA에서만 행을 변경할 수 있습니다.');
    return rows[0];
  }

  private async getDraftRow(qr: QueryRunner, rowId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT F.*,R.REF_PFD_REVISION_ID FROM QUALITY_PFMEA_ROWS F JOIN QUALITY_PLAN_REVISIONS R
         ON R.COMPANY=F.COMPANY AND R.PLANT_CD=F.PLANT_CD AND R.REVISION_ID=F.REVISION_ID
        WHERE F.ROW_ID=:1 AND F.COMPANY=:2 AND F.PLANT_CD=:3 AND R.STATUS='DRAFT' FOR UPDATE`, [rowId, company, plant],
    );
    if (!rows.length) throw new BadRequestException('DRAFT PFMEA 행만 변경할 수 있습니다.');
    return rows[0];
  }

  private validateRanks(dto: CreatePfmeaRowDto) {
    const ranks = [dto.severity, dto.occurrence, dto.detection, dto.actionSeverity, dto.actionOccurrence, dto.actionDetection]
      .filter((value): value is number => value != null);
    if (ranks.some((value) => !Number.isInteger(value) || value < 1 || value > 10)) throw new BadRequestException('PFMEA 등급은 1~10 정수여야 합니다.');
  }

  private async assertCode(qr: QueryRunner, group: string, code: string, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT DETAIL_CODE FROM COM_CODES WHERE COMPANY=:1 AND PLANT_CD=:2 AND GROUP_CODE=:3 AND DETAIL_CODE=:4 AND USE_YN='Y'`,
      [company, plant, group, code],
    );
    if (!rows.length) throw new BadRequestException('등록되지 않은 특별특성 코드입니다.');
  }

  private async nextId(qr: QueryRunner) {
    const rows = await qr.query('SELECT SEQ_QUALITY_PFMEA_ROW.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
    return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq);
  }
}
