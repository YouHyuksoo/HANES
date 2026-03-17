/**
 * @file iqc-group-item.entity.ts
 * @description IQC 검사그룹-항목 매핑 엔티티 - 그룹에 포함된 검사항목과 순서
 *              groupId + inspItemId 복합 PK를 사용한다.
 *
 * 초보자 가이드:
 * 1. groupId + inspItemId가 복합 PK (자연키)
 * 2. SEQ로 검사 순서 관리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IqcGroup } from './iqc-group.entity';
import { IqcItemPool } from './iqc-item-pool.entity';

@Entity({ name: 'IQC_GROUP_ITEMS' })
@Index(['groupId'])
export class IqcGroupItem {
  @PrimaryColumn({ name: 'GROUP_ID', type: 'int' })
  groupId: number;

  @PrimaryColumn({ name: 'INSP_ITEM_ID', type: 'int' })
  inspItemId: number;

  @Column({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

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

  @ManyToOne(() => IqcGroup, (group) => group.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'GROUP_ID', referencedColumnName: 'id' })
  group: IqcGroup;

  @ManyToOne(() => IqcItemPool, { eager: false })
  @JoinColumn({ name: 'INSP_ITEM_ID', referencedColumnName: 'id' })
  inspItem: IqcItemPool;
}
