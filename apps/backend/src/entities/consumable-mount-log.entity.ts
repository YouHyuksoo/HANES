/**
 * @file entities/consumable-mount-log.entity.ts
 * @description 금형 장착/해제 이력 엔티티
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. consumableCode: 금형(소모품) 코드
 * 3. equipCode: 장착 대상 설비 코드
 * 4. action: MOUNT(장착), UNMOUNT(해제)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_MOUNT_LOGS' })
@Index(['consumableCode'])
@Index(['equipCode'])
export class ConsumableMountLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'ACTION', length: 20 })
  action: string;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerCode: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CON_UID', length: 50, nullable: true })
  conUid: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
