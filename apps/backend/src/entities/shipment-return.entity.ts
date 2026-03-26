/**
 * @file shipment-return.entity.ts
 * @description 출하반품(ShipmentReturn) 엔티티 - 출하 후 반품 정보를 관리한다.
 *              RETURN_NO 자연키 PK 사용.
 *
 * 초보자 가이드:
 * 1. RETURN_NO가 자연키 PK (반품번호)
 * 2. 상태 흐름: DRAFT → CONFIRMED → CLOSED
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SHIPMENT_RETURNS' })
@Index(['shipmentId'])
@Index(['status'])
export class ShipmentReturn {
  @PrimaryColumn({ name: 'RETURN_NO', length: 50 })
  returnNo: string;

  @Column({ type: 'varchar2', name: 'SHIPMENT_ID', length: 255, nullable: true })
  shipmentId: string | null;

  @Column({ name: 'RETURN_DATE', type: 'date', nullable: true })
  returnDate: Date | null;

  @Column({ type: 'varchar2', name: 'RETURN_REASON', length: 500, nullable: true })
  returnReason: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
  status: string;

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
