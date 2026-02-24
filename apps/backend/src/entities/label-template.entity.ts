import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'LABEL_TEMPLATES' })
@Unique(['templateName', 'category'])
@Index(['category'])
@Index(['isDefault'])
export class LabelTemplate {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'TEMPLATE_NAME', length: 100 })
  templateName: string;

  @Column({ name: 'CATEGORY', length: 50 })
  category: string;

  @Column({ name: 'DESIGN_DATA', type: 'clob' })
  designData: string;

  @Column({ name: 'IS_DEFAULT', default: false })
  isDefault: boolean;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ZPL_CODE', type: 'clob', nullable: true })
  zplCode: string | null;

  @Column({ name: 'PRINT_MODE', length: 20, default: 'BROWSER' })
  printMode: string;

  @Column({ name: 'PRINTER_ID', length: 36, nullable: true })
  printerId: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
