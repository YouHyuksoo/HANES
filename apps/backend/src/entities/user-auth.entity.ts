/**
 * @file entities/user-auth.entity.ts
 * @description 사용자 메뉴 권한 엔티티 - 사용자별 메뉴 접근 권한을 관리한다.
 *              userEmail + menuCode 복합 PK를 사용한다.
 *
 * 초보자 가이드:
 * 1. userEmail + menuCode가 복합 PK (자연키)
 * 2. canRead/canWrite/canDelete/canExport: 메뉴별 CRUD 권한
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'USER_AUTHS' })
export class UserAuth {
  @PrimaryColumn({ name: 'USER_EMAIL', length: 255 })
  userEmail: string;

  @PrimaryColumn({ name: 'MENU_CODE', length: 100 })
  menuCode: string;

  @Column({ name: 'CAN_READ', default: true })
  canRead: boolean;

  @Column({ name: 'CAN_WRITE', default: false })
  canWrite: boolean;

  @Column({ name: 'CAN_DELETE', default: false })
  canDelete: boolean;

  @Column({ name: 'CAN_EXPORT', default: false })
  canExport: boolean;

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
