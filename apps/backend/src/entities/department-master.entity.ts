/**
 * @file entities/department-master.entity.ts
 * @description 부서 마스터 엔티티 - 부서 정보를 관리한다.
 *              deptCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. deptCode가 PK (UUID 대신 자연키)
 * 2. parentDeptCode: 상위 부서 코드 (트리 구조)
 * 3. sortOrder: 정렬 순서
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'DEPARTMENT_MASTERS' })
export class DepartmentMaster {
  @PrimaryColumn({ name: 'DEPT_CODE', length: 50 })
  deptCode: string;

  @Column({ name: 'DEPT_NAME', length: 100 })
  deptName: string;

  @Column({ name: 'PARENT_DEPT_CODE', length: 50, nullable: true })
  parentDeptCode: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'MANAGER_NAME', length: 50, nullable: true })
  managerName: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
