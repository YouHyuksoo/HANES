/**
 * @file src/entities/sample-inspect-result.entity.ts
 * @description 반제품 샘플검사 결과 엔티티 - 낱개단위 측정값 저장
 *
 * 초보자 가이드:
 * 1. **목적**: 반제품 생산 시 샘플검사 측정값을 낱개(샘플)별로 기록
 * 2. **관계**: JobOrder(작업지시) → SampleInspectResult (1:N)
 * 3. **측정값**: 각 샘플에 대한 측정값, 상/하한치, 자동 합불 판정
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobOrder } from './job-order.entity';

@Entity({ name: 'SAMPLE_INSPECT_RESULTS' })
@Index(['jobOrderId'])
@Index(['inspectDate'])
@Index(['passYn'])
export class SampleInspectResult {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'JOB_ORDER_ID', length: 36 })
  jobOrderId: string;

  @ManyToOne(() => JobOrder)
  @JoinColumn({ name: 'JOB_ORDER_ID' })
  jobOrder: JobOrder;

  @Column({ name: 'INSPECT_DATE', type: 'date' })
  inspectDate: Date;

  @Column({ name: 'INSPECTOR_NAME', length: 100 })
  inspectorName: string;

  @Column({ name: 'INSPECT_TYPE', length: 50, nullable: true })
  inspectType: string | null;

  @Column({ name: 'SAMPLE_NO', type: 'int' })
  sampleNo: number;

  @Column({ name: 'MEASURED_VALUE', length: 100, nullable: true })
  measuredValue: string | null;

  @Column({ name: 'SPEC_UPPER', length: 50, nullable: true })
  specUpper: string | null;

  @Column({ name: 'SPEC_LOWER', length: 50, nullable: true })
  specLower: string | null;

  @Column({ name: 'PASS_YN', length: 1, default: 'Y' })
  passYn: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
