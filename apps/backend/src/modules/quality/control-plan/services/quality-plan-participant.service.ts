import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { TransactionService } from '../../../../shared/transaction.service';
import type { CreateQualityPlanParticipantDto } from '../dto/quality-plan-participant.dto';

@Injectable()
export class QualityPlanParticipantService {
  constructor(private readonly tx: TransactionService) {}

  async findByRevision(revisionId: number, company: string, plant: string) {
    return this.tx.run((qr) => qr.query(
      `SELECT PARTICIPANT_ID,REVISION_ID,ROLE,USER_ID,USER_NAME,ORGANIZATION,CREATED_AT
         FROM QUALITY_PLAN_PARTICIPANTS
        WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 ORDER BY PARTICIPANT_ID`,
      [revisionId, company, plant],
    ));
  }

  async create(revisionId: number, dto: CreateQualityPlanParticipantDto, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      await this.assertDraftPfmea(qr, revisionId, company, plant);
      const ids = await qr.query('SELECT SEQ_QUALITY_PLAN_PARTICIPANT.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
      const participantId = Number(ids[0]?.NEXT_SEQ ?? ids[0]?.next_seq);
      await qr.query(
        `INSERT INTO QUALITY_PLAN_PARTICIPANTS
         (PARTICIPANT_ID,REVISION_ID,COMPANY,PLANT_CD,ROLE,USER_ID,USER_NAME,ORGANIZATION)
         VALUES (:1,:2,:3,:4,'KEY_CONTACT',:5,:6,:7)`,
        [participantId, revisionId, company, plant, dto.userId ?? null, dto.userName.trim(), dto.organization ?? null],
      );
      return { participantId, revisionId, role: 'KEY_CONTACT', ...dto };
    });
  }

  async delete(participantId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      const rows = await qr.query(
        `SELECT P.PARTICIPANT_ID FROM QUALITY_PLAN_PARTICIPANTS P
         JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=P.COMPANY AND R.PLANT_CD=P.PLANT_CD AND R.REVISION_ID=P.REVISION_ID
         JOIN QUALITY_PLAN_DOCUMENTS D ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
         WHERE P.PARTICIPANT_ID=:1 AND P.COMPANY=:2 AND P.PLANT_CD=:3 AND R.STATUS='DRAFT' AND D.DOCUMENT_TYPE='PFMEA' FOR UPDATE`,
        [participantId, company, plant],
      );
      if (!rows.length) throw new BadRequestException('DRAFT PFMEA의 CFT 참여자만 삭제할 수 있습니다.');
      await qr.query('DELETE FROM QUALITY_PLAN_PARTICIPANTS WHERE PARTICIPANT_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3', [participantId, company, plant]);
      return { participantId };
    });
  }

  private async assertDraftPfmea(qr: QueryRunner, revisionId: number, company: string, plant: string) {
    const rows = await qr.query(
      `SELECT R.REVISION_ID FROM QUALITY_PLAN_REVISIONS R JOIN QUALITY_PLAN_DOCUMENTS D
         ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID
        WHERE R.REVISION_ID=:1 AND R.COMPANY=:2 AND R.PLANT_CD=:3 AND R.STATUS='DRAFT' AND D.DOCUMENT_TYPE='PFMEA' FOR UPDATE`,
      [revisionId, company, plant],
    );
    if (!rows.length) throw new BadRequestException('DRAFT PFMEA에서만 CFT 참여자를 변경할 수 있습니다.');
  }
}
