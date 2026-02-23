/**
 * @file entities/consumable-mount-log.entity.ts
 * @description 금형 장착/해제 이력 엔티티
 *
 * 초보자 가이드:
 * - 금형(소모품)이 어떤 설비에 장착/해제되었는지 이력을 추적
 * - ACTION: MOUNT(장착), UNMOUNT(해제)
 * - 설비별/금형별 이력 조회 가능
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_MOUNT_LOGS' })
@Index(['consumableId'])
@Index(['equipId'])
export class ConsumableMountLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'CONSUMABLE_ID', length: 50 })
  consumableId: string;

  @Column({ name: 'EQUIP_ID', length: 50 })
  equipId: string;

  @Column({ name: 'ACTION', length: 20 })
  action: string;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
