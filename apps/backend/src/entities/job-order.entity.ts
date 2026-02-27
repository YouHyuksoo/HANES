/**
 * @file job-order.entity.ts
 * @description 작업지시(JobOrder) 엔티티 - 생산 작업지시 정보를 관리한다.
 *              orderNo를 자연키 PK로 사용하며, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ORDER_NO가 PK (UUID 대신 자연키)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. PARENT_ID로 부모 작업지시를 self-reference
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProdResult } from './prod-result.entity';
import { PartMaster } from './part-master.entity';

@Entity({ name: 'JOB_ORDERS' })
@Index(['status'])
@Index(['planDate'])
@Index(['lineCode'])
export class JobOrder {
  @PrimaryColumn({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ name: 'PARENT_ID', length: 50, nullable: true })
  parentOrderNo: string | null;

  @ManyToOne(() => JobOrder, (jo) => jo.children, { nullable: true })
  @JoinColumn({ name: 'PARENT_ID' })
  parent: JobOrder | null;

  @OneToMany(() => JobOrder, (jo) => jo.parent)
  children: JobOrder[];

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => PartMaster, { nullable: true })
  @JoinColumn({ name: 'ITEM_CODE' })
  part: PartMaster | null;

  @Column({ name: 'LINE_CODE', length: 255, nullable: true })
  lineCode: string | null;

  @Column({ name: 'PLAN_QTY', type: 'int' })
  planQty: number;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'PLAN_DATE', type: 'date', nullable: true })
  planDate: Date | null;

  @Column({ name: 'START_TIME', type: 'timestamp', nullable: true })
  startAt: Date | null;

  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endAt: Date | null;

  @Column({ name: 'PRIORITY', type: 'int', default: 5 })
  priority: number;

  @Column({ name: 'STATUS', length: 50, default: 'WAITING' })
  status: string;

  @Column({ name: 'CUST_PO_NO', length: 50, nullable: true })
  custPoNo: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ERP_SYNC_YN', length: 1, default: 'N' })
  erpSyncYn: string;

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

  @OneToMany(() => ProdResult, (prodResult) => prodResult.jobOrder)
  prodResults: ProdResult[];
}
