/**
 * @file src/entities/menu-category.entity.ts
 * @description 사이드바 카테고리(상위 메뉴) 정의 엔티티
 *
 * 초보자 가이드:
 * 1. COMPANY + PLANT_CD + CATEGORY_CODE는 자연키 PK (영문 대문자/언더스코어)
 * 2. 예약어 __ROOT__는 단독 메뉴(DASHBOARD 등) 그룹용
 * 3. iconName이 NULL이면 사이드바에서 기본 폴더 아이콘 사용
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'MENU_CATEGORIES' })
export class MenuCategory {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @PrimaryColumn({ name: 'CATEGORY_CODE', type: 'varchar2', length: 50 })
  categoryCode!: string;

  @Column({ name: 'LABEL_KEY', type: 'varchar2', length: 200 })
  labelKey!: string;

  @Column({ name: 'ICON_NAME', type: 'varchar2', length: 50, nullable: true })
  iconName!: string | null;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder!: number;

  @Column({ name: 'IS_ACTIVE', type: 'char', length: 1, default: 'Y' })
  isActive!: 'Y' | 'N';

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 })
  createdBy!: string;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt!: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50 })
  updatedBy!: string;
}
