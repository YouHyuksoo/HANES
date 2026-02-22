/**
 * @file entities/vendor-barcode-mapping.entity.ts
 * @description 자재 제조사 바코드 매핑 엔티티
 *
 * 초보자 가이드:
 * 1. 제조사가 부여한 바코드(vendorBarcode)를 MES 내 품목(partId)과 매핑
 * 2. 바코드 스캔 시 이 테이블을 조회하여 자동으로 파트넘버를 변환
 * 3. 하나의 제조사 바코드 패턴이 하나의 품목에 매핑됨
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'VENDOR_BARCODE_MAPPINGS' })
@Index(['vendorBarcode'], { unique: true })
@Index(['partId'])
@Index(['vendorCode'])
export class VendorBarcodeMapping {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  /** 제조사 바코드 값 (스캔 원본) */
  @Column({ name: 'VENDOR_BARCODE', length: 200 })
  vendorBarcode: string;

  /** MES 품목 ID (PART_MASTERS.ID 참조) */
  @Column({ name: 'PART_ID', length: 36, nullable: true })
  partId: string | null;

  /** MES 품번 (PART_MASTERS.PART_CODE 참조, 조회 편의용) */
  @Column({ name: 'PART_CODE', length: 50, nullable: true })
  partCode: string | null;

  /** MES 품명 (조회 편의용) */
  @Column({ name: 'PART_NAME', length: 100, nullable: true })
  partName: string | null;

  /** 제조사 코드 (VENDOR_MASTERS 참조) */
  @Column({ name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  /** 제조사명 (조회 편의용) */
  @Column({ name: 'VENDOR_NAME', length: 100, nullable: true })
  vendorName: string | null;

  /** 매핑 규칙 설명 (예: 접두사 매칭, 정규식 등) */
  @Column({ name: 'MAPPING_RULE', length: 200, nullable: true })
  mappingRule: string | null;

  /** 바코드 유형 (EXACT: 정확히 일치, PREFIX: 접두사 매칭, REGEX: 정규식) */
  @Column({ name: 'MATCH_TYPE', length: 20, default: 'EXACT' })
  matchType: string;

  /** 비고 */
  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  /** 사용여부 */
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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
