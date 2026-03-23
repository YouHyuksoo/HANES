/**
 * @file mold-master.entity.ts
 * @description 금형 마스터 엔티티 — 금형 기본정보 및 수명 관리
 *
 * 초보자 가이드:
 * 1. 금형 기본정보(코드, 명칭, 유형, 캐비티 수) 관리
 * 2. 타수(shots) 기반 수명 관리: currentShots / guaranteedShots
 * 3. 보전 주기 관리: maintenanceCycle(타수 기준) → nextMaintenanceDate 자동 산출
 * 4. 상태: ACTIVE / MAINTENANCE / RETIRED / SCRAPPED
 * 5. MoldUsageLog 엔티티와 1:N 관계 (사용 이력)
 * 6. PartMaster와 ManyToOne 관계 (생산 품목)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartMaster } from './part-master.entity';

@Entity({ name: 'MOLD_MASTERS' })
export class MoldMaster {
  @PrimaryColumn({ name: 'MOLD_CODE', length: 50 })
  moldCode: string;

  @Column({ name: 'MOLD_NAME', length: 200 })
  moldName: string;

  @Column({ name: 'MOLD_TYPE', length: 50, nullable: true })
  moldType: string;

  @Column({ name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string;

  @ManyToOne(() => PartMaster)
  @JoinColumn({ name: 'ITEM_CODE', referencedColumnName: 'itemCode' })
  part: PartMaster;

  @Column({ name: 'CAVITY', type: 'int', default: 1 })
  cavity: number;

  @Column({ name: 'GUARANTEED_SHOTS', type: 'int', nullable: true })
  guaranteedShots: number;

  @Column({ name: 'CURRENT_SHOTS', type: 'int', default: 0 })
  currentShots: number;

  @Column({ name: 'LAST_MAINTENANCE_DATE', type: 'timestamp', nullable: true })
  lastMaintenanceDate: Date;

  @Column({ name: 'NEXT_MAINTENANCE_DATE', type: 'timestamp', nullable: true })
  nextMaintenanceDate: Date;

  @Column({ name: 'MAINTENANCE_CYCLE', type: 'int', nullable: true })
  maintenanceCycle: number;

  @Column({ name: 'STATUS', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'LOCATION', length: 200, nullable: true })
  location: string;

  @Column({ name: 'MAKER', length: 200, nullable: true })
  maker: string;

  @Column({ name: 'PURCHASE_DATE', type: 'timestamp', nullable: true })
  purchaseDate: Date;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
