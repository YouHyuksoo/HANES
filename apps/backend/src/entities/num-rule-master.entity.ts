import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'NUM_RULE_MASTERS' })
export class NumRuleMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'RULE_TYPE', length: 50, unique: true })
  ruleType: string;

  @Column({ name: 'RULE_NAME', length: 100 })
  ruleName: string;

  @Column({ name: 'PATTERN', length: 100 })
  pattern: string;

  @Column({ name: 'PREFIX', length: 20, nullable: true })
  prefix: string | null;

  @Column({ name: 'SUFFIX', length: 20, nullable: true })
  suffix: string | null;

  @Column({ name: 'SEQ_LENGTH', type: 'int', default: 4 })
  seqLength: number;

  @Column({ name: 'CURRENT_SEQ', type: 'int', default: 0 })
  currentSeq: number;

  @Column({ name: 'RESET_TYPE', length: 20, default: 'DAILY' })
  resetType: string;

  @Column({ name: 'LAST_RESET', type: 'date', nullable: true })
  lastResetDate: Date | null;

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
