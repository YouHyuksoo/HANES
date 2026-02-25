/**
 * @file oqc-request-box.entity.ts
 * @description OQC 의뢰-박스 연결 엔티티 - 검사 의뢰에 포함된 박스 목록
 *              시퀀스 PK 사용, oqcRequestId → requestNo로 OqcRequest 참조.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. REQUEST_NO로 OqcRequest(검사의뢰)를 참조
 * 3. IS_SAMPLE: 'Y'면 샘플로 선정된 박스
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OqcRequest } from './oqc-request.entity';

@Entity({ name: 'OQC_REQUEST_BOXES' })
@Index(['requestNo'])
@Index(['boxNo'])
export class OqcRequestBox {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'REQUEST_NO', length: 50 })
  requestNo: string;

  @Column({ name: 'BOX_NO', length: 50 })
  boxNo: string;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'IS_SAMPLE', length: 1, default: 'N' })
  isSample: string;

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

  @ManyToOne(() => OqcRequest, (req) => req.boxes)
  @JoinColumn({ name: 'REQUEST_NO' })
  oqcRequest: OqcRequest;
}
