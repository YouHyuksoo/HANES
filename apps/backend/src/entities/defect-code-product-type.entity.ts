import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'DEFECT_CODE_PRODUCT_TYPES' })
@Index(['company', 'plant', 'productType'])
export class DefectCodeProductType {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ type: 'varchar2', name: 'DEFECT_CODE', length: 50 })
  defectCode: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PRODUCT_TYPE', length: 50 })
  productType: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
