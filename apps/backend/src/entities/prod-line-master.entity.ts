/**
 * @file entities/prod-line-master.entity.ts
 * @description 생산라인 마스터 엔티티 - 생산라인 정보를 관리한다.
 *              lineCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. lineCode가 PK (UUID 대신 자연키)
 * 2. lineType으로 라인 유형 분류
 * 3. oper: ERP 공정코드 매핑
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PROD_LINE_MASTERS' })
@Index(['lineType'])
@Index(['oper'])
export class ProdLineMaster {
  @PrimaryColumn({ name: 'LINE_CODE', length: 50 })
  lineCode: string;

  @Column({ name: 'LINE_NAME', length: 255 })
  lineName: string;

  @Column({ name: 'WH_LOC', length: 255, nullable: true })
  whLoc: string | null;

  @Column({ name: 'ERP_CODE', length: 255, nullable: true })
  erpCode: string | null;

  @Column({ name: 'OPER', length: 255, nullable: true })
  oper: string | null;

  @Column({ name: 'LINE_TYPE', length: 255, nullable: true })
  lineType: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
}
