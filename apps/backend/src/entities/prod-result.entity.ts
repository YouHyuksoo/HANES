/**
 * @file prod-result.entity.ts
 * @description 생산실적(ProdResult) 엔티티 - 작업지시별 생산 결과를 기록한다.
 *              PK는 RESULT_NO(채번).
 *
 * 초보자 가이드:
 * 1. RESULT_NO가 PK (SeqGenerator로 채번, 예: PR260316-00001)
 * 2. ORDER_NO로 JobOrder(작업지시)를 참조
 * 3. EQUIP_CODE로 EquipMaster, WORKER_ID로 WorkerMaster 참조
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InspectResult } from './inspect-result.entity';
import { DefectLog } from './defect-log.entity';
import { JobOrder } from './job-order.entity';
import { EquipMaster } from './equip-master.entity';
import { WorkerMaster } from './worker-master.entity';


@Entity({ name: 'PROD_RESULTS' })
@Index(['orderNo'])
@Index(['equipCode'])
@Index(['workerId'])
@Index(['status'])
@Index(['shiftCode'])
export class ProdResult {
  @PrimaryColumn({ name: 'RESULT_NO', length: 30 })
  resultNo: string;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @ManyToOne(() => JobOrder, (jobOrder) => jobOrder.prodResults)
  @JoinColumn({ name: 'ORDER_NO' })
  jobOrder: JobOrder;

  @Column({ type: 'varchar2', name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @ManyToOne(() => EquipMaster)
  @JoinColumn({ name: 'EQUIP_CODE', referencedColumnName: 'equipCode' })
  equip: EquipMaster | null;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @ManyToOne(() => WorkerMaster)
  @JoinColumn({ name: 'WORKER_ID', referencedColumnName: 'workerCode' })
  worker: WorkerMaster | null;

  @Column({ type: 'varchar2', name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 255, nullable: true })
  processCode: string | null;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'START_TIME', type: 'timestamp', nullable: true })
  startAt: Date | null;

  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endAt: Date | null;

  @Column({ name: 'CYCLE_TIME', type: 'decimal', precision: 10, scale: 4, nullable: true })
  cycleTime: number | null;

  @Column({ name: 'STATUS', length: 20, default: 'RUNNING' })
  status: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'SHIFT_CODE', length: 20, nullable: true })
  shiftCode: string | null;

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

  @OneToMany(() => InspectResult, (inspectResult) => inspectResult.prodResult)
  inspectResults: InspectResult[];

  @OneToMany(() => DefectLog, (defectLog) => defectLog.prodResult)
  defectLogs: DefectLog[];

}
