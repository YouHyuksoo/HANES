/**
 * @file oqc-request.entity.ts
 * @description OQC(출하검사) 의뢰 엔티티 - 출하 전 제품 품질 검증 요청
 *              requestNo를 자연키 PK로 사용, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. REQUEST_NO가 PK (UUID 대신 자연키)
 * 2. ITEM_CODE로 ItemMaster(품목)를 참조
 * 3. 상태 흐름: PENDING → IN_PROGRESS → PASS/FAIL
 * 4. OqcRequest 1:N OqcRequestBox
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OqcRequestBox } from './oqc-request-box.entity';

@Entity({ name: 'OQC_REQUESTS' })
@Index(['status'])
@Index(['itemCode'])
@Index(['requestDate'])
export class OqcRequest {
  @PrimaryColumn({ name: 'REQUEST_NO', length: 50 })
  requestNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'CUSTOMER', length: 100, nullable: true })
  customer: string | null;

  @Column({ name: 'REQUEST_DATE', type: 'date' })
  requestDate: Date;

  @Column({ name: 'TOTAL_BOX_COUNT', type: 'int', default: 0 })
  totalBoxCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'int', default: 0 })
  totalQty: number;

  @Column({ name: 'SAMPLE_SIZE', type: 'int', nullable: true })
  sampleSize: number | null;

  @Column({ name: 'STATUS', length: 50, default: 'PENDING' })
  status: string;

  @Column({ name: 'RESULT', length: 50, nullable: true })
  result: string | null;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'INSPECT_DATE', type: 'timestamp', nullable: true })
  inspectDate: Date | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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

  @OneToMany(() => OqcRequestBox, (box) => box.oqcRequest)
  boxes: OqcRequestBox[];
}
