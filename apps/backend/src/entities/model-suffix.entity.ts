/**
 * @file entities/model-suffix.entity.ts
 * @description 모델 접미사 엔티티 - 모델별 접미사(variant) 정보를 관리한다.
 *              modelCode + suffixCode 복합 PK를 사용한다.
 *
 * 초보자 가이드:
 * 1. modelCode + suffixCode가 복합 PK (자연키)
 * 2. customer: 해당 접미사가 적용되는 고객
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'MODEL_SUFFIXES' })
export class ModelSuffix {
  @PrimaryColumn({ name: 'MODEL_CODE', length: 100 })
  modelCode: string;

  @PrimaryColumn({ name: 'SUFFIX_CODE', length: 50 })
  suffixCode: string;

  @Column({ name: 'SUFFIX_NAME', length: 200 })
  suffixName: string;

  @Column({ type: 'varchar2', name: 'CUSTOMER', length: 100, nullable: true })
  customer: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
