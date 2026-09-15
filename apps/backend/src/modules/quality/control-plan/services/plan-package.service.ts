import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { NumberingService } from '../../../../shared/numbering.service';
import { TransactionService } from '../../../../shared/transaction.service';
import type { CreatePlanPackageDto, UpdatePlanPackageDto } from '../dto/plan-package.dto';

const DOCUMENTS = [
  { type: 'PFD', title: '공정흐름도', formNo: 'QREKA-PR-025-01' },
  { type: 'PFMEA', title: '공정 FMEA', formNo: 'QREKA-PR-025-02' },
  { type: 'CONTROL_PLAN', title: '관리계획서', formNo: 'QREKA-PR-025-04' },
] as const;

@Injectable()
export class PlanPackageService {
  constructor(private readonly tx: TransactionService, private readonly numbering: NumberingService) {}

  async create(dto: CreatePlanPackageDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const items = await qr.query(
        `SELECT ITEM_NAME FROM ITEM_MASTERS WHERE COMPANY = :1 AND PLANT_CD = :2 AND ITEM_CODE = :3`,
        [company, plant, dto.itemCode],
      );
      if (!items.length) throw new NotFoundException('현재 회사/공장의 품목을 찾을 수 없습니다.');

      const packageId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_PACKAGE');
      const itemName = items[0].ITEM_NAME ?? items[0].item_name;
      await qr.query(
        `INSERT INTO QUALITY_PLAN_PACKAGES
         (PACKAGE_ID, COMPANY, PLANT_CD, PROJECT_CODE, PROJECT_NAME, CUSTOMER_CODE, CUSTOMER_NAME,
          ITEM_CODE, ITEM_NAME, PART_NUMBER, PHASE, ORGANIZATION, KEY_CONTACT, CREATED_BY, UPDATED_BY)
         VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15)`,
        [packageId, company, plant, dto.projectCode ?? null, dto.projectName ?? null,
          dto.customerCode ?? null, dto.customerName ?? null, dto.itemCode, itemName,
          dto.partNumber ?? null, dto.phase, dto.organization ?? null, dto.keyContact ?? null, userId, userId],
      );

      const documents = [];
      const revisionIds = new Map<string, number>();
      for (const definition of DOCUMENTS) {
        const documentId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_DOCUMENT');
        const revisionId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_REVISION');
        const documentNo = await this.numbering.nextQualityDocumentNo(qr, definition.type);
        await qr.query(
          `INSERT INTO QUALITY_PLAN_DOCUMENTS
           (DOCUMENT_ID, PACKAGE_ID, COMPANY, PLANT_CD, DOCUMENT_TYPE, DOCUMENT_NO, TITLE,
            TEMPLATE_FORM_NO, TEMPLATE_REVISION, CREATED_BY)
           VALUES (:1,:2,:3,:4,:5,:6,:7,:8,'00',:9)`,
          [documentId, packageId, company, plant, definition.type, documentNo, definition.title, definition.formNo, userId],
        );
        await qr.query(
          `INSERT INTO QUALITY_PLAN_REVISIONS
           (REVISION_ID, DOCUMENT_ID, COMPANY, PLANT_CD, REVISION_CODE, STATUS, AUTHOR_ID)
           VALUES (:1,:2,:3,:4,'00','DRAFT',:5)`,
          [revisionId, documentId, company, plant, userId],
        );
        revisionIds.set(definition.type, revisionId);
        documents.push({ documentId, revisionId, documentType: definition.type, documentNo, revisionCode: '00', status: 'DRAFT' });
      }
      await qr.query(
        `UPDATE QUALITY_PLAN_REVISIONS R SET R.REF_PFD_REVISION_ID=:1
          WHERE R.REVISION_ID=:2 AND R.COMPANY=:3 AND R.PLANT_CD=:4`,
        [revisionIds.get('PFD'), revisionIds.get('PFMEA'), company, plant],
      );
      await qr.query(
        `UPDATE QUALITY_PLAN_REVISIONS R SET R.REF_PFD_REVISION_ID=:1, R.REF_PFMEA_REVISION_ID=:2
          WHERE R.REVISION_ID=:3 AND R.COMPANY=:4 AND R.PLANT_CD=:5`,
        [revisionIds.get('PFD'), revisionIds.get('PFMEA'), revisionIds.get('CONTROL_PLAN'), company, plant],
      );
      await this.recordEvent(qr, packageId, company, plant, 'CREATED', userId);
      return { packageId, company, plant, itemCode: dto.itemCode, itemName, phase: dto.phase, documents };
    });
  }

  async findAll(company: string, plant: string) {
    return this.tx.run((qr) => qr.query(
      `SELECT P.*, D.DOCUMENT_ID, D.DOCUMENT_TYPE, D.DOCUMENT_NO, D.TITLE, D.TEMPLATE_FORM_NO,
              R.REVISION_ID, R.REVISION_CODE, R.STATUS, R.PUBLISHED_AT, R.REVISION_DATE,
              R.CHANGE_REASON, R.CHANGE_DESCRIPTION,R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID
         FROM QUALITY_PLAN_PACKAGES P
         LEFT JOIN QUALITY_PLAN_DOCUMENTS D ON D.COMPANY=P.COMPANY AND D.PLANT_CD=P.PLANT_CD AND D.PACKAGE_ID=P.PACKAGE_ID
         LEFT JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID
        WHERE P.COMPANY=:1 AND P.PLANT_CD=:2
        ORDER BY P.UPDATED_AT DESC, D.DOCUMENT_TYPE, R.REVISION_CODE DESC`, [company, plant],
    ));
  }

  async findOne(packageId: number, company: string, plant: string) {
    const rows = await this.tx.run((qr) => qr.query(
      `SELECT P.*, D.DOCUMENT_ID, D.DOCUMENT_TYPE, D.DOCUMENT_NO, D.TITLE, D.TEMPLATE_FORM_NO,
              R.REVISION_ID, R.REVISION_CODE, R.STATUS, R.PUBLISHED_AT,R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID
         FROM QUALITY_PLAN_PACKAGES P
         JOIN QUALITY_PLAN_DOCUMENTS D ON D.COMPANY=P.COMPANY AND D.PLANT_CD=P.PLANT_CD AND D.PACKAGE_ID=P.PACKAGE_ID
         JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID
        WHERE P.PACKAGE_ID=:1 AND P.COMPANY=:2 AND P.PLANT_CD=:3
        ORDER BY D.DOCUMENT_TYPE, R.REVISION_CODE DESC`, [packageId, company, plant],
    ));
    if (!rows.length) throw new NotFoundException('문서 패키지를 찾을 수 없습니다.');
    return rows;
  }

  async update(packageId: number, dto: UpdatePlanPackageDto, company: string, plant: string, userId: string) {
    return this.tx.run(async (qr) => {
      const rows = await qr.query(
        `SELECT P.PACKAGE_ID,P.ITEM_CODE,
                (SELECT COUNT(*) FROM QUALITY_PLAN_DOCUMENTS D JOIN QUALITY_PLAN_REVISIONS R
                  ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID
                 WHERE D.PACKAGE_ID=P.PACKAGE_ID AND D.COMPANY=P.COMPANY AND D.PLANT_CD=P.PLANT_CD
                   AND R.STATUS IN ('PUBLISHED','SUPERSEDED')) AS "PUBLISHED_COUNT"
           FROM QUALITY_PLAN_PACKAGES P WHERE P.PACKAGE_ID=:1 AND P.COMPANY=:2 AND P.PLANT_CD=:3 FOR UPDATE`,
        [packageId, company, plant],
      );
      if (!rows.length) throw new NotFoundException('문서 패키지를 찾을 수 없습니다.');
      if (Number(rows[0].PUBLISHED_COUNT ?? 0) > 0) throw new BadRequestException('발행 이력이 있는 패키지 기본정보는 변경할 수 없습니다. 문서를 개정하세요.');
      if (dto.itemCode && dto.itemCode !== rows[0].ITEM_CODE) throw new BadRequestException('패키지의 품목은 변경할 수 없습니다. 새 패키지를 생성하세요.');
      await qr.query(
        `UPDATE QUALITY_PLAN_PACKAGES SET PROJECT_CODE=COALESCE(:1,PROJECT_CODE),PROJECT_NAME=COALESCE(:2,PROJECT_NAME),
          CUSTOMER_CODE=COALESCE(:3,CUSTOMER_CODE),CUSTOMER_NAME=COALESCE(:4,CUSTOMER_NAME),PART_NUMBER=COALESCE(:5,PART_NUMBER),
          PHASE=COALESCE(:6,PHASE),ORGANIZATION=COALESCE(:7,ORGANIZATION),KEY_CONTACT=COALESCE(:8,KEY_CONTACT),
          UPDATED_BY=:9,UPDATED_AT=SYSTIMESTAMP WHERE PACKAGE_ID=:10 AND COMPANY=:11 AND PLANT_CD=:12`,
        [dto.projectCode ?? null,dto.projectName ?? null,dto.customerCode ?? null,dto.customerName ?? null,
          dto.partNumber ?? null,dto.phase ?? null,dto.organization ?? null,dto.keyContact ?? null,userId,packageId,company,plant],
      );
      await this.recordEvent(qr, packageId, company, plant, 'UPDATED', userId);
      return { packageId };
    });
  }

  async recordOutputEvent(packageId: number, company: string, plant: string, actorId: string,
    eventType: 'PREVIEWED' | 'PDF_DOWNLOADED' | 'PRINTED' | 'EXCEL_DOWNLOADED', documentType?: string) {
    return this.tx.run(async (qr) => {
      const packages = await qr.query(
        `SELECT PACKAGE_ID FROM QUALITY_PLAN_PACKAGES WHERE PACKAGE_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3`,
        [packageId, company, plant],
      );
      if (!packages.length) throw new NotFoundException('문서 패키지를 찾을 수 없습니다.');
      const revisionDocumentType = documentType === 'PFD' || documentType === 'PFMEA'
        ? documentType
        : 'CONTROL_PLAN';
      const revisions = await qr.query(
        `SELECT D.DOCUMENT_ID,R.REVISION_ID
           FROM QUALITY_PLAN_DOCUMENTS D JOIN QUALITY_PLAN_REVISIONS R
             ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID
          WHERE D.PACKAGE_ID=:1 AND D.COMPANY=:2 AND D.PLANT_CD=:3
            AND D.DOCUMENT_TYPE=:4 AND R.STATUS='PUBLISHED'
          ORDER BY R.REVISION_CODE DESC FETCH FIRST 1 ROW ONLY`,
        [packageId, company, plant, revisionDocumentType],
      );
      if (!revisions.length) throw new BadRequestException('출력할 발행 Revision이 없습니다.');
      const eventId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_EVENT');
      await qr.query(
        `INSERT INTO QUALITY_PLAN_EVENTS
         (EVENT_ID,PACKAGE_ID,DOCUMENT_ID,REVISION_ID,COMPANY,PLANT_CD,EVENT_TYPE,ACTOR_ID,DETAIL)
         VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9)`,
        [eventId, packageId, Number(revisions[0].DOCUMENT_ID), Number(revisions[0].REVISION_ID), company, plant,
          eventType, actorId, JSON.stringify({ documentType: documentType ?? revisionDocumentType })],
      );
      return { eventId };
    });
  }

  async listEvents(packageId: number, company: string, plant: string) {
    return this.tx.run((qr) => qr.query(
      `SELECT E.EVENT_ID,E.EVENT_TYPE,E.ACTOR_ID,E.DETAIL,E.OCCURRED_AT,E.DOCUMENT_ID,E.REVISION_ID,
              D.DOCUMENT_TYPE,D.DOCUMENT_NO,R.REVISION_CODE
         FROM QUALITY_PLAN_EVENTS E
         LEFT JOIN QUALITY_PLAN_DOCUMENTS D ON D.COMPANY=E.COMPANY AND D.PLANT_CD=E.PLANT_CD AND D.DOCUMENT_ID=E.DOCUMENT_ID
         LEFT JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=E.COMPANY AND R.PLANT_CD=E.PLANT_CD AND R.REVISION_ID=E.REVISION_ID
        WHERE E.PACKAGE_ID=:1 AND E.COMPANY=:2 AND E.PLANT_CD=:3
        ORDER BY E.OCCURRED_AT DESC,E.EVENT_ID DESC`,
      [packageId, company, plant],
    ));
  }

  private async nextId(qr: QueryRunner, sequence: string): Promise<number> {
    const rows = await qr.query(`SELECT ${sequence}.NEXTVAL AS "NEXT_SEQ" FROM DUAL`);
    return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq);
  }

  private async recordEvent(qr: QueryRunner, packageId: number, company: string, plant: string, eventType: string, actorId: string) {
    const eventId = await this.nextId(qr, 'SEQ_QUALITY_PLAN_EVENT');
    await qr.query(
      `INSERT INTO QUALITY_PLAN_EVENTS (EVENT_ID, PACKAGE_ID, COMPANY, PLANT_CD, EVENT_TYPE, ACTOR_ID)
       VALUES (:1,:2,:3,:4,:5,:6)`, [eventId, packageId, company, plant, eventType, actorId],
    );
  }
}
