/**
 * @file src/entities/role.entity.ts
 * @description 역할(Role) 엔티티 - RBAC 역할 정의 테이블
 *
 * 초보자 가이드:
 * 1. **ROLES 테이블**: 시스템에서 사용하는 역할(ADMIN, MANAGER 등)을 정의
 * 2. **isSystem**: true인 역할은 삭제/수정 불가 (ADMIN 등 기본 역할)
 * 3. **permissions**: 이 역할에 할당된 메뉴 권한 목록 (RoleMenuPermission과 1:N 관계)

 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RoleMenuPermission } from './role-menu-permission.entity';

@Entity({ name: 'ROLES' })
@Index(['code'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('increment', { name: 'ID' })
  id: number;

  @Column({ name: 'CODE', length: 50, unique: true })
  code: string;

  @Column({ name: 'NAME', length: 100 })
  name: string;

  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({
    name: 'IS_SYSTEM',
    type: 'char',
    length: 1,
    default: 'N',
    transformer: { to: (v: boolean) => (v ? 'Y' : 'N'), from: (v: string) => v === 'Y' },
  })
  isSystem: boolean;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

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

  @OneToMany(() => RoleMenuPermission, (p) => p.role)
  permissions: RoleMenuPermission[];
}
