/**
 * @file entities/trace-log.entity.ts
 * @description 추적 로그 엔티티 - 제품/자재 이동 추적 이력을 관리한다.
 *              복합 PK(TRACE_TIME + SEQ) 사용.
 *
 * 초보자 가이드:
 * 1. 복합 PK: traceTime(TRACE_TIME) + seq(SEQ)
 * 2. 팔레트/박스/자재UID/제품UID/시리얼 등 다양한 추적 대상
 * 3. eventType: 이벤트 유형 (입고, 출고, 이동 등)
 * 4. self-reference: parent/children으로 트리 구조 (PARENT_ID로 참조)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

@Entity({ name: 'TRACE_LOGS' })
@Index(['palletId'])
@Index(['boxId'])
@Index(['matUid'])
@Index(['prdUid'])
@Index(['matLotId'])
@Index(['serialNo'])
@Index(['eventType'])
export class TraceLog {
  @PrimaryColumn({ name: 'TRACE_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  traceTime: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'PALLET_ID', length: 255, nullable: true })
  palletId: string | null;

  @Column({ name: 'BOX_ID', length: 255, nullable: true })
  boxId: string | null;

  @Column({ name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;

  @Column({ name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ name: 'MAT_LOT_ID', length: 255, nullable: true })
  matLotId: string | null;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'SERIAL_NO', length: 255, nullable: true })
  serialNo: string | null;

  @Column({ name: 'EVENT_TYPE', length: 50, nullable: true })
  eventType: string | null;

  @Column({ name: 'EVENT_DATA', type: 'clob', nullable: true })
  eventData: string | null;

  @Column({ name: 'PARENT_ID', type: 'int', nullable: true })
  parentId: number | null;

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

  /**
   * 시리얼 트리깊이 계산 (루트=0, 자식=1, 손자=2...)
   * 주의: parentId만으로는 depth 계산 불가 — 서비스 레이어에서 재귀 조회 필요
   */
  getDepth(): number {
    return this.parentId ? 1 : 0;
  }
}
