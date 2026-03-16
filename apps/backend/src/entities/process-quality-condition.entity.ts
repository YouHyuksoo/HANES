/**
 * @file process-quality-condition.entity.ts
 * @description 공정별 양품조건(합격조건) 엔티티
 *              복합 PK: ROUTING_CODE + SEQ + CONDITION_SEQ
 *
 * 초보자 가이드:
 * 1. ROUTING_PROCESSES의 하위 데이터로, 각 공정의 양품 판정 조건을 정의
 * 2. CONDITION_CODE: 양품조건명 (ComCode: QUALITY_CONDITION)
 * 3. MIN_VALUE / MAX_VALUE: 정상 수치 범위
 * 4. EQUIP_INTERFACE_YN: 설비에서 자동 수신하는 항목 여부
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PROCESS_QUALITY_CONDITIONS' })
@Index(['routingCode', 'seq'])
export class ProcessQualityCondition {
  @PrimaryColumn({ name: 'ROUTING_CODE', length: 50 })
  routingCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @PrimaryColumn({ name: 'CONDITION_SEQ', type: 'int' })
  conditionSeq: number;

  @Column({ name: 'CONDITION_CODE', length: 50, nullable: true })
  conditionCode: string | null;

  @Column({ name: 'MIN_VALUE', type: 'decimal', precision: 10, scale: 2, nullable: true })
  minValue: number | null;

  @Column({ name: 'MAX_VALUE', type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxValue: number | null;

  @Column({ name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'EQUIP_INTERFACE_YN', length: 1, default: 'N' })
  equipInterfaceYn: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 255 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 255 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
