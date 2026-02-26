/**
 * @file src/entities/mat-issue.entity.ts
 * @description 자재 출고 엔티티 - 작업지시 기반 자재 투입/출고 이력
 *
 * 초보자 가이드:
 * - issueType: 출고 유형 (PRODUCTION, MANUAL, SCRAP 등)
 * - id: SEQUENCE 자동증분 PK
 * - matUid: 출고 자재시리얼, orderNo: 작업지시 참조
 * - prodResultId: 생산실적 ID (number, 자재 투입 이력 연결)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProdResult } from './prod-result.entity';

@Entity({ name: 'MAT_ISSUES' })
@Index(['orderNo'])
@Index(['matUid'])
@Index(['issueType'])
@Index(['issueNo'])
export class MatIssue {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ISSUE_NO', length: 50, nullable: true })
  issueNo: string | null;

  @Column({ name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ name: 'PROD_RESULT_ID', type: 'int', nullable: true })
  prodResultId: number | null;

  @ManyToOne(() => ProdResult, { nullable: true })
  @JoinColumn({ name: 'PROD_RESULT_ID' })
  prodResult: ProdResult | null;

  @Column({ name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ name: 'ISSUE_QTY', type: 'int' })
  issueQty: number;

  @Column({ name: 'ISSUE_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  issueDate: Date;

  @Column({ name: 'ISSUE_TYPE', length: 20 })
  issueType: string;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

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
