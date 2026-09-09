/**
 * @file inspect-aid.entity.ts
 * @description 검사보조구 마스터 엔티티 — 양품/불량 한도견본, 검사홀더·지그
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + AID_CODE (설비점검항목 마스터와 같은 복합 PK 패턴)
 * 2. AID_TYPE은 공통코드 INSPECT_AID_TYPE(LIMIT_OK/LIMIT_NG/HOLDER)
 * 3. STATUS: ACTIVE(사용중) / EXPIRED(만료) / RETIRED(폐기) — 공통코드 INSPECT_AID_STATUS
 * 4. VALID_TO 기준으로 만료·임박(기본 30일) 목록을 GET /expiring 으로 조회한다.
 * 5. IMAGE_URL은 multer 업로드 경로(/uploads/inspect-aids/...)
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'INSPECT_AIDS' })
export class InspectAid {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'AID_CODE', length: 50 })
  aidCode: string;

  @Column({ name: 'AID_TYPE', length: 30 })
  aidType: string;

  @Column({ name: 'AID_NAME', length: 200 })
  aidName: string;

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar2', name: 'DEFECT_CODE', length: 50, nullable: true })
  defectCode: string | null;

  @Column({ type: 'varchar2', name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar2', name: 'LOCATION', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'VALID_FROM', type: 'date', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'VALID_TO', type: 'date', nullable: true })
  validTo: Date | null;

  @Column({ type: 'varchar2', name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'STATUS', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
