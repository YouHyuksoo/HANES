/**
 * @file entities/plant.entity.ts
 * @description 공장 조직 엔티티 - 공장/공장동/라인/셀 계층구조를 관리한다.
 *              복합 PK: (plantCode, shopCode, lineCode, cellCode). 패턴 C.
 *              self-reference 관계로 부모-자식 트리 구조.
 *
 * 초보자 가이드:
 * 1. 복합 PK: plantCode + shopCode + lineCode + cellCode
 * 2. plantType: PLANT(공장), SHOP(공장동), LINE(라인), CELL(셀)
 * 3. parent/children: 자기참조 관계 (트리 구조)
 * 4. shopCode/lineCode/cellCode가 null이면 상위 레벨
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PLANTS' })
@Index(['plantType'])
export class Plant {
  @PrimaryColumn({ name: 'PLANT_CODE', length: 50 })
  plantCode: string;

  @PrimaryColumn({ name: 'SHOP_CODE', length: 50, default: '-' })
  shopCode: string;

  @PrimaryColumn({ name: 'LINE_CODE', length: 50, default: '-' })
  lineCode: string;

  @PrimaryColumn({ name: 'CELL_CODE', length: 50, default: '-' })
  cellCode: string;

  @Column({ name: 'PLANT_NAME', length: 100 })
  plantName: string;

  @Column({ name: 'PLANT_TYPE', length: 50, nullable: true })
  plantType: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
}
