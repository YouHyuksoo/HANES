/**
 * @file spc-data.entity.ts
 * @description SPC 측정 데이터 엔티티 — 관리도 데이터 포인트
 *
 * 초보자 가이드:
 * 1. SpcChart에 연결된 개별 측정 데이터(서브그룹)
 * 2. values: JSON 배열 문자열 (예: "[1.23, 1.25, 1.24, 1.26, 1.22]")
 * 3. mean/range/stdDev: 서브그룹 통계값
 * 4. outOfControl: 관리 이탈 여부 (0=정상, 1=이탈)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SpcChart } from './spc-chart.entity';

@Entity({ name: 'SPC_DATA' })
@Index(['chartId'])
@Index(['company', 'plant', 'sampleDate'])
export class SpcData {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'CHART_ID' })
  chartId: number;

  @ManyToOne(() => SpcChart)
  @JoinColumn({ name: 'CHART_ID' })
  chart: SpcChart;

  @Column({ name: 'SAMPLE_DATE', type: 'timestamp' })
  sampleDate: Date;

  @Column({ name: 'SUBGROUP_NO', type: 'int' })
  subgroupNo: number;

  @Column({ name: 'VALUES', length: 2000 })
  values: string;

  @Column({ name: 'MEAN', type: 'decimal', precision: 12, scale: 4 })
  mean: number;

  @Column({ name: 'RANGE_VAL', type: 'decimal', precision: 12, scale: 4 })
  range: number;

  @Column({ name: 'STD_DEV', type: 'decimal', precision: 12, scale: 4, nullable: true })
  stdDev: number;

  @Column({ name: 'CPK', type: 'decimal', precision: 8, scale: 4, nullable: true })
  cpk: number;

  @Column({ name: 'PPK', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ppk: number;

  @Column({ name: 'OUT_OF_CONTROL', type: 'number', default: 0 })
  outOfControl: number;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
