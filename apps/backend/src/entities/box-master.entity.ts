/**
 * @file box-master.entity.ts
 * @description 박스 마스터(BoxMaster) 엔티티 - 포장 박스 정보를 관리한다.
 *              boxNo를 자연키 PK로 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. BOX_NO가 PK (UUID 대신 자연키)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
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

@Entity({ name: 'BOX_MASTERS' })
@Index(['itemCode'])
@Index(['palletNo'])
@Index(['status'])
export class BoxMaster {
  @PrimaryColumn({ name: 'BOX_NO', length: 50 })
  boxNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'SERIAL_LIST', type: 'clob', nullable: true })
  serialList: string | null;

  @Column({ name: 'PALLET_NO', length: 50, nullable: true })
  palletNo: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'OPEN' })
  status: string;

  @Column({ name: 'OQC_STATUS', length: 50, nullable: true })
  oqcStatus: string | null;

  @Column({ name: 'CLOSE_TIME', type: 'timestamp', nullable: true })
  closeAt: Date | null;

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
