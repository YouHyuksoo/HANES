/**
 * @file spc-chart.entity.ts
 * @description SPC 관리도 엔티티 — IATF 16949 통계적 공정 관리
 *
 * 초보자 가이드:
 * 1. 품목+공정별 품질 특성치를 관리도(Control Chart)로 모니터링
 * 2. chartType: XBAR_R, XBAR_S, P, NP, C, U (계량형/계수형)
 * 3. chartNo 자동채번: SPC-YYYYMMDD-NNN
 * 4. USL/LSL: 규격 상한/하한, UCL/LCL/CL: 관리 상한/하한/중심선
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PartMaster } from './part-master.entity';
import { ProcessMaster } from './process-master.entity';

@Entity({ name: 'SPC_CHARTS' })
@Index(['company', 'plant', 'chartNo'], { unique: true })
@Index(['company', 'plant', 'itemCode'])
@Index(['company', 'plant', 'processCode'])
export class SpcChart {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'CHART_NO', length: 30 })
  chartNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => PartMaster)
  @JoinColumn({ name: 'ITEM_CODE', referencedColumnName: 'itemCode' })
  item: PartMaster;

  @Column({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @ManyToOne(() => ProcessMaster)
  @JoinColumn({ name: 'PROCESS_CODE', referencedColumnName: 'processCode' })
  process: ProcessMaster;

  @Column({ name: 'CHARACTERISTIC_NAME', length: 200 })
  characteristicName: string;

  @Column({ name: 'CHART_TYPE', length: 30 })
  chartType: string;

  @Column({ name: 'SUBGROUP_SIZE', type: 'int', default: 5 })
  subgroupSize: number;

  @Column({ name: 'USL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  usl: number;

  @Column({ name: 'LSL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lsl: number;

  @Column({ name: 'TARGET', type: 'decimal', precision: 12, scale: 4, nullable: true })
  target: number;

  @Column({ name: 'UCL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  ucl: number;

  @Column({ name: 'LCL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lcl: number;

  @Column({ name: 'CL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  cl: number;

  @Column({ name: 'STATUS', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
