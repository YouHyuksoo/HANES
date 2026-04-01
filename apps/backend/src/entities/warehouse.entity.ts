/**
 * @file entities/warehouse.entity.ts
 * @description 창고 마스터 엔티티 - 창고 정보를 관리한다.
 *              warehouseCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. warehouseCode가 PK (UUID 대신 자연키)
 * 2. warehouseType: MAT(원자재), PROD(제품), WIP(재공), DEFECT(불용) 등
 * 3. warehouseGroup: 동일 그룹 내 이동은 즉시, 다른 그룹 이동은 매니저 승인 필요
 * 4. isDefault: 기본 창고 여부
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WAREHOUSES' })
@Index(['warehouseType'])
@Index(['plantCode'])
@Index(['lineCode'])
export class Warehouse {
  @PrimaryColumn({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ name: 'WAREHOUSE_NAME', length: 100 })
  warehouseName: string;

  @Column({ name: 'WAREHOUSE_TYPE', length: 50 })
  warehouseType: string;

  /** 창고 그룹 (동일 그룹 내 이동: 즉시 / 다른 그룹 이동: 매니저 승인) */
  @Column({ type: 'varchar2', name: 'WAREHOUSE_GROUP', length: 20, nullable: true, default: null })
  warehouseGroup: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CODE', length: 50, nullable: true })
  plantCode: string | null;

  @Column({ type: 'varchar2', name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string | null;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar2', name: 'VENDOR_ID', length: 50, nullable: true })
  vendorId: string | null;

  @Column({ name: 'IS_DEFAULT', length: 1, default: "'N'" })
  isDefault: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
