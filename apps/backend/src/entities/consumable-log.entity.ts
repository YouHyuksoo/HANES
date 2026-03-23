/**
 * @file entities/consumable-log.entity.ts
 * @description 소모품 입출고/이동 로그 엔티티 - 소모품 이력을 관리한다.
 *              복합키: TRANS_DATE + SEQ (일자 + 일련번호).
 *
 * 초보자 가이드:
 * 1. 복합 PK: transDate(거래일) + seq(일련번호)
 * 2. consumableCode: 대상 소모품 코드
 * 3. logType: INCOMING(입고), ISSUE(출고), RETURN(반납) 등
 * 4. id는 레거시 FK 호환을 위해 generated @Column으로 유지
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
import { ConsumableMaster } from './consumable-master.entity';

@Entity({ name: 'CONSUMABLE_LOGS' })
@Index(['consumableCode'])
@Index(['logType'])
export class ConsumableLog {
  @PrimaryColumn({ name: 'TRANS_DATE', type: 'date' })
  transDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @ManyToOne(() => ConsumableMaster, (master) => master.logs)
  @JoinColumn({ name: 'CONSUMABLE_CODE', referencedColumnName: 'consumableCode' })
  master: ConsumableMaster;

  @Column({ name: 'LOG_TYPE', length: 50 })
  logType: string;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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

  @Column({ name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ name: 'VENDOR_NAME', length: 100, nullable: true })
  vendorName: string | null;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'INCOMING_TYPE', length: 50, nullable: true })
  incomingType: string | null;

  @Column({ name: 'DEPARTMENT', length: 50, nullable: true })
  department: string | null;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string | null;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @Column({ name: 'ISSUE_REASON', length: 200, nullable: true })
  issueReason: string | null;

  @Column({ name: 'RETURN_REASON', length: 200, nullable: true })
  returnReason: string | null;

  @Column({ name: 'CON_UID', length: 50, nullable: true })
  conUid: string | null;
}
