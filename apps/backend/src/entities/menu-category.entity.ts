/**
 * @file src/entities/menu-category.entity.ts
 * @description 사이드바 카테고리(상위 메뉴) 정의 엔티티
 */
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'MENU_CATEGORIES' })
export class MenuCategory {
  @PrimaryColumn({ name: 'CATEGORY_CODE', type: 'varchar2', length: 50 })
  categoryCode!: string;

  @Column({ name: 'LABEL_KEY', type: 'varchar2', length: 200 })
  labelKey!: string;

  @Column({ name: 'ICON_NAME', type: 'varchar2', length: 50, nullable: true })
  iconName?: string | null;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder!: number;

  @Column({ name: 'IS_ACTIVE', type: 'char', length: 1, default: 'Y' })
  isActive!: 'Y' | 'N';

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
