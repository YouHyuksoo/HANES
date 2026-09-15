import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { validateQualityPlan } from '@harness/shared';
import type { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import type { CreateControlPlanRowDto, UpdateControlPlanRowDto } from '../dto/control-plan-row.dto';

@Injectable()
export class ControlPlanDocumentService {
  constructor(private readonly tx: TransactionService) {}

  async findRows(revisionId: number, company: string, plant: string) {
    return this.tx.run((qr) => qr.query(
      `SELECT C.* FROM QUALITY_CONTROL_PLAN_ROWS C WHERE C.REVISION_ID=:1 AND C.COMPANY=:2 AND C.PLANT_CD=:3 ORDER BY C.ROW_SEQ`,
      [revisionId, company, plant],
    ));
  }

  async createRow(revisionId: number, dto: CreateControlPlanRowDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const revision = await this.getDraftRevision(qr, revisionId, company, plant);
      if (!revision.REF_PFD_REVISION_ID) throw new BadRequestException('Control Plan에 참조 PFD Revision을 지정하세요.');
      const pfdRows = await qr.query(
        `SELECT ROW_ID, PROCESS_NO, PROCESS_CODE, PROCESS_NAME, EQUIPMENT_CODE, EQUIPMENT_NAME
           FROM QUALITY_PROCESS_FLOW_ROWS WHERE ROW_ID=:1 AND REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`,
        [dto.processFlowRowId, revision.REF_PFD_REVISION_ID, company, plant],
      );
      if (!pfdRows.length) throw new NotFoundException('고정 PFD Revision에서 공정을 찾을 수 없습니다.');
      const pfd = pfdRows[0];
      let selectedPfmeaRows: Array<{ ROW_ID: number; PROCESS_FLOW_ROW_ID: number }> = [];
      if (dto.pfmeaRowId) {
        if (!revision.REF_PFMEA_REVISION_ID) throw new BadRequestException('참조 PFMEA Revision을 지정하세요.');
        const pfmeaRows = await qr.query(
          `SELECT ROW_ID, PROCESS_FLOW_ROW_ID FROM QUALITY_PFMEA_ROWS
            WHERE ROW_ID=:1 AND REVISION_ID=:2 AND PROCESS_FLOW_ROW_ID=:3 AND COMPANY=:4 AND PLANT_CD=:5`,
          [dto.pfmeaRowId, revision.REF_PFMEA_REVISION_ID, dto.processFlowRowId, company, plant],
        );
        if (!pfmeaRows.length) throw new NotFoundException('고정 PFMEA Revision에서 연결 항목을 찾을 수 없습니다.');
        selectedPfmeaRows = pfmeaRows;
      }
      const issues = validateQualityPlan({
        revisionId, processFlowRows: [{ id: dto.processFlowRowId, processNo: pfd.PROCESS_NO }],
        pfmeaRows: selectedPfmeaRows.map((row) => ({ id: Number(row.ROW_ID), processFlowRowId: Number(row.PROCESS_FLOW_ROW_ID) })),
        controlPlanRows: [{ id: 0, processFlowRowId: dto.processFlowRowId, pfmeaRowId: dto.pfmeaRowId,
          sampleSize: dto.sampleSize, sampleFrequency: dto.sampleFrequency }],
      });
      if (issues.length) throw new BadRequestException(issues[0].message);
      if (dto.specialCharacteristicCode) await this.assertSpecialCode(qr, dto.specialCharacteristicCode, company, plant);
      const idRows = await qr.query('SELECT SEQ_QUALITY_CONTROL_PLAN_ROW.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
      const rowId = Number(idRows[0]?.NEXT_SEQ ?? idRows[0]?.next_seq);
      const seqRows = await qr.query(
        `SELECT NVL(MAX(ROW_SEQ),0)+1 AS "NEXT_ROW_SEQ" FROM QUALITY_CONTROL_PLAN_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`,
        [revisionId, company, plant],
      );
      const rowSeq = Number(seqRows[0]?.NEXT_ROW_SEQ ?? seqRows[0]?.next_row_seq ?? 1);
      const processNo = pfd.PROCESS_NO ?? pfd.process_no;
      const processName = pfd.PROCESS_NAME ?? pfd.process_name;
      await qr.query(
        `INSERT INTO QUALITY_CONTROL_PLAN_ROWS
         (ROW_ID,REVISION_ID,ROW_SEQ,COMPANY,PLANT_CD,PROCESS_FLOW_ROW_ID,PFMEA_ROW_ID,PROCESS_NO,PROCESS_NAME,
          EQUIPMENT_CODE,EQUIPMENT_NAME,CHARACTERISTIC_NO,PRODUCT_CHARACTERISTIC,PROCESS_CHARACTERISTIC,SPECIAL_CHAR_CODE,
          SPECIFICATION,EVALUATION_METHOD,SAMPLE_SIZE,SAMPLE_FREQUENCY,CONTROL_METHOD,RESPONSIBLE_ROLE,REACTION_PLAN,
          RECORD_FORM,CREATED_BY,UPDATED_BY)
         VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,:20,:21,:22,:23,:24,:25)`,
        [rowId,revisionId,rowSeq,company,plant,dto.processFlowRowId,dto.pfmeaRowId ?? null,processNo,processName,
          dto.equipmentCode ?? pfd.EQUIPMENT_CODE ?? null,dto.equipmentName ?? pfd.EQUIPMENT_NAME ?? null,
          dto.characteristicNo ?? null,dto.productCharacteristic ?? null,dto.processCharacteristic ?? null,
          dto.specialCharacteristicCode ?? null,dto.specification,dto.evaluationMethod,dto.sampleSize,dto.sampleFrequency ?? null,
          dto.controlMethod,dto.responsibleRole ?? null,dto.reactionPlan,dto.recordForm ?? null,userId,userId],
      );
      return { rowId, revisionId, rowSeq, ...dto, processNo, processName };
    });
  }

  async updateRow(rowId: number, dto: UpdateControlPlanRowDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const current = await this.getDraftRow(qr, rowId, company, plant);
      const processFlowRowId = dto.processFlowRowId ?? Number(current.PROCESS_FLOW_ROW_ID);
      const pfmeaRowId = dto.pfmeaRowId === undefined
        ? (current.PFMEA_ROW_ID == null ? null : Number(current.PFMEA_ROW_ID))
        : dto.pfmeaRowId;
      let pfd = { PROCESS_NO: current.PROCESS_NO, PROCESS_NAME: current.PROCESS_NAME, EQUIPMENT_CODE: current.EQUIPMENT_CODE, EQUIPMENT_NAME: current.EQUIPMENT_NAME };
      let selectedPfmeaRows: Array<{ ROW_ID: number; PROCESS_FLOW_ROW_ID: number }> = pfmeaRowId == null
        ? []
        : [{ ROW_ID: pfmeaRowId, PROCESS_FLOW_ROW_ID: processFlowRowId }];
      if (dto.processFlowRowId !== undefined || dto.pfmeaRowId !== undefined) {
        const pfdRows = await qr.query(
          `SELECT ROW_ID,PROCESS_NO,PROCESS_NAME,EQUIPMENT_CODE,EQUIPMENT_NAME FROM QUALITY_PROCESS_FLOW_ROWS
            WHERE ROW_ID=:1 AND REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`,
          [processFlowRowId, current.REF_PFD_REVISION_ID, company, plant],
        );
        if (!pfdRows.length) throw new NotFoundException('고정 PFD Revision에서 공정을 찾을 수 없습니다.');
        pfd = pfdRows[0];
        if (pfmeaRowId != null) {
          const pfmeaRows = await qr.query(
            `SELECT ROW_ID,PROCESS_FLOW_ROW_ID FROM QUALITY_PFMEA_ROWS WHERE ROW_ID=:1 AND REVISION_ID=:2 AND PROCESS_FLOW_ROW_ID=:3 AND COMPANY=:4 AND PLANT_CD=:5`,
            [pfmeaRowId, current.REF_PFMEA_REVISION_ID, processFlowRowId, company, plant],
          );
          if (!pfmeaRows.length) throw new NotFoundException('고정 PFMEA Revision에서 연결 항목을 찾을 수 없습니다.');
          selectedPfmeaRows = pfmeaRows;
        }
        await qr.query(
          `UPDATE QUALITY_CONTROL_PLAN_ROWS SET PROCESS_FLOW_ROW_ID=:1,PFMEA_ROW_ID=:2,PROCESS_NO=:3,PROCESS_NAME=:4,
             EQUIPMENT_CODE=:5,EQUIPMENT_NAME=:6,UPDATED_BY=:7,UPDATED_AT=SYSTIMESTAMP
            WHERE ROW_ID=:8 AND COMPANY=:9 AND PLANT_CD=:10`,
          [processFlowRowId, pfmeaRowId ?? null, pfd.PROCESS_NO, pfd.PROCESS_NAME, pfd.EQUIPMENT_CODE ?? null,
            pfd.EQUIPMENT_NAME ?? null, userId, rowId, company, plant],
        );
      }
      const sampleSize = dto.sampleSize ?? current.SAMPLE_SIZE;
      const sampleFrequency = dto.sampleFrequency ?? current.SAMPLE_FREQUENCY;
      const issues = validateQualityPlan({
        revisionId: Number(current.REVISION_ID),
        processFlowRows: [{ id: processFlowRowId, processNo: pfd.PROCESS_NO }],
        pfmeaRows: selectedPfmeaRows.map((row) => ({ id: Number(row.ROW_ID), processFlowRowId: Number(row.PROCESS_FLOW_ROW_ID) })),
        controlPlanRows: [{ id: rowId, processFlowRowId, pfmeaRowId, sampleSize, sampleFrequency }],
      });
      if (issues.length) throw new BadRequestException(issues[0].message);
      if (dto.specialCharacteristicCode) await this.assertSpecialCode(qr, dto.specialCharacteristicCode, company, plant);
      await qr.query(
        `UPDATE QUALITY_CONTROL_PLAN_ROWS SET
          CHARACTERISTIC_NO=COALESCE(:1,CHARACTERISTIC_NO), PRODUCT_CHARACTERISTIC=COALESCE(:2,PRODUCT_CHARACTERISTIC),
          PROCESS_CHARACTERISTIC=COALESCE(:3,PROCESS_CHARACTERISTIC), SPECIAL_CHAR_CODE=COALESCE(:4,SPECIAL_CHAR_CODE),
          SPECIFICATION=COALESCE(:5,SPECIFICATION), EVALUATION_METHOD=COALESCE(:6,EVALUATION_METHOD),
          SAMPLE_SIZE=:7, SAMPLE_FREQUENCY=:8, CONTROL_METHOD=COALESCE(:9,CONTROL_METHOD),
          RESPONSIBLE_ROLE=COALESCE(:10,RESPONSIBLE_ROLE), REACTION_PLAN=COALESCE(:11,REACTION_PLAN),
          RECORD_FORM=COALESCE(:12,RECORD_FORM), UPDATED_BY=:13, UPDATED_AT=SYSTIMESTAMP
         WHERE ROW_ID=:14 AND COMPANY=:15 AND PLANT_CD=:16`,
        [dto.characteristicNo ?? null,dto.productCharacteristic ?? null,dto.processCharacteristic ?? null,
          dto.specialCharacteristicCode ?? null,dto.specification ?? null,dto.evaluationMethod ?? null,sampleSize,
          sampleFrequency ?? null,dto.controlMethod ?? null,dto.responsibleRole ?? null,dto.reactionPlan ?? null,
          dto.recordForm ?? null,userId,rowId,company,plant],
      );
      return { rowId };
    });
  }

  async deleteRow(rowId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      await this.getDraftRow(qr, rowId, company, plant);
      await qr.query(`DELETE FROM QUALITY_CONTROL_PLAN_ROWS WHERE ROW_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [rowId, company, plant]);
      return { rowId };
    });
  }

  private async getDraftRevision(qr: QueryRunner, revisionId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT R.STATUS, R.REF_PFD_REVISION_ID, R.REF_PFMEA_REVISION_ID, D.DOCUMENT_TYPE, D.PACKAGE_ID
         FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
           ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
        WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3 FOR UPDATE`, [revisionId, company, plant],
    );
    if (!rows.length) throw new NotFoundException('Control Plan Revision을 찾을 수 없습니다.');
    if (rows[0].STATUS !== 'DRAFT' || rows[0].DOCUMENT_TYPE !== 'CONTROL_PLAN') throw new BadRequestException('DRAFT Control Plan에서만 행을 변경할 수 있습니다.');
    return rows[0];
  }

  private async getDraftRow(qr: QueryRunner, rowId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT C.*,R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID FROM QUALITY_CONTROL_PLAN_ROWS C JOIN QUALITY_PLAN_REVISIONS R
         ON R.COMPANY=C.COMPANY AND R.PLANT_CD=C.PLANT_CD AND R.REVISION_ID=C.REVISION_ID
        WHERE C.ROW_ID=:1 AND C.COMPANY=:2 AND C.PLANT_CD=:3 AND R.STATUS='DRAFT' FOR UPDATE`, [rowId, company, plant],
    );
    if (!rows.length) throw new BadRequestException('DRAFT Control Plan 행만 변경할 수 있습니다.');
    return rows[0];
  }

  private async assertSpecialCode(qr: QueryRunner, code: string, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT DETAIL_CODE FROM COM_CODES WHERE COMPANY=:1 AND PLANT_CD=:2 AND GROUP_CODE='QC_SPECIAL_CHAR' AND DETAIL_CODE=:3 AND USE_YN='Y'`,
      [company, plant, code],
    );
    if (!rows.length) throw new BadRequestException('등록되지 않은 특별특성 코드입니다.');
  }
}
