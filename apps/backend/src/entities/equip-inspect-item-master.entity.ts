/**
 * @file entities/equip-inspect-item-master.entity.ts
 * @description 설비 점검항목 마스터 엔티티 - 설비별 점검항목을 관리한다.
 *              자연키 없으므로 SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. equipCode: 대상 설비 코드
 * 3. inspectType: 점검 유형 (일상, 정기 등)
 * 4. seq: 항목 순서
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'EQUIP_INSPECT_ITEM_MASTERS' })
@Index(['equipCode'])
@Index(['inspectType'])
export class EquipInspectItemMaster {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'INSPECT_TYPE', length: 50 })
  inspectType: string;

  @Column({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ITEM_NAME', length: 255 })
  itemName: string;

  @Column({ name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ name: 'CYCLE', length: 50, nullable: true })
  cycle: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
