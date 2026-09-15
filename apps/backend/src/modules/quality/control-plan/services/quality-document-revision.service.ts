import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { nextRevisionCode } from '@harness/shared';
import { TransactionService } from '../../../../shared/transaction.service';
import type { CreateQualityRevisionDto, UpdateQualityRevisionDto } from '../dto/quality-document.dto';
import { QualityPlanValidationService } from './quality-plan-validation.service';

interface RevisionRow {
  REVISION_ID: number; DOCUMENT_ID: number; DOCUMENT_TYPE: 'PFD' | 'PFMEA' | 'CONTROL_PLAN';
  REVISION_CODE: string; STATUS: string; PACKAGE_ID: number;
  REF_PFD_REVISION_ID?: number | null; REF_PFMEA_REVISION_ID?: number | null;
}

const CLONE_SQL = {
  PFD: `INSERT INTO QUALITY_PROCESS_FLOW_ROWS
    (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_NO, PROCESS_CODE, PROCESS_NAME, EQUIPMENT_CODE, EQUIPMENT_NAME,
     FLOW_LANE, FLOW_SYMBOL, PRODUCT_SPECIAL_CHAR, PROCESS_SPECIAL_CHAR, DESCRIPTION, CREATED_BY, UPDATED_BY)
    SELECT SEQ_QUALITY_PROCESS_FLOW_ROW.NEXTVAL, :1, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_NO, PROCESS_CODE, PROCESS_NAME,
     EQUIPMENT_CODE, EQUIPMENT_NAME, FLOW_LANE, FLOW_SYMBOL, PRODUCT_SPECIAL_CHAR, PROCESS_SPECIAL_CHAR, DESCRIPTION, :2, :3
      FROM QUALITY_PROCESS_FLOW_ROWS WHERE REVISION_ID=:4 AND COMPANY=:5 AND PLANT_CD=:6`,
  PFMEA: `INSERT INTO QUALITY_PFMEA_ROWS
    (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_FLOW_ROW_ID, PROCESS_FUNCTION, REQUIREMENT, FAILURE_MODE, FAILURE_EFFECT,
     SEVERITY, SPECIAL_CHAR_CODE, FAILURE_CAUSE, PREVENTION_CONTROL, OCCURRENCE, DETECTION_CONTROL, DETECTION, RPN,
     RECOMMENDED_ACTION, RESPONSIBLE_ORG, RESPONSIBLE_PERSON, TARGET_DATE, COMPLETED_ACTION, COMPLETION_DATE,
     ACTION_SEVERITY, ACTION_OCCURRENCE, ACTION_DETECTION, ACTION_RPN, CREATED_BY, UPDATED_BY)
    SELECT SEQ_QUALITY_PFMEA_ROW.NEXTVAL, :1, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_FLOW_ROW_ID, PROCESS_FUNCTION, REQUIREMENT,
     FAILURE_MODE, FAILURE_EFFECT, SEVERITY, SPECIAL_CHAR_CODE, FAILURE_CAUSE, PREVENTION_CONTROL, OCCURRENCE, DETECTION_CONTROL,
     DETECTION, RPN, RECOMMENDED_ACTION, RESPONSIBLE_ORG, RESPONSIBLE_PERSON, TARGET_DATE, COMPLETED_ACTION, COMPLETION_DATE,
     ACTION_SEVERITY, ACTION_OCCURRENCE, ACTION_DETECTION, ACTION_RPN, :2, :3
      FROM QUALITY_PFMEA_ROWS WHERE REVISION_ID=:4 AND COMPANY=:5 AND PLANT_CD=:6`,
  CONTROL_PLAN: `INSERT INTO QUALITY_CONTROL_PLAN_ROWS
    (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_FLOW_ROW_ID, PFMEA_ROW_ID, PROCESS_NO, PROCESS_NAME,
     EQUIPMENT_CODE, EQUIPMENT_NAME, CHARACTERISTIC_NO, PRODUCT_CHARACTERISTIC, PROCESS_CHARACTERISTIC, SPECIAL_CHAR_CODE,
     SPECIFICATION, EVALUATION_METHOD, SAMPLE_SIZE, SAMPLE_FREQUENCY, CONTROL_METHOD, RESPONSIBLE_ROLE, REACTION_PLAN,
     RECORD_FORM, CREATED_BY, UPDATED_BY)
    SELECT SEQ_QUALITY_CONTROL_PLAN_ROW.NEXTVAL, :1, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_FLOW_ROW_ID, PFMEA_ROW_ID, PROCESS_NO,
     PROCESS_NAME, EQUIPMENT_CODE, EQUIPMENT_NAME, CHARACTERISTIC_NO, PRODUCT_CHARACTERISTIC, PROCESS_CHARACTERISTIC,
     SPECIAL_CHAR_CODE, SPECIFICATION, EVALUATION_METHOD, SAMPLE_SIZE, SAMPLE_FREQUENCY, CONTROL_METHOD, RESPONSIBLE_ROLE,
     REACTION_PLAN, RECORD_FORM, :2, :3
      FROM QUALITY_CONTROL_PLAN_ROWS WHERE REVISION_ID=:4 AND COMPANY=:5 AND PLANT_CD=:6`,
} as const;

