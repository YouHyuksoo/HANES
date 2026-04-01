/**
 * @file entities/mat-out-request.entity.ts
 * @description 기타출고 승인요청 엔티티 (MAT_OUT_REQUESTS 테이블)
 *              G9: 반품/폐기/기타 출고 시 유권한자 승인 워크플로우
 *
 * 초보자 가이드:
 * 1. 요청 등록 시 대상 시리얼의 재고가 잠김 (reservedQty 증가)
 * 2. 승인 시 실제 출고 처리 (StockTransaction 생성)
 * 3. 취소 시 잠금 해제 (reservedQty 원복)
 * 4. outType: RETURN(반품), SCRAP(폐기), OTHER(기타)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_OUT_REQUESTS' })
@Index(['outType'])
@Index(['status'])
@Index(['matUid'])
export class MatOutRequest {
  @PrimaryColumn({ name: 'REQUEST_NO', length: 20 })
  requestNo: string;

  /** 출고유형: RETURN(반품), SCRAP(폐기), OTHER(기타) */
  @Column({ name: 'OUT_TYPE', length: 10 })
  outType: string;

  /** 상태: REQUESTED → APPROVED → COMPLETED / REJECTED / CANCELLED */
  @Column({ name: 'STATUS', length: 10, default: 'REQUESTED' })
  status: string;

  /** 대상 시리얼 */
  @Column({ name: 'MAT_UID', length: 30 })
  matUid: string;

  /** 품목코드 */
  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  /** 출고 수량 */
  @Column({ name: 'QTY', type: 'number', precision: 12, scale: 3 })
  qty: number;

  /** 출고 사유 */
  @Column({ type: 'varchar2', name: 'REASON', length: 500, nullable: true })
  reason: string | null;

  /** 요청자 ID */
  @Column({ type: 'varchar2', name: 'REQUESTER_ID', length: 20, nullable: true })
  requesterId: string | null;

  /** 승인자 ID */
  @Column({ type: 'varchar2', name: 'APPROVER_ID', length: 20, nullable: true })
  approverId: string | null;

  /** 승인/거절 일시 */
  @Column({ type: 'timestamp', name: 'APPROVED_AT', nullable: true })
  approvedAt: Date | null;

  /** 재고 잠금 여부 (기본 Y) */
  @Column({ name: 'LOCK_YN', length: 1, default: 'Y' })
  lockYn: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
