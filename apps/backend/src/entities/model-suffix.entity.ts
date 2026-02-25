/**
 * @file entities/model-suffix.entity.ts
 * @description 모델 접미사 엔티티 - 모델별 접미사(variant) 정보를 관리한다.
 *              자연키 없으므로 SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. modelCode + suffixCode 조합으로 식별
 * 3. customer: 해당 접미사가 적용되는 고객
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MODEL_SUFFIXES' })
@Index(['modelCode'])
export class ModelSuffix {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'MODEL_CODE', length: 100 })
  modelCode: string;

  @Column({ name: 'SUFFIX_CODE', length: 50 })
  suffixCode: string;

  @Column({ name: 'SUFFIX_NAME', length: 200 })
  suffixName: string;

  @Column({ name: 'CUSTOMER', length: 100, nullable: true })
  customer: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
