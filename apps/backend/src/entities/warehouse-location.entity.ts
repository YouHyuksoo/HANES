/**
 * @file entities/warehouse-location.entity.ts
 * @description 창고 로케이션(세부위치) 엔티티 - 창고 내 bin/rack/shelf 등 위치 관리
 *              복합 PK: (warehouseCode, locationCode). SEQUENCE 대신 자연키 사용.
 *
 * 초보자 가이드:
 * 1. 하나의 창고(Warehouse)는 여러 로케이션을 가질 수 있음
 * 2. 복합 PK: warehouseCode + locationCode
 * 3. zone/row/column으로 물리적 위치 식별
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'WAREHOUSE_LOCATIONS' })
export class WarehouseLocation {
  @PrimaryColumn({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @PrimaryColumn({ name: 'LOCATION_CODE', length: 50 })
  locationCode: string;

  @Column({ name: 'LOCATION_NAME', length: 100 })
  locationName: string;

  @Column({ name: 'ZONE', length: 50, nullable: true })
  zone: string | null;

  @Column({ name: 'ROW_NO', length: 50, nullable: true })
  rowNo: string | null;

  @Column({ name: 'COL_NO', length: 50, nullable: true })
  colNo: string | null;

  @Column({ name: 'LEVEL_NO', length: 50, nullable: true })
  levelNo: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
