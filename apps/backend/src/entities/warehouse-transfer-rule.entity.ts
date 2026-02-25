/**
 * @file entities/warehouse-transfer-rule.entity.ts
 * @description 창고 이동 규칙 엔티티 - 창고 간 이동 허용 여부를 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. fromWarehouseCode + toWarehouseCode: 복합 유니크
 * 3. allowYn: 이동 허용 여부
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'WAREHOUSE_TRANSFER_RULES' })
@Unique(['fromWarehouseCode', 'toWarehouseCode'])
@Index(['fromWarehouseCode'])
@Index(['toWarehouseCode'])
export class WarehouseTransferRule {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'FROM_WAREHOUSE_CODE', length: 50 })
  fromWarehouseCode: string;

  @Column({ name: 'TO_WAREHOUSE_CODE', length: 50 })
  toWarehouseCode: string;

  @Column({ name: 'ALLOW_YN', length: 1, default: 'Y' })
  allowYn: string;

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
