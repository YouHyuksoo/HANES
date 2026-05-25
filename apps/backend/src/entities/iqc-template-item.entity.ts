/**
 * @file iqc-template-item.entity.ts
 * @description IQC 템플릿 검사항목 엔티티
 *              COMPANY + PLANT_CD + TEMPLATE_ID + SEQ 복합 PK.
 *              측정형(LSL/USL) 또는 판정형(JUDGE_CRITERIA) 기준을 함께 저장한다.
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { IqcTemplate } from './iqc-template.entity';
import { IqcItemPool } from './iqc-item-pool.entity';

@Entity({ name: 'IQC_TEMPLATE_ITEMS' })
export class IqcTemplateItem {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'TEMPLATE_ID', length: 50 })
  templateId: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'INSP_ITEM_CODE', length: 20 })
  inspItemCode: string;

  @Column({ name: 'LSL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lsl: number | null;

  @Column({ name: 'USL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  usl: number | null;

  @Column({ name: 'JUDGE_CRITERIA', type: 'varchar2', length: 500, nullable: true })
  judgeCriteria: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => IqcTemplate, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'TEMPLATE_ID', referencedColumnName: 'templateId' },
  ])
  template: IqcTemplate;

  @ManyToOne(() => IqcItemPool, { eager: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'INSP_ITEM_CODE', referencedColumnName: 'inspItemCode' },
  ])
  inspItem: IqcItemPool;
}
