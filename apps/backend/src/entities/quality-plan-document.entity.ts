import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PLAN_DOCUMENTS' })
@Index(['company', 'plant', 'documentNo'], { unique: true })
export class QualityPlanDocumentEntity {
  @PrimaryColumn({ name: 'DOCUMENT_ID', type: 'number' }) documentId: number;
  @Column({ name: 'PACKAGE_ID', type: 'number' }) packageId: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'DOCUMENT_TYPE', type: 'varchar2', length: 20 }) documentType: string;
  @Column({ name: 'DOCUMENT_NO', type: 'varchar2', length: 50 }) documentNo: string;
  @Column({ name: 'TITLE', type: 'varchar2', length: 200 }) title: string;
  @Column({ name: 'TEMPLATE_FORM_NO', type: 'varchar2', length: 30 }) templateFormNo: string;
  @Column({ name: 'TEMPLATE_REVISION', type: 'varchar2', length: 10, default: '00' }) templateRevision: string;
  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 }) createdBy: string;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
}
