/**
 * @file src/entities/mat-receiving.entity.ts
 * @description 입고 전용 테이블 엔티티 - 입고 업무 관리용 (StockTransaction은 수불원장)
 *
 * 초보자 가이드:
 * 1. **MAT_RECEIVINGS**: IQC 합격건의 입고 이력을 관리하는 전용 테이블
 * 2. **receiveNo**: 같은 배치의 입고 아이템은 동일한 입고번호를 가짐
 * 3. **StockTransaction과의 관계**: 입고 시 MatReceiving + StockTransaction 모두 생성
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_RECEIVINGS' })
@Index(['receiveNo'])
@Index(['lotId'])
@Index(['partId'])
@Index(['receiveDate'])
export class MatReceiving {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'RECEIVE_NO', length: 50 })
  receiveNo: string;

  @Column({ name: 'LOT_ID', length: 50 })
  lotId: string;

  @Column({ name: 'PART_ID', length: 50 })
  partId: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ name: 'RECEIVE_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receiveDate: Date;

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
