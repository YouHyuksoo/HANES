/**
 * @file iqc-log.entity.ts
 * @description IQC 검사이력(IqcLog) 엔티티 - 수입검사 결과를 기록한다.
 *              시퀀스 PK 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. 검사유형(INITIAL/RETEST), 결과(PASS/FAIL) 관리
 */
import {
  Entity,
  PrimaryGeneratedColumn,
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
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'INSPECT_TYPE', length: 50, default: 'INITIAL' })
  inspectType: string;

  @Column({ name: 'RESULT', length: 50, default: 'PASS' })
  result: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'INSPECT_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  inspectDate: Date;

  @Column({ name: 'STATUS', length: 50, default: 'DONE' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
