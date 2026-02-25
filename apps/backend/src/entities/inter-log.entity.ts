/**
 * @file entities/inter-log.entity.ts
 * @description 인터페이스 로그 엔티티 - 외부 시스템 연동 이력을 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. direction: INBOUND(수신) / OUTBOUND(송신)
 * 3. status: PENDING, SUCCESS, FAILED
 * 4. payload: 연동 데이터 (CLOB)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'INTER_LOGS' })
@Index(['direction', 'messageType'])
@Index(['status'])
@Index(['interfaceId'])
export class InterLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

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

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
