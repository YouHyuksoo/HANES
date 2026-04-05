# 예지보전(Predictive Maintenance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 센서 데이터 수신 → 조건 규칙 감시 → 자동 WO 생성/INTERLOCK 흐름을 구현하고, 기존 PM Plan의 USAGE_BASED 타입을 활성화한다.

**Architecture:** 외부 시스템이 POST로 센서 데이터를 push → 수신 시 조건 규칙 체크 → 임계값 초과 시 자동 조치(ALERT/AUTO_WO/INTERLOCK). PmPlan의 USAGE_BASED는 센서 데이터의 RUNTIME_HOURS 누적으로 트리거.

**Tech Stack:** NestJS, TypeORM, Oracle DB

---

## DDL 변경 사항 (사용자 승인 필요)

| 테이블 | 타입 | 용도 |
|--------|------|------|
| `SENSOR_DATA_LOGS` | 신규 | 센서 측정 데이터 저장 |
| `EQUIP_CONDITION_RULES` | 신규 | 설비별 감시 규칙 (임계값+조치) |
| `PM_PLANS.USAGE_THRESHOLD` | 컬럼 추가 | USAGE_BASED 트리거 값 |
| `PM_PLANS.USAGE_FIELD` | 컬럼 추가 | 감시 대상 (RUNTIME_HOURS 등) |
| `PM_PLANS.CURRENT_USAGE` | 컬럼 추가 | 현재 누적 사용량 |

---

## File Map

### Task 1: 엔티티 + DDL
- Create: `apps/backend/src/entities/sensor-data-log.entity.ts`
- Create: `apps/backend/src/entities/equip-condition-rule.entity.ts`
- Modify: `apps/backend/src/entities/pm-plan.entity.ts` — usageThreshold, usageField, currentUsage 추가

### Task 2: 센서 데이터 수신 서비스 + 조건 감시
- Create: `apps/backend/src/modules/equipment/services/sensor-monitor.service.ts`
- Create: `apps/backend/src/modules/equipment/dto/sensor-monitor.dto.ts`
- Create: `apps/backend/src/modules/equipment/controllers/sensor-monitor.controller.ts`

### Task 3: 모듈 등록 + USAGE_BASED WO 생성
- Modify: `apps/backend/src/modules/equipment/equipment.module.ts`
- Modify: `apps/backend/src/modules/equipment/services/pm-plan.service.ts` — generateWorkOrders 확장

---

## Task 1: 엔티티 + DDL

**Files:**
- Create: `apps/backend/src/entities/sensor-data-log.entity.ts`
- Create: `apps/backend/src/entities/equip-condition-rule.entity.ts`
- Modify: `apps/backend/src/entities/pm-plan.entity.ts`

- [ ] **Step 1: DDL 실행 (oracle-db 스킬, --site JSHANES)**

```sql
-- 센서 데이터 로그
CREATE TABLE SENSOR_DATA_LOGS (
  LOG_ID      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  EQUIP_CODE  VARCHAR2(50) NOT NULL,
  SENSOR_TYPE VARCHAR2(30) NOT NULL,
  VALUE       NUMBER(15,4) NOT NULL,
  UNIT        VARCHAR2(20),
  MEASURED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  COMPANY     VARCHAR2(50),
  PLANT_CD    VARCHAR2(50),
  CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IDX_SDL_EQUIP ON SENSOR_DATA_LOGS(EQUIP_CODE, SENSOR_TYPE);
CREATE INDEX IDX_SDL_MEASURED ON SENSOR_DATA_LOGS(MEASURED_AT);

-- 설비 조건 감시 규칙
CREATE TABLE EQUIP_CONDITION_RULES (
  RULE_ID         NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  EQUIP_CODE      VARCHAR2(50) NOT NULL,
  SENSOR_TYPE     VARCHAR2(30) NOT NULL,
  WARNING_VALUE   NUMBER(15,4),
  CRITICAL_VALUE  NUMBER(15,4),
  COMPARE_OP      VARCHAR2(5) DEFAULT 'GT',
  ACTION_TYPE     VARCHAR2(20) DEFAULT 'ALERT',
  PM_PLAN_CODE    VARCHAR2(50),
  USE_YN          VARCHAR2(1) DEFAULT 'Y',
  COMPANY         VARCHAR2(50),
  PLANT_CD        VARCHAR2(50),
  CREATED_BY      VARCHAR2(50),
  UPDATED_BY      VARCHAR2(50),
  CREATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IDX_ECR_EQUIP ON EQUIP_CONDITION_RULES(EQUIP_CODE, SENSOR_TYPE);

-- PM_PLANS에 USAGE_BASED 컬럼 추가
ALTER TABLE PM_PLANS ADD (
  USAGE_FIELD     VARCHAR2(30),
  USAGE_THRESHOLD NUMBER(15,4),
  CURRENT_USAGE   NUMBER(15,4) DEFAULT 0
);
```

