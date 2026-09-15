import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PLAN_PACKAGES' })
@Index(['company', 'plant', 'itemCode', 'phase'])
export class QualityPlanPackageEntity {
  @PrimaryColumn({ name: 'PACKAGE_ID', type: 'number' }) packageId: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'PROJECT_CODE', type: 'varchar2', length: 50, nullable: true }) projectCode: string | null;
  @Column({ name: 'PROJECT_NAME', type: 'varchar2', length: 200, nullable: true }) projectName: string | null;
  @Column({ name: 'CUSTOMER_CODE', type: 'varchar2', length: 50, nullable: true }) customerCode: string | null;
  @Column({ name: 'CUSTOMER_NAME', type: 'varchar2', length: 200, nullable: true }) customerName: string | null;
  @Column({ name: 'ITEM_CODE', type: 'varchar2', length: 50 }) itemCode: string;
  @Column({ name: 'ITEM_NAME', type: 'varchar2', length: 200 }) itemName: string;
  @Column({ name: 'PART_NUMBER', type: 'varchar2', length: 100, nullable: true }) partNumber: string | null;
  @Column({ name: 'PHASE', type: 'varchar2', length: 20 }) phase: string;
  @Column({ name: 'ORGANIZATION', type: 'varchar2', length: 200, nullable: true }) organization: string | null;
  @Column({ name: 'KEY_CONTACT', type: 'varchar2', length: 100, nullable: true }) keyContact: string | null;
  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 }) createdBy: string;
  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' }) updatedAt: Date;
}
