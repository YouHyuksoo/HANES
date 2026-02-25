/**
 * @file prod-result.entity.ts
 * @description 생산실적(ProdResult) 엔티티 - 작업지시별 생산 결과를 기록한다.
 *              시퀀스 PK 사용, orderNo로 JobOrder 참조, equipCode/workerCode로 참조.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. ORDER_NO로 JobOrder(작업지시)를 참조
 * 3. EQUIP_CODE로 EquipMaster, WORKER_CODE로 WorkerMaster 참조
 */
import {
  Entity,
  PrimaryGeneratedColumn,
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
import { MatIssue } from './mat-issue.entity';

@Entity({ name: 'PROD_RESULTS' })
@Index(['orderNo'])
@Index(['equipCode'])
@Index(['workerCode'])
@Index(['status'])
export class ProdResult {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @ManyToOne(() => JobOrder, (jobOrder) => jobOrder.prodResults)
  @JoinColumn({ name: 'ORDER_NO' })
  jobOrder: JobOrder;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string | null;

  @ManyToOne(() => EquipMaster)
  @JoinColumn({ name: 'EQUIP_CODE', referencedColumnName: 'equipCode' })
  equip: EquipMaster | null;

  @Column({ name: 'WORKER_CODE', length: 50, nullable: true })
  workerCode: string | null;

  @ManyToOne(() => WorkerMaster)
  @JoinColumn({ name: 'WORKER_CODE', referencedColumnName: 'workerCode' })
  worker: WorkerMaster | null;

  @Column({ name: 'LOT_NO', length: 255, nullable: true })
  lotNo: string | null;

  @Column({ name: 'PROCESS_CODE', length: 255, nullable: true })
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

  @Column({ name: 'STATUS', length: 50, default: 'RUNNING' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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

  @OneToMany(() => InspectResult, (inspectResult) => inspectResult.prodResult)
  inspectResults: InspectResult[];

  @OneToMany(() => DefectLog, (defectLog) => defectLog.prodResult)
  defectLogs: DefectLog[];

  @OneToMany(() => MatIssue, (matIssue) => matIssue.prodResult)
  matIssues: MatIssue[];
}
