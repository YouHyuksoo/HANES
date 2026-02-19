import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'INTER_LOGS' })
@Index(['direction', 'messageType'])
@Index(['status'])
@Index(['interfaceId'])
export class InterLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'DIRECTION', length: 50 })
  direction: string;

  @Column({ name: 'MESSAGE_TYPE', length: 100 })
  messageType: string;

  @Column({ name: 'INTERFACE_ID', length: 255, nullable: true })
  interfaceId: string | null;

  @Column({ name: 'PAYLOAD', type: 'clob', nullable: true })
  payload: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'PENDING' })
  status: string;

  @Column({ name: 'ERROR_MSG', length: 500, nullable: true })
  errorMsg: string | null;

  @Column({ name: 'RETRY_COUNT', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'SEND_TIME', type: 'timestamp', nullable: true })
  sendAt: Date | null;

  @Column({ name: 'RECV_TIME', type: 'timestamp', nullable: true })
  recvAt: Date | null;

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
}
