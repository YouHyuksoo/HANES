/**
 * @file sample-inspect-result.entity.ts
 * @description 반제품 샘플검사 결과 엔티티 - 낱개단위 측정값 저장
 *              복합 PK: orderNo + sampleNo
 *
 * 초보자 가이드:
 * 1. 복합 PK: orderNo(작업지시번호) + sampleNo(샘플번호)
 * 2. ORDER_NO로 JobOrder(작업지시)를 참조
 * 3. 각 샘플에 대한 측정값, 상/하한치, 자동 합불 판정
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
} from 'typeorm';
import { JobOrder } from './job-order.entity';

@Entity({ name: 'SAMPLE_INSPECT_RESULTS' })
@Index(['inspectDate'])
@Index(['passYn'])
export class SampleInspectResult {
  @PrimaryColumn({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @ManyToOne(() => JobOrder)
  @JoinColumn({ name: 'ORDER_NO' })
  jobOrder: JobOrder;

  @PrimaryColumn({ name: 'SAMPLE_NO', type: 'int' })
  sampleNo: number;

  @Column({ name: 'INSPECT_DATE', type: 'date' })
  inspectDate: Date;

  @Column({ name: 'INSPECTOR_NAME', length: 100 })
  inspectorName: string;

  @Column({ type: 'varchar2', name: 'INSPECT_TYPE', length: 50, nullable: true })
  inspectType: string | null;

  @Column({ type: 'varchar2', name: 'MEASURED_VALUE', length: 100, nullable: true })
  measuredValue: string | null;

  @Column({ type: 'varchar2', name: 'SPEC_UPPER', length: 50, nullable: true })
  specUpper: string | null;

  @Column({ type: 'varchar2', name: 'SPEC_LOWER', length: 50, nullable: true })
  specLower: string | null;

  @Column({ name: 'PASS_YN', length: 1, default: 'Y' })
  passYn: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
