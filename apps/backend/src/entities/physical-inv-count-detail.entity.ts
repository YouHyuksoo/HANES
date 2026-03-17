/**
 * @file src/entities/physical-inv-count-detail.entity.ts
 * @description 재고실사 카운트 상세 엔티티 — PDA 바코드 스캔 결과를 세션별로 저장
 *
 * 초보자 가이드:
 * 1. **목적**: PDA에서 자재 바코드를 스캔하면 이 테이블에 실사수량이 누적됩니다.
 * 2. **복합 PK**: (SESSION_DATE + SEQ + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
 *    - SESSION_DATE + SEQ → PhysicalInvSession FK
 *    - WAREHOUSE_CODE + ITEM_CODE + MAT_UID → MatStock 식별자
 * 3. **COUNTED_QTY**: PDA 스캔으로 누적된 실사수량
 * 4. **SYSTEM_QTY**: 실사 시점의 시스템(장부) 수량 스냅샷
 * 5. **LOCATION_CODE**: PDA에서 스캔한 로케이션 코드
 * 6. **플로우**: PDA 스캔 → POST /count → 이 테이블 INSERT/UPDATE → PC 웹에서 조회하여 반영
 *
 * DB 테이블: PHYSICAL_INV_COUNT_DETAILS
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PHYSICAL_INV_COUNT_DETAILS' })
@Index(['sessionDate', 'seq'])
export class PhysicalInvCountDetail {
  /** 실사 세션 일자 (PhysicalInvSession FK) */
  @PrimaryColumn({ name: 'SESSION_DATE', type: 'date' })
  sessionDate: Date;

  /** 실사 세션 일련번호 (PhysicalInvSession FK) */
  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  /** 창고코드 */
  @PrimaryColumn({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  /** 품목코드 */
  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  /** 자재시리얼 (MAT_UID) */
  @PrimaryColumn({ name: 'MAT_UID', length: 50 })
  matUid: string;

  /** PDA 스캔 로케이션 코드 */
  @Column({ name: 'LOCATION_CODE', length: 50, nullable: true })
  locationCode: string | null;

  /** 실사 시점 시스템(장부) 수량 스냅샷 */
  @Column({ name: 'SYSTEM_QTY', type: 'int', default: 0 })
  systemQty: number;

  /** PDA 스캔 실사수량 (누적) */
  @Column({ name: 'COUNTED_QTY', type: 'int', default: 0 })
  countedQty: number;

  /** 스캔한 사용자 ID */
  @Column({ name: 'COUNTED_BY', length: 50, nullable: true })
  countedBy: string | null;

  /** 비고 */
  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
