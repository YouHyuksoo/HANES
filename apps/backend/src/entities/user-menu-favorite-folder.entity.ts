/** 사용자·회사·사업장별 1단계 즐겨찾기 폴더. ID는 Oracle SEQUENCE로 채번한다. */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'USER_MENU_FAVORITE_FOLDERS' })
export class UserMenuFavoriteFolder {
  @PrimaryColumn({ name: 'ID', type: 'number', precision: 15, scale: 0 })
  id!: number;

  @Column({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @Column({ name: 'USER_EMAIL', type: 'varchar2', length: 100 })
  userEmail!: string;

  @Column({ name: 'NAME', type: 'varchar2', length: 100 })
  name!: string;

  @Column({ name: 'SORT_ORDER', type: 'number', precision: 15, scale: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt!: Date;
}
