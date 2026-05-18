/**
 * @file src/entities/menu-category-item.entity.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 엔티티
 */
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { MenuCategory } from './menu-category.entity';

@Entity({ name: 'MENU_CATEGORY_ITEMS' })
export class MenuCategoryItem {
  @PrimaryColumn({ name: 'MENU_CODE', type: 'varchar2', length: 100 })
  menuCode!: string;

  @Column({ name: 'CATEGORY_CODE', type: 'varchar2', length: 50 })
  categoryCode!: string;

  @ManyToOne(() => MenuCategory)
  @JoinColumn({ name: 'CATEGORY_CODE', referencedColumnName: 'categoryCode' })
  category?: MenuCategory;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder!: number;

  @Column({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @Column({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 })
  createdBy!: string;

  @Column({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt!: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50 })
  updatedBy!: string;
}
