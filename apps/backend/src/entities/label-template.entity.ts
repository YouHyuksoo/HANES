/**
 * @file entities/label-template.entity.ts
 * @description 라벨 템플릿 엔티티 - 라벨 디자인/ZPL 템플릿을 관리한다.
 *              자연키 없으므로 SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. templateName + category 복합 유니크
 * 3. designData: 라벨 디자인 JSON (CLOB)
 * 4. zplCode: ZPL 프린터용 코드 (CLOB)
 * 5. printMode: BROWSER(브라우저) / ZPL(직접출력)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'LABEL_TEMPLATES' })
@Unique(['templateName', 'category'])
@Index(['category'])
@Index(['isDefault'])
export class LabelTemplate {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'TEMPLATE_NAME', length: 100 })
  templateName: string;

  @Column({ name: 'CATEGORY', length: 50 })
  category: string;

  @Column({ name: 'DESIGN_DATA', type: 'clob' })
  designData: string;

  @Column({ name: 'IS_DEFAULT', default: false })
  isDefault: boolean;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ZPL_CODE', type: 'clob', nullable: true })
  zplCode: string | null;

  @Column({ name: 'PRINT_MODE', length: 20, default: 'BROWSER' })
  printMode: string;

  @Column({ name: 'PRINTER_ID', length: 36, nullable: true })
  printerId: string | null;

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
}
