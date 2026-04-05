/**
 * @file src/entities/mat-receiving.entity.ts
 * @description 입고 전용 테이블 엔티티 - 입고 업무 관리용 (StockTransaction은 수불원장)
 *
 * 초보자 가이드:
 * 1. **MAT_RECEIVINGS**: IQC 합격건의 입고 이력을 관리하는 전용 테이블
 * 2. **receiveNo**: 같은 배치의 입고 아이템은 동일한 입고번호를 가짐
 * 3. **StockTransaction과의 관계**: 입고 시 MatReceiving + StockTransaction 모두 생성
 * 4. **복합 PK**: receiveNo + seq (같은 입고번호의 여러 품목 행)
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_RECEIVINGS' })
@Index(['matUid'])
@Index(['itemCode'])
@Index(['receiveDate'])
export class MatReceiving {
  @PrimaryColumn({ name: 'RECEIVE_NO', length: 50 })
  receiveNo: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ type: 'number', name: 'ARRIVAL_SEQ', nullable: true })
  arrivalSeq: number | null;

  @Column({ name: 'RECEIVE_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receiveDate: Date;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
