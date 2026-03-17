/**
 * @file src/entities/physical-inv-session.entity.ts
 * @description 재고실사 세션 엔티티 — 실사 개시/완료 상태를 추적하는 테이블
 *
 * 초보자 가이드:
 * 1. **목적**: PC에서 "실사 개시" 버튼을 누르면 이 테이블에 status='IN_PROGRESS' 레코드가 생성됩니다.
 * 2. **인터락**: 실사가 진행 중(IN_PROGRESS)이면 InventoryFreezeGuard가 자재 트랜잭션을 차단합니다.
 * 3. **완료**: "실사반영" 후 status='COMPLETED'로 업데이트합니다.
 * 4. **invType**: 'MATERIAL'(자재실사) | 'PRODUCT'(제품실사)
 * 5. **scope**: 전사 차단 또는 특정 창고(warehouseCode)만 차단할 수 있습니다.
 * 6. **sessionDate + seq**: 복합 PK (세션일자 + 일련번호)
 *
 * DB 테이블: PHYSICAL_INV_SESSIONS
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** 실사 진행 상태 */
export type PhysicalInvStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** 실사 유형 */
export type PhysicalInvType = 'MATERIAL' | 'PRODUCT';

@Entity({ name: 'PHYSICAL_INV_SESSIONS' })
@Index(['status'])
@Index(['company', 'plant', 'status'])
export class PhysicalInvSession {
  @PrimaryColumn({ name: 'SESSION_DATE', type: 'date', default: () => 'SYSDATE' })
  sessionDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  /** 실사 유형: MATERIAL(자재) | PRODUCT(제품) */
  @Column({ name: 'INV_TYPE', length: 20 })
  invType: PhysicalInvType;

  /** 진행 상태: IN_PROGRESS | COMPLETED | CANCELLED */
  @Column({ name: 'STATUS', length: 20, default: 'IN_PROGRESS' })
  status: PhysicalInvStatus;

  /** 기준년월 (YYYY-MM) — 실사 기준이 되는 연월 */
  @Column({ name: 'COUNT_MONTH', length: 7 })
  countMonth: string;

  /**
   * 차단 범위 - 창고 코드 (null이면 전체 창고 차단)
   * 특정 창고만 실사 중일 때 해당 창고 코드를 저장
   */
  @Column({ name: 'WAREHOUSE_CODE', length: 50, nullable: true })
  warehouseCode: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'STARTED_BY', length: 50, nullable: true })
  startedBy: string | null;

  @Column({ name: 'COMPLETED_BY', length: 50, nullable: true })
  completedBy: string | null;

  @Column({ name: 'COMPLETED_AT', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