- [ ] **Step 2: sensor-data-log.entity.ts 생성**

```typescript
/**
 * @file entities/sensor-data-log.entity.ts
 * @description 센서 데이터 로그 — 외부 시스템이 push한 설비 측정 데이터 저장
 *
 * 초보자 가이드:
 * 1. LOG_ID가 PK (Oracle IDENTITY)
 * 2. equipCode + sensorType으로 설비별 센서 데이터 구분
 * 3. sensorType 예시: TEMPERATURE, VIBRATION, CURRENT, RUNTIME_HOURS, PRESSURE
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'SENSOR_DATA_LOGS' })
@Index(['equipCode', 'sensorType'])
@Index(['measuredAt'])
export class SensorDataLog {
  @PrimaryGeneratedColumn({ name: 'LOG_ID' })
  logId: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'SENSOR_TYPE', length: 30 })
  sensorType: string;

  @Column({ name: 'VALUE', type: 'number', precision: 15, scale: 4 })
  value: number;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'MEASURED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  measuredAt: Date;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
```

NOTE: SENSOR_DATA_LOGS는 외부 시스템이 대량으로 push하는 로그 테이블이므로 예외적으로 @PrimaryGeneratedColumn 사용 (Oracle IDENTITY). 자연키가 없고 순수 로그성 데이터.

- [ ] **Step 3: equip-condition-rule.entity.ts 생성**

```typescript
/**
 * @file entities/equip-condition-rule.entity.ts
 * @description 설비 조건 감시 규칙 — 센서값 임계치 초과 시 자동 조치 정의
 *
 * 초보자 가이드:
 * 1. RULE_ID가 PK (Oracle IDENTITY)
 * 2. compareOp: GT(초과), GTE(이상), LT(미만), LTE(이하)
 * 3. actionType: ALERT(알림만), AUTO_WO(WO 자동생성), INTERLOCK(설비 정지)
 * 4. pmPlanCode: AUTO_WO 시 어떤 PM 계획 기반으로 WO를 생성할지
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'EQUIP_CONDITION_RULES' })
@Index(['equipCode', 'sensorType'])
export class EquipConditionRule {
  @PrimaryGeneratedColumn({ name: 'RULE_ID' })
  ruleId: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'SENSOR_TYPE', length: 30 })
  sensorType: string;

  @Column({ name: 'WARNING_VALUE', type: 'number', precision: 15, scale: 4, nullable: true })
  warningValue: number | null;

  @Column({ name: 'CRITICAL_VALUE', type: 'number', precision: 15, scale: 4, nullable: true })
  criticalValue: number | null;

  @Column({ name: 'COMPARE_OP', length: 5, default: 'GT' })
  compareOp: string;

  @Column({ name: 'ACTION_TYPE', length: 20, default: 'ALERT' })
  actionType: string;

  @Column({ type: 'varchar2', name: 'PM_PLAN_CODE', length: 50, nullable: true })
  pmPlanCode: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

NOTE: 마찬가지로 EQUIP_CONDITION_RULES도 자연키가 없는 규칙 테이블이므로 @PrimaryGeneratedColumn 사용.

- [ ] **Step 4: pm-plan.entity.ts에 USAGE_BASED 컬럼 추가**

`useYn` 컬럼 앞에 3개 컬럼 추가:

```typescript
  /** USAGE_BASED: 감시 대상 센서 타입 (RUNTIME_HOURS, SHOT_COUNT 등) */
  @Column({ type: 'varchar2', name: 'USAGE_FIELD', length: 30, nullable: true })
  usageField: string | null;

  /** USAGE_BASED: 이 값 도달 시 WO 생성 */
  @Column({ name: 'USAGE_THRESHOLD', type: 'number', precision: 15, scale: 4, nullable: true })
  usageThreshold: number | null;

  /** USAGE_BASED: 현재 누적 사용량 (센서 데이터에서 자동 업데이트) */
  @Column({ name: 'CURRENT_USAGE', type: 'number', precision: 15, scale: 4, default: 0 })
  currentUsage: number;
