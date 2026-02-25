/**
 * @file entities/process-master.entity.ts
 * @description 공정 마스터 엔티티 - 생산 공정 정보를 관리한다.
 *              processCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. processCode가 PK (UUID 대신 자연키)
 * 2. processType으로 공정 유형 분류
 * 3. sampleInspectYn: 이 공정에서 표본검사 수행 여부
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

  @Column({ name: 'PROCESS_CATEGORY', length: 50, nullable: true })
  processCategory: string | null;

  @Column({ name: 'SAMPLE_INSPECT_YN', length: 1, default: 'N' })
  sampleInspectYn: string;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
