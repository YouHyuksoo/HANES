/**
 * @file entities/trace-log.entity.ts
 * @description 추적 로그 엔티티 - 제품/자재 이동 추적 이력을 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. 팔레트/박스/자재UID/제품UID/시리얼 등 다양한 추적 대상
 * 3. eventType: 이벤트 유형 (입고, 출고, 이동 등)
 * 4. self-reference: parent/children으로 트리 구조
 */
import {
  Entity,
  PrimaryGeneratedColumn,
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
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'TRACE_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  traceTime: Date;

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
  workerCode: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'SERIAL_NO', length: 255, nullable: true })
  serialNo: string | null;

  @Column({ name: 'EVENT_TYPE', length: 50, nullable: true })
  eventType: string | null;

  @Column({ name: 'EVENT_DATA', type: 'clob', nullable: true })
  eventData: string | null;

  @Column({ name: 'PARENT_ID', type: 'number', nullable: true })
  parentId: number | null;

  @ManyToOne(() => TraceLog, (trace) => trace.children, { nullable: true })
  @JoinColumn({ name: 'PARENT_ID' })
  parent: TraceLog | null;

  @OneToMany(() => TraceLog, (trace) => trace.parent)
  children: TraceLog[];

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

  /**
   * 시리얼 트리깊이 계산 (루트=0, 자식=1, 손자=2...)
   * 주의: Entity에서 직접 호출 시 parent가 로드되지 않았으면 0을 반환
   */
  getDepth(): number {
    let d = 0;
    let current: TraceLog | null = this;
    while (current?.parentId) {
      d++;
      current = current.parent;
    }
    return d;
  }
}
