/**
 * @file shipment-return.entity.ts
 * @description 출하반품(ShipmentReturn) 엔티티 - 출하 후 반품 정보를 관리한다.
 *              시퀀스 PK 사용.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. RETURN_NO: 반품번호 (유니크)
 * 3. 상태 흐름: DRAFT → CONFIRMED → CLOSED
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

@Entity({ name: 'SHIPMENT_RETURNS' })
@Unique(['returnNo'])
@Index(['shipmentId'])
@Index(['status'])
export class ShipmentReturn {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'RETURN_NO', length: 50, unique: true })
  returnNo: string;

  @Column({ name: 'SHIPMENT_ID', length: 255, nullable: true })
  shipmentId: string | null;

  @Column({ name: 'RETURN_DATE', type: 'date', nullable: true })
  returnDate: Date | null;

  @Column({ name: 'RETURN_REASON', length: 500, nullable: true })
  returnReason: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
