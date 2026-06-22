# 개선요청 등록 기능 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 인증 페이지에서 UI 요소를 클릭 선택하여 개선요청을 DB에 등록하고, 관리 UI와 AI가 목록을 조회·반영할 수 있는 전역 기능을 구현한다.

**Architecture:** 화면 우하단 고정 FAB 버튼 → 클릭 시 오버레이 활성화 → 사용자가 UI 요소 클릭 → html2canvas 스크린샷 + 요소 정보 캡처 → 입력 폼 모달 → DB 저장. 백엔드는 SystemModule에 추가, 프론트엔드는 MainLayout에 단 한 줄 삽입으로 전역 제공.

**Tech Stack:** Next.js 14, NestJS, TypeORM (Oracle), Zustand, Tailwind CSS, html2canvas, react-hot-toast, lucide-react, react-i18next

---

## 파일 목록

### 신규 생성
| 파일 | 역할 |
|------|------|
| `apps/backend/src/migrations/2026-05-21_create_impr_requests.sql` | DB 테이블 생성 |
| `apps/backend/src/entities/impr-request.entity.ts` | TypeORM 엔티티 |
| `apps/backend/src/modules/system/dto/impr-request.dto.ts` | NestJS DTO |
| `apps/backend/src/modules/system/services/impr-request.service.ts` | 비즈니스 로직 |
| `apps/backend/src/modules/system/controllers/impr-request.controller.ts` | API 컨트롤러 |
| `apps/frontend/src/stores/improvementRequestStore.ts` | Zustand 전역 상태 |
| `apps/frontend/src/services/improvementRequestService.ts` | axios API 클라이언트 |
| `apps/frontend/src/components/improvement/ImprovementOverlay.tsx` | 전체화면 선택 오버레이 |
| `apps/frontend/src/components/improvement/ImprovementRequestModal.tsx` | 설명 입력 폼 모달 |
| `apps/frontend/src/components/improvement/ImprovementFAB.tsx` | FAB 버튼 + 조합 루트 |
| `apps/frontend/src/app/(authenticated)/system/improvement-requests/page.tsx` | 관리 UI 목록 페이지 |
| `apps/frontend/src/app/(authenticated)/system/improvement-requests/components/ImprovementDetailModal.tsx` | 상세 + 스크린샷 뷰어 |

### 수정
| 파일 | 변경 내용 |
|------|-----------|
| `apps/backend/src/modules/system/system.module.ts` | ImprRequest 엔티티/서비스/컨트롤러 등록 |
| `apps/frontend/src/components/layout/MainLayout.tsx` | `<ImprovementFAB />` 한 줄 추가 |
| `apps/frontend/src/config/menuConfig.ts` | SYS_IMPR_REQ 메뉴 추가 |
| `apps/frontend/src/locales/ko.json` | improvement 키 추가 |
| `apps/frontend/src/locales/en.json` | improvement 키 추가 |
| `apps/frontend/src/locales/zh.json` | improvement 키 추가 |
| `apps/frontend/src/locales/vi.json` | improvement 키 추가 |

---

## Task 1: DB 마이그레이션 — IMPR_REQUESTS 테이블 생성

**Files:**
- Create: `apps/backend/src/migrations/2026-05-21_create_impr_requests.sql`

- [ ] **Step 1: SQL 파일 작성**

```sql
-- 2026-05-21: 개선요청 등록 테이블 생성

CREATE TABLE IMPR_REQUESTS (
  IMPR_ID        VARCHAR2(36)   NOT NULL,
  PAGE_URL       VARCHAR2(500)  NOT NULL,
  ELEMENT_TEXT   VARCHAR2(1000),
  ELEMENT_TAG    VARCHAR2(100),
  DESCRIPTION    VARCHAR2(2000) NOT NULL,
  SCREENSHOT     CLOB,
  STATUS         VARCHAR2(20)   DEFAULT 'PENDING' NOT NULL,
  REQUESTER_ID   VARCHAR2(100)  NOT NULL,
  REQUESTER_NM   VARCHAR2(200),
  COMPANY        VARCHAR2(10)   NOT NULL,
  PLANT_CD       VARCHAR2(10)   NOT NULL,
  CREATED_AT     TIMESTAMP      DEFAULT SYSDATE NOT NULL,
  UPDATED_AT     TIMESTAMP      DEFAULT SYSDATE NOT NULL,
  CONSTRAINT PK_IMPR_REQUESTS PRIMARY KEY (IMPR_ID)
);

CREATE INDEX IDX_IMPR_REQUESTS_STATUS    ON IMPR_REQUESTS (STATUS);
CREATE INDEX IDX_IMPR_REQUESTS_COMPANY   ON IMPR_REQUESTS (COMPANY, PLANT_CD);
CREATE INDEX IDX_IMPR_REQUESTS_CREATED   ON IMPR_REQUESTS (CREATED_AT DESC);

COMMIT;
```

- [ ] **Step 2: JSHANES 사이트에서 실행**

```bash
# Oracle SQL*Plus 또는 DBeaver에서 JSHANES 접속 후 실행
# 또는 프로젝트 oracle-db 도구로 실행
```

