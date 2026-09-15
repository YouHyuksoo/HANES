import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';

@Injectable()
export class QualityPlanDraftGeneratorService {
  constructor(private readonly tx: TransactionService) {}

  async generate(packageId: number, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const contexts = await qr.query(
        `SELECT P.PACKAGE_ID, P.ITEM_CODE,
          MAX(CASE WHEN D.DOCUMENT_TYPE='PFD' THEN R.REVISION_ID END) PFD_REVISION_ID,
          MAX(CASE WHEN D.DOCUMENT_TYPE='PFMEA' THEN R.REVISION_ID END) PFMEA_REVISION_ID,
          MAX(CASE WHEN D.DOCUMENT_TYPE='CONTROL_PLAN' THEN R.REVISION_ID END) CP_REVISION_ID
         FROM QUALITY_PLAN_PACKAGES P JOIN QUALITY_PLAN_DOCUMENTS D ON D.COMPANY=P.COMPANY AND D.PLANT_CD=P.PLANT_CD AND D.PACKAGE_ID=P.PACKAGE_ID
         JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID AND R.STATUS='DRAFT'
        WHERE P.PACKAGE_ID=:1 AND P.COMPANY=:2 AND P.PLANT_CD=:3 GROUP BY P.PACKAGE_ID,P.ITEM_CODE`, [packageId, company, plant],
      );
      if (!contexts.length) throw new NotFoundException('자동 초안을 만들 DRAFT 문서패키지가 없습니다.');
      const context = contexts[0];
      if (!context.PFD_REVISION_ID || !context.PFMEA_REVISION_ID || !context.CP_REVISION_ID) throw new BadRequestException('세 문서가 모두 DRAFT여야 합니다.');
      const existing = await qr.query(
        `SELECT (SELECT COUNT(*) FROM QUALITY_PROCESS_FLOW_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3)
              +(SELECT COUNT(*) FROM QUALITY_PFMEA_ROWS WHERE REVISION_ID=:4 AND COMPANY=:5 AND PLANT_CD=:6)
              +(SELECT COUNT(*) FROM QUALITY_CONTROL_PLAN_ROWS WHERE REVISION_ID=:7 AND COMPANY=:8 AND PLANT_CD=:9) AS "CNT" FROM DUAL`,
        [context.PFD_REVISION_ID, company, plant, context.PFMEA_REVISION_ID, company, plant,
          context.CP_REVISION_ID, company, plant],
      );
      if (Number(existing[0]?.CNT ?? 0) > 0) throw new BadRequestException('기존 행이 있는 DRAFT에는 자동 초안을 다시 생성할 수 없습니다.');
      await qr.query(`UPDATE QUALITY_PLAN_REVISIONS SET REF_PFD_REVISION_ID=:1 WHERE REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`,
        [context.PFD_REVISION_ID, context.PFMEA_REVISION_ID, company, plant]);
      await qr.query(`UPDATE QUALITY_PLAN_REVISIONS SET REF_PFD_REVISION_ID=:1, REF_PFMEA_REVISION_ID=:2 WHERE REVISION_ID=:3 AND COMPANY=:4 AND PLANT_CD=:5`,
        [context.PFD_REVISION_ID, context.PFMEA_REVISION_ID, context.CP_REVISION_ID, company, plant]);
      const routing = await qr.query(
        `SELECT RP.*, EC.CODE_NAME AS EQUIPMENT_NAME FROM ROUTING_GROUPS RG JOIN ROUTING_PROCESSES RP
          ON RP.COMPANY=RG.COMPANY AND RP.PLANT_CD=RG.PLANT_CD AND RP.ROUTING_CODE=RG.ROUTING_CODE
         LEFT JOIN COM_CODES EC ON EC.COMPANY=RP.COMPANY AND EC.PLANT_CD=RP.PLANT_CD
          AND EC.GROUP_CODE='EQUIP_TYPE' AND EC.DETAIL_CODE=RP.EQUIP_TYPE AND EC.USE_YN='Y'
         WHERE RG.COMPANY=:1 AND RG.PLANT_CD=:2 AND RG.ITEM_CODE=:3 AND RG.USE_YN='Y' AND RP.USE_YN='Y' ORDER BY RP.SEQ`,
        [company, plant, context.ITEM_CODE],
      );
      const conditions = await qr.query(
        `SELECT QC.* FROM ROUTING_GROUPS RG JOIN PROCESS_QUALITY_CONDITIONS QC
          ON QC.COMPANY=RG.COMPANY AND QC.PLANT_CD=RG.PLANT_CD AND QC.ROUTING_CODE=RG.ROUTING_CODE
         WHERE RG.COMPANY=:1 AND RG.PLANT_CD=:2 AND RG.ITEM_CODE=:3 AND QC.USE_YN='Y' ORDER BY QC.SEQ,QC.CONDITION_SEQ`,
        [company, plant, context.ITEM_CODE],
      );
      const inspectSpecs = await qr.query(`SELECT * FROM INSPECT_ITEM_SPECS WHERE COMPANY=:1 AND PLANT_CD=:2 AND ITEM_CODE=:3 AND USE_YN='Y'`, [company, plant, context.ITEM_CODE]);
      const crimpSpecs = await qr.query(`SELECT * FROM TERMINAL_CRIMP_SPECS WHERE COMPANY=:1 AND PLANT_CD=:2 AND USE_YN='Y' AND (WIRE_ITEM_CODE=:3 OR TERMINAL_ITEM_CODE=:4)`, [company, plant, context.ITEM_CODE, context.ITEM_CODE]);
      const pfdBySeq = new Map<number, number>();
      for (const process of routing) {
        const rowId = await this.nextId(qr, 'SEQ_QUALITY_PROCESS_FLOW_ROW');
        pfdBySeq.set(Number(process.SEQ), rowId);
        await qr.query(
          `INSERT INTO QUALITY_PROCESS_FLOW_ROWS
           (ROW_ID,REVISION_ID,ROW_SEQ,COMPANY,PLANT_CD,PROCESS_NO,PROCESS_CODE,PROCESS_NAME,EQUIPMENT_CODE,EQUIPMENT_NAME,FLOW_LANE,FLOW_SYMBOL,CREATED_BY,UPDATED_BY)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14)`,
          [rowId,context.PFD_REVISION_ID,process.SEQ,company,plant,String(Number(process.SEQ)*10),process.PROCESS_CODE,process.PROCESS_NAME,
            process.EQUIP_TYPE ?? null,process.EQUIPMENT_NAME ?? process.EQUIP_TYPE ?? null,process.EXECUTION_TYPE === 'SUBCON' ? 'OUTSOURCING' : 'MAIN',process.SAMPLE_INSPECT_YN === 'Y' ? 'INSPECTION' : 'OPERATION',userId,userId],
        );
      }
      const candidates = conditions.map((condition: any) => ({
        pfdRowId: pfdBySeq.get(Number(condition.SEQ)), name: condition.CONDITION_CODE,
        specification: this.rangeSpec(condition.MIN_VALUE, condition.MAX_VALUE, condition.UNIT), evaluationMethod: '공정검사', sampleSize: '1EA', sampleFrequency: null,
      })).filter((candidate: any) => candidate.pfdRowId);
      const fallbackPfdRowId = routing.length ? pfdBySeq.get(Number(routing[routing.length - 1].SEQ)) : undefined;
      for (const spec of inspectSpecs) if (fallbackPfdRowId) candidates.push({ pfdRowId: fallbackPfdRowId, name: spec.INSPECT_TYPE,
        specification: this.inspectSpec(spec), evaluationMethod: spec.INSPECT_TYPE, sampleSize: '1EA', sampleFrequency: null });
      for (const spec of crimpSpecs) if (fallbackPfdRowId) candidates.push({ pfdRowId: fallbackPfdRowId, name: 'CRIMP_HEIGHT',
        specification: this.rangeSpec(spec.CRIMP_HEIGHT_LSL, spec.CRIMP_HEIGHT_USL, 'mm'), evaluationMethod: '마이크로미터', sampleSize: '1EA', sampleFrequency: '초/중/종' });
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const pfmeaRowId = await this.nextId(qr, 'SEQ_QUALITY_PFMEA_ROW');
        await qr.query(
          `INSERT INTO QUALITY_PFMEA_ROWS
           (ROW_ID,REVISION_ID,ROW_SEQ,COMPANY,PLANT_CD,PROCESS_FLOW_ROW_ID,PROCESS_FUNCTION,REQUIREMENT,FAILURE_MODE,FAILURE_EFFECT,
            SEVERITY,FAILURE_CAUSE,OCCURRENCE,DETECTION,RPN,CREATED_BY,UPDATED_BY)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,'검토 필요',1,'검토 필요',1,1,1,:10,:11)`,
          [pfmeaRowId,context.PFMEA_REVISION_ID,index+1,company,plant,candidate.pfdRowId,candidate.name,candidate.specification,`${candidate.name} 규격 이탈`,userId,userId],
        );
        const cpRowId = await this.nextId(qr, 'SEQ_QUALITY_CONTROL_PLAN_ROW');
        const process = routing.find((row: any) => pfdBySeq.get(Number(row.SEQ)) === candidate.pfdRowId);
        await qr.query(
          `INSERT INTO QUALITY_CONTROL_PLAN_ROWS
           (ROW_ID,REVISION_ID,ROW_SEQ,COMPANY,PLANT_CD,PROCESS_FLOW_ROW_ID,PFMEA_ROW_ID,PROCESS_NO,PROCESS_NAME,
            PROCESS_CHARACTERISTIC,SPECIFICATION,EVALUATION_METHOD,SAMPLE_SIZE,SAMPLE_FREQUENCY,CONTROL_METHOD,REACTION_PLAN,CREATED_BY,UPDATED_BY)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,'검사','이상 발생 시 정지·격리 후 품질부서 통보',:15,:16)`,
          [cpRowId,context.CP_REVISION_ID,index+1,company,plant,candidate.pfdRowId,pfmeaRowId,String(Number(process?.SEQ ?? index+1)*10),
            process?.PROCESS_NAME ?? '',candidate.name,candidate.specification,candidate.evaluationMethod,candidate.sampleSize,candidate.sampleFrequency,userId,userId],
        );
      }
      return { packageId, pfdRows: routing.length, pfmeaCandidates: candidates.length, controlPlanCandidates: candidates.length };
    });
  }

  private async nextId(qr: QueryRunner, sequence: string) { const rows = await qr.query(`SELECT ${sequence}.NEXTVAL AS "NEXT_SEQ" FROM DUAL`); return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq); }
  private rangeSpec(min: any, max: any, unit: any) { return `${min ?? ''}~${max ?? ''}${unit ?? ''}`; }
  private inspectSpec(spec: any) { return spec.INSPECT_TYPE === 'HIPOT' ? `${spec.TEST_VOLTAGE_KV ?? ''}kV / ${spec.MAX_CURRENT_MA ?? ''}mA` : JSON.stringify(spec); }
}
