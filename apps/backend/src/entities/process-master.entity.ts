/**
 * @file entities/process-master.entity.ts
 * @description 공정 마스터 엔티티 - 생산 공정 정보를 관리한다.
 *              processCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. processCode가 PK (UUID 대신 자연키)
 * 2. processType으로 공정 유형 분류
 * 3. processCategory: 공정 대분류 (ASSY, INSP 등)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PROCESS_MASTERS' })
@Index(['processType'])
export class ProcessMaster {
  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @Column({ name: 'PROCESS_NAME', length: 255 })
  processName: string;

  @Column({ name: 'PROCESS_TYPE', length: 255 })
  processType: string;

  @Column({ type: 'varchar2', name: 'PROCESS_CATEGORY', length: 50 })
  processCategory: string;

  /** 공정 라인구분: LV=저전압 HV=고전압 CM=공통 (PDF 제조공정 흐름도 기준) */
  @Column({ type: 'varchar2', name: 'LINE_TYPE', length: 2 })
  lineType: string;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