확인:
```sql
SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = 'IMPR_REQUESTS';
-- 결과: IMPR_REQUESTS 1행 반환
```

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/migrations/2026-05-21_create_impr_requests.sql
git commit -m "feat: add IMPR_REQUESTS table migration"
```

---

## Task 2: 백엔드 엔티티

**Files:**
- Create: `apps/backend/src/entities/impr-request.entity.ts`

- [ ] **Step 1: 엔티티 파일 작성**

```typescript
/**
 * @file entities/impr-request.entity.ts
 * @description 개선요청 엔티티 - 사용자가 UI 요소를 선택하여 등록한 개선요청 기록
 *
 * 초보자 가이드:
 * 1. IMPR_ID: UUID 문자열 PK (Oracle 시퀀스 대신 애플리케이션에서 uuid 생성)
 * 2. SCREENSHOT: CLOB 타입으로 base64 이미지 문자열 저장
 * 3. STATUS: PENDING → IN_PROGRESS → DONE 상태 흐름
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'IMPR_REQUESTS' })
@Index(['status'])
@Index(['company', 'plantCd'])
export class ImprRequest {
  @PrimaryColumn({ name: 'IMPR_ID', type: 'varchar2', length: 36 })
  imprId: string;

  @Column({ name: 'PAGE_URL', type: 'varchar2', length: 500 })
  pageUrl: string;

  @Column({ type: 'varchar2', name: 'ELEMENT_TEXT', length: 1000, nullable: true })
  elementText: string | null;

  @Column({ type: 'varchar2', name: 'ELEMENT_TAG', length: 100, nullable: true })
  elementTag: string | null;

  @Column({ name: 'DESCRIPTION', type: 'varchar2', length: 2000 })
  description: string;

  @Column({ name: 'SCREENSHOT', type: 'clob', nullable: true })
  screenshot: string | null;

  /** PENDING | IN_PROGRESS | DONE */
  @Column({ name: 'STATUS', type: 'varchar2', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'REQUESTER_ID', type: 'varchar2', length: 100 })
  requesterId: string;

  @Column({ type: 'varchar2', name: 'REQUESTER_NM', length: 200, nullable: true })
  requesterNm: string | null;

  @Column({ name: 'COMPANY', type: 'varchar2', length: 10 })
  company: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 10 })
  plantCd: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/entities/impr-request.entity.ts
git commit -m "feat: add ImprRequest entity"
```

---

## Task 3: 백엔드 DTO + 서비스 + 컨트롤러 + 모듈 등록

**Files:**
- Create: `apps/backend/src/modules/system/dto/impr-request.dto.ts`
- Create: `apps/backend/src/modules/system/services/impr-request.service.ts`
- Create: `apps/backend/src/modules/system/controllers/impr-request.controller.ts`
- Modify: `apps/backend/src/modules/system/system.module.ts`

- [ ] **Step 1: DTO 작성**

`apps/backend/src/modules/system/dto/impr-request.dto.ts`:
```typescript
/**
 * @file dto/impr-request.dto.ts
 * @description 개선요청 DTO
 */
