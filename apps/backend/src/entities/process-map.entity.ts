/**
 * @file process-map.entity.ts
 * @description 공정맵(ProcessMap) 엔티티 - 품목별 공정 순서를 정의한다.
 *              시퀀스 PK 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. SEQ로 공정 순서를 관리
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

@Entity({ name: 'PROCESS_MAPS' })
@Unique(['itemCode', 'seq'])
@Index(['itemCode'])
@Index(['processType'])
export class ProcessMap {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'PROCESS_CODE', length: 255 })
  processCode: string;

  @Column({ name: 'PROCESS_NAME', length: 255 })
  processName: string;

  @Column({ name: 'PROCESS_TYPE', length: 255, nullable: true })
  processType: string | null;

  @Column({ name: 'EQUIP_TYPE', length: 255, nullable: true })
  equipType: string | null;

  @Column({ name: 'STD_TIME', type: 'decimal', precision: 10, scale: 4, nullable: true })
  stdTime: number | null;

  @Column({ name: 'SETUP_TIME', type: 'decimal', precision: 10, scale: 4, nullable: true })
  setupTime: number | null;

  @Column({ name: 'WIRE_LENGTH', type: 'decimal', precision: 10, scale: 2, nullable: true })
  wireLength: number | null;

  @Column({ name: 'STRIP_LENGTH', type: 'decimal', precision: 10, scale: 2, nullable: true })
  stripLength: number | null;

  @Column({ name: 'CRIMP_HEIGHT', type: 'decimal', precision: 10, scale: 3, nullable: true })
  crimpHeight: number | null;

  @Column({ name: 'CRIMP_WIDTH', type: 'decimal', precision: 10, scale: 3, nullable: true })
  crimpWidth: number | null;

  @Column({ name: 'WELD_CONDITION', length: 500, nullable: true })
  weldCondition: string | null;

  @Column({ name: 'PROCESS_PARAMS', length: 2000, nullable: true })
  processParams: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
