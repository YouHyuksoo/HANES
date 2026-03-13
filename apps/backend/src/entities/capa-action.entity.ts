/**
 * @file capa-action.entity.ts
 * @description CAPA 조치 항목 엔티티 — 시정/예방 조치의 개별 실행 항목
 *
 * 초보자 가이드:
 * 1. 하나의 CAPA 요청에 여러 조치 항목이 연결됨 (1:N 관계)
 * 2. 각 항목은 담당자, 기한, 진행 상태를 개별 관리
 * 3. 상태: PENDING → IN_PROGRESS → DONE
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { CAPARequest } from './capa-request.entity';

@Entity({ name: 'CAPA_ACTIONS' })
export class CAPAAction {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'CAPA_ID' })
  capaId: number;

  @ManyToOne(() => CAPARequest, { nullable: false })
  @JoinColumn({ name: 'CAPA_ID' })
  capaRequest: CAPARequest;

  @Column({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ACTION_DESC', length: 1000 })
  actionDesc: string;

  @Column({ name: 'RESPONSIBLE_CODE', length: 50, nullable: true })
  responsibleCode: string;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'STATUS', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'RESULT', length: 1000, nullable: true })
  result: string;

  @Column({ name: 'COMPLETED_AT', type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
