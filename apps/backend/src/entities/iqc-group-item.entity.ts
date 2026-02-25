/**
 * @file iqc-group-item.entity.ts
 * @description IQC 검사그룹-항목 매핑 엔티티 - 그룹에 포함된 검사항목과 순서
 *              시퀀스 PK 사용. 충돌 해결: itemId → inspItemId.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. GROUP_ID + INSP_ITEM_ID 복합 유니크 제약
 * 3. SEQ로 검사 순서 관리
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { IqcGroup } from './iqc-group.entity';

@Entity({ name: 'IQC_GROUP_ITEMS' })
@Unique(['groupId', 'inspItemId'])
@Index(['groupId'])
export class IqcGroupItem {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'GROUP_ID', type: 'int' })
  groupId: number;

  @Column({ name: 'INSP_ITEM_ID', type: 'int' })
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
  @JoinColumn({ name: 'GROUP_ID' })
  group: IqcGroup;
}
