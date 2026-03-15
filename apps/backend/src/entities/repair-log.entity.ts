/**
 * @file entities/repair-log.entity.ts
 * @description 수리 이력 엔티티 - 불량에 대한 수리 결과를 기록한다.
 *
 * 초보자 가이드:
 * 1. repairDate + seq: 복합 PK (수리일자 + 일련번호)
 * 2. defectLogId: 불량 로그 ID 참조
 * 3. result: 수리 결과 (PASS, FAIL, SCRAP 등)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'REPAIR_LOGS' })
@Index(['defectLogId'])
@Index(['workerId'])
export class RepairLog {
  @PrimaryColumn({ name: 'REPAIR_DATE', type: 'date', default: () => 'SYSDATE' })
  repairDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'DEFECT_LOG_ID', type: 'number' })
  defectLogId: number;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REPAIR_ACTION', length: 500, nullable: true })
  repairAction: string | null;

  @Column({ name: 'MATERIAL_USED', length: 500, nullable: true })
  materialUsed: string | null;

  @Column({ name: 'REPAIR_TIME', type: 'int', nullable: true })
  repairTime: number | null;

  @Column({ name: 'RESULT', length: 50, nullable: true })
  result: string | null;

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
}
