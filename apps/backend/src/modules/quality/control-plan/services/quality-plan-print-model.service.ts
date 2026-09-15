import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionService } from '../../../../shared/transaction.service';

@Injectable()
export class QualityPlanPrintModelService {
  constructor(private readonly tx: TransactionService) {}

  async getPackagePrintModel(packageId: number, company: string, plant: string) {
    return this.tx.run(async (qr) => {
      const documents = await qr.query(
        `SELECT P.*,D.DOCUMENT_ID,D.DOCUMENT_TYPE,D.DOCUMENT_NO,D.TITLE,D.TEMPLATE_FORM_NO,D.TEMPLATE_REVISION,
                R.REVISION_ID,R.REVISION_CODE,R.ISSUE_DATE,R.REVISION_DATE,R.PUBLISHED_AT,R.CHANGE_REASON,
                R.CHANGE_DESCRIPTION,R.AUTHOR_ID,R.PUBLISHER_ID,R.REF_PFD_REVISION_ID,R.REF_PFMEA_REVISION_ID
           FROM QUALITY_PLAN_PACKAGES P JOIN QUALITY_PLAN_DOCUMENTS D
             ON D.COMPANY=P.COMPANY AND D.PLANT_CD=P.PLANT_CD AND D.PACKAGE_ID=P.PACKAGE_ID
           JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID
          WHERE P.PACKAGE_ID=:1 AND P.COMPANY=:2 AND P.PLANT_CD=:3 AND R.STATUS='PUBLISHED'
            AND NOT EXISTS (SELECT 1 FROM QUALITY_PLAN_REVISIONS N WHERE N.COMPANY=R.COMPANY AND N.PLANT_CD=R.PLANT_CD
              AND N.DOCUMENT_ID=R.DOCUMENT_ID AND N.STATUS='PUBLISHED' AND N.REVISION_CODE>R.REVISION_CODE)
          ORDER BY D.DOCUMENT_TYPE`, [packageId, company, plant],
      );
      if (!documents.length) throw new NotFoundException('출력할 발행 Revision이 없습니다.');
      const byType = Object.fromEntries(documents.map((row: any) => [row.DOCUMENT_TYPE, row]));
      const pfdRows = byType.PFD ? await qr.query(`SELECT * FROM QUALITY_PROCESS_FLOW_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 ORDER BY ROW_SEQ`, [byType.PFD.REVISION_ID, company, plant]) : [];
      const pfmeaRows = byType.PFMEA ? await qr.query(`SELECT * FROM QUALITY_PFMEA_ROWS WHERE REVISION_ID=:1 AND COMPANY=:2 AND PLANT_CD=:3 ORDER BY ROW_SEQ`, [byType.PFMEA.REVISION_ID, company, plant]) : [];
      const controlPlanRows = byType.CONTROL_PLAN ? await qr.query(
        `SELECT C.*, F.FLOW_LANE, F.PROCESS_CODE
           FROM QUALITY_CONTROL_PLAN_ROWS C
           JOIN QUALITY_PROCESS_FLOW_ROWS F ON F.ROW_ID=C.PROCESS_FLOW_ROW_ID
            AND F.COMPANY=C.COMPANY AND F.PLANT_CD=C.PLANT_CD
          WHERE C.REVISION_ID=:1 AND C.COMPANY=:2 AND C.PLANT_CD=:3 ORDER BY C.ROW_SEQ`,
        [byType.CONTROL_PLAN.REVISION_ID, company, plant],
      ) : [];
      const revisions = await qr.query(`SELECT D.DOCUMENT_TYPE,D.DOCUMENT_NO,R.REVISION_CODE,R.STATUS,R.REVISION_DATE,R.PUBLISHED_AT,R.CHANGE_REASON,R.CHANGE_DESCRIPTION,R.AUTHOR_ID,R.PUBLISHER_ID FROM QUALITY_PLAN_DOCUMENTS D JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=D.COMPANY AND R.PLANT_CD=D.PLANT_CD AND R.DOCUMENT_ID=D.DOCUMENT_ID WHERE D.PACKAGE_ID=:1 AND D.COMPANY=:2 AND D.PLANT_CD=:3 ORDER BY D.DOCUMENT_TYPE,R.REVISION_CODE`, [packageId, company, plant]);
      const participants = await qr.query(`SELECT P.* FROM QUALITY_PLAN_PARTICIPANTS P JOIN QUALITY_PLAN_REVISIONS R ON R.COMPANY=P.COMPANY AND R.PLANT_CD=P.PLANT_CD AND R.REVISION_ID=P.REVISION_ID JOIN QUALITY_PLAN_DOCUMENTS D ON D.COMPANY=R.COMPANY AND D.PLANT_CD=R.PLANT_CD AND D.DOCUMENT_ID=R.DOCUMENT_ID WHERE D.PACKAGE_ID=:1 AND P.COMPANY=:2 AND P.PLANT_CD=:3 AND R.STATUS='PUBLISHED'`, [packageId, company, plant]);
      return { package: documents[0], documents, pfdRows, pfmeaRows, controlPlanRows, revisions, participants };
    });
  }
}
