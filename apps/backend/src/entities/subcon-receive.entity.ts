/**
 * @file subcon-receive.entity.ts
 * @description 외주수입(SubconReceive) 엔티티 - 외주 가공품 수입검사/입고 정보를 기록한다.
 *              시퀀스 PK 사용, orderId → orderNo로 SubconOrder 참조.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. ORDER_NO로 SubconOrder(외주발주)를 참조
 * 3. RECEIVE_NO: 수입번호 (유니크)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'SUBCON_RECEIVES' })
@Unique(['receiveNo'])
@Index(['orderNo'])
@Index(['receivedAt'])
export class SubconReceive {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ name: 'RECEIVE_NO', length: 255, unique: true })
  receiveNo: string;

  @Column({ name: 'LOT_NO', length: 255, nullable: true })
  lotNo: string | null;

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

  @Column({ name: 'STATUS', length: 50, default: 'DONE' })
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
}
