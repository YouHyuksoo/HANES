/**
 * @file entities/user.entity.ts
 * @description 사용자 엔티티 - 시스템 사용자 정보를 관리한다.
 *              email을 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. email이 PK (UUID 대신 자연키)
 * 2. role: OPERATOR, MANAGER, ADMIN 등
 * 3. status: ACTIVE, INACTIVE 등
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'USERS' })
@Index(['role'])
@Index(['status'])
export class User {
  @PrimaryColumn({ name: 'EMAIL', length: 255 })
  email: string;

  @Column({ name: 'PASSWORD', length: 255, default: 'admin123' })
  password: string;

  @Column({ type: 'varchar2', name: 'NAME', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar2', name: 'EMP_NO', length: 50, nullable: true })
  empNo: string | null;

  @Column({ type: 'varchar2', name: 'DEPT', length: 255, nullable: true })
  dept: string | null;

  @Column({ name: 'ROLE', length: 50, default: 'OPERATOR' })
  role: string;

  @Column({ name: 'STATUS', length: 50, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'varchar2', name: 'PHOTO_URL', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ name: 'LAST_LOGIN', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  /** PDA 역할 코드 (FK → PDA_ROLE.CODE, nullable) */
  @Column({ type: 'varchar2', name: 'PDA_ROLE_CODE', length: 50, nullable: true })
  pdaRoleCode: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
