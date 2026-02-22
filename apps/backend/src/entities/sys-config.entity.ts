/**
 * @file entities/sys-config.entity.ts
 * @description 시스템 환경설정 엔티티 (SYS_CONFIGS 테이블)
 *
 * 초보자 가이드:
 * - 시스템 전체에서 사용하는 설정값을 관리하는 테이블
 * - configGroup으로 카테고리 분류 (MATERIAL, PRODUCTION, QUALITY, SYSTEM)
 * - configType: BOOLEAN(Y/N), SELECT(선택), NUMBER(숫자), TEXT(문자열)
 * - options: SELECT 타입일 때 선택지 JSON (e.g. [{"value":"V","label":"L"}])
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SYS_CONFIGS' })
@Index(['configGroup'])
@Index(['configKey'])
export class SysConfig {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'CONFIG_GROUP', length: 50 })
  configGroup: string;

  @Column({ name: 'CONFIG_KEY', length: 100 })
  configKey: string;

  @Column({ name: 'CONFIG_VALUE', length: 500 })
  configValue: string;

  @Column({ name: 'CONFIG_TYPE', length: 20, default: 'BOOLEAN' })
  configType: string;

  @Column({ name: 'LABEL', length: 200 })
  label: string;

  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'OPTIONS', length: 2000, nullable: true })
  options: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'IS_ACTIVE', length: 1, default: 'Y' })
  isActive: string;

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
