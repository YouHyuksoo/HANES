/**
 * @file src/entities/menu-category-item.entity.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 엔티티
 *
 * 초보자 가이드:
 * 1. COMPANY + PLANT_CD + MENU_CODE가 PK — 한 메뉴는 tenant 안에서 하나의 카테고리에만 배치
 * 2. COMPANY + PLANT_CD + CATEGORY_CODE는 FK + 일반 컬럼 (TypeORM 표준 패턴, role-menu-permission 참고)
 * 3. SORT_ORDER는 카테고리 내 표시 순서(10단위 권장)
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
import { MenuCategory } from './menu-category.entity';

@Entity({ name: 'MENU_CATEGORY_ITEMS' })
export class MenuCategoryItem {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @PrimaryColumn({ name: 'MENU_CODE', type: 'varchar2', length: 100 })
  menuCode!: string;

  @Column({ name: 'CATEGORY_CODE', type: 'varchar2', length: 50 })
  categoryCode!: string;

  @ManyToOne(() => MenuCategory)
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plantCd' },
    { name: 'CATEGORY_CODE', referencedColumnName: 'categoryCode' },
  ])
  category?: MenuCategory;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
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
