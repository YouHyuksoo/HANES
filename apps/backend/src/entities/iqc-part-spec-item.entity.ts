/**
 * @file iqc-part-spec-item.entity.ts
 * @description 품목별 IQC 검사항목 세부 엔티티
 *              COMPANY + PLANT_CD + ITEM_CODE + SEQ 복합 PK. IQC_ITEM_POOL 참조 + 개별 LSL/USL.
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { IqcPartSpec } from './iqc-part-spec.entity';
import { IqcItemPool } from './iqc-item-pool.entity';

@Entity({ name: 'IQC_PART_SPEC_ITEMS' })
export class IqcPartSpecItem {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'INSP_ITEM_CODE', length: 20 })
  inspItemCode: string;

  @Column({ name: 'LSL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lsl: number | null;

  @Column({ name: 'USL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  usl: number | null;

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

  @ManyToOne(() => IqcPartSpec, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'ITEM_CODE', referencedColumnName: 'itemCode' },
  ])
  spec: IqcPartSpec;

  @ManyToOne(() => IqcItemPool, { eager: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'INSP_ITEM_CODE', referencedColumnName: 'inspItemCode' },
  ])
  inspItem: IqcItemPool;
}
