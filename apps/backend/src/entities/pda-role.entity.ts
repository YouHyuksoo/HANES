/**
 * @file entities/pda-role.entity.ts
 * @description PDA 역할(PdaRole) 엔티티 - PDA 단말기 접근 권한 역할 정의 테이블
 *              Role 엔티티와 동일한 패턴으로 code를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. code가 PK (PDA_ADMIN, PDA_MATERIAL, PDA_SHIPPING 등)
 * 2. isActive: true인 역할만 PDA 로그인 시 선택 가능
 * 3. menus: 이 역할에 할당된 PDA 메뉴 목록 (PdaRoleMenu와 1:N)
 * 4. company / plant: 다중 사업장 지원을 위한 필터 컬럼
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PdaRoleMenu } from './pda-role-menu.entity';

@Entity({ name: 'PDA_ROLE' })
export class PdaRole {
  /** 역할 코드 — 자연키 PK (예: PDA_ADMIN) */
  @PrimaryColumn({ name: 'CODE', length: 50 })
  code: string;

  /** 역할 이름 (예: PDA 관리자) */
  @Column({ name: 'NAME', length: 100 })
  name: string;

  /** 역할 설명 */
  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  /** 활성 여부 — Oracle char(1), Y/N 저장 */
  @Column({
    name: 'IS_ACTIVE',
    type: 'char',
    length: 1,
    default: 'Y',
    transformer: {
      to: (v: boolean) => (v ? 'Y' : 'N'),
      from: (v: string) => v === 'Y',
    },
  })
  isActive: boolean;

  /** 회사 코드 (다중 사업장 지원) */
  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  /** 공장 코드 (다중 사업장 지원) */
  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  /** 생성자 */
  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  /** 수정자 */
  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  /** 생성일시 */
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  /** 수정일시 */
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  /** 이 역할에 할당된 PDA 메뉴 권한 목록 */
  @OneToMany(() => PdaRoleMenu, (m) => m.pdaRole)
  menus: PdaRoleMenu[];
}
