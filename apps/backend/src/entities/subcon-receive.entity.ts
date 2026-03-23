/**
 * @file subcon-receive.entity.ts
 * @description 외주수입(SubconReceive) 엔티티 - 외주 가공품 수입검사/입고 정보를 기록한다.
 *              자연키 PK: receiveNo (수입번호).
 *
 * 초보자 가이드:
 * 1. receiveNo가 PK (자연키)
 * 2. ORDER_ID로 SubconOrder(외주발주)를 참조
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SUBCON_RECEIVES' })
@Index(['orderNo'])
@Index(['receivedAt'])
export class SubconReceive {
  @Column({ name: 'ORDER_ID', length: 50 })
  orderNo: string;

  @PrimaryColumn({ name: 'RECEIVE_NO', length: 255 })
  receiveNo: string;

  @Column({ name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'RECEIVE_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt: Date;

  @Column({ name: 'INSPECT_RESULT', length: 255, nullable: true })
  inspectResult: string | null;

  @Column({ name: 'WORKER_ID', length: 255, nullable: true })
  workerId: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

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
}
