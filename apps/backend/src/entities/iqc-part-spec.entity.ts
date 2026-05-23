/**
 * @file iqc-part-spec.entity.ts
 * @description 품목별 IQC 기준 헤더 엔티티
 *              COMPANY + PLANT_CD + ITEM_CODE 복합키. 시료수·파괴검사여부 보유.
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { IqcPartSpecItem } from './iqc-part-spec-item.entity';

@Entity({ name: 'IQC_PART_SPECS' })
export class IqcPartSpec {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

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

  @OneToMany(() => IqcPartSpecItem, (i) => i.spec, { cascade: true })
  items: IqcPartSpecItem[];
}
