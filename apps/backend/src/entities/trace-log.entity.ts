import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

@Entity({ name: 'TRACE_LOGS' })
@Index(['palletId'])
@Index(['boxId'])
@Index(['lotId'])
@Index(['matLotId'])
@Index(['serialNo'])
@Index(['eventType'])
export class TraceLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'TRACE_TIME', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  traceTime: Date;

  @Column({ name: 'PALLET_ID', length: 255, nullable: true })
  palletId: string | null;

  @Column({ name: 'BOX_ID', length: 255, nullable: true })
  boxId: string | null;

  @Column({ name: 'LOT_ID', length: 255, nullable: true })
  lotId: string | null;

  @Column({ name: 'MAT_LOT_ID', length: 255, nullable: true })
  matLotId: string | null;

  @Column({ name: 'EQUIP_ID', length: 255, nullable: true })
  equipId: string | null;

  @Column({ name: 'WORKER_ID', length: 255, nullable: true })
  workerId: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'SERIAL_NO', length: 255, nullable: true })
  serialNo: string | null;

  @Column({ name: 'EVENT_TYPE', length: 50, nullable: true })
  eventType: string | null;

  @Column({ name: 'EVENT_DATA', type: 'clob', nullable: true })
  eventData: string | null;

  @Column({ name: 'PARENT_ID', length: 36, nullable: true })
  parentId: string | null;

  @ManyToOne(() => TraceLog, (trace) => trace.children, { nullable: true })
  @JoinColumn({ name: 'PARENT_ID' })
  parent: TraceLog | null;

  @OneToMany(() => TraceLog, (trace) => trace.parent)
  children: TraceLog[];

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

  /** 
   * 시리얼 트리깊이 계산 (루트=0, 자식=1, 손자=2...)
   * 주의: Entity에서 직접 호출 시 parent가 로드되지 않았으면 0을 반환
   */
  getDepth(): number {
    let d = 0;
    let current: TraceLog | null = this;
    while (current?.parentId) {
      d++;
      current = current.parent;
    }
    return d;
  }
}
