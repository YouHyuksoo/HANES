/**
 * @file control-plan.entity.ts
 * @description 관리계획서(Control Plan) 엔티티 — IATF 16949 8.5.1.1
 *
 * 초보자 가이드:
 * 1. 제품/공정별 품질특성, 관리방법, 검사기준을 정의하는 관리계획서
 * 2. 단계: PROTOTYPE(시작품) → PRE_LAUNCH(양산시험) → PRODUCTION(양산)
 * 3. 상태 흐름: DRAFT → REVIEW → APPROVED → OBSOLETE
 * 4. planNo 자동채번: CP-YYYYMMDD-NNN
 * 5. 개정(revise) 시 기존 버전을 OBSOLETE로 변경하고 새 버전 생성
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
import { PartMaster } from './part-master.entity';

@Entity({ name: 'CONTROL_PLANS' })
@Index(['company', 'plant', 'planNo'], { unique: true })
@Index(['company', 'plant', 'itemCode'])
export class ControlPlan {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'PLAN_NO', length: 30 })
  planNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => PartMaster, { nullable: true })
  @JoinColumn({ name: 'ITEM_CODE' })
  part: PartMaster | null;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string;

  @Column({ name: 'REVISION_NO', type: 'int', default: 1 })
  revisionNo: number;

  @Column({ name: 'REVISION_DATE', type: 'timestamp', nullable: true })
  revisionDate: Date;

  @Column({ name: 'PHASE', length: 30 })
  phase: string;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'REMARKS', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
