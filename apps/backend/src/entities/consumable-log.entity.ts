/**
 * @file entities/consumable-log.entity.ts
 * @description 소모품 입출고/이동 로그 엔티티 - 소모품 이력을 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. consumableCode: 대상 소모품 코드
 * 3. logType: INCOMING(입고), ISSUE(출고), RETURN(반납) 등
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_LOGS' })
@Index(['consumableCode'])
@Index(['logType'])
export class ConsumableLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @Column({ name: 'LOG_TYPE', length: 50 })
  logType: string;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerCode: string | null;

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
