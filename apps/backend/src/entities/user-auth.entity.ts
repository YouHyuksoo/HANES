/**
 * @file entities/user-auth.entity.ts
 * @description 사용자 메뉴 권한 엔티티 - 사용자별 메뉴 접근 권한을 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. userEmail + menuCode 복합 유니크
 * 3. canRead/canWrite/canDelete/canExport: 메뉴별 CRUD 권한
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'USER_AUTHS' })
@Unique(['userEmail', 'menuCode'])
@Index(['userEmail'])
export class UserAuth {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'USER_EMAIL', length: 255 })
  userEmail: string;

  @Column({ name: 'MENU_CODE', length: 100 })
  menuCode: string;

  @Column({ name: 'CAN_READ', default: true })
  canRead: boolean;

  @Column({ name: 'CAN_WRITE', default: false })
  canWrite: boolean;

  @Column({ name: 'CAN_DELETE', default: false })
  canDelete: boolean;

  @Column({ name: 'CAN_EXPORT', default: false })
  canExport: boolean;

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