```

- [ ] **Step 5: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 2: 센서 데이터 수신 서비스 + 조건 감시

**Files:**
- Create: `apps/backend/src/modules/equipment/dto/sensor-monitor.dto.ts`
- Create: `apps/backend/src/modules/equipment/services/sensor-monitor.service.ts`
- Create: `apps/backend/src/modules/equipment/controllers/sensor-monitor.controller.ts`

- [ ] **Step 1: DTO 생성**

```typescript
/**
 * @file dto/sensor-monitor.dto.ts
 * @description 센서 데이터 수신 및 조건 규칙 관리 DTO
 */
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/** 센서 데이터 단건 */
export class SensorDataItemDto {
  @IsString()
  equipCode: string;

  @IsString()
  sensorType: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  measuredAt?: string;
}

/** 센서 데이터 배치 수신 */
export class PostSensorDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SensorDataItemDto)
  items: SensorDataItemDto[];
}

/** 조건 규칙 생성 */
export class CreateConditionRuleDto {
  @IsString()
  equipCode: string;

  @IsString()
  sensorType: string;

  @IsOptional()
  @IsNumber()
  warningValue?: number;

  @IsOptional()
  @IsNumber()
  criticalValue?: number;

  @IsOptional()
  @IsString()
  @IsIn(['GT', 'GTE', 'LT', 'LTE'])
  compareOp?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ALERT', 'AUTO_WO', 'INTERLOCK'])
  actionType?: string;

  @IsOptional()
  @IsString()
  pmPlanCode?: string;
}

/** 조건 규칙 수정 */
export class UpdateConditionRuleDto {
  @IsOptional()
  @IsNumber()
  warningValue?: number;

  @IsOptional()
  @IsNumber()
  criticalValue?: number;

  @IsOptional()
  @IsString()
  compareOp?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsString()
  pmPlanCode?: string;

  @IsOptional()
  @IsString()
  useYn?: string;
}

/** 센서 데이터 조회 쿼리 */
export class SensorDataQueryDto {
  @IsOptional()
  @IsString()
  equipCode?: string;

