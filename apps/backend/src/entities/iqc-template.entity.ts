/**
 * @file iqc-template.entity.ts
 * @description IQC 항목 템플릿 헤더 엔티티
 *              COMPANY + PLANT_CD + TEMPLATE_ID 복합 PK.
 *              자주 쓰는 검사 구성(시료단위·파괴검사 + 항목 리스트)을 저장한다.
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { IqcTemplateItem } from './iqc-template-item.entity';

@Entity({ name: 'IQC_TEMPLATES' })
export class IqcTemplate {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'TEMPLATE_ID', length: 50 })
  templateId: string;

  @Column({ name: 'TEMPLATE_NAME', length: 200 })
  templateName: string;

  @Column({ name: 'SAMPLE_QTY', type: 'int', default: 1 })
  sampleQty: number;

  @Column({ name: 'IS_DEST', length: 1, default: 'N' })
  isDest: string;

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

  @OneToMany(() => IqcTemplateItem, (i) => i.template, { cascade: true })
  items: IqcTemplateItem[];
}
