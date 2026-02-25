/**
 * @file entities/com-code.entity.ts
 * @description 공통코드 엔티티 - 시스템 전체에서 사용하는 코드를 관리한다.
 *              복합 PK: (groupCode, detailCode). 패턴 C.
 *
 * 초보자 가이드:
 * 1. 복합 PK: groupCode + detailCode
 * 2. groupCode: 코드 그룹 (예: PART_TYPE, WAREHOUSE_TYPE)
 * 3. detailCode: 그룹 내 상세 코드 (예: MAT, PROD)
 * 4. attr1~attr3: 추가 속성 (색상, 아이콘 등)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'COM_CODES' })
@Index(['groupCode'])
@Index(['parentCode'])
export class ComCode {
  @PrimaryColumn({ name: 'GROUP_CODE', length: 50 })
  groupCode: string;

  @PrimaryColumn({ name: 'DETAIL_CODE', length: 50 })
  detailCode: string;

  @Column({ name: 'PARENT_CODE', length: 50, nullable: true })
  parentCode: string | null;

  @Column({ name: 'CODE_NAME', length: 100 })
  codeName: string;

  @Column({ name: 'CODE_DESC', length: 255, nullable: true })
  codeDesc: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'ATTR1', length: 100, nullable: true })
  attr1: string | null;

  @Column({ name: 'ATTR2', length: 100, nullable: true })
  attr2: string | null;

  @Column({ name: 'ATTR3', length: 100, nullable: true })
  attr3: string | null;

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