  @IsOptional()
  @IsString()
  sensorType?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
```

- [ ] **Step 2: sensor-monitor.service.ts 생성**

핵심 로직:
1. `receiveSensorData()` — 배치 저장 + 규칙 체크 + USAGE_BASED 업데이트
2. `checkConditionRules()` — 임계값 비교 → 자동 조치
3. 조건 규칙 CRUD

```typescript
/**
 * @file services/sensor-monitor.service.ts
 * @description 센서 데이터 수신 + 조건 기반 감시 서비스
 *
 * 초보자 가이드:
 * 1. receiveSensorData(): 외부 시스템이 push한 센서 데이터를 저장하고 규칙 체크
 * 2. checkConditionRules(): 임계값 초과 시 ALERT/AUTO_WO/INTERLOCK 자동 실행
 * 3. USAGE_BASED PM Plan의 currentUsage를 센서 데이터로 자동 갱신
 */
```

서비스 메서드:
- `receiveSensorData(dto, company?, plant?)` — 배치 저장 후 규칙 체크
- `checkConditionRules(equipCode, sensorType, value)` — 규칙 매칭 + 자동 조치
  - ALERT: 로그만 (Logger.warn)
  - AUTO_WO: PmWorkOrder 자동 생성 (pmPlanCode 기반)
  - INTERLOCK: EquipMaster.status = 'INTERLOCK'
- `updateUsageBasedPlans(equipCode, sensorType, value)` — USAGE_BASED PM Plan의 currentUsage 갱신
- 조건 규칙 CRUD: `findAllRules`, `createRule`, `updateRule`, `deleteRule`

compareOp 비교 로직:
```typescript
private isTriggered(value: number, threshold: number, op: string): boolean {
  switch (op) {
    case 'GT': return value > threshold;
    case 'GTE': return value >= threshold;
    case 'LT': return value < threshold;
    case 'LTE': return value <= threshold;
    default: return value > threshold;
  }
}
```

AUTO_WO 생성 시 PmPlanService.createWorkOrder() 호출 (woType='PREDICTIVE', priority='HIGH').

- [ ] **Step 3: sensor-monitor.controller.ts 생성**

엔드포인트:
- `POST /equipment/sensor-data` — 센서 데이터 배치 수신
- `GET /equipment/sensor-data` — 센서 데이터 조회
- `GET /equipment/condition-rules` — 규칙 목록
- `POST /equipment/condition-rules` — 규칙 생성
- `PUT /equipment/condition-rules/:id` — 규칙 수정
- `DELETE /equipment/condition-rules/:id` — 규칙 삭제

- [ ] **Step 4: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 3: 모듈 등록 + USAGE_BASED WO 생성

**Files:**
- Modify: `apps/backend/src/modules/equipment/equipment.module.ts`
- Modify: `apps/backend/src/modules/equipment/services/pm-plan.service.ts`

- [ ] **Step 1: equipment.module.ts에 새 엔티티/서비스/컨트롤러 등록**

imports TypeOrmModule.forFeature에 추가:
- `SensorDataLog`
- `EquipConditionRule`

controllers에 추가:
- `SensorMonitorController`

providers에 추가:
- `SensorMonitorService`

exports에 추가:
- `SensorMonitorService`

- [ ] **Step 2: pm-plan.service.ts generateWorkOrders() 확장 — USAGE_BASED**

현재 generateWorkOrders()는 TIME_BASED만 처리 (nextDueAt 기준).
USAGE_BASED 계획도 함께 조회하여 `currentUsage >= usageThreshold`이면 WO 생성.

기존 plans 조회 뒤에 추가:

```typescript
// USAGE_BASED 계획: currentUsage >= usageThreshold 도달한 건
const usagePlans = await this.pmPlanRepo
  .createQueryBuilder('p')
  .where('p.useYn = :yn', { yn: 'Y' })
  .andWhere('p.pmType = :type', { type: 'USAGE_BASED' })
  .andWhere('p.usageThreshold IS NOT NULL')
  .andWhere('p.currentUsage >= p.usageThreshold')
  .getMany();

// 합치기
const allPlans = [...plans, ...usagePlans];
```

WO 생성 후 USAGE_BASED 계획은 currentUsage를 0으로 리셋:

```typescript
if (plan.pmType === 'USAGE_BASED') {
  await this.pmPlanRepo.update(
    { planCode: plan.planCode },
    { currentUsage: 0, lastExecutedAt: new Date() },
  );
}
```

- [ ] **Step 3: pm-plan.dto.ts 확장 — USAGE_BASED 필드**

CreatePmPlanDto, UpdatePmPlanDto에 추가:
```typescript
@IsOptional()
@IsString()
usageField?: string;

@IsOptional()
@IsNumber()
usageThreshold?: number;
```

- [ ] **Step 4: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## 실행 순서 및 의존성

```
Task 1 (DDL+엔티티) → Task 2 (서비스+컨트롤러) → Task 3 (모듈 등록+WO확장)
```

순차 의존 (병렬 불가).

## 완료 기준

1. `pnpm build` 에러 0건
2. `POST /equipment/sensor-data` API로 센서 데이터 수신 가능
3. 조건 규칙 CRUD + 임계값 초과 시 ALERT/AUTO_WO/INTERLOCK 자동 실행
4. USAGE_BASED PM Plan의 currentUsage 자동 갱신
5. generateWorkOrders()에서 USAGE_BASED 계획도 WO 생성
