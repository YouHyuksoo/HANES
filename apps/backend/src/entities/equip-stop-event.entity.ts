/**
 * @file entities/equip-stop-event.entity.ts
 * @description 설비정지 이벤트 엔티티 - 설비가 멈춘 구간(정지~해제)을 한 행으로 기록한다.
 *
 * 초보자 가이드:
 * 1. PK stopId는 Oracle SEQUENCE(SEQ_EQUIP_STOP_EVENTS)로 채번한다(서비스에서 NEXTVAL 조회).
 * 2. status: OPEN(정지중) → CLOSED(해제완료). 설비당 OPEN은 UX_EQUIP_STOP_OPEN 유니크 인덱스로 1건만 허용.
 * 3. stopReason이 null이면 "사유미정". 해제하려면 사유가 확정돼 있어야 한다.
 * 4. lossSeconds는 해제 시 서버가 RELEASED_AT-STARTED_AT로 계산해 고정한다(클라 시계 미사용).
 * 5. prevEquipStatus: 정지 직전 EQUIP_MASTERS.STATUS. 해제 시 이 값으로 되돌린다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'EQUIP_STOP_EVENTS' })
@Index(['company', 'plant', 'equipCode', 'startedAt'])
export class EquipStopEvent {
  @PrimaryColumn({ name: 'STOP_ID', type: 'number' })
  stopId: number;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ type: 'varchar2', name: 'JOB_ORDER_NO', length: 50, nullable: true })
  jobOrderNo: string | null;

  /** COM_CODES(EQUIP_STOP_REASON). null = 사유미정 */
  @Column({ type: 'varchar2', name: 'STOP_REASON', length: 50, nullable: true })
  stopReason: string | null;

  @Column({ type: 'varchar2', name: 'STOP_REMARK', length: 500, nullable: true })
  stopRemark: string | null;

  @Column({ type: 'varchar2', name: 'STATUS', length: 20, default: 'OPEN' })
  status: 'OPEN' | 'CLOSED';

  @Column({ name: 'STARTED_AT', type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'varchar2', name: 'STARTED_BY', length: 50, nullable: true })
  startedBy: string | null;

  @Column({ type: 'timestamp', name: 'RELEASED_AT', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'varchar2', name: 'RELEASED_BY', length: 50, nullable: true })
  releasedBy: string | null;

  @Column({ type: 'varchar2', name: 'RELEASE_REMARK', length: 500, nullable: true })
  releaseRemark: string | null;

  /** 유실시간(초). 해제 시 서버가 확정 */
  @Column({ type: 'number', name: 'LOSS_SECONDS', nullable: true })
  lossSeconds: number | null;

  @Column({ type: 'varchar2', name: 'PREV_EQUIP_STATUS', length: 20, nullable: true })
  prevEquipStatus: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
