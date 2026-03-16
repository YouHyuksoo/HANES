/**
 * @file routing-group.entity.ts
 * @description 라우팅 그룹 마스터 엔티티 - 공정순서 그룹을 정의
 *              PK: ROUTING_CODE (자연키)
 *
 * 초보자 가이드:
 * 1. 라우팅 그룹은 공정순서의 템플릿 역할
 * 2. BOM에서 제품/반제품에 라우팅 그룹을 매핑하여 사용
 * 3. 하위에 ROUTING_PROCESSES(공정순서)와 PROCESS_QUALITY_CONDITIONS(양품조건) 보유
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'ROUTING_GROUPS' })
export class RoutingGroup {
  @PrimaryColumn({ name: 'ROUTING_CODE', length: 50 })
  routingCode: string;

  @Column({ name: 'ROUTING_NAME', length: 200 })
  routingName: string;

  @Column({ name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'COMPANY', length: 255 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 255 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
