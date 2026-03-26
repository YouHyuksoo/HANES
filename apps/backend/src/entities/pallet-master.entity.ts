/**
 * @file pallet-master.entity.ts
 * @description 파레트 마스터(PalletMaster) 엔티티 - 파레트 정보를 관리한다.
 *              palletNo를 자연키 PK로 사용.
 *
 * 초보자 가이드:
 * 1. PALLET_NO가 PK (UUID 대신 자연키)
 * 2. 박스 수량, 총 수량, 상태 관리
 * 3. 상태: OPEN → CLOSED
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PALLET_MASTERS' })
@Index(['status'])
@Index(['shipmentId'])
export class PalletMaster {
  @PrimaryColumn({ name: 'PALLET_NO', length: 50 })
  palletNo: string;

  @Column({ name: 'BOX_COUNT', type: 'int', default: 0 })
  boxCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'int', default: 0 })
  totalQty: number;

  @Column({ name: 'STATUS', length: 20, default: 'OPEN' })
  status: string;

  @Column({ name: 'CLOSE_TIME', type: 'timestamp', nullable: true })
  closeAt: Date | null;

  @Column({ type: 'varchar2', name: 'SHIPMENT_ID', length: 255, nullable: true })
  shipmentId: string | null;

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
