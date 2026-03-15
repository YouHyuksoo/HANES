/**
 * @file entities/pda-role-menu.entity.ts
 * @description PDA 역할-메뉴 매핑 엔티티 - PDA 역할별 접근 가능한 메뉴 정의
 *              pdaRoleCode + menuCode 복합 PK를 사용한다.
 *
 * 초보자 가이드:
 * 1. pdaRoleCode + menuCode가 복합 PK (자연키)
 * 2. isActive: true면 해당 메뉴 접근 허용
 * 3. CASCADE 삭제: PDA 역할 삭제 시 관련 메뉴 매핑도 자동 삭제
 *
 * 메뉴 코드 목록:
 * - PDA_MAT_RECEIVING  : 자재 입고
 * - PDA_MAT_ISSUING    : 자재 불출
 * - PDA_MAT_ADJUSTMENT : 자재 조정
 * - PDA_MAT_INV_COUNT  : 자재 재고실사
 * - PDA_SHIPPING       : 출하
 * - PDA_EQUIP_INSPECT  : 설비 점검
 * - PDA_PRODUCT_INV_COUNT : 제품 재고실사
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PdaRole } from './pda-role.entity';

@Entity({ name: 'PDA_ROLE_MENU' })
export class PdaRoleMenu {
  /** PDA 역할 코드 (FK → PDA_ROLE.CODE) */
  @PrimaryColumn({ name: 'PDA_ROLE_CODE', length: 50 })
  pdaRoleCode: string;

  /** PDA 메뉴 코드 */
  @PrimaryColumn({ name: 'MENU_CODE', length: 50 })
  menuCode: string;

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

  /** 생성일시 */
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  /** 수정일시 */
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  /** PDA 역할 — CASCADE 삭제 */
  @ManyToOne(() => PdaRole, (role) => role.menus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'PDA_ROLE_CODE', referencedColumnName: 'code' })
  pdaRole: PdaRole;
}
