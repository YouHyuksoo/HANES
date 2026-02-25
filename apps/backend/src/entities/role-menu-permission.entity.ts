/**
 * @file entities/role-menu-permission.entity.ts
 * @description 역할-메뉴 권한 매핑 엔티티 - 역할별 접근 가능한 메뉴 정의
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. roleCode + menuCode: 복합 유니크 인덱스로 중복 방지
 * 3. canAccess: true면 해당 메뉴 접근 허용
 * 4. CASCADE 삭제: 역할 삭제 시 관련 권한도 자동 삭제
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';

@Entity({ name: 'ROLE_MENU_PERMISSIONS' })
@Index(['roleCode', 'menuCode'], { unique: true })
export class RoleMenuPermission {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ROLE_CODE', length: 50 })
  roleCode: string;

  @Column({ name: 'MENU_CODE', length: 50 })
  menuCode: string;

  @Column({
    name: 'CAN_ACCESS',
    type: 'char',
    length: 1,
    default: 'Y',
    transformer: { to: (v: boolean) => (v ? 'Y' : 'N'), from: (v: string) => v === 'Y' },
  })
  canAccess: boolean;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ROLE_CODE', referencedColumnName: 'code' })
  role: Role;
}
