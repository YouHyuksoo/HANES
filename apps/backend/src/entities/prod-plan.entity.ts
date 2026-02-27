/**
 * @file src/entities/prod-plan.entity.ts
 * @description 월간생산계획(ProdPlan) 엔티티 - 월별 생산 계획 정보를 관리한다.
 *
 * 초보자 가이드:
 * 1. ID가 PK (자동증가 시퀀스)
 * 2. PLAN_NO는 유니크 자연키 (PP-YYYYMM-NNN)
 * 3. ITEM_CODE로 PartMaster(품목)를 참조
 * 4. STATUS: DRAFT → CONFIRMED → CLOSED 워크플로우
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

@Entity({ name: 'PROD_PLANS' })
@Index(['planMonth'])
@Index(['status'])
export class ProdPlan {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'PLAN_NO', length: 50, unique: true })
  planNo: string;

  @Column({ name: 'PLAN_MONTH', length: 7 })
  planMonth: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => PartMaster, { nullable: true })
  @JoinColumn({ name: 'ITEM_CODE' })
  part: PartMaster | null;

  @Column({ name: 'ITEM_TYPE', length: 10 })
  itemType: string;

  @Column({ name: 'PLAN_QTY', type: 'int' })
  planQty: number;

  @Column({ name: 'ORDER_QTY', type: 'int', default: 0 })
  orderQty: number;

  @Column({ name: 'CUSTOMER', length: 50, nullable: true })
  customer: string | null;

  @Column({ name: 'LINE_CODE', length: 255, nullable: true })
  lineCode: string | null;

  @Column({ name: 'PRIORITY', type: 'int', default: 5 })
  priority: number;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