@Injectable()
export class QualityDocumentRevisionService {
  constructor(private readonly tx: TransactionService, private readonly validation: QualityPlanValidationService) {}

  async findByDocument(documentId: number, company: string, plant: string) {
    return this.tx.run((qr) => qr.query(
      `SELECT R.* FROM QUALITY_PLAN_REVISIONS R
        WHERE R.DOCUMENT_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3 ORDER BY R.REVISION_CODE DESC`,
      [documentId, company, plant],
    ));
  }

  async findOne(revisionId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      const rows = await qr.query(
        `SELECT R.*, D.DOCUMENT_TYPE, D.DOCUMENT_NO, D.PACKAGE_ID
           FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
             ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
          WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3`, [revisionId, company, plant],
      );
      if (!rows.length) throw new NotFoundException('Revision을 찾을 수 없습니다.');
      return rows[0];
    });
  }

  async compare(revisionId: number, otherRevisionId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      const revisions = await qr.query(
        `SELECT R.REVISION_ID,R.DOCUMENT_ID,R.REVISION_CODE,R.STATUS,R.ISSUE_DATE,R.REVISION_DATE,
                R.CHANGE_REASON,R.CHANGE_DESCRIPTION,R.AUTHOR_ID,R.PUBLISHER_ID,
                R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID,D.DOCUMENT_TYPE
           FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
             ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
          WHERE R.REVISION_ID IN (:1,:2) AND R.COMPANY=:3 AND R.PLANT_CD=:4`,
        [revisionId, otherRevisionId, company, plant],
      );
      if (revisions.length !== 2) throw new NotFoundException('비교할 Revision을 찾을 수 없습니다.');
      const left = revisions.find((row: any) => Number(row.REVISION_ID) === revisionId);
      const right = revisions.find((row: any) => Number(row.REVISION_ID) === otherRevisionId);
      if (!left || !right || Number(left.DOCUMENT_ID) !== Number(right.DOCUMENT_ID)) {
        throw new BadRequestException('같은 문서의 Revision만 비교할 수 있습니다.');
      }
      const table = left.DOCUMENT_TYPE === 'PFD' ? 'QUALITY_PROCESS_FLOW_ROWS'
        : left.DOCUMENT_TYPE === 'PFMEA' ? 'QUALITY_PFMEA_ROWS' : 'QUALITY_CONTROL_PLAN_ROWS';
      const selectRows = (id: number) => qr.query(
        `SELECT * FROM ${table} WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 ORDER BY ROW_SEQ`,
        [id, company, plant],
      );
      const leftRows = await selectRows(revisionId); const rightRows = await selectRows(otherRevisionId);
      const leftBySeq = new Map<number, Record<string, unknown>>(leftRows.map((row: Record<string, unknown>) => [Number(row.ROW_SEQ), row]));
      const rightBySeq = new Map<number, Record<string, unknown>>(rightRows.map((row: Record<string, unknown>) => [Number(row.ROW_SEQ), row]));
      const added = rightRows.filter((row: any) => !leftBySeq.has(Number(row.ROW_SEQ)));
      const removed = leftRows.filter((row: any) => !rightBySeq.has(Number(row.ROW_SEQ)));
      const changed = [];
      for (const [rowSeq, before] of leftBySeq) {
        const after = rightBySeq.get(rowSeq); if (!after) continue;
        const fields = this.changedFields(before, after, ['ROW_ID','REVISION_ID','CREATED_AT','UPDATED_AT','CREATED_BY','UPDATED_BY']);
        if (fields.length) changed.push({ rowSeq, fields, before, after });
      }
      const metadataFields = ['REVISION_CODE','STATUS','ISSUE_DATE','REVISION_DATE','CHANGE_REASON','CHANGE_DESCRIPTION','AUTHOR_ID','PUBLISHER_ID','REF_PFD_REVISION_ID','REF_PFMEA_REVISION_ID'];
      const metadataChanges = metadataFields.filter((field) => this.comparable(left[field]) !== this.comparable(right[field]))
        .map((field) => ({ field, before: left[field] ?? null, after: right[field] ?? null }));
      return { documentId: Number(left.DOCUMENT_ID), documentType: left.DOCUMENT_TYPE, left, right, metadataChanges, added, removed, changed };
    });
  }

  async updateMetadata(revisionId: number, dto: UpdateQualityRevisionDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const revision = await this.getRevision(qr, revisionId, company, plant);
      this.assertDraft(revision);
      const refPfdRevisionId = dto.refPfdRevisionId ?? revision.REF_PFD_REVISION_ID ?? null;
      const refPfmeaRevisionId = dto.refPfmeaRevisionId ?? revision.REF_PFMEA_REVISION_ID ?? null;
      if (revision.DOCUMENT_TYPE === 'PFD' && (dto.refPfdRevisionId != null || dto.refPfmeaRevisionId != null)) {
        throw new BadRequestException('PFD 문서는 상위 Revision을 참조하지 않습니다.');
      }
      if (dto.refPfdRevisionId != null) await this.assertReference(qr, dto.refPfdRevisionId, 'PFD', revision.PACKAGE_ID, company, plant);
      const pfmeaReference = dto.refPfmeaRevisionId != null
        ? await this.assertReference(qr, dto.refPfmeaRevisionId, 'PFMEA', revision.PACKAGE_ID, company, plant) : null;
      if (revision.DOCUMENT_TYPE === 'PFMEA' && dto.refPfmeaRevisionId != null) throw new BadRequestException('PFMEA 문서는 PFD Revision만 참조합니다.');
      if (revision.DOCUMENT_TYPE === 'CONTROL_PLAN' && pfmeaReference && Number(pfmeaReference.REF_PFD_REVISION_ID) !== Number(refPfdRevisionId)) {
        throw new BadRequestException('Control Plan의 PFD와 PFMEA가 같은 PFD Revision 계보를 참조해야 합니다.');
      }
      const assignments: string[] = [];
      const binds: unknown[] = [];
      const assign = (column: string, value: unknown) => {
        binds.push(value);
        assignments.push(`${column}=:${binds.length}`);
      };
      if (dto.changeReason !== undefined) assign('CHANGE_REASON', dto.changeReason);
      if (dto.changeDescription !== undefined) assign('CHANGE_DESCRIPTION', dto.changeDescription);
      assign('REF_PFD_REVISION_ID', refPfdRevisionId);
      assign('REF_PFMEA_REVISION_ID', refPfmeaRevisionId);
      const revisionBind = binds.length + 1;
      const companyBind = binds.length + 2;
      const plantBind = binds.length + 3;
      await qr.query(
        `UPDATE QUALITY_PLAN_REVISIONS SET ${assignments.join(', ')}, UPDATED_AT=SYSTIMESTAMP
          WHERE REVISION_ID=:${revisionBind} AND COMPANY=:${companyBind} AND PLANT_CD=:${plantBind}`,
        [...binds, revisionId, company, plant],
      );
      await this.recordEvent(qr, revision, company, plant, 'UPDATED', userId);
      return { revisionId, status: 'DRAFT' };
    });
  }

  async deleteDraft(revisionId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      const revision = await this.getRevision(qr, revisionId, company, plant);
      this.assertDraft(revision);
      const table = revision.DOCUMENT_TYPE === 'PFD' ? 'QUALITY_PROCESS_FLOW_ROWS'
        : revision.DOCUMENT_TYPE === 'PFMEA' ? 'QUALITY_PFMEA_ROWS' : 'QUALITY_CONTROL_PLAN_ROWS';
      await qr.query(`DELETE FROM ${table} WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [revisionId, company, plant]);
      await qr.query(`DELETE FROM QUALITY_PLAN_PARTICIPANTS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [revisionId, company, plant]);
      await qr.query(`DELETE FROM QUALITY_PLAN_VALIDATIONS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [revisionId, company, plant]);
      await qr.query(`DELETE FROM QUALITY_PLAN_REVISIONS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`, [revisionId, company, plant]);
      return { revisionId };
    });
  }

  async createRevision(sourceRevisionId: number, dto: CreateQualityRevisionDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const source = await this.getRevision(qr, sourceRevisionId, company, plant);
      if (source.STATUS !== 'PUBLISHED') throw new BadRequestException('발행된 Revision에서만 개정할 수 있습니다.');
      const drafts = await qr.query(
        `SELECT REVISION_ID FROM QUALITY_PLAN_REVISIONS WHERE COMPANY=:1 AND PLANT_CD=:2 AND DOCUMENT_ID=:3 AND STATUS = 'DRAFT'`,
        [company, plant, source.DOCUMENT_ID],
      );
      if (drafts.length) throw new ConflictException('이미 작성 중인 DRAFT Revision이 있습니다.');
      const revisionId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_REVISION');
      const revisionCode = nextRevisionCode(source.REVISION_CODE);
      await qr.query(
        `INSERT INTO QUALITY_PLAN_REVISIONS
         (REVISION_ID, DOCUMENT_ID, COMPANY, PLANT_CD, REVISION_CODE, STATUS, REVISION_DATE, CHANGE_REASON,
          CHANGE_DESCRIPTION, AUTHOR_ID, REF_PFD_REVISION_ID, REF_PFMEA_REVISION_ID)
         SELECT :1, DOCUMENT_ID, COMPANY, PLANT_CD, :2, 'DRAFT', SYSDATE, :3, :4, :5,
                REF_PFD_REVISION_ID, REF_PFMEA_REVISION_ID
           FROM QUALITY_PLAN_REVISIONS WHERE REVISION_ID=:6 AND COMPANY=:7 AND PLANT_CD=:8`,
        [revisionId, revisionCode, dto.changeReason, dto.changeDescription, userId, sourceRevisionId, company, plant],
      );
      await qr.query(CLONE_SQL[source.DOCUMENT_TYPE], [revisionId, userId, userId, sourceRevisionId, company, plant]);
      await qr.query(
        `INSERT INTO QUALITY_PLAN_PARTICIPANTS
         (PARTICIPANT_ID, REVISION_ID, COMPANY, PLANT_CD, ROLE, USER_ID, USER_NAME, ORGANIZATION)
         SELECT SEQ_QUALITY_PLAN_PARTICIPANT.NEXTVAL, :1, COMPANY, PLANT_CD, ROLE, USER_ID, USER_NAME, ORGANIZATION
           FROM QUALITY_PLAN_PARTICIPANTS WHERE REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4`,
        [revisionId, sourceRevisionId, company, plant],
      );
      await this.recordEvent(qr, { ...source, REVISION_ID: revisionId }, company, plant, 'REVISION_CREATED', userId);
      return { revisionId, documentId: source.DOCUMENT_ID, revisionCode, status: 'DRAFT' };
    });
  }

  async publish(revisionId: number, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const revision = await this.getRevision(qr, revisionId, company, plant);
      this.assertDraft(revision);
      const validation = await this.validation.validateInTx(qr, revisionId, company, plant, userId);
      if (!validation.valid) throw new BadRequestException({ message: '발행 검증 오류를 수정해야 합니다.', validation });
      await qr.query(
        `UPDATE QUALITY_PLAN_REVISIONS SET STATUS = 'PUBLISHED', PUBLISHED_AT=SYSTIMESTAMP, PUBLISHER_ID=:1, ISSUE_DATE=SYSDATE
          WHERE REVISION_ID=:2 AND COMPANY=:3 AND PLANT_CD=:4 AND STATUS='DRAFT'`, [userId, revisionId, company, plant],
      );
      await qr.query(
        `UPDATE QUALITY_PLAN_REVISIONS SET STATUS = 'SUPERSEDED', UPDATED_AT=SYSTIMESTAMP
          WHERE DOCUMENT_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 AND STATUS='PUBLISHED' AND REVISION_ID<>:4`,
        [revision.DOCUMENT_ID, company, plant, revisionId],
      );
      await this.recordEvent(qr, revision, company, plant, 'PUBLISHED', userId);
      return { revisionId, status: 'PUBLISHED' };
    });
  }

  private async getRevision(qr: QueryRunner, revisionId: number, company: string, plant: string): Promise<RevisionRow> {
    const rows = await qr.query(
      `SELECT R.REVISION_ID, R.DOCUMENT_ID, R.REVISION_CODE, R.STATUS,R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID,
              D.DOCUMENT_TYPE, D.PACKAGE_ID
         FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
           ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
        WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3 FOR UPDATE`, [revisionId, company, plant],
    );
    if (!rows.length) throw new NotFoundException('Revision을 찾을 수 없습니다.');
    return rows[0];
  }

  private async assertReference(qr: QueryRunner, referenceRevisionId: number, expectedType: 'PFD' | 'PFMEA',
    packageId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT R.REVISION_ID,R.STATUS,R.REF_PFD_REVISION_ID,D.DOCUMENT_TYPE,D.PACKAGE_ID
         FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
           ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
        WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3`,
      [referenceRevisionId, company, plant],
    );
    const reference = rows[0];
    if (!reference || reference.DOCUMENT_TYPE !== expectedType || Number(reference.PACKAGE_ID) !== Number(packageId)) {
      throw new BadRequestException(`같은 문서 묶음의 ${expectedType} Revision만 참조할 수 있습니다.`);
    }
    if (!['PUBLISHED', 'SUPERSEDED'].includes(String(reference.STATUS))) {
      throw new BadRequestException('발행되어 변경할 수 없는 상위 Revision만 참조할 수 있습니다.');
    }
    return reference;
  }

  private assertDraft(revision: Pick<RevisionRow, 'STATUS'>) {
    if (revision.STATUS !== 'DRAFT') throw new BadRequestException('발행본은 수정하거나 삭제할 수 없습니다. 새 Revision을 생성하세요.');
  }

  private changedFields(before: Record<string, unknown>, after: Record<string, unknown>, excluded: string[]) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].filter((key) => !excluded.includes(key) && this.comparable(before[key]) !== this.comparable(after[key])).sort();
  }

  private comparable(value: unknown) {
    return value instanceof Date ? value.toISOString() : value == null ? '' : String(value);
  }

  private async nextId(qr: QueryRunner, sequence: string) {
    const rows = await qr.query(`SELECT ${sequence}.NEXTVAL AS "NEXT_SEQ" FROM DUAL`);
    return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq);
  }

  private async recordEvent(qr: QueryRunner, revision: Pick<RevisionRow, 'PACKAGE_ID' | 'DOCUMENT_ID' | 'REVISION_ID'>,
    company: string, plant: string, eventType: string, actorId: string) {
    const eventId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_EVENT');
    await qr.query(
      `INSERT INTO QUALITY_PLAN_EVENTS
       (EVENT_ID, PACKAGE_ID, DOCUMENT_ID, REVISION_ID, COMPANY, PLANT_CD, EVENT_TYPE, ACTOR_ID)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8)`,
      [eventId, revision.PACKAGE_ID, revision.DOCUMENT_ID, revision.REVISION_ID, company, plant, eventType, actorId],
    );
  }
}
