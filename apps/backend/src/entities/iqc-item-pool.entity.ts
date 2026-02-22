/**
 * @file src/entities/iqc-item-pool.entity.ts
 * @description IQC 검사항목 풀(Pool) 엔티티 — 전역 검사항목 정의 마스터
 *
 * 초보자 가이드:
 * 1. IQC 검사항목의 글로벌 정의 테이블 (IQC-001, IQC-002 등)
 * 2. IQC_GROUP_ITEMS에서 ITEM_ID로 참조됨
 * 3. JUDGE_METHOD: VISUAL(육안) / MEASURE(계측)
 * 4. 계측 항목은 LSL/USL/UNIT으로 규격 범위 정의
 * 5. REVISION으로 항목 버전 관리
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IQC_ITEM_POOL' })
@Index(['itemCode'], { unique: true })
export class IqcItemPool {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ITEM_CODE', length: 20 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 100 })
  itemName: string;

  @Column({ name: 'JUDGE_METHOD', length: 20 })
  judgeMethod: string;

  @Column({ name: 'CRITERIA', length: 255, nullable: true })
  criteria: string | null;

  @Column({ name: 'LSL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lsl: number | null;

  @Column({ name: 'USL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  usl: number | null;

  @Column({ name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'REVISION', type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'EFFECTIVE_DATE', type: 'timestamp', nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
