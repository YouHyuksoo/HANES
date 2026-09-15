import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import type { CreateProcessFlowRowDto, UpdateProcessFlowRowDto } from '../dto/process-flow.dto';

@Injectable()
export class ProcessFlowDocumentService {
  constructor(private readonly tx: TransactionService) {}

  async findRows(revisionId: number, company: string, plant: string) {
    const rows = await this.tx.run((qr) => qr.query(
      `SELECT * FROM QUALITY_PROCESS_FLOW_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 ORDER BY ROW_SEQ`,
      [revisionId, company, plant],
    ));
    return {
      rows,
      connections: rows.slice(1).map((row: any, index: number) => ({
        fromRowId: rows[index].ROW_ID ?? rows[index].rowId,
        toRowId: row.ROW_ID ?? row.rowId,
      })),
    };
  }

  async createRow(revisionId: number, dto: CreateProcessFlowRowDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      await this.assertDraftPfd(qr, revisionId, company, plant);
      await this.validateReferences(qr, dto, company, plant);
      const idRows = await qr.query('SELECT SEQ_QUALITY_PROCESS_FLOW_ROW.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
      const rowId = Number(idRows[0]?.NEXT_SEQ ?? idRows[0]?.next_seq);
      const seqRows = await qr.query(
        `SELECT NVL(MAX(ROW_SEQ),0)+1 AS "NEXT_ROW_SEQ" FROM QUALITY_PROCESS_FLOW_ROWS
          WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [revisionId, company, plant],
      );
      const rowSeq = Number(seqRows[0]?.NEXT_ROW_SEQ ?? seqRows[0]?.next_row_seq ?? 1);
      await qr.query(
        `INSERT INTO QUALITY_PROCESS_FLOW_ROWS
         (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_NO, PROCESS_CODE, PROCESS_NAME, EQUIPMENT_CODE,
          EQUIPMENT_NAME, FLOW_LANE, FLOW_SYMBOL, PRODUCT_SPECIAL_CHAR, PROCESS_SPECIAL_CHAR, DESCRIPTION, CREATED_BY, UPDATED_BY)
         VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17)`,
        [rowId, revisionId, rowSeq, company, plant, dto.processNo, dto.processCode ?? null, dto.processName,
          dto.equipmentCode ?? null, dto.equipmentName ?? null, dto.lane, dto.symbol,
          dto.productSpecialCharacteristicCode ?? null, dto.processSpecialCharacteristicCode ?? null,
          dto.description ?? null, userId, userId],
      );
      return { rowId, revisionId, rowSeq, ...dto };
    });
  }

  async updateRow(rowId: number, dto: UpdateProcessFlowRowDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const rows = await qr.query(
        `SELECT F.REVISION_ID, R.STATUS, D.DOCUMENT_TYPE FROM QUALITY_PROCESS_FLOW_ROWS F
          JOIN QUALITY_PLAN_REVISIONS R ON R.REVISION_ID=F.REVISION_ID AND R.COMPANY=F.COMPANY AND R.PLANT_CD=F.PLANT_CD
          JOIN QUALITY_PLAN_DOCUMENTS D ON D.DOCUMENT_ID=R.DOCUMENT_ID AND D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD
         WHERE F.ROW_ID=:1 AND F.COMPANY=:2 AND F.PLANT_CD=:3 FOR UPDATE`, [rowId, company, plant],
      );
      if (!rows.length) throw new NotFoundException('PFD 행을 찾을 수 없습니다.');
      this.requireDraftPfd(rows[0]);
      await this.validateReferences(qr, dto, company, plant);
      await qr.query(
        `UPDATE QUALITY_PROCESS_FLOW_ROWS SET
          PROCESS_NO=COALESCE(:1,PROCESS_NO), PROCESS_CODE=COALESCE(:2,PROCESS_CODE), PROCESS_NAME=COALESCE(:3,PROCESS_NAME),
          EQUIPMENT_CODE=COALESCE(:4,EQUIPMENT_CODE), EQUIPMENT_NAME=COALESCE(:5,EQUIPMENT_NAME),
          FLOW_LANE=COALESCE(:6,FLOW_LANE), FLOW_SYMBOL=COALESCE(:7,FLOW_SYMBOL),
          PRODUCT_SPECIAL_CHAR=COALESCE(:8,PRODUCT_SPECIAL_CHAR), PROCESS_SPECIAL_CHAR=COALESCE(:9,PROCESS_SPECIAL_CHAR),
          DESCRIPTION=COALESCE(:10,DESCRIPTION), UPDATED_BY=:11, UPDATED_AT=SYSTIMESTAMP
         WHERE ROW_ID=:12 AND COMPANY=:13 AND PLANT_CD=:14`,
        [dto.processNo ?? null, dto.processCode ?? null, dto.processName ?? null, dto.equipmentCode ?? null,
          dto.equipmentName ?? null, dto.lane ?? null, dto.symbol ?? null, dto.productSpecialCharacteristicCode ?? null,
          dto.processSpecialCharacteristicCode ?? null, dto.description ?? null, userId, rowId, company, plant],
      );
      return { rowId, ...dto };
    });
  }

  async deleteRow(rowId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      const rows = await qr.query(
        `SELECT F.REVISION_ID, R.STATUS, D.DOCUMENT_TYPE FROM QUALITY_PROCESS_FLOW_ROWS F
          JOIN QUALITY_PLAN_REVISIONS R ON R.REVISION_ID=F.REVISION_ID AND R.COMPANY=F.COMPANY AND R.PLANT_CD=F.PLANT_CD
          JOIN QUALITY_PLAN_DOCUMENTS D ON D.DOCUMENT_ID=R.DOCUMENT_ID AND D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD
         WHERE F.ROW_ID=:1 AND F.COMPANY=:2 AND F.PLANT_CD=:3 FOR UPDATE`, [rowId, company, plant],
      );
      if (!rows.length) throw new NotFoundException('PFD 행을 찾을 수 없습니다.');
      this.requireDraftPfd(rows[0]);
      await qr.query(`DELETE FROM QUALITY_PROCESS_FLOW_ROWS WHERE ROW_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [rowId, company, plant]);
      return { rowId };
    });
  }

  async reorder(revisionId: number, rowIds: number[], company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      await this.assertDraftPfd(qr, revisionId, company, plant);
      const current = await qr.query(
        `SELECT ROW_ID FROM QUALITY_PROCESS_FLOW_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 FOR UPDATE`,
        [revisionId, company, plant],
      );
      const expected = current.map((row: any) => Number(row.ROW_ID)).sort((a: number,b: number) => a-b);
      const requested = [...new Set(rowIds)].sort((a,b) => a-b);
      if (requested.length !== rowIds.length || requested.length !== expected.length || requested.some((id,index) => id !== expected[index])) {
        throw new BadRequestException('재정렬 행 목록이 현재 PFD 행 전체와 일치해야 합니다.');
      }
      await qr.query(
        `UPDATE QUALITY_PROCESS_FLOW_ROWS SET ROW_SEQ = -ROW_SEQ, UPDATED_BY=:1, UPDATED_AT=SYSTIMESTAMP
          WHERE REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`, [userId, revisionId, company, plant],
      );
      for (let index = 0; index < rowIds.length; index += 1) {
        await qr.query(
          `UPDATE QUALITY_PROCESS_FLOW_ROWS SET ROW_SEQ=:1 WHERE ROW_ID=:2 AND REVISION_ID=:3 AND COMPANY=:4 AND PLANT_CD=:5`,
          [index + 1, rowIds[index], revisionId, company, plant],
        );
      }
      return { revisionId, rowIds };
    });
  }

  private async assertDraftPfd(qr: QueryRunner, revisionId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT R.STATUS, D.DOCUMENT_TYPE FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
        ON D.DOCUMENT_ID=R.DOCUMENT_ID AND D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD
       WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3 FOR UPDATE`, [revisionId, company, plant],
    );
    if (!rows.length) throw new NotFoundException('Revision을 찾을 수 없습니다.');
    this.requireDraftPfd(rows[0]);
  }

  private requireDraftPfd(row: any) {
    if (row.STATUS !== 'DRAFT' || row.DOCUMENT_TYPE !== 'PFD') throw new BadRequestException('DRAFT PFD Revision에서만 행을 변경할 수 있습니다.');
  }

  private async validateReferences(qr: QueryRunner, dto: UpdateProcessFlowRowDto, company: string, plant: string) {
    if (dto.processCode) {
      const processRows = await qr.query(
        `SELECT PROCESS_CODE FROM PROCESS_MASTERS WHERE COMPANY=:1 AND PLANT_CD=:2 AND PROCESS_CODE=:3`,
        [company, plant, dto.processCode],
      );
      if (!processRows.length) throw new NotFoundException('현재 tenant의 공정마스터를 찾을 수 없습니다.');
    }
    for (const [group, value] of [['QC_PFD_LANE', dto.lane], ['QC_PFD_SYMBOL', dto.symbol]] as const) {
      if (!value) continue;
      const codes = await qr.query(
        `SELECT DETAIL_CODE FROM COM_CODES WHERE COMPANY=:1 AND PLANT_CD=:2 AND GROUP_CODE=:3 AND DETAIL_CODE=:4 AND USE_YN='Y'`,
        [company, plant, group, value],
      );
      if (!codes.length) throw new BadRequestException(`${group} 공통코드에 등록되지 않은 값입니다.`);
    }
  }
}
