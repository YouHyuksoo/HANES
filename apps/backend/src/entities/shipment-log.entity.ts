/**
 * @file shipment-log.entity.ts
 * @description 출하이력(ShipmentLog) 엔티티 - 출하 실적 정보를 기록한다.
 *              자연키 PK: shipNo (출하번호).
 *
 * 초보자 가이드:
 * 1. shipNo가 PK (자연키)
 * 2. 차량, 운전기사, 목적지, 수량 등 출하 정보 관리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SHIPMENT_LOGS' })
@Index(['status'])
@Index(['shipDate'])
@Index(['customer'])
export class ShipmentLog {
  @PrimaryColumn({ name: 'SHIP_NO', length: 50 })
  shipNo: string;

  @Column({ name: 'SHIP_DATE', type: 'date', nullable: true })
  shipDate: Date | null;

  @Column({ name: 'SHIP_TIME', type: 'timestamp', nullable: true })
  shipAt: Date | null;

  @Column({ type: 'varchar2', name: 'VEHICLE_NO', length: 50, nullable: true })
  vehicleNo: string | null;

  @Column({ type: 'varchar2', name: 'DRIVER_NAME', length: 100, nullable: true })
  driverName: string | null;

  @Column({ type: 'varchar2', name: 'DESTINATION', length: 255, nullable: true })
  destination: string | null;

  @Column({ type: 'varchar2', name: 'CUSTOMER', length: 100, nullable: true })
  customer: string | null;

  @Column({ name: 'PALLET_COUNT', type: 'int', default: 0 })
  palletCount: number;

  @Column({ name: 'BOX_COUNT', type: 'int', default: 0 })
  boxCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'int', default: 0 })
  totalQty: number;

  @Column({ name: 'STATUS', length: 50, default: 'PREPARING' })
  status: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ERP_SYNC_YN', length: 1, default: 'N' })
  erpSyncYn: string;

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
