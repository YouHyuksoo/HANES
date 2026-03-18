/**
 * @file spc-chart.entity.ts
 * @description SPC 관리도 엔티티 — IATF 16949 통계적 공정 관리
 *              자연키 PK: chartNo (관리도 번호).
 *              id는 자식 FK(spc-data.chartId) 호환을 위해 generated @Column으로 유지.
 *
 * 초보자 가이드:
 * 1. chartNo가 PK (자연키)
 * 2. id는 자동 증가 시퀀스이지만 PK가 아님 (SpcData.chartId FK 호환용)
 * 3. chartType: XBAR_R, XBAR_S, P, NP, C, U (계량형/계수형)
 * 4. chartNo 자동채번: SPC-YYYYMMDD-NNN
 * 5. USL/LSL: 규격 상한/하한, UCL/LCL/CL: 관리 상한/하한/중심선
 */
import {
  Entity,
  PrimaryColumn,
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
@Index(['company', 'plant', 'itemCode'])
@Index(['company', 'plant', 'processCode'])
export class SpcChart {
  @Column({ name: 'ID', type: 'int', generated: true, insert: false, update: false })
  id: number;

  @PrimaryColumn({ name: 'CHART_NO', length: 30 })
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

  /** 데이터 소스 (IQC/PROCESS/OQC/MANUAL) — ComCode SPC_DATA_SRC */
  @Column({ name: 'DATA_SOURCE', length: 20, default: 'MANUAL' })
  dataSource: string;

  /** 소스 검사항목명 (원천 데이터에서 매핑할 항목) */
  @Column({ name: 'SOURCE_INSPECT_ITEM', type: 'nvarchar2', length: 100, nullable: true })
  sourceInspectItem: string | null;

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
