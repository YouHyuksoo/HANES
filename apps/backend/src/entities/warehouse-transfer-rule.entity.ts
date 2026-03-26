/**
 * @file entities/warehouse-transfer-rule.entity.ts
 * @description 창고 이동 규칙 엔티티 - 창고 간 이동 허용 여부를 관리한다.
 *              fromWarehouseId + toWarehouseId 복합 PK를 사용한다.
 *
 * 초보자 가이드:
 * 1. fromWarehouseId + toWarehouseId가 복합 PK (자연키)
 * 2. allowYn: 이동 허용 여부
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'WAREHOUSE_TRANSFER_RULES' })
export class WarehouseTransferRule {
  @PrimaryColumn({ name: 'FROM_WAREHOUSE_ID', length: 50 })
  fromWarehouseId: string;

  @PrimaryColumn({ name: 'TO_WAREHOUSE_ID', length: 50 })
  toWarehouseId: string;

  @Column({ name: 'ALLOW_YN', length: 1, default: 'Y' })
  allowYn: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
