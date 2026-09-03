/**
 * @file src/entities/user-menu-favorite.entity.ts
 * @description 사용자별 사이드바 메뉴 즐겨찾기 엔티티
 *
 * 초보자 가이드:
 * 1. COMPANY + PLANT_CD + USER_EMAIL + MENU_CODE가 PK — 사용자당 메뉴 하나에 즐겨찾기 한 건
 * 2. SORT_ORDER는 즐겨찾기 그룹 내 표시 순서(10단위)
 * 3. USER_EMAIL은 USERS.EMAIL — 토큰이 이메일이므로 그대로 사용
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'USER_MENU_FAVORITES' })
export class UserMenuFavorite {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @PrimaryColumn({ name: 'USER_EMAIL', type: 'varchar2', length: 100 })
  userEmail!: string;

  @PrimaryColumn({ name: 'MENU_CODE', type: 'varchar2', length: 100 })
  menuCode!: string;

  @Column({ name: 'SORT_ORDER', type: 'decimal', precision: 10, scale: 0, default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 })
  createdBy!: string;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt!: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50 })
  updatedBy!: string;
}
