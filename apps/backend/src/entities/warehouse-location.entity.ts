/**
 * @file entities/warehouse-location.entity.ts
 * @description 창고 로케이션(세부위치) 엔티티 - 창고 내 bin/rack/shelf 등 위치 관리
 *
 * 초보자 가이드:
 * 1. 하나의 창고(Warehouse)는 여러 로케이션을 가질 수 있음
 * 2. 로케이션코드는 창고 내에서 유일
 * 3. zone/row/column으로 물리적 위치 식별
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WAREHOUSE_LOCATIONS' })
@Index(['warehouseId', 'locationCode'], { unique: true })
export class WarehouseLocation {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WAREHOUSE_ID', length: 255 })
  warehouseId: string;

  @Column({ name: 'LOCATION_CODE', length: 50 })
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

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
