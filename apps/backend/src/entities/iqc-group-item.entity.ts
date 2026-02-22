/**
 * @file src/entities/iqc-group-item.entity.ts
 * @description IQC 검사그룹-항목 매핑 엔티티 — 그룹에 포함된 검사항목과 순서
 *
 * 초보자 가이드:
 * 1. IQC_GROUPS와 IQC_ITEM_MASTERS의 N:M 관계 중간 테이블
 * 2. SEQ로 검사 순서 관리
 * 3. GROUP_ID + ITEM_ID 복합 유니크 제약
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { IqcGroup } from './iqc-group.entity';

@Entity({ name: 'IQC_GROUP_ITEMS' })
@Unique(['groupId', 'itemId'])
@Index(['groupId'])
export class IqcGroupItem {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'GROUP_ID', length: 255 })
  groupId: string;

  @Column({ name: 'ITEM_ID', length: 255 })
  itemId: string;

  @Column({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @ManyToOne(() => IqcGroup, (group) => group.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'GROUP_ID' })
  group: IqcGroup;
}
