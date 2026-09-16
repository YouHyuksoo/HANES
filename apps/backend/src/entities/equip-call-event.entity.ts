/**
 * @file entities/equip-call-event.entity.ts
 * @description 관리자호출 이력 엔티티 - 현장에서 관리자/엔지니어를 부른 기록.
 *
 * 초보자 가이드:
 * 1. PK callId는 Oracle SEQUENCE(SEQ_EQUIP_CALL_EVENTS)로 채번한다.
 * 2. status: OPEN(호출중) → ACKED(응대완료). 설비당 OPEN은 UX_EQUIP_CALL_OPEN으로 1건만 허용.
 * 3. callType: COM_CODES(EQUIP_CALL_TYPE).
 * 4. 1단계는 이력 기록 + 화면 표시까지다. 알림 발송은 범위 밖.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'EQUIP_CALL_EVENTS' })
@Index(['company', 'plant', 'equipCode', 'calledAt'])
export class EquipCallEvent {
  @PrimaryColumn({ name: 'CALL_ID', type: 'number' })
  callId: number;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ type: 'varchar2', name: 'JOB_ORDER_NO', length: 50, nullable: true })
  jobOrderNo: string | null;

  @Column({ type: 'varchar2', name: 'CALL_TYPE', length: 50 })
  callType: string;

  @Column({ type: 'varchar2', name: 'CALL_REMARK', length: 500, nullable: true })
  callRemark: string | null;

  @Column({ type: 'varchar2', name: 'STATUS', length: 20, default: 'OPEN' })
  status: 'OPEN' | 'ACKED';

  @Column({ name: 'CALLED_AT', type: 'timestamp' })
  calledAt: Date;

  @Column({ type: 'varchar2', name: 'CALLED_BY', length: 50, nullable: true })
  calledBy: string | null;

  @Column({ type: 'timestamp', name: 'ACKED_AT', nullable: true })
  ackedAt: Date | null;

  @Column({ type: 'varchar2', name: 'ACKED_BY', length: 50, nullable: true })
  ackedBy: string | null;

  @Column({ type: 'varchar2', name: 'ACK_REMARK', length: 500, nullable: true })
  ackRemark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
