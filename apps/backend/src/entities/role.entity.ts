/**
 * @file entities/role.entity.ts
 * @description 역할(Role) 엔티티 - RBAC 역할 정의 테이블
 *              code를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. code가 PK (ADMIN, MANAGER 등)
 * 2. isSystem: true인 역할은 삭제/수정 불가
 * 3. permissions: 이 역할에 할당된 메뉴 권한 목록 (RoleMenuPermission과 1:N)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RoleMenuPermission } from './role-menu-permission.entity';

@Entity({ name: 'ROLES' })
export class Role {
  @PrimaryColumn({ name: 'CODE', length: 50 })
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
