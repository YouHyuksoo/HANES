/**
 * @file iqc-log.entity.ts
 * @description IQC 검사이력(IqcLog) 엔티티 - 수입검사 결과를 기록한다.
 *              복합 PK(INSPECT_DATE + SEQ) 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. 복합 PK: inspectDate(INSPECT_DATE) + seq(SEQ)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. 검사유형(INITIAL/RETEST), 결과(PASS/FAIL) 관리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IQC_LOGS' })
@Index(['itemCode'])
@Index(['arrivalNo'])
@Index(['inspectType'])
@Index(['result'])
export class IqcLog {
  @PrimaryColumn({ name: 'INSPECT_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'INSPECT_TYPE', length: 50, default: 'INITIAL' })
  inspectType: string;

  @Column({ name: 'RESULT', length: 50, default: 'PASS' })
  result: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ type: 'varchar2', name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

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
