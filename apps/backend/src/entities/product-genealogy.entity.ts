/**
 * @file product-genealogy.entity.ts
 * @description 생산 genealogy — 부모 시리얼 ← 자식 소스 링크(재귀).
 *              FG→SG(키팅), SG→MAT_LOT(반제품 생산), FG→MAT_LOT(서브공정 직접 원자재).
 *              GENEALOGY_ID는 SEQ_PROD_GENEALOGY.NEXTVAL로 채운다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PRODUCT_GENEALOGY' })
@Index(['parentKey'])
@Index(['childKey'])
export class ProductGenealogy {
  @PrimaryColumn({ name: 'GENEALOGY_ID', type: 'int' })
  genealogyId: number;

  /** 'FG' | 'SG' */
  @Column({ name: 'PARENT_TYPE', length: 20 })
  parentType: string;

  @Column({ name: 'PARENT_KEY', length: 50 })
  parentKey: string;

  /** 'SG' | 'MAT_LOT' */
  @Column({ name: 'CHILD_TYPE', length: 20 })
  childType: string;

  @Column({ name: 'CHILD_KEY', length: 100 })
  childKey: string;

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ type: 'varchar2', name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar2', name: 'CIRCUIT_NO', length: 50, nullable: true })
  circuitNo: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
