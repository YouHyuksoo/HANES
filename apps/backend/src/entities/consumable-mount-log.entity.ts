/**
 * @file entities/consumable-mount-log.entity.ts
 * @description 금형 장착/해제 이력 엔티티
 *              복합키: MOUNT_DATE + SEQ (일자 + 일련번호).
 *
 * 초보자 가이드:
 * 1. 복합 PK: mountDate(장착일) + seq(일련번호)
 * 2. consumableCode: 금형(소모품) 코드
 * 3. equipCode: 장착 대상 설비 코드
 * 4. action: MOUNT(장착), UNMOUNT(해제)
 * 5. 복합키(MOUNT_DATE + SEQ)만 사용 — ID 컬럼 불필요
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_MOUNT_LOGS' })
@Index(['consumableCode'])
@Index(['equipCode'])
export class ConsumableMountLog {
  @PrimaryColumn({ name: 'MOUNT_DATE', type: 'date' })
  mountDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'CONSUMABLE_CODE', length: 50 })
  consumableCode: string;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'ACTION', length: 20 })
  action: string;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CON_UID', length: 50, nullable: true })
  conUid: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
