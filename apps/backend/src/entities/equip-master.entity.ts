/**
 * @file entities/equip-master.entity.ts
 * @description 설비 마스터 엔티티 - 설비 정보를 관리한다.
 *              equipCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. equipCode가 PK (UUID 대신 자연키)
 * 2. equipType으로 설비 유형 분류
 * 3. commConfig: JSON 문자열로 통신 설정 저장 (Oracle CLOB)
 * 4. bomRels: 설비 BOM 관계 (1:N)
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
import { EquipBomRel } from './equip-bom-rel.entity';

@Entity({ name: 'EQUIP_MASTERS' })
@Index(['equipType'])
@Index(['lineCode'])
@Index(['status'])
export class EquipMaster {
  @PrimaryColumn({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'EQUIP_NAME', length: 100 })
  equipName: string;

  @Column({ name: 'EQUIP_TYPE', length: 50, nullable: true })
  equipType: string | null;

  @Column({ name: 'MODEL_NAME', length: 100, nullable: true })
  modelName: string | null;

  @Column({ name: 'MAKER', length: 100, nullable: true })
  maker: string | null;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'IP_ADDRESS', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'PORT', type: 'int', nullable: true })
  port: number | null;

  @Column({ name: 'COMM_TYPE', length: 50, nullable: true })
  commType: string | null;

  /** Oracle stores JSON as CLOB - requires manual parse/stringify */
  @Column({ name: 'COMM_CONFIG', type: 'clob', nullable: true })
  commConfig: string | null;

  @Column({ name: 'INSTALL_DATE', type: 'date', nullable: true })
  installDate: Date | null;

  @Column({ name: 'STATUS', length: 20, default: 'NORMAL' })
  status: string;

  @Column({ name: 'CURRENT_JOB_ORDER_ID', length: 50, nullable: true })
  currentJobOrderId: string | null;

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

  // Relations
  @OneToMany(() => EquipBomRel, (rel) => rel.equipment)
  bomRels: EquipBomRel[];

  /** Helper method to parse commConfig from JSON string */
  getCommConfigObject(): Record<string, unknown> | null {
    if (!this.commConfig) return null;
    try {
      return JSON.parse(this.commConfig);
    } catch {
      return null;
    }
  }

  /** Helper method to set commConfig as JSON string */
  setCommConfigObject(obj: Record<string, unknown>): void {
    this.commConfig = JSON.stringify(obj);
  }
}