import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateImprRequestDto {
  @ApiProperty({ description: '요청 발생 페이지 URL' })
  @IsString()
  @MaxLength(500)
  pageUrl: string;

  @ApiPropertyOptional({ description: '클릭한 요소 텍스트' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  elementText?: string;

  @ApiPropertyOptional({ description: '클릭한 요소 HTML 태그' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  elementTag?: string;

  @ApiProperty({ description: '개선 내용 설명' })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ description: 'base64 스크린샷 (JPEG)' })
  @IsOptional()
  @IsString()
  screenshot?: string;
}

export class UpdateImprStatusDto {
  @ApiProperty({ description: '변경할 상태', enum: ['PENDING', 'IN_PROGRESS', 'DONE'] })
  @IsIn(['PENDING', 'IN_PROGRESS', 'DONE'])
  status: string;
}

export class ImprRequestQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'DONE', 'ALL'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}
```

- [ ] **Step 2: 서비스 작성**

`apps/backend/src/modules/system/services/impr-request.service.ts`:
```typescript
/**
 * @file services/impr-request.service.ts
 * @description 개선요청 CRUD 서비스
 *
 * 초보자 가이드:
 * 1. create: UUID를 애플리케이션에서 생성하여 PK로 사용
 * 2. findAll: STATUS 필터 + 페이지네이션
 * 3. findOne: 스크린샷 포함 단건 조회
 * 4. updateStatus: PENDING → IN_PROGRESS → DONE 상태 전이
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImprRequest } from '../../../entities/impr-request.entity';
import {
  CreateImprRequestDto,
  ImprRequestQueryDto,
  UpdateImprStatusDto,
} from '../dto/impr-request.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ImprRequestService {
  constructor(
    @InjectRepository(ImprRequest)
    private readonly repo: Repository<ImprRequest>,
  ) {}

  async create(
    dto: CreateImprRequestDto,
    requesterId: string,
    requesterNm: string | null,
    company: string,
    plantCd: string,
  ): Promise<ImprRequest> {
    const entity = this.repo.create({
      imprId: randomUUID(),
      pageUrl: dto.pageUrl,
      elementText: dto.elementText ?? null,
      elementTag: dto.elementTag ?? null,
      description: dto.description,
      screenshot: dto.screenshot ?? null,
      status: 'PENDING',
      requesterId,
      requesterNm,
      company,
      plantCd,
    });
    return this.repo.save(entity);
  }

  async findAll(query: ImprRequestQueryDto, company: string, plantCd: string) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('r')
      .select([
        'r.imprId', 'r.pageUrl', 'r.elementText', 'r.elementTag',
        'r.description', 'r.status', 'r.requesterId', 'r.requesterNm',
        'r.company', 'r.plantCd', 'r.createdAt', 'r.updatedAt',
        // screenshot 제외 (목록에서는 불필요, 대용량)
      ])
      .where('r.company = :company AND r.plantCd = :plantCd', { company, plantCd });

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    qb.orderBy('r.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(imprId: string, company: string, plantCd: string): Promise<ImprRequest> {
    const item = await this.repo.findOne({
      where: { imprId, company, plantCd },
    });
    if (!item) throw new NotFoundException(`ImprRequest ${imprId} not found`);
    return item;
  }

  async updateStatus(
    imprId: string,
    dto: UpdateImprStatusDto,
    company: string,
    plantCd: string,
  ): Promise<ImprRequest> {
    const item = await this.findOne(imprId, company, plantCd);
    item.status = dto.status;
    return this.repo.save(item);
  }
}
```

- [ ] **Step 3: 컨트롤러 작성**

`apps/backend/src/modules/system/controllers/impr-request.controller.ts`:
```typescript
/**
 * @file controllers/impr-request.controller.ts
 * @description 개선요청 API - POST /system/improvement-requests
 *
 * 초보자 가이드:
 * 1. Authorization 헤더에서 userId 추출 (activity-log.controller와 동일 패턴)
 * 2. x-company, x-plant 헤더에서 멀티테넌시 정보 추출
 * 3. 목록 조회 시 screenshot 컬럼 제외 (대용량, 단건 조회 시에만 포함)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ImprRequestService } from '../services/impr-request.service';
import {
  CreateImprRequestDto,
  UpdateImprStatusDto,
  ImprRequestQueryDto,
} from '../dto/impr-request.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템관리 - 개선요청')
@Controller('system/improvement-requests')
export class ImprRequestController {
  constructor(private readonly service: ImprRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '개선요청 등록' })
  async create(@Body() dto: CreateImprRequestDto, @Req() req: Request) {
    const { userId, userName, company, plantCd } = this.extractMeta(req);
    const item = await this.service.create(dto, userId, userName, company, plantCd);
    return ResponseUtil.success(item);
  }

  @Get()
  @ApiOperation({ summary: '개선요청 목록 조회 (스크린샷 제외)' })
  async findAll(@Query() query: ImprRequestQueryDto, @Req() req: Request) {
    const { company, plantCd } = this.extractMeta(req);
    const result = await this.service.findAll(query, company, plantCd);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '개선요청 단건 조회 (스크린샷 포함)' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const { company, plantCd } = this.extractMeta(req);
    const item = await this.service.findOne(id, company, plantCd);
    return ResponseUtil.success(item);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '개선요청 상태 변경' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateImprStatusDto,
    @Req() req: Request,
  ) {
    const { company, plantCd } = this.extractMeta(req);
    const item = await this.service.updateStatus(id, dto, company, plantCd);
    return ResponseUtil.success(item);
  }

  private extractMeta(req: Request) {
    const auth = req.headers.authorization ?? '';
    const [, token] = auth.split(' ');
    const userId = token || 'unknown';
    const userName = (req.headers['x-user-name'] as string) ?? null;
    const company = (req.headers['x-company'] as string) ?? 'JSHANES';
    const plantCd = (req.headers['x-plant'] as string) ?? 'JSHANES';
    return { userId, userName, company, plantCd };
  }
}
```

- [ ] **Step 4: system.module.ts 에 등록**

`apps/backend/src/modules/system/system.module.ts` 에서 아래 내용을 추가:

imports 배열의 `TypeOrmModule.forFeature([...])` 안에 `ImprRequest` 추가:
```typescript
import { ImprRequest } from '../../entities/impr-request.entity';
import { ImprRequestController } from './controllers/impr-request.controller';
import { ImprRequestService } from './services/impr-request.service';

// TypeOrmModule.forFeature 배열에 추가:
ImprRequest,

// controllers 배열에 추가:
ImprRequestController,

// providers 배열에 추가:
ImprRequestService,

// exports 배열에 추가:
ImprRequestService,
```

- [ ] **Step 5: 백엔드 빌드 확인**

```bash
cd apps/backend && npx tsc --noEmit
```
Expected: 에러 0건

- [ ] **Step 6: API 동작 확인**

```bash
# 서버 실행 중 상태에서 테스트 (토큰은 실제 로그인 후 발급받은 값 사용)
curl -X POST http://localhost:3001/system/improvement-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test@example.com" \
  -H "x-company: JSHANES" \
  -H "x-plant: JSHANES" \
  -d '{"pageUrl":"/dashboard","elementText":"저장","elementTag":"button","description":"버튼 색상을 파란색으로 변경 요청"}'
```
Expected: `{"success":true,"data":{"imprId":"...","status":"PENDING",...}}`

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/src/modules/system/dto/impr-request.dto.ts \
        apps/backend/src/modules/system/services/impr-request.service.ts \
        apps/backend/src/modules/system/controllers/impr-request.controller.ts \
        apps/backend/src/modules/system/system.module.ts
git commit -m "feat: add improvement request backend API"
```

---

## Task 4: 프론트엔드 — Zustand 스토어 + API 서비스

**Files:**
- Create: `apps/frontend/src/stores/improvementRequestStore.ts`
- Create: `apps/frontend/src/services/improvementRequestService.ts`

- [ ] **Step 1: 스토어 작성**

`apps/frontend/src/stores/improvementRequestStore.ts`:
```typescript
/**
 * @file src/stores/improvementRequestStore.ts
 * @description 개선요청 등록 전역 상태 - 선택 모드 ON/OFF, 선택된 요소, 스크린샷
 *
 * 초보자 가이드:
 * 1. isActive: true = 오버레이 선택 모드 활성화
 * 2. selectedElement: 사용자가 클릭한 DOM 요소 정보 (null이면 모달 숨김)
 * 3. screenshot: html2canvas로 캡처한 base64 이미지
 * 4. reset(): 모달 닫기 + 상태 초기화
 */
import { create } from 'zustand';

export interface SelectedElement {
  text: string;
  tagName: string;
}

interface ImprovementRequestState {
  isActive: boolean;
  selectedElement: SelectedElement | null;
  screenshot: string | null;
  activate: () => void;
  deactivate: () => void;
  setSelectedElement: (el: SelectedElement, screenshot: string) => void;
  reset: () => void;
}

export const useImprovementRequestStore = create<ImprovementRequestState>((set) => ({
  isActive: false,
  selectedElement: null,
  screenshot: null,
  activate: () => set({ isActive: true, selectedElement: null, screenshot: null }),
  deactivate: () => set({ isActive: false }),
  setSelectedElement: (el, screenshot) =>
    set({ isActive: false, selectedElement: el, screenshot }),
  reset: () => set({ isActive: false, selectedElement: null, screenshot: null }),
}));
```

- [ ] **Step 2: API 서비스 작성**

`apps/frontend/src/services/improvementRequestService.ts`:
```typescript
/**
 * @file src/services/improvementRequestService.ts
 * @description 개선요청 API 클라이언트
 *
 * 초보자 가이드:
 * 1. create: POST /system/improvement-requests — 요청 등록
 * 2. list: GET  /system/improvement-requests — 목록 조회 (스크린샷 제외)
 * 3. detail: GET /system/improvement-requests/:id — 단건 조회 (스크린샷 포함)
 * 4. updateStatus: PATCH /system/improvement-requests/:id/status
 */
import { api } from './api';

export interface ImprRequestItem {
  imprId: string;
  pageUrl: string;
  elementText: string | null;
  elementTag: string | null;
  description: string;
  screenshot?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  requesterId: string;
  requesterNm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateImprRequestPayload {
  pageUrl: string;
  elementText?: string;
  elementTag?: string;
  description: string;
  screenshot?: string;
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const improvementRequestService = {
  create: (payload: CreateImprRequestPayload): Promise<ImprRequestItem> =>
    api.post('/system/improvement-requests', payload).then((r) => unwrap<ImprRequestItem>(r as any)),

  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api
      .get<{ data: { data: ImprRequestItem[]; total: number; page: number; limit: number } }>(
        '/system/improvement-requests',
        { params },
      )
      .then((r) => r.data.data),

  detail: (id: string): Promise<ImprRequestItem> =>
    api
      .get(`/system/improvement-requests/${id}`)
      .then((r) => unwrap<ImprRequestItem>(r as any)),

  updateStatus: (id: string, status: string): Promise<ImprRequestItem> =>
    api
      .patch(`/system/improvement-requests/${id}/status`, { status })
      .then((r) => unwrap<ImprRequestItem>(r as any)),
};
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/stores/improvementRequestStore.ts \
        apps/frontend/src/services/improvementRequestService.ts
git commit -m "feat: add improvement request store and service"
```

---

## Task 5: html2canvas 의존성 추가 + ImprovementOverlay 컴포넌트

**Files:**
- Modify: `apps/frontend/package.json` (pnpm add)
- Create: `apps/frontend/src/components/improvement/ImprovementOverlay.tsx`

- [ ] **Step 1: html2canvas 설치**

```bash
cd apps/frontend && pnpm add html2canvas
```

- [ ] **Step 2: ImprovementOverlay 작성**

`apps/frontend/src/components/improvement/ImprovementOverlay.tsx`:
```typescript
"use client";

/**
 * @file src/components/improvement/ImprovementOverlay.tsx
 * @description 개선요청 선택 모드 오버레이 — 커서 아래 요소를 하이라이트하고 클릭 시 캡처
 *
 * 초보자 가이드:
 * 1. 전체화면 반투명 div가 마우스 이벤트를 캡처한다
 * 2. mousemove: 오버레이 pointer-events를 잠시 none으로 바꿔 실제 요소를 탐지
 * 3. click: 동일 방식으로 요소 탐지 → 스크린샷 촬영 → setSelectedElement 호출
 * 4. 스크린샷 촬영 중에는 오버레이를 visibility:hidden으로 숨겨 화면에 포함되지 않게 함
 */
import { useEffect, useRef } from "react";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";

const SKIP_TAGS = ['HTML', 'BODY', 'SCRIPT', 'STYLE', 'HEAD'];

export default function ImprovementOverlay() {
  const { setSelectedElement, deactivate } = useImprovementRequestStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  const clearHighlight = () => {
    if (highlightedElRef.current) {
      highlightedElRef.current.style.outline = '';
      highlightedElRef.current.style.outlineOffset = '';
      highlightedElRef.current = null;
    }
  };

  const getTargetElement = (x: number, y: number): HTMLElement | null => {
    if (!overlayRef.current) return null;
    overlayRef.current.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    overlayRef.current.style.pointerEvents = 'auto';
    if (!el) return null;
    if (SKIP_TAGS.includes(el.tagName)) return null;
    return el;
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = getTargetElement(e.clientX, e.clientY);
      if (target === highlightedElRef.current) return;

      clearHighlight();

      if (target) {
        highlightedElRef.current = target;
        target.style.outline = '2px solid #f97316';
        target.style.outlineOffset = '2px';
      }
    };

    const handleClick = async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = getTargetElement(e.clientX, e.clientY);
      clearHighlight();

      // 스크린샷 촬영을 위해 오버레이 숨김
      overlay.style.visibility = 'hidden';

      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(document.body, {
          scale: 0.5,
          useCORS: true,
          logging: false,
        });
        const screenshot = canvas.toDataURL('image/jpeg', 0.7);

        setSelectedElement(
          {
            text: target?.textContent?.trim().slice(0, 500) ?? '',
            tagName: target?.tagName.toLowerCase() ?? 'unknown',
          },
          screenshot,
        );
      } catch {
        overlay.style.visibility = 'visible';
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHighlight();
        deactivate();
      }
    };

    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearHighlight();
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setSelectedElement, deactivate]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 bg-black/20 cursor-crosshair"
      style={{ pointerEvents: 'auto' }}
    />
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/components/improvement/ImprovementOverlay.tsx
git commit -m "feat: add ImprovementOverlay component with element selection"
```

---

## Task 6: ImprovementRequestModal 컴포넌트

**Files:**
- Create: `apps/frontend/src/components/improvement/ImprovementRequestModal.tsx`

- [ ] **Step 1: 모달 작성**

`apps/frontend/src/components/improvement/ImprovementRequestModal.tsx`:
```typescript
"use client";

/**
 * @file src/components/improvement/ImprovementRequestModal.tsx
 * @description 개선요청 입력 폼 모달 — 선택된 요소 정보 + 스크린샷 + 설명 입력
 *
 * 초보자 가이드:
 * 1. selectedElement가 null이 아니면 자동으로 열림
 * 2. 페이지 URL, 요소 정보, 스크린샷은 읽기전용으로 표시
 * 3. 저장 성공 시 reset()으로 상태 초기화 (모달 자동 닫힘)
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePathname } from "next/navigation";
import { X, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";
import { improvementRequestService } from "@/services/improvementRequestService";

export default function ImprovementRequestModal() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { selectedElement, screenshot, reset } = useImprovementRequestStore();
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setDescription("");
    reset();
  }, [reset]);

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return;
    setIsSubmitting(true);
    try {
      await improvementRequestService.create({
        pageUrl: pathname,
        elementText: selectedElement?.text ?? undefined,
        elementTag: selectedElement?.tagName ?? undefined,
        description: description.trim(),
        screenshot: screenshot ?? undefined,
      });
      toast.success(t("improvement.submitSuccess"));
      handleClose();
    } catch {
      toast.error(t("improvement.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  }, [description, pathname, selectedElement, screenshot, t, handleClose]);

  if (!selectedElement) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* 모달 */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface">
          <Wrench className="w-5 h-5 text-orange-500" />
          <h3 className="flex-1 text-sm font-bold text-text">
            {t("improvement.modalTitle")}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 페이지 URL */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">
              {t("improvement.pageUrl")}
            </p>
            <p className="text-sm text-text font-mono bg-surface rounded px-2 py-1.5 break-all">
              {pathname}
            </p>
          </div>

          {/* 선택 요소 */}
          {selectedElement.text && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">
                {t("improvement.selectedElement")}
              </p>
              <p className="text-sm text-text bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded px-2 py-1.5">
                <span className="text-xs text-orange-600 dark:text-orange-400 mr-2">
                  &lt;{selectedElement.tagName}&gt;
                </span>
                {selectedElement.text}
              </p>
            </div>
          )}

          {/* 스크린샷 */}
          {screenshot && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">
                {t("improvement.screenshot")}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="screenshot"
                className="w-full rounded border border-border"
              />
            </div>
          )}

          {/* 설명 입력 */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">
              {t("improvement.description")}
              <span className="text-red-500 ml-0.5">*</span>
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("improvement.descriptionPlaceholder")}
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <p className="text-xs text-text-muted text-right mt-0.5">
              {description.length} / 2000
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-surface/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-border text-text-muted hover:bg-surface transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || isSubmitting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("common.saving") : t("improvement.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/components/improvement/ImprovementRequestModal.tsx
git commit -m "feat: add ImprovementRequestModal component"
```

---

## Task 7: ImprovementFAB + MainLayout 통합

**Files:**
- Create: `apps/frontend/src/components/improvement/ImprovementFAB.tsx`
- Modify: `apps/frontend/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: ImprovementFAB 작성**

`apps/frontend/src/components/improvement/ImprovementFAB.tsx`:
```typescript
"use client";

/**
 * @file src/components/improvement/ImprovementFAB.tsx
 * @description 개선요청 FAB 버튼 — 오버레이·모달 조합 루트
 *
 * 초보자 가이드:
 * 1. 항상 화면 우하단에 떠 있는 버튼 (fixed bottom-6 right-6)
 * 2. 비활성 상태: 🔧 아이콘 + 파란 배경
 * 3. 활성 상태: ✕ 아이콘 + 주황 배경 + 상단 안내 배너
 * 4. selectedElement가 생기면 ImprovementRequestModal 자동 표시
 */
import { useTranslation } from "react-i18next";
import { Wrench, X } from "lucide-react";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";
import ImprovementOverlay from "./ImprovementOverlay";
import ImprovementRequestModal from "./ImprovementRequestModal";

export default function ImprovementFAB() {
  const { t } = useTranslation();
  const { isActive, selectedElement, activate, deactivate } =
    useImprovementRequestStore();

  return (
    <>
      {/* 선택 모드 안내 배너 */}
      {isActive && (
        <div className="fixed top-[var(--header-height)] left-0 right-0 z-[50] flex items-center justify-center py-2 bg-orange-500 text-white text-sm font-medium shadow-md">
          <span>{t("improvement.selectHint")}</span>
          <span className="ml-3 text-xs opacity-80">{t("improvement.exitHint")}</span>
        </div>
      )}

      {/* 오버레이 (선택 모드 활성 + 모달 미열림 상태에서만) */}
      {isActive && !selectedElement && <ImprovementOverlay />}

      {/* 입력 모달 */}
      <ImprovementRequestModal />

      {/* FAB 버튼 */}
      <button
        onClick={() => (isActive ? deactivate() : activate())}
        title={isActive ? t("improvement.exitHint") : t("improvement.fabTooltip")}
        className={`
          fixed bottom-6 right-6 z-[50] w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${isActive
            ? "bg-orange-500 hover:bg-orange-600 scale-110"
            : "bg-blue-600 hover:bg-blue-700"
          }
          text-white
        `}
      >
        {isActive ? (
          <X className="w-5 h-5" />
        ) : (
          <Wrench className="w-5 h-5" />
        )}
      </button>
    </>
  );
}
```

- [ ] **Step 2: MainLayout.tsx 수정**

`apps/frontend/src/components/layout/MainLayout.tsx` 에서:

```typescript
// 파일 상단 import에 추가:
import ImprovementFAB from "@/components/improvement/ImprovementFAB";
```

`</div>` 닫는 태그 (line 104, `return` 블록의 최상위 div 닫기) 바로 앞에 추가:
```tsx
      <ImprovementFAB />
    </div>
```

전체 return 블록의 마지막이 아래처럼 되어야 함:
```tsx
    <div className="h-screen overflow-hidden bg-background">
      {showConnectionCheck && <ConnectionCheckOverlay onReady={handleReady} />}

      {isKioskWorkView ? (
        <main className="h-screen overflow-hidden bg-background">
          {children}
        </main>
      ) : (
        <>
          <Header ... />
          <Sidebar ... />
          <main ...>
            <TabBar />
            <div className="flex-1 min-h-0 overflow-hidden">
              <KeepAlive>{children}</KeepAlive>
            </div>
          </main>
        </>
      )}

      <ImprovementFAB />
    </div>
```

- [ ] **Step 3: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```
Expected: 에러 0건

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/components/improvement/ImprovementFAB.tsx \
        apps/frontend/src/components/layout/MainLayout.tsx
git commit -m "feat: add ImprovementFAB and integrate into MainLayout"
```

---

## Task 8: i18n — 4개 언어 파일 동시 수정

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: ko.json 에 improvement 키 추가**

최상위 레벨 마지막 항목 바로 앞 (닫는 `}` 전)에 추가:
```json
"improvement": {
  "fabTooltip": "개선요청 등록",
  "modeActive": "개선요청 모드",
  "selectHint": "변경하고 싶은 요소를 클릭하세요",
  "exitHint": "ESC 또는 버튼을 눌러 종료",
  "modalTitle": "개선요청 등록",
  "pageUrl": "페이지",
  "selectedElement": "선택한 요소",
  "screenshot": "스크린샷",
  "description": "개선 내용",
  "descriptionPlaceholder": "어떻게 바꾸고 싶으신지 설명해 주세요",
  "submit": "요청 등록",
  "submitSuccess": "개선요청이 등록되었습니다",
  "submitError": "등록 중 오류가 발생했습니다",
  "managePage": "개선요청 관리",
  "statusPending": "대기",
  "statusInProgress": "처리중",
  "statusDone": "완료",
  "noScreenshot": "스크린샷 없음"
}
```

- [ ] **Step 2: en.json 에 improvement 키 추가**

```json
"improvement": {
  "fabTooltip": "Submit Improvement Request",
  "modeActive": "Improvement Request Mode",
  "selectHint": "Click the element you want to change",
  "exitHint": "Press ESC or button to exit",
  "modalTitle": "Submit Improvement Request",
  "pageUrl": "Page",
  "selectedElement": "Selected Element",
  "screenshot": "Screenshot",
  "description": "Improvement Description",
  "descriptionPlaceholder": "Describe what you would like to change",
  "submit": "Submit Request",
  "submitSuccess": "Improvement request submitted",
  "submitError": "Failed to submit request",
  "managePage": "Improvement Requests",
  "statusPending": "Pending",
  "statusInProgress": "In Progress",
  "statusDone": "Done",
  "noScreenshot": "No Screenshot"
}
```

- [ ] **Step 3: zh.json 에 improvement 키 추가**

```json
"improvement": {
  "fabTooltip": "提交改善申请",
  "modeActive": "改善申请模式",
  "selectHint": "点击您想要更改的元素",
  "exitHint": "按ESC或按钮退出",
  "modalTitle": "提交改善申请",
  "pageUrl": "页面",
  "selectedElement": "选中的元素",
  "screenshot": "截图",
  "description": "改善内容",
  "descriptionPlaceholder": "请描述您想要的更改内容",
  "submit": "提交申请",
  "submitSuccess": "改善申请已提交",
  "submitError": "提交失败",
  "managePage": "改善申请管理",
  "statusPending": "待处理",
  "statusInProgress": "处理中",
  "statusDone": "已完成",
  "noScreenshot": "无截图"
}
```

- [ ] **Step 4: vi.json 에 improvement 키 추가**

```json
"improvement": {
  "fabTooltip": "Gửi yêu cầu cải tiến",
  "modeActive": "Chế độ yêu cầu cải tiến",
  "selectHint": "Nhấp vào phần tử bạn muốn thay đổi",
  "exitHint": "Nhấn ESC hoặc nút để thoát",
  "modalTitle": "Gửi yêu cầu cải tiến",
  "pageUrl": "Trang",
  "selectedElement": "Phần tử đã chọn",
  "screenshot": "Ảnh chụp màn hình",
  "description": "Nội dung cải tiến",
  "descriptionPlaceholder": "Mô tả những gì bạn muốn thay đổi",
  "submit": "Gửi yêu cầu",
  "submitSuccess": "Yêu cầu cải tiến đã được gửi",
  "submitError": "Gửi yêu cầu thất bại",
  "managePage": "Quản lý yêu cầu cải tiến",
  "statusPending": "Chờ xử lý",
  "statusInProgress": "Đang xử lý",
  "statusDone": "Hoàn thành",
  "noScreenshot": "Không có ảnh chụp"
}
```

- [ ] **Step 5: i18n 키 존재 확인**

```bash
grep -l '"improvement"' apps/frontend/src/locales/*.json
```
Expected: ko.json, en.json, zh.json, vi.json 4개 모두 출력

- [ ] **Step 6: BOM 없는 UTF-8 확인 (CRITICAL)**

```bash
# 파일 BOM 확인 — 출력이 없어야 정상
file apps/frontend/src/locales/ko.json | grep BOM
file apps/frontend/src/locales/en.json | grep BOM
file apps/frontend/src/locales/zh.json | grep BOM
file apps/frontend/src/locales/vi.json | grep BOM
```

- [ ] **Step 7: 커밋**

```bash
git add apps/frontend/src/locales/ko.json \
        apps/frontend/src/locales/en.json \
        apps/frontend/src/locales/zh.json \
        apps/frontend/src/locales/vi.json
git commit -m "feat: add improvement request i18n keys (ko/en/zh/vi)"
```

---

## Task 9: 관리 UI — 목록 페이지 + 상세 모달

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/improvement-requests/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/system/improvement-requests/components/ImprovementDetailModal.tsx`

- [ ] **Step 1: ImprovementDetailModal 작성**

`apps/frontend/src/app/(authenticated)/system/improvement-requests/components/ImprovementDetailModal.tsx`:
```typescript
"use client";

/**
 * @file components/ImprovementDetailModal.tsx
 * @description 개선요청 상세 모달 — 스크린샷 전체 표시 + 상태 변경
 *
 * 초보자 가이드:
 * 1. imprId로 단건 API 호출하여 스크린샷 포함 전체 데이터 로드
 * 2. 상태 변경 버튼으로 PENDING → IN_PROGRESS → DONE 전이
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import {
  improvementRequestService,
  ImprRequestItem,
} from "@/services/improvementRequestService";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "statusPending",
  IN_PROGRESS: "statusInProgress",
  DONE: "statusDone",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: null,
};

interface Props {
  imprId: string;
  onClose: () => void;
  onStatusChanged: () => void;
}

export default function ImprovementDetailModal({ imprId, onClose, onStatusChanged }: Props) {
  const { t } = useTranslation();
  const [item, setItem] = useState<ImprRequestItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    improvementRequestService.detail(imprId).then(setItem).catch(() => {
      toast.error("상세 조회 실패");
      onClose();
    });
  }, [imprId, onClose]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!item) return;
    setIsUpdating(true);
    try {
      const updated = await improvementRequestService.updateStatus(imprId, newStatus);
      setItem(updated);
      onStatusChanged();
      toast.success("상태가 변경되었습니다");
    } catch {
      toast.error("상태 변경 실패");
    } finally {
      setIsUpdating(false);
    }
  }, [item, imprId, onStatusChanged]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface flex-shrink-0">
          <h3 className="flex-1 text-sm font-bold text-text">
            {t("improvement.managePage")} — 상세
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!item ? (
            <p className="text-sm text-text-muted text-center py-8">로딩 중...</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded ${STATUS_COLORS[item.status] ?? ''}`}>
                  {t(`improvement.${STATUS_LABELS[item.status]}`)}
                </span>
                <span className="text-xs text-text-muted">
                  {item.requesterNm ?? item.requesterId} · {new Date(item.createdAt).toLocaleString('ko-KR')}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.pageUrl")}</p>
                <p className="text-sm font-mono text-text bg-surface rounded px-2 py-1.5 break-all">{item.pageUrl}</p>
              </div>

              {item.elementText && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.selectedElement")}</p>
                  <p className="text-sm text-text bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded px-2 py-1.5">
                    <span className="text-xs text-orange-600 dark:text-orange-400 mr-2">&lt;{item.elementTag}&gt;</span>
                    {item.elementText}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.description")}</p>
                <p className="text-sm text-text bg-surface rounded px-3 py-2 whitespace-pre-wrap">{item.description}</p>
              </div>

              {item.screenshot ? (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.screenshot")}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.screenshot} alt="screenshot" className="w-full rounded border border-border" />
                </div>
              ) : (
                <p className="text-xs text-text-muted">{t("improvement.noScreenshot")}</p>
              )}
            </>
          )}
        </div>

        {/* 푸터 — 상태 변경 */}
        {item && NEXT_STATUS[item.status] && (
          <div className="flex justify-end px-5 py-3 border-t border-border bg-surface/50 flex-shrink-0">
            <button
              onClick={() => handleStatusChange(NEXT_STATUS[item.status]!)}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {item.status === 'PENDING' ? '처리 시작' : '완료 처리'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 목록 페이지 작성**

`apps/frontend/src/app/(authenticated)/system/improvement-requests/page.tsx`:
```typescript
"use client";

/**
 * @file system/improvement-requests/page.tsx
 * @description 개선요청 관리 페이지 — 목록 조회 + 상태 필터 + 상세 모달
 *
 * 초보자 가이드:
 * 1. 상태 탭(ALL/PENDING/IN_PROGRESS/DONE)으로 필터링
 * 2. 행 클릭 시 ImprovementDetailModal 오픈
 * 3. 상태 변경 후 목록 자동 새로고침
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  improvementRequestService,
  ImprRequestItem,
} from "@/services/improvementRequestService";
import ImprovementDetailModal from "./components/ImprovementDetailModal";

const STATUS_TABS = ['ALL', 'PENDING', 'IN_PROGRESS', 'DONE'] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

export default function ImprovementRequestsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [items, setItems] = useState<ImprRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await improvementRequestService.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 50,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold text-text">{t("improvement.managePage")}</h1>

      {/* 상태 탭 */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === s
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {s === 'ALL' ? '전체' : t(`improvement.status${s.charAt(0) + s.slice(1).toLowerCase().replace('_progress', 'InProgress').replace('_', '')}`)}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted self-center pr-2">
          {total}건
        </span>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <p className="text-sm text-text-muted py-8 text-center">로딩 중...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">등록된 개선요청이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.imprId}
              onClick={() => setSelectedId(item.imprId)}
              className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover cursor-pointer transition-colors"
            >
              <span className={`mt-0.5 px-2 py-0.5 text-xs font-semibold rounded flex-shrink-0 ${STATUS_COLORS[item.status] ?? ''}`}>
                {t(`improvement.${item.status === 'PENDING' ? 'statusPending' : item.status === 'IN_PROGRESS' ? 'statusInProgress' : 'statusDone'}`)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{item.description}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {item.pageUrl} · {item.requesterNm ?? item.requesterId} · {new Date(item.createdAt).toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selectedId && (
        <ImprovementDetailModal
          imprId={selectedId}
          onClose={() => setSelectedId(null)}
          onStatusChanged={load}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/system/improvement-requests/
git commit -m "feat: add improvement requests management UI"
```

---

## Task 10: 메뉴 등록 + 최종 빌드 검증

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`

- [ ] **Step 1: menuConfig.ts 에 SYS_IMPR_REQ 추가**

`apps/frontend/src/config/menuConfig.ts` 의 SYSTEM 섹션 (`SYS_SCREEN_REQ` 다음)에 추가:

```typescript
// 기존 마지막 항목:
{ code: "SYS_SCREEN_REQ", labelKey: "menu.system.screenRequirements", path: "/system/screen-requirements" },
// 새로 추가:
{ code: "SYS_IMPR_REQ", labelKey: "menu.system.improvementRequests", path: "/system/improvement-requests" },
```

- [ ] **Step 2: ko.json 에 menu.system.improvementRequests 키 추가**

`apps/frontend/src/locales/ko.json` 의 `"menu"` > `"system"` 섹션에 추가:
```json
"improvementRequests": "개선요청 관리"
```

- [ ] **Step 3: en.json, zh.json, vi.json 에도 추가**

en.json: `"improvementRequests": "Improvement Requests"`
zh.json: `"improvementRequests": "改善申请管理"`
vi.json: `"improvementRequests": "Quản lý yêu cầu cải tiến"`

- [ ] **Step 4: 4개 locale 파일 키 확인**

```bash
grep -n "improvementRequests" apps/frontend/src/locales/ko.json \
                              apps/frontend/src/locales/en.json \
                              apps/frontend/src/locales/zh.json \
                              apps/frontend/src/locales/vi.json
```
Expected: 4개 파일에서 각 1줄씩 출력

- [ ] **Step 5: 전체 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```
Expected: 에러 0건, 경고만 있어도 됨

- [ ] **Step 6: 최종 커밋**

```bash
git add apps/frontend/src/config/menuConfig.ts \
        apps/frontend/src/locales/ko.json \
        apps/frontend/src/locales/en.json \
        apps/frontend/src/locales/zh.json \
        apps/frontend/src/locales/vi.json
git commit -m "feat: register improvement-requests menu and i18n key"
```

---

## 검증 체크리스트

- [ ] IMPR_REQUESTS 테이블이 DB에 생성됨 (`SELECT * FROM USER_TABLES WHERE TABLE_NAME='IMPR_REQUESTS'`)
- [ ] `POST /system/improvement-requests` curl 테스트 성공
- [ ] `GET /system/improvement-requests` curl 테스트 성공
- [ ] 모든 인증 페이지 우하단에 🔧 FAB 버튼 표시
- [ ] FAB 클릭 → 오버레이 활성화 + 상단 배너 표시
- [ ] 마우스 이동 시 요소 주황색 하이라이트
- [ ] 요소 클릭 → 스크린샷 캡처 → 모달 오픈
- [ ] 설명 입력 후 저장 → DB에 레코드 생성 확인
- [ ] ESC 키로 선택 모드 종료
- [ ] `/system/improvement-requests` 페이지에서 목록 조회
- [ ] 목록 행 클릭 → 상세 모달 오픈 + 스크린샷 표시
- [ ] 상태 변경 버튼 동작
- [ ] `pnpm build` 에러 0건
