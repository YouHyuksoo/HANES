# 좌측 메뉴 카테고리/순서 관리 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바 메뉴의 카테고리/순서/소속을 관리자가 화면에서 관리할 수 있게 한다. 메뉴(leaf) 정의는 `menuConfig.ts`에 유지하고, 카테고리와 배치만 DB로 관리한다.

**Architecture:** 신규 테이블 2개(`MENU_CATEGORIES`, `MENU_CATEGORY_ITEMS`) + NestJS `menu-categories` 모듈 + 프론트 zustand `useMenuTreeStore` + 관리 화면 `/system/menu-categories`(드래그앤드롭 트리 + FormPanel). 사이드바는 머지된 트리 사용, 로딩 fallback은 코드 `menuConfig`.

**Tech Stack:** Oracle DB, NestJS, TypeORM, Next.js (App Router), React, zustand, TailwindCSS, react-i18next, `@dnd-kit/core` + `@dnd-kit/sortable` (신규 의존성).

**관련 스펙:** `docs/specs/2026-05-18-menu-category-management-design.md`

---

## 파일 구조

### 신규 파일 (생성)

- `scripts/2026-05-18_create_menu_categories.sql` — DDL
- `scripts/2026-05-18_create_menu_categories_rollback.sql` — 롤백 DDL
- `scripts/gen-menu-category-seed.js` — `menuConfig.ts` 파싱 → 시드 SQL 생성
- `scripts/2026-05-18_seed_menu_categories.sql` — 위 스크립트 결과물(생성됨, 커밋)
- `apps/backend/src/entities/menu-category.entity.ts`
- `apps/backend/src/entities/menu-category-item.entity.ts`
- `apps/backend/src/modules/menu-categories/menu-categories.module.ts`
- `apps/backend/src/modules/menu-categories/services/menu-categories.service.ts`
- `apps/backend/src/modules/menu-categories/services/menu-categories.service.spec.ts`
- `apps/backend/src/modules/menu-categories/services/menu-category-items.service.ts`
- `apps/backend/src/modules/menu-categories/services/menu-category-items.service.spec.ts`
- `apps/backend/src/modules/menu-categories/controllers/menu-categories.controller.ts`
- `apps/backend/src/modules/menu-categories/controllers/menu-category-items.controller.ts`
- `apps/backend/src/modules/menu-categories/dto/menu-category.dto.ts`
- `apps/backend/src/modules/menu-categories/dto/menu-category-item.dto.ts`
- `apps/frontend/src/lib/api/menuCategories.ts`
- `apps/frontend/src/stores/menuTreeStore.ts`
- `apps/frontend/src/app/(authenticated)/system/menu-categories/page.tsx`
- `apps/frontend/src/app/(authenticated)/system/menu-categories/components/MenuTreePanel.tsx`
- `apps/frontend/src/app/(authenticated)/system/menu-categories/components/CategoryFormPanel.tsx`
- `apps/frontend/src/app/(authenticated)/system/menu-categories/components/MenuItemPanel.tsx`
- `apps/frontend/src/app/(authenticated)/system/menu-categories/components/UnassignedTray.tsx`
- `docs/standards/menu-add-workflow.md` — 신규 페이지 추가 워크플로우 문서

### 수정 파일

- `apps/backend/src/app.module.ts` — `MenuCategoriesModule` import
- `apps/frontend/src/config/menuConfig.ts` — `SYS_MENU_CATEGORY` leaf 추가
- `apps/frontend/src/locales/ko.json` / `en.json` / `zh.json` / `vi.json` — 라벨 키 추가
- `apps/frontend/src/components/layout/Sidebar.tsx` — 머지된 트리 사용
- `apps/backend/src/seeds/menu-config.json` — `SYS_MENU_CATEGORY`를 SYSTEM children에 추가

---

## Task 1: DDL 마이그레이션 SQL 작성 및 실행

**Files:**
- Create: `scripts/2026-05-18_create_menu_categories.sql`
- Create: `scripts/2026-05-18_create_menu_categories_rollback.sql`

- [ ] **Step 1-1: 마이그레이션 SQL 작성**

`scripts/2026-05-18_create_menu_categories.sql`:

```sql
-- ============================================================================
-- 2026-05-18 좌측 메뉴 카테고리/순서 관리 — 신규 테이블 2개 생성
-- 사이트: JSHANES
-- ============================================================================

-- 1) MENU_CATEGORIES : 카테고리 정의
CREATE TABLE MENU_CATEGORIES (
  CATEGORY_CODE   VARCHAR2(50)   NOT NULL,
  LABEL_KEY       VARCHAR2(200)  NOT NULL,
  ICON_NAME       VARCHAR2(50)   NULL,
  SORT_ORDER      NUMBER(10)     DEFAULT 0    NOT NULL,
  IS_ACTIVE       CHAR(1)        DEFAULT 'Y'  NOT NULL,
  COMPANY         VARCHAR2(20)   NOT NULL,
  PLANT_CD        VARCHAR2(20)   NOT NULL,
  CREATED_AT      TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CREATED_BY      VARCHAR2(50)   NOT NULL,
  UPDATED_AT      TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_BY      VARCHAR2(50)   NOT NULL,
  CONSTRAINT PK_MENU_CATEGORIES PRIMARY KEY (CATEGORY_CODE),
  CONSTRAINT CK_MENU_CATEGORIES_IS_ACTIVE CHECK (IS_ACTIVE IN ('Y','N'))
);

CREATE INDEX IDX_MENU_CATEGORIES_SCOPE
  ON MENU_CATEGORIES (COMPANY, PLANT_CD, SORT_ORDER);

COMMENT ON TABLE  MENU_CATEGORIES IS '사이드바 카테고리(상위 메뉴) 정의';
COMMENT ON COLUMN MENU_CATEGORIES.CATEGORY_CODE IS '카테고리 코드 (영문 대문자/언더스코어, 예약어 __ROOT__ 포함)';
COMMENT ON COLUMN MENU_CATEGORIES.LABEL_KEY     IS 'i18n 키 (예: menu.master)';
COMMENT ON COLUMN MENU_CATEGORIES.ICON_NAME     IS 'lucide-react 아이콘 이름. NULL이면 기본 폴더 아이콘';
COMMENT ON COLUMN MENU_CATEGORIES.SORT_ORDER    IS '사이드바 최상위 표시 순서(10단위 권장)';
COMMENT ON COLUMN MENU_CATEGORIES.IS_ACTIVE     IS 'Y/N — N이면 사이드바에서 숨김';
COMMENT ON COLUMN MENU_CATEGORIES.COMPANY       IS '멀티테넌시 — 회사';
COMMENT ON COLUMN MENU_CATEGORIES.PLANT_CD      IS '멀티테넌시 — 사업장';

-- 2) MENU_CATEGORY_ITEMS : 메뉴 ↔ 카테고리 배치
CREATE TABLE MENU_CATEGORY_ITEMS (
  MENU_CODE       VARCHAR2(100)  NOT NULL,
  CATEGORY_CODE   VARCHAR2(50)   NOT NULL,
  SORT_ORDER      NUMBER(10)     DEFAULT 0  NOT NULL,
  COMPANY         VARCHAR2(20)   NOT NULL,
  PLANT_CD        VARCHAR2(20)   NOT NULL,
  CREATED_AT      TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CREATED_BY      VARCHAR2(50)   NOT NULL,
  UPDATED_AT      TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_BY      VARCHAR2(50)   NOT NULL,
  CONSTRAINT PK_MENU_CATEGORY_ITEMS PRIMARY KEY (MENU_CODE),
  CONSTRAINT FK_MCI_CATEGORY FOREIGN KEY (CATEGORY_CODE)
    REFERENCES MENU_CATEGORIES (CATEGORY_CODE) ON DELETE RESTRICT
);

CREATE INDEX IDX_MCI_CATEGORY
  ON MENU_CATEGORY_ITEMS (CATEGORY_CODE, SORT_ORDER);

COMMENT ON TABLE  MENU_CATEGORY_ITEMS IS '메뉴(leaf) ↔ 카테고리 배치';
COMMENT ON COLUMN MENU_CATEGORY_ITEMS.MENU_CODE     IS 'menuConfig.ts의 leaf 메뉴 코드';
COMMENT ON COLUMN MENU_CATEGORY_ITEMS.CATEGORY_CODE IS '소속 카테고리 (FK)';
COMMENT ON COLUMN MENU_CATEGORY_ITEMS.SORT_ORDER    IS '카테고리 내 표시 순서(10단위 권장)';
```

- [ ] **Step 1-2: 롤백 SQL 작성**

`scripts/2026-05-18_create_menu_categories_rollback.sql`:

```sql
-- ============================================================================
-- 2026-05-18 좌측 메뉴 카테고리/순서 관리 — 롤백
-- ============================================================================
DROP TABLE MENU_CATEGORY_ITEMS;
DROP TABLE MENU_CATEGORIES;
```

- [ ] **Step 1-3: JSHANES에 DDL 적용**

`oracle-db` 스킬 또는 검증된 SQL 경로로 적용. CLI 예시:

```
사이트: JSHANES
파일: scripts/2026-05-18_create_menu_categories.sql 적용
```

- [ ] **Step 1-4: 테이블/제약/인덱스 생성 확인**

`USER_TABLES`, `USER_CONSTRAINTS`, `USER_INDEXES`에서 다음 항목 확인:

```sql
SELECT TABLE_NAME FROM USER_TABLES
 WHERE TABLE_NAME IN ('MENU_CATEGORIES','MENU_CATEGORY_ITEMS');
-- 기대: 2건

SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM USER_CONSTRAINTS
 WHERE TABLE_NAME IN ('MENU_CATEGORIES','MENU_CATEGORY_ITEMS')
 ORDER BY TABLE_NAME, CONSTRAINT_TYPE;
-- 기대: PK 2건, CK 1건, FK 1건

SELECT INDEX_NAME FROM USER_INDEXES
 WHERE TABLE_NAME IN ('MENU_CATEGORIES','MENU_CATEGORY_ITEMS')
 ORDER BY INDEX_NAME;
-- 기대: IDX_MCI_CATEGORY, IDX_MENU_CATEGORIES_SCOPE 포함
```

- [ ] **Step 1-5: 커밋**

```bash
git add scripts/2026-05-18_create_menu_categories.sql scripts/2026-05-18_create_menu_categories_rollback.sql
git commit -m "feat(menu-category): MENU_CATEGORIES/MENU_CATEGORY_ITEMS DDL 추가"
```

---

## Task 2: TypeORM 엔티티 2개

**Files:**
- Create: `apps/backend/src/entities/menu-category.entity.ts`
- Create: `apps/backend/src/entities/menu-category-item.entity.ts`

- [ ] **Step 2-1: MenuCategory 엔티티 작성**

`apps/backend/src/entities/menu-category.entity.ts`:

```ts
/**
 * @file src/entities/menu-category.entity.ts
 * @description 사이드바 카테고리(상위 메뉴) 정의 엔티티
 */
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'MENU_CATEGORIES' })
export class MenuCategory {
  @PrimaryColumn({ name: 'CATEGORY_CODE', type: 'varchar2', length: 50 })
  categoryCode!: string;

  @Column({ name: 'LABEL_KEY', type: 'varchar2', length: 200 })
  labelKey!: string;

  @Column({ name: 'ICON_NAME', type: 'varchar2', length: 50, nullable: true })
  iconName?: string | null;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder!: number;

  @Column({ name: 'IS_ACTIVE', type: 'char', length: 1, default: 'Y' })
  isActive!: 'Y' | 'N';

  @Column({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @Column({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 })
  createdBy!: string;

  @Column({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt!: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50 })
  updatedBy!: string;
}
```

- [ ] **Step 2-2: MenuCategoryItem 엔티티 작성**

`apps/backend/src/entities/menu-category-item.entity.ts`:

```ts
/**
 * @file src/entities/menu-category-item.entity.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 엔티티
 */
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { MenuCategory } from './menu-category.entity';

@Entity({ name: 'MENU_CATEGORY_ITEMS' })
export class MenuCategoryItem {
  @PrimaryColumn({ name: 'MENU_CODE', type: 'varchar2', length: 100 })
  menuCode!: string;

  @Column({ name: 'CATEGORY_CODE', type: 'varchar2', length: 50 })
  categoryCode!: string;

  @ManyToOne(() => MenuCategory)
  @JoinColumn({ name: 'CATEGORY_CODE', referencedColumnName: 'categoryCode' })
  category?: MenuCategory;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder!: number;

  @Column({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company!: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd!: string;

  @Column({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 })
  createdBy!: string;

  @Column({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt!: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50 })
  updatedBy!: string;
}
```

- [ ] **Step 2-3: 빌드 확인**

Run: `pnpm --filter backend build`
Expected: 0 에러

- [ ] **Step 2-4: 커밋**

```bash
git add apps/backend/src/entities/menu-category.entity.ts apps/backend/src/entities/menu-category-item.entity.ts
git commit -m "feat(menu-category): TypeORM entities 추가"
```

---

## Task 3: DTO 작성

**Files:**
- Create: `apps/backend/src/modules/menu-categories/dto/menu-category.dto.ts`
- Create: `apps/backend/src/modules/menu-categories/dto/menu-category-item.dto.ts`

- [ ] **Step 3-1: 카테고리 DTO 작성**

`apps/backend/src/modules/menu-categories/dto/menu-category.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Matches, MaxLength, IsIn, IsInt, Min, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const CATEGORY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
const RESERVED_ROOT = '__ROOT__';

export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'NEW_CATEGORY', description: '카테고리 코드(영문 대문자/숫자/언더스코어, 2~50자). __ROOT__ 등 예약어는 생성 불가.' })
  @IsString()
  @Matches(CATEGORY_CODE_PATTERN, { message: '카테고리 코드는 영문 대문자/숫자/언더스코어 2~50자여야 합니다.' })
  code!: string;

  @ApiProperty({ example: 'menu.newCategory' })
  @IsString()
  @MaxLength(200)
  labelKey!: string;

  @ApiProperty({ required: false, example: 'Folder' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iconName?: string;
}

export class UpdateMenuCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  labelKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iconName?: string | null;

  @ApiProperty({ required: false, enum: ['Y', 'N'] })
  @IsOptional()
  @IsIn(['Y', 'N'])
  isActive?: 'Y' | 'N';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderCategoryItem {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [ReorderCategoryItem] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItem)
  items!: ReorderCategoryItem[];
}

export { CATEGORY_CODE_PATTERN, RESERVED_ROOT };
```

- [ ] **Step 3-2: 메뉴 배치 DTO 작성**

`apps/backend/src/modules/menu-categories/dto/menu-category-item.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MoveMenuItemDto {
  @ApiProperty({ description: '이동할 메뉴 코드(leaf)' })
  @IsString()
  menuCode!: string;

  @ApiProperty({ description: '대상 카테고리 코드' })
  @IsString()
  toCategoryCode!: string;

  @ApiProperty({ description: '카테고리 내 표시 순서' })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderMenuItem {
  @ApiProperty()
  @IsString()
  menuCode!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderMenuItemsDto {
  @ApiProperty({ type: [ReorderMenuItem] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItem)
  items!: ReorderMenuItem[];
}
```

- [ ] **Step 3-3: 빌드 확인 + 커밋**

```bash
pnpm --filter backend build
git add apps/backend/src/modules/menu-categories/dto
git commit -m "feat(menu-category): DTO 추가 (Create/Update/Reorder/Move)"
```

---

## Task 4: MenuCategoriesService + 단위 테스트 (TDD)

**Files:**
- Create: `apps/backend/src/modules/menu-categories/services/menu-categories.service.ts`
- Create: `apps/backend/src/modules/menu-categories/services/menu-categories.service.spec.ts`

- [ ] **Step 4-1: 실패하는 테스트 작성**

`apps/backend/src/modules/menu-categories/services/menu-categories.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import { MenuCategoriesService } from './menu-categories.service';

describe('MenuCategoriesService', () => {
  let service: MenuCategoriesService;
  let categoryRepo: jest.Mocked<Repository<MenuCategory>>;
  let itemRepo: jest.Mocked<Repository<MenuCategoryItem>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    categoryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<Repository<MenuCategory>>;

    itemRepo = {
      find: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<Repository<MenuCategoryItem>>;

    dataSource = {
      transaction: jest.fn(async (cb: any) => cb({ getRepository: () => categoryRepo })),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuCategoriesService,
        { provide: getRepositoryToken(MenuCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(MenuCategoryItem), useValue: itemRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MenuCategoriesService>(MenuCategoriesService);
  });

  describe('create', () => {
    it('유효한 카테고리를 생성한다', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      categoryRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.create(
        { code: 'NEW_CAT', labelKey: 'menu.newCat' },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );
      expect(result.categoryCode).toBe('NEW_CAT');
      expect(categoryRepo.save).toHaveBeenCalled();
    });

    it('예약어 __ROOT__ 생성 시 BadRequest', async () => {
      await expect(
        service.create(
          { code: '__ROOT__', labelKey: 'x' } as any,
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('중복 코드 생성 시 Conflict', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'X' } as any);
      await expect(
        service.create(
          { code: 'X', labelKey: 'x' },
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('delete', () => {
    it('비어있는 카테고리는 삭제된다', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'X' } as any);
      itemRepo.count.mockResolvedValueOnce(0);
      categoryRepo.delete.mockResolvedValueOnce({} as any);

      await service.delete('X');
      expect(categoryRepo.delete).toHaveBeenCalledWith({ categoryCode: 'X' });
    });

    it('자식 메뉴가 있으면 Conflict 한국어 메시지', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'X' } as any);
      itemRepo.count.mockResolvedValueOnce(3);

      await expect(service.delete('X')).rejects.toThrow(
        '카테고리에 메뉴가 3개 있습니다. 먼저 다른 카테고리로 이동하거나 삭제해주세요',
      );
    });

    it('__ROOT__는 삭제 차단', async () => {
      await expect(service.delete('__ROOT__')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('존재하지 않으면 NotFound', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.delete('X')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('카테고리 순서 일괄 갱신', async () => {
      categoryRepo.update.mockResolvedValue({} as any);
      await service.reorder({ items: [{ code: 'A', sortOrder: 10 }, { code: 'B', sortOrder: 20 }] });
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 4-2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter backend test menu-categories.service`
Expected: FAIL — "Cannot find module './menu-categories.service'"

- [ ] **Step 4-3: 서비스 구현**

`apps/backend/src/modules/menu-categories/services/menu-categories.service.ts`:

```ts
/**
 * @file src/modules/menu-categories/services/menu-categories.service.ts
 * @description 사이드바 카테고리 CRUD/Reorder 서비스
 */
import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  ReorderCategoriesDto,
  RESERVED_ROOT,
} from '../dto/menu-category.dto';

interface AuditScope {
  company: string;
  plantCd: string;
  userId: string;
}

@Injectable()
export class MenuCategoriesService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoryRepo: Repository<MenuCategory>,
    @InjectRepository(MenuCategoryItem)
    private readonly itemRepo: Repository<MenuCategoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<MenuCategory[]> {
    return this.categoryRepo.find({ order: { sortOrder: 'ASC', categoryCode: 'ASC' } });
  }

  async create(dto: CreateMenuCategoryDto, scope: AuditScope): Promise<MenuCategory> {
    if (dto.code === RESERVED_ROOT) {
      throw new BadRequestException(`예약어 ${RESERVED_ROOT}는 생성할 수 없습니다.`);
    }
    const existing = await this.categoryRepo.findOne({ where: { categoryCode: dto.code } });
    if (existing) {
      throw new ConflictException(`이미 존재하는 카테고리 코드입니다: ${dto.code}`);
    }
    const now = new Date();
    const entity = this.categoryRepo.create({
      categoryCode: dto.code,
      labelKey: dto.labelKey,
      iconName: dto.iconName ?? null,
      sortOrder: 9999, // 신규는 가장 아래로
      isActive: 'Y',
      company: scope.company,
      plantCd: scope.plantCd,
      createdAt: now,
      createdBy: scope.userId,
      updatedAt: now,
      updatedBy: scope.userId,
    });
    return this.categoryRepo.save(entity);
  }

  async update(code: string, dto: UpdateMenuCategoryDto, scope: AuditScope): Promise<MenuCategory> {
    const existing = await this.categoryRepo.findOne({ where: { categoryCode: code } });
    if (!existing) throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${code}`);

    if (code === RESERVED_ROOT) {
      // __ROOT__는 sortOrder만 수정 허용
      if (dto.labelKey !== undefined || dto.iconName !== undefined || dto.isActive !== undefined) {
        throw new BadRequestException(`${RESERVED_ROOT}는 라벨/아이콘/활성 상태를 변경할 수 없습니다.`);
      }
    }

    await this.categoryRepo.update(
      { categoryCode: code },
      {
        ...(dto.labelKey !== undefined && { labelKey: dto.labelKey }),
        ...(dto.iconName !== undefined && { iconName: dto.iconName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        updatedAt: new Date(),
        updatedBy: scope.userId,
      },
    );

    return (await this.categoryRepo.findOne({ where: { categoryCode: code } }))!;
  }

  async delete(code: string): Promise<{ code: string }> {
    if (code === RESERVED_ROOT) {
      throw new BadRequestException(`예약어 ${RESERVED_ROOT}는 삭제할 수 없습니다.`);
    }
    const existing = await this.categoryRepo.findOne({ where: { categoryCode: code } });
    if (!existing) throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${code}`);

    const childCount = await this.itemRepo.count({ where: { categoryCode: code } });
    if (childCount > 0) {
      throw new ConflictException(
        `카테고리에 메뉴가 ${childCount}개 있습니다. 먼저 다른 카테고리로 이동하거나 삭제해주세요`,
      );
    }

    await this.categoryRepo.delete({ categoryCode: code });
    return { code };
  }

  async reorder(dto: ReorderCategoriesDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(MenuCategory);
      for (const item of dto.items) {
        await repo.update({ categoryCode: item.code }, { sortOrder: item.sortOrder, updatedAt: new Date() });
      }
    });
  }
}
```

- [ ] **Step 4-4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter backend test menu-categories.service`
Expected: PASS — 모든 케이스 통과

- [ ] **Step 4-5: 커밋**

```bash
git add apps/backend/src/modules/menu-categories/services/menu-categories.service.ts apps/backend/src/modules/menu-categories/services/menu-categories.service.spec.ts
git commit -m "feat(menu-category): MenuCategoriesService + 단위 테스트"
```

---

## Task 5: MenuCategoryItemsService + 단위 테스트 (TDD)

**Files:**
- Create: `apps/backend/src/modules/menu-categories/services/menu-category-items.service.ts`
- Create: `apps/backend/src/modules/menu-categories/services/menu-category-items.service.spec.ts`

- [ ] **Step 5-1: 실패하는 테스트 작성**

`apps/backend/src/modules/menu-categories/services/menu-category-items.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import { MenuCategoryItemsService } from './menu-category-items.service';

const VALID_MENU_CODES = new Set(['DASHBOARD', 'MST_PART', 'MST_BOM', 'SYS_USER']);

jest.mock('../utils/menu-code-validator', () => ({
  isValidMenuCode: (code: string) => VALID_MENU_CODES.has(code),
}));

describe('MenuCategoryItemsService', () => {
  let service: MenuCategoryItemsService;
  let itemRepo: jest.Mocked<Repository<MenuCategoryItem>>;
  let categoryRepo: jest.Mocked<Repository<MenuCategory>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    itemRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<MenuCategoryItem>>;

    categoryRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<MenuCategory>>;

    dataSource = {
      transaction: jest.fn(async (cb: any) => cb({ getRepository: () => itemRepo })),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuCategoryItemsService,
        { provide: getRepositoryToken(MenuCategoryItem), useValue: itemRepo },
        { provide: getRepositoryToken(MenuCategory), useValue: categoryRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MenuCategoryItemsService>(MenuCategoryItemsService);
  });

  describe('move', () => {
    it('메뉴를 다른 카테고리로 이동(신규 생성)', async () => {
      itemRepo.findOne.mockResolvedValueOnce(null);
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'TARGET' } as any);
      itemRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.move(
        { menuCode: 'MST_PART', toCategoryCode: 'TARGET', sortOrder: 10 },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );
      expect(result.menuCode).toBe('MST_PART');
      expect(result.categoryCode).toBe('TARGET');
    });

    it('이미 다른 카테고리에 있으면 카테고리/순서 갱신', async () => {
      itemRepo.findOne.mockResolvedValueOnce({ menuCode: 'MST_PART', categoryCode: 'OLD' } as any);
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'TARGET' } as any);
      itemRepo.save.mockImplementation(async (e: any) => e);

      await service.move(
        { menuCode: 'MST_PART', toCategoryCode: 'TARGET', sortOrder: 20 },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );
      expect(itemRepo.save).toHaveBeenCalled();
    });

    it('존재하지 않는 menuCode는 BadRequest', async () => {
      await expect(
        service.move(
          { menuCode: 'NON_EXISTENT', toCategoryCode: 'X', sortOrder: 0 },
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('존재하지 않는 카테고리는 NotFound', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.move(
          { menuCode: 'MST_PART', toCategoryCode: 'GONE', sortOrder: 0 },
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('매핑을 삭제하여 미배치 상태로 만든다', async () => {
      itemRepo.findOne.mockResolvedValueOnce({ menuCode: 'MST_PART' } as any);
      itemRepo.delete.mockResolvedValueOnce({} as any);

      await service.remove('MST_PART');
      expect(itemRepo.delete).toHaveBeenCalledWith({ menuCode: 'MST_PART' });
    });

    it('매핑이 없으면 NotFound', async () => {
      itemRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.remove('MST_PART')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorderInCategory', () => {
    it('카테고리 내 순서 일괄 갱신', async () => {
      itemRepo.update.mockResolvedValue({} as any);
      await service.reorderInCategory('CAT', {
        items: [
          { menuCode: 'MST_PART', sortOrder: 10 },
          { menuCode: 'MST_BOM', sortOrder: 20 },
        ],
      });
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 5-2: menu-code-validator 유틸 작성**

`apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`:

```ts
/**
 * @file 메뉴 코드 유효성 검증 — 프론트 menuConfig.ts의 leaf 메뉴 코드와 동기화된 화이트리스트
 *
 * 운영 정책상 신규 페이지 추가 시 개발자가 이 파일과 menuConfig.ts를 동시에 수정한다.
 * 자동 동기화 없이 명시적 등록을 유지한다.
 */
const KNOWN_LEAF_CODES: ReadonlySet<string> = new Set<string>([
  // 단독 메뉴 (__ROOT__ 매핑 대상)
  'DASHBOARD', 'WORKFLOW',
  // MONITORING
  'MON_EQUIP_STATUS',
  // MASTER
  'MST_PART','MST_BOM','MST_PARTNER','EQUIP_MASTER','MST_PROCESS','MST_PROD_LINE',
  'MST_ROUTING','MST_WORK_CALENDAR','MST_WORKER','MST_WORK_INST','MST_WAREHOUSE',
  'MST_LABEL','MST_VENDOR_BARCODE','MST_PROCESS_CAPA','SYS_DOCUMENT',
  // INVENTORY
  'INV_MAT_STOCK','INV_TRANSACTION','INV_MAT_PHYSICAL_INV','INV_MAT_PHYSICAL_INV_HISTORY',
  'INV_ARRIVAL_STOCK','MAT_HOLD',
  // PRODUCT_INVENTORY
  'INV_PRODUCT_STOCK','INV_PRODUCT_PHYSICAL_INV','INV_PRODUCT_PHYSICAL_INV_HISTORY','PROD_HOLD',
  // PRODUCT_MGMT
  'PROD_RECEIVE','PROD_RECEIPT_CANCEL','PROD_ISSUE','PROD_ISSUE_CANCEL',
  // MATERIAL
  'MAT_ARRIVAL','MAT_RECEIVE_LABEL','MAT_RECEIVE','MAT_RECEIVE_HISTORY','MAT_REQUEST',
  'MAT_ISSUE','MAT_LOT','MAT_LOT_SPLIT','MAT_LOT_MERGE','MAT_SHELF_LIFE','MAT_SCRAP',
  'MAT_ADJUSTMENT','MAT_MISC_RECEIPT','MAT_RECEIPT_CANCEL',
  // PURCHASING
  'PUR_PO','PUR_PO_STATUS',
  // PRODUCTION
  'PROD_MONTHLY_PLAN','PROD_SIMULATION','PROD_ORDER','PROD_RESULT','PROD_PROGRESS',
  'PROD_INPUT_MANUAL','PROD_INPUT_MACHINE','PROD_INPUT_INSPECT','PROD_INPUT_EQUIP',
  'PROD_RESULT_SUMMARY','PROD_WIP_STOCK','QC_REWORK','QC_REWORK_HISTORY','PROD_REPAIR',
  // INSPECTION
  'INSP_RESULT','INSP_HISTORY','INSP_PROTOCOL',
  // QUALITY
  'QC_IQC_ITEM','QC_IQC','QC_IQC_HISTORY','QC_DEFECT','QC_REWORK_INSPECT','QC_INSPECT',
  'QC_SAMPLE_INSPECT','QC_OQC','QC_OQC_HISTORY','QC_TRACE','QC_CHANGE','QC_COMPLAINT',
  'QC_CAPA','QC_FAI','QC_PPAP','QC_SPC','QC_CONTROL_PLAN','QC_AUDIT','SYS_TRAINING',
  // EQUIPMENT
  'EQ_MOLD_MGMT','EQUIP_INSPECT_ITEM_MASTER','EQUIP_INSPECT_ITEM','EQUIP_INSPECT_CALENDAR',
  'EQUIP_DAILY','EQUIP_PERIODIC_CALENDAR','EQUIP_PERIODIC','EQUIP_HISTORY',
  'EQUIP_PM_PLAN','EQUIP_PM_CALENDAR','EQUIP_PM_RESULT',
  // GAUGE_MGMT
  'GAUGE_MASTER','GAUGE_CALIBRATION','GAUGE_CALIBRATION_HISTORY',
  // SHIPPING
  'SHIP_PACK_RESULT','SHIP_PACK','SHIP_PALLET','SHIP_CONFIRM','SHIP_ORDER','SHIP_HISTORY','SHIP_RETURN',
  // SALES
  'SALES_CUST_PO','SALES_CUST_PO_STATUS',
  // CUSTOMS
  'CUST_ENTRY','CUST_STOCK','CUST_USAGE',
  // CONSUMABLES
  'CONS_MASTER','CONS_LABEL','CONS_RECEIVING','CONS_ISSUING','CONS_STOCK','CONS_LIFE','CONS_MOUNT',
  // OUTSOURCING
  'OUT_VENDOR','OUT_ORDER','OUT_RECEIVE',
  // INTERFACE
  'IF_DASHBOARD','IF_LOG','IF_MANUAL',
  // SYSTEM
  'SYS_COMPANY','SYS_DEPT','SYS_USER','SYS_ROLE','SYS_PDA_ROLE','SYS_COMM','SYS_CONFIG',
  'SYS_CODE','SYS_SCHEDULER','SYS_MENU_CATEGORY',
]);

export function isValidMenuCode(code: string): boolean {
  return KNOWN_LEAF_CODES.has(code);
}

export function listKnownMenuCodes(): string[] {
  return Array.from(KNOWN_LEAF_CODES);
}
```

- [ ] **Step 5-3: 테스트 실행 — 실패 확인**

Run: `pnpm --filter backend test menu-category-items.service`
Expected: FAIL — "Cannot find module './menu-category-items.service'"

- [ ] **Step 5-4: 서비스 구현**

`apps/backend/src/modules/menu-categories/services/menu-category-items.service.ts`:

```ts
/**
 * @file src/modules/menu-categories/services/menu-category-items.service.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 서비스 — 이동/삭제/카테고리 내 순서 일괄 갱신
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import { MoveMenuItemDto, ReorderMenuItemsDto } from '../dto/menu-category-item.dto';
import { isValidMenuCode } from '../utils/menu-code-validator';

interface AuditScope {
  company: string;
  plantCd: string;
  userId: string;
}

@Injectable()
export class MenuCategoryItemsService {
  constructor(
    @InjectRepository(MenuCategoryItem)
    private readonly itemRepo: Repository<MenuCategoryItem>,
    @InjectRepository(MenuCategory)
    private readonly categoryRepo: Repository<MenuCategory>,
    private readonly dataSource: DataSource,
  ) {}

  async findByCategory(categoryCode: string): Promise<MenuCategoryItem[]> {
    return this.itemRepo.find({
      where: { categoryCode },
      order: { sortOrder: 'ASC', menuCode: 'ASC' },
    });
  }

  async move(dto: MoveMenuItemDto, scope: AuditScope): Promise<MenuCategoryItem> {
    if (!isValidMenuCode(dto.menuCode)) {
      throw new BadRequestException(`알 수 없는 메뉴 코드입니다: ${dto.menuCode}`);
    }
    const cat = await this.categoryRepo.findOne({ where: { categoryCode: dto.toCategoryCode } });
    if (!cat) throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${dto.toCategoryCode}`);

    const existing = await this.itemRepo.findOne({ where: { menuCode: dto.menuCode } });
    const now = new Date();

    const entity = this.itemRepo.create({
      menuCode: dto.menuCode,
      categoryCode: dto.toCategoryCode,
      sortOrder: dto.sortOrder,
      company: scope.company,
      plantCd: scope.plantCd,
      createdAt: existing?.createdAt ?? now,
      createdBy: existing?.createdBy ?? scope.userId,
      updatedAt: now,
      updatedBy: scope.userId,
    });

    return this.itemRepo.save(entity);
  }

  async remove(menuCode: string): Promise<{ menuCode: string }> {
    const existing = await this.itemRepo.findOne({ where: { menuCode } });
    if (!existing) throw new NotFoundException(`메뉴 배치를 찾을 수 없습니다: ${menuCode}`);

    await this.itemRepo.delete({ menuCode });
    return { menuCode };
  }

  async reorderInCategory(categoryCode: string, dto: ReorderMenuItemsDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(MenuCategoryItem);
      for (const item of dto.items) {
        await repo.update(
          { menuCode: item.menuCode, categoryCode },
          { sortOrder: item.sortOrder, updatedAt: new Date() },
        );
      }
    });
  }
}
```

- [ ] **Step 5-5: 테스트 실행 — 통과 확인**

Run: `pnpm --filter backend test menu-category-items.service`
Expected: PASS

- [ ] **Step 5-6: 커밋**

```bash
git add apps/backend/src/modules/menu-categories/services/menu-category-items.service.ts apps/backend/src/modules/menu-categories/services/menu-category-items.service.spec.ts apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
git commit -m "feat(menu-category): MenuCategoryItemsService + leaf 코드 화이트리스트"
```

---

## Task 6: 컨트롤러 2개 작성

**Files:**
- Create: `apps/backend/src/modules/menu-categories/controllers/menu-categories.controller.ts`
- Create: `apps/backend/src/modules/menu-categories/controllers/menu-category-items.controller.ts`

- [ ] **Step 6-1: MenuCategoriesController 작성**

`apps/backend/src/modules/menu-categories/controllers/menu-categories.controller.ts`:

```ts
/**
 * @file src/modules/menu-categories/controllers/menu-categories.controller.ts
 * @description 사이드바 카테고리 CRUD/Tree/Reorder 컨트롤러
 *
 * 엔드포인트:
 * - GET    /menu-categories                  목록
 * - GET    /menu-categories/tree             사이드바 렌더용 트리(카테고리 + 메뉴 배치)
 * - GET    /menu-categories/unassigned-menus 미배치 menu 코드 목록
 * - POST   /menu-categories                  신규 카테고리
 * - PATCH  /menu-categories/reorder          카테고리 순서 일괄 갱신
 * - PATCH  /menu-categories/:code            카테고리 수정
 * - PATCH  /menu-categories/:code/items      카테고리 내 메뉴 순서 일괄 갱신
 * - DELETE /menu-categories/:code            카테고리 삭제
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuCategoriesService } from '../services/menu-categories.service';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import {
  CreateMenuCategoryDto, UpdateMenuCategoryDto, ReorderCategoriesDto,
} from '../dto/menu-category.dto';
import { ReorderMenuItemsDto } from '../dto/menu-category-item.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { listKnownMenuCodes } from '../utils/menu-code-validator';

@ApiTags('시스템 - 메뉴 카테고리')
@Controller('menu-categories')
export class MenuCategoriesController {
  constructor(
    private readonly categories: MenuCategoriesService,
    private readonly items: MenuCategoryItemsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '카테고리 목록' })
  async findAll() {
    const data = await this.categories.findAll();
    return ResponseUtil.success(data);
  }

  @Get('tree')
  @ApiOperation({ summary: '사이드바 트리 (카테고리 + 메뉴 배치)' })
  async tree() {
    const categories = await this.categories.findAll();
    const tree = await Promise.all(
      categories.map(async (c) => ({
        categoryCode: c.categoryCode,
        labelKey: c.labelKey,
        iconName: c.iconName,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        menus: (await this.items.findByCategory(c.categoryCode)).map((i) => ({
          menuCode: i.menuCode,
          sortOrder: i.sortOrder,
        })),
      })),
    );
    return ResponseUtil.success(tree);
  }

  @Get('unassigned-menus')
  @ApiOperation({ summary: '어디에도 배치되지 않은 메뉴 코드 목록' })
  async unassigned() {
    const all = listKnownMenuCodes();
    const categories = await this.categories.findAll();
    const placed = new Set<string>();
    for (const c of categories) {
      for (const i of await this.items.findByCategory(c.categoryCode)) {
        placed.add(i.menuCode);
      }
    }
    const unassigned = all.filter((code) => !placed.has(code));
    return ResponseUtil.success(unassigned);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '카테고리 생성' })
  async create(@Body() dto: CreateMenuCategoryDto, @Req() req: any) {
    const data = await this.categories.create(dto, this.scope(req));
    return ResponseUtil.success(data);
  }

  @Patch('reorder')
  @ApiOperation({ summary: '카테고리 순서 일괄 갱신' })
  async reorder(@Body() dto: ReorderCategoriesDto) {
    await this.categories.reorder(dto);
    return ResponseUtil.success({ ok: true });
  }

  @Patch(':code')
  @ApiOperation({ summary: '카테고리 수정' })
  async update(@Param('code') code: string, @Body() dto: UpdateMenuCategoryDto, @Req() req: any) {
    const data = await this.categories.update(code, dto, this.scope(req));
    return ResponseUtil.success(data);
  }

  @Patch(':code/items')
  @ApiOperation({ summary: '카테고리 내 메뉴 순서 일괄 갱신' })
  async reorderItems(@Param('code') code: string, @Body() dto: ReorderMenuItemsDto) {
    await this.items.reorderInCategory(code, dto);
    return ResponseUtil.success({ ok: true });
  }

  @Delete(':code')
  @ApiOperation({ summary: '카테고리 삭제(빈 카테고리만 가능)' })
  async delete(@Param('code') code: string) {
    const data = await this.categories.delete(code);
    return ResponseUtil.success(data);
  }

  private scope(req: any) {
    const user = req.user ?? {};
    return {
      company: user.company ?? 'HANES',
      plantCd: user.plantCd ?? '-',
      userId: user.userId ?? user.userName ?? 'system',
    };
  }
}
```

- [ ] **Step 6-2: MenuCategoryItemsController 작성**

`apps/backend/src/modules/menu-categories/controllers/menu-category-items.controller.ts`:

```ts
/**
 * @file src/modules/menu-categories/controllers/menu-category-items.controller.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 컨트롤러 — 이동/삭제 단건
 */
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import { MoveMenuItemDto } from '../dto/menu-category-item.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템 - 메뉴 배치')
@Controller('menu-category-items')
export class MenuCategoryItemsController {
  constructor(private readonly items: MenuCategoryItemsService) {}

  @Patch('move')
  @ApiOperation({ summary: '메뉴를 다른 카테고리로 이동' })
  async move(@Body() dto: MoveMenuItemDto, @Req() req: any) {
    const data = await this.items.move(dto, this.scope(req));
    return ResponseUtil.success(data);
  }

  @Delete(':menuCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '메뉴 배치 삭제(미배치 상태로 만들기)' })
  async remove(@Param('menuCode') menuCode: string) {
    const data = await this.items.remove(menuCode);
    return ResponseUtil.success(data);
  }

  private scope(req: any) {
    const user = req.user ?? {};
    return {
      company: user.company ?? 'HANES',
      plantCd: user.plantCd ?? '-',
      userId: user.userId ?? user.userName ?? 'system',
    };
  }
}
```

- [ ] **Step 6-3: 커밋**

```bash
git add apps/backend/src/modules/menu-categories/controllers
git commit -m "feat(menu-category): 카테고리/배치 컨트롤러 추가"
```

---

## Task 7: 모듈 등록 + AppModule 연결

**Files:**
- Create: `apps/backend/src/modules/menu-categories/menu-categories.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 7-1: MenuCategoriesModule 작성**

`apps/backend/src/modules/menu-categories/menu-categories.module.ts`:

```ts
/**
 * @file src/modules/menu-categories/menu-categories.module.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../entities/menu-category-item.entity';
import { MenuCategoriesService } from './services/menu-categories.service';
import { MenuCategoryItemsService } from './services/menu-category-items.service';
import { MenuCategoriesController } from './controllers/menu-categories.controller';
import { MenuCategoryItemsController } from './controllers/menu-category-items.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, MenuCategoryItem])],
  controllers: [MenuCategoriesController, MenuCategoryItemsController],
  providers: [MenuCategoriesService, MenuCategoryItemsService],
  exports: [MenuCategoriesService, MenuCategoryItemsService],
})
export class MenuCategoriesModule {}
```

- [ ] **Step 7-2: AppModule에 등록**

`apps/backend/src/app.module.ts`에서 `imports` 배열을 찾아 `MenuCategoriesModule` 추가:

```ts
import { MenuCategoriesModule } from './modules/menu-categories/menu-categories.module';

// ... imports 배열에 추가:
//   ...,
//   MenuCategoriesModule,
//   ...,
```

(정확한 위치는 master 모듈 import 라인 근처. 실제 파일을 열어 import 문 + `imports` 배열 두 곳을 수정.)

- [ ] **Step 7-3: 빌드 확인**

Run: `pnpm --filter backend build`
Expected: 0 에러

- [ ] **Step 7-4: 커밋**

```bash
git add apps/backend/src/modules/menu-categories/menu-categories.module.ts apps/backend/src/app.module.ts
git commit -m "feat(menu-category): MenuCategoriesModule 등록"
```

---

## Task 8: 시드 SQL 생성 스크립트 작성 + 적용

**Files:**
- Create: `scripts/gen-menu-category-seed.js`
- Create: `scripts/2026-05-18_seed_menu_categories.sql` (스크립트 결과물)

- [ ] **Step 8-1: 시드 생성 스크립트 작성**

`scripts/gen-menu-category-seed.js`:

```js
#!/usr/bin/env node
/**
 * @file scripts/gen-menu-category-seed.js
 * @description menuConfig.ts를 파싱하여 MENU_CATEGORIES / MENU_CATEGORY_ITEMS 시드 SQL을 생성한다.
 *
 * 출력: scripts/2026-05-18_seed_menu_categories.sql
 * 사용: node scripts/gen-menu-category-seed.js
 */
const fs = require('fs');
const path = require('path');

const MENU_CONFIG_PATH = path.resolve(__dirname, '../apps/frontend/src/config/menuConfig.ts');
const OUTPUT_PATH = path.resolve(__dirname, '2026-05-18_seed_menu_categories.sql');

const SINGLE_TOP_MENUS = new Set(['DASHBOARD', 'WORKFLOW']);
const COMPANY = 'HANES';
const PLANT_CD = '-';
const SYSTEM_USER = 'system';

const source = fs.readFileSync(MENU_CONFIG_PATH, 'utf-8');

/**
 * 단순 정규식 기반 파서 — menuConfig 배열의 최상위 항목과 children을 추출
 * 본 파일은 변동이 잦지 않은 시드 1회용 스크립트이므로 정규식 방식 채택.
 */
function extract(source) {
  // 최상위 블록: { code: "X", labelKey: "...", icon: Y, children: [...] } 또는 children 없는 단일 메뉴
  const topRegex = /\{\s*code:\s*"([A-Z_][A-Z0-9_]*)",\s*labelKey:\s*"([^"]+)"(?:,\s*path:\s*"[^"]+")?,?\s*icon:\s*(\w+),?(?:\s*children:\s*\[([\s\S]*?)\]\s*)?,?\s*\}/g;
  const childRegex = /\{\s*code:\s*"([A-Z_][A-Z0-9_]*)",\s*labelKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"\s*\}/g;

  const categories = [];
  const items = [];
  let match;
  while ((match = topRegex.exec(source)) !== null) {
    const [, code, labelKey, iconName, childrenBlock] = match;
    categories.push({ code, labelKey, iconName });
    if (childrenBlock) {
      let cm;
      while ((cm = childRegex.exec(childrenBlock)) !== null) {
        items.push({ menuCode: cm[1], categoryCode: code });
      }
    }
  }
  return { categories, items };
}

const { categories, items } = extract(source);

const lines = [];
lines.push('-- ============================================================================');
lines.push('-- 2026-05-18 좌측 메뉴 카테고리/순서 — 초기 시드');
lines.push('-- 생성: scripts/gen-menu-category-seed.js (자동 생성, 직접 편집 금지)');
lines.push('-- ============================================================================');
lines.push('');

// __ROOT__ 시드
lines.push(`INSERT INTO MENU_CATEGORIES (CATEGORY_CODE, LABEL_KEY, ICON_NAME, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
lines.push(`VALUES ('__ROOT__', 'menu.root', NULL, 0, 'Y', '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
lines.push('');

// 카테고리 시드 (단독 메뉴는 카테고리로 만들지 않음)
let sortOrder = 10;
const realCategories = categories.filter((c) => !SINGLE_TOP_MENUS.has(c.code));
for (const c of realCategories) {
  lines.push(`INSERT INTO MENU_CATEGORIES (CATEGORY_CODE, LABEL_KEY, ICON_NAME, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
  lines.push(`VALUES ('${c.code}', '${c.labelKey}', '${c.iconName}', ${sortOrder}, 'Y', '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
  sortOrder += 10;
}
lines.push('');

// 메뉴 배치 시드 (카테고리 자식 + 단독 메뉴는 __ROOT__로)
const orderInCategory = new Map(); // categoryCode -> 다음 sort_order
const nextOrder = (cat) => {
  const v = (orderInCategory.get(cat) ?? 0) + 10;
  orderInCategory.set(cat, v);
  return v;
};

for (const c of categories) {
  if (SINGLE_TOP_MENUS.has(c.code)) {
    // 단독 메뉴: 카테고리가 아니라 __ROOT__에 배치
    const so = nextOrder('__ROOT__');
    lines.push(`INSERT INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
    lines.push(`VALUES ('${c.code}', '__ROOT__', ${so}, '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
  }
}

for (const i of items) {
  const so = nextOrder(i.categoryCode);
  lines.push(`INSERT INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
  lines.push(`VALUES ('${i.menuCode}', '${i.categoryCode}', ${so}, '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
}

lines.push('');
lines.push('COMMIT;');
lines.push('');

fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');
console.log(`Wrote: ${OUTPUT_PATH}`);
console.log(`Categories: ${realCategories.length + 1 /* __ROOT__ */}`);
console.log(`Items: ${items.length + Array.from(SINGLE_TOP_MENUS).filter((c) => categories.some((cc) => cc.code === c)).length}`);
```

- [ ] **Step 8-2: 스크립트 실행 — SQL 생성**

Run: `node scripts/gen-menu-category-seed.js`
Expected:
```
Wrote: .../scripts/2026-05-18_seed_menu_categories.sql
Categories: 22
Items: 100+
```

생성된 SQL을 열어 INSERT 개수가 menuConfig leaf 수와 일치하는지 확인.

- [ ] **Step 8-3: 시드 SQL을 JSHANES에 적용**

`oracle-db` 스킬로 `scripts/2026-05-18_seed_menu_categories.sql` 실행.

- [ ] **Step 8-4: 시드 검증**

```sql
-- 카테고리 수: 1(__ROOT__) + 코드 카테고리 수
SELECT COUNT(*) FROM MENU_CATEGORIES;

-- __ROOT__ 매핑(단독 메뉴) 확인
SELECT MENU_CODE FROM MENU_CATEGORY_ITEMS WHERE CATEGORY_CODE = '__ROOT__' ORDER BY SORT_ORDER;
-- 기대: DASHBOARD, WORKFLOW

-- 카테고리별 메뉴 개수
SELECT CATEGORY_CODE, COUNT(*) AS CNT
  FROM MENU_CATEGORY_ITEMS GROUP BY CATEGORY_CODE
  ORDER BY CATEGORY_CODE;
```

- [ ] **Step 8-5: 커밋**

```bash
git add scripts/gen-menu-category-seed.js scripts/2026-05-18_seed_menu_categories.sql
git commit -m "feat(menu-category): 시드 생성 스크립트 + 초기 시드 SQL"
```

---

## Task 9: menuConfig.ts에 관리 화면 leaf 추가 + ROLE 시드

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/backend/src/seeds/menu-config.json`

- [ ] **Step 9-1: menuConfig.ts의 SYSTEM 카테고리 children에 SYS_MENU_CATEGORY 추가**

`apps/frontend/src/config/menuConfig.ts`의 `SYSTEM` 블록(파일 끝부분) children 배열에 다음을 추가:

```ts
      { code: "SYS_MENU_CATEGORY", labelKey: "menu.system.menuCategory", path: "/system/menu-categories" },
```

`SYS_SCHEDULER` 다음 줄에 추가하면 자연스러움.

- [ ] **Step 9-2: 백엔드 role-menu seed JSON 갱신**

`apps/backend/src/seeds/menu-config.json`의 `childMenuCodes.SYSTEM` 배열에 `"SYS_MENU_CATEGORY"`를 추가.
(파일 구조: `{ topMenuCodes, childMenuCodes }` — SYSTEM 그룹의 자식 배열에 추가)

- [ ] **Step 9-3: ROLE_MENU_PERMISSIONS에 SYS_MENU_CATEGORY 등록**

`apps/backend/src/seeds/seed-roles.ts`는 `childMenuCodes.SYSTEM`을 자동으로 읽으므로 별도 코드 수정 불필요. 시드 재실행:

Run:
```
cd apps/backend
npx ts-node src/seeds/seed-roles.ts
```

(이 명령은 멱등성 시드 — 기존 권한 행이 있으면 건너뜀. SYS_MENU_CATEGORY는 새로 추가됨.)

- [ ] **Step 9-4: 시드 결과 확인**

```sql
SELECT ROLE_CODE, MENU_CODE FROM ROLE_MENU_PERMISSIONS
 WHERE MENU_CODE = 'SYS_MENU_CATEGORY'
 ORDER BY ROLE_CODE;
-- 기대: MANAGER 또는 ADMIN-only 정책에 따라 1~2건 (ADMIN은 행 없이 코드에서 전체 허용 처리됨)
```

- [ ] **Step 9-5: 신규 menu_code 배치 SQL 추가 (관리 화면 메뉴를 SYSTEM 카테고리에 배치)**

`scripts/2026-05-18_seed_sys_menu_category_item.sql`:

```sql
INSERT INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
VALUES ('SYS_MENU_CATEGORY', 'SYSTEM', 100, 'HANES', '-', SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system');
COMMIT;
```

JSHANES에 적용.

- [ ] **Step 9-6: 커밋**

```bash
git add apps/frontend/src/config/menuConfig.ts apps/backend/src/seeds/menu-config.json scripts/2026-05-18_seed_sys_menu_category_item.sql
git commit -m "feat(menu-category): SYS_MENU_CATEGORY leaf + 권한/배치 시드"
```

---

## Task 10: i18n 4파일에 라벨 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 10-1: ko.json에 키 추가**

`menu.system` 객체에 `menuCategory: "메뉴 카테고리 관리"` 추가, 그리고 `menu.root: "최상위"` 등 신규 키 4종 추가:

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| `menu.root` | 최상위 | Root | 顶级 | Cấp cao nhất |
| `menu.system.menuCategory` | 메뉴 카테고리 관리 | Menu Category Management | 菜单类别管理 | Quản lý danh mục menu |
| `menuCategoryAdmin.title` | 메뉴 카테고리 관리 | Menu Category Management | 菜单类别管理 | Quản lý danh mục menu |
| `menuCategoryAdmin.unassigned` | 미배치 메뉴 | Unassigned Menus | 未分配菜单 | Menu chưa phân loại |
| `menuCategoryAdmin.addCategory` | 카테고리 추가 | Add Category | 添加类别 | Thêm danh mục |
| `menuCategoryAdmin.cannotDeleteWithChildren` | 카테고리에 메뉴가 {{count}}개 있습니다. 먼저 다른 카테고리로 이동하거나 삭제해주세요. | This category has {{count}} menus. Please move or remove them first. | 此类别下有 {{count}} 个菜单。请先移动或删除它们。 | Danh mục này có {{count}} menu. Vui lòng di chuyển hoặc xóa chúng trước. |

4개 파일에 동일 키 구조로 동시 추가.

- [ ] **Step 10-2: i18n 키 누락 검증**

Run (PowerShell):
```powershell
$keys = @('menu.root','menu.system.menuCategory','menuCategoryAdmin.title','menuCategoryAdmin.unassigned','menuCategoryAdmin.addCategory','menuCategoryAdmin.cannotDeleteWithChildren')
foreach ($f in 'ko','en','zh','vi') {
  $content = Get-Content "apps/frontend/src/locales/$f.json" -Raw
  foreach ($k in $keys) {
    if ($content -notmatch [regex]::Escape($k.Split('.')[-1])) { Write-Host "MISSING in $f.json: $k" }
  }
}
```

Expected: MISSING 출력 0건

- [ ] **Step 10-3: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "i18n(menu-category): ko/en/zh/vi 라벨 추가"
```

---

## Task 11: 프론트 API 클라이언트 + zustand store

**Files:**
- Create: `apps/frontend/src/lib/api/menuCategories.ts`
- Create: `apps/frontend/src/stores/menuTreeStore.ts`

- [ ] **Step 11-1: API 클라이언트 작성**

`apps/frontend/src/lib/api/menuCategories.ts`:

```ts
/**
 * @file src/lib/api/menuCategories.ts
 * @description 메뉴 카테고리/배치 API 클라이언트
 */
import { apiClient } from './client';

export interface CategoryTreeNode {
  categoryCode: string;
  labelKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: 'Y' | 'N';
  menus: { menuCode: string; sortOrder: number }[];
}

export interface MenuCategoryRow {
  categoryCode: string;
  labelKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: 'Y' | 'N';
}

export const menuCategoriesApi = {
  tree: () => apiClient.get<CategoryTreeNode[]>('/menu-categories/tree').then((r) => r.data),
  list: () => apiClient.get<MenuCategoryRow[]>('/menu-categories').then((r) => r.data),
  unassigned: () => apiClient.get<string[]>('/menu-categories/unassigned-menus').then((r) => r.data),

  create: (dto: { code: string; labelKey: string; iconName?: string }) =>
    apiClient.post('/menu-categories', dto).then((r) => r.data),

  update: (code: string, dto: { labelKey?: string; iconName?: string | null; isActive?: 'Y' | 'N'; sortOrder?: number }) =>
    apiClient.patch(`/menu-categories/${code}`, dto).then((r) => r.data),

  delete: (code: string) =>
    apiClient.delete(`/menu-categories/${code}`).then((r) => r.data),

  reorderCategories: (items: { code: string; sortOrder: number }[]) =>
    apiClient.patch('/menu-categories/reorder', { items }).then((r) => r.data),

  reorderItems: (categoryCode: string, items: { menuCode: string; sortOrder: number }[]) =>
    apiClient.patch(`/menu-categories/${categoryCode}/items`, { items }).then((r) => r.data),

  moveItem: (dto: { menuCode: string; toCategoryCode: string; sortOrder: number }) =>
    apiClient.patch('/menu-category-items/move', dto).then((r) => r.data),

  unassign: (menuCode: string) =>
    apiClient.delete(`/menu-category-items/${menuCode}`).then((r) => r.data),
};
```

(주: `apiClient` 경로는 프로젝트 표준을 따른다. 기존 다른 API 파일과 동일한 import 사용. 다를 경우 그 패턴에 맞춰 조정.)

- [ ] **Step 11-2: zustand store 작성 (사이드바 렌더용 머지 트리)**

`apps/frontend/src/stores/menuTreeStore.ts`:

```ts
/**
 * @file src/stores/menuTreeStore.ts
 * @description 사이드바 렌더용 — DB 트리 + 코드 menuConfig leaf를 머지한 결과 보관
 *
 * 초보자 가이드:
 * - load(): /menu-categories/tree 호출, menuConfig leaf 정보와 머지
 * - invalidate(): 관리 화면에서 변경 시 재로딩 트리거
 * - 미배치(매핑 없는) leaf와 카테고리 isActive='N'은 사이드바에서 제외
 */
import { create } from 'zustand';
import { menuCategoriesApi, type CategoryTreeNode } from '@/lib/api/menuCategories';
import { menuConfig, type MenuConfigItem } from '@/config/menuConfig';

interface MergedMenuItem {
  code: string;
  labelKey: string;
  path: string;
}

export interface MergedMenuGroup {
  categoryCode: string; // '__ROOT__' 포함
  labelKey: string;
  iconName: string | null;
  children: MergedMenuItem[];
}

interface MenuTreeStore {
  groups: MergedMenuGroup[] | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/** menuConfig.ts에서 leaf 메뉴 코드 → 정보 lookup 맵 생성 */
function buildLeafLookup(): Map<string, MergedMenuItem> {
  const map = new Map<string, MergedMenuItem>();
  const walk = (items: MenuConfigItem[]) => {
    for (const item of items) {
      if (item.path) {
        map.set(item.code, { code: item.code, labelKey: item.labelKey, path: item.path });
      }
      if (item.children) walk(item.children);
    }
  };
  walk(menuConfig);
  return map;
}

export const useMenuTreeStore = create<MenuTreeStore>((set) => ({
  groups: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const tree: CategoryTreeNode[] = await menuCategoriesApi.tree();
      const leafLookup = buildLeafLookup();

      const active = tree.filter((c) => c.isActive === 'Y');
      active.sort((a, b) => a.sortOrder - b.sortOrder);

      const groups: MergedMenuGroup[] = active.map((c) => ({
        categoryCode: c.categoryCode,
        labelKey: c.labelKey,
        iconName: c.iconName,
        children: c.menus
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((m) => leafLookup.get(m.menuCode))
          .filter((x): x is MergedMenuItem => x !== undefined),
      }));

      set({ groups, loading: false });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'failed to load menu tree';
      set({ loading: false, error: message });
    }
  },

  invalidate: async () => {
    await useMenuTreeStore.getState().load();
  },
}));
```

- [ ] **Step 11-3: 빌드 확인**

Run: `pnpm --filter frontend build`
Expected: 0 에러

- [ ] **Step 11-4: 커밋**

```bash
git add apps/frontend/src/lib/api/menuCategories.ts apps/frontend/src/stores/menuTreeStore.ts
git commit -m "feat(menu-category): 프론트 API + zustand 트리 스토어"
```

---

## Task 12: 관리 화면 — 드래그앤드롭 트리 + FormPanel

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/menu-categories/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/system/menu-categories/components/MenuTreePanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/system/menu-categories/components/CategoryFormPanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/system/menu-categories/components/MenuItemPanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/system/menu-categories/components/UnassignedTray.tsx`

- [ ] **Step 12-1: @dnd-kit 의존성 추가**

```bash
pnpm --filter frontend add @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 12-2: page.tsx — 화면 컨테이너 (상태 + 레이아웃만)**

`apps/frontend/src/app/(authenticated)/system/menu-categories/page.tsx`:

```tsx
"use client";

/**
 * @file src/app/(authenticated)/system/menu-categories/page.tsx
 * @description 메뉴 카테고리 관리 — 드래그앤드롭 트리 + 우측 편집 패널
 *
 * 초보자 가이드:
 * - 좌측: 카테고리 트리 + 미배치 메뉴 트레이 (DnD)
 * - 우측: 선택된 항목 편집(카테고리: 라벨/아이콘/순서; 메뉴: 소속 변경)
 * - 페이지 파일은 300줄을 넘기지 않도록 트리/폼/트레이는 컴포넌트로 분리
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type CategoryTreeNode } from '@/lib/api/menuCategories';
import MenuTreePanel from './components/MenuTreePanel';
import CategoryFormPanel from './components/CategoryFormPanel';
import MenuItemPanel from './components/MenuItemPanel';
import UnassignedTray from './components/UnassignedTray';
import { useMenuTreeStore } from '@/stores/menuTreeStore';

type Selection =
  | { kind: 'none' }
  | { kind: 'new-category' }
  | { kind: 'category'; code: string }
  | { kind: 'menu'; menuCode: string };

export default function MenuCategoryAdminPage() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const invalidate = useMenuTreeStore((s) => s.invalidate);

  const refresh = async () => {
    const [t1, u1] = await Promise.all([
      menuCategoriesApi.tree(),
      menuCategoriesApi.unassigned(),
    ]);
    setTree(t1);
    setUnassigned(u1);
    await invalidate();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
        <h1 className="text-lg font-semibold text-text">{t('menuCategoryAdmin.title')}</h1>
        <button
          className="px-3 py-1.5 rounded-[var(--radius)] bg-primary text-white text-sm font-medium hover:opacity-90"
          onClick={() => setSelection({ kind: 'new-category' })}
        >
          + {t('menuCategoryAdmin.addCategory')}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-auto p-4 border-r border-border">
          <MenuTreePanel
            tree={tree}
            onChange={refresh}
            onSelectCategory={(code) => setSelection({ kind: 'category', code })}
            onSelectMenu={(menuCode) => setSelection({ kind: 'menu', menuCode })}
          />
          <div className="mt-6">
            <UnassignedTray unassigned={unassigned} tree={tree} onChange={refresh} />
          </div>
        </div>

        <aside className="w-[380px] min-h-0 overflow-auto p-4 bg-background">
          {selection.kind === 'none' && (
            <div className="text-sm text-text-muted">{t('menuCategoryAdmin.selectHint') || ''}</div>
          )}
          {selection.kind === 'new-category' && (
            <CategoryFormPanel
              key="new"
              mode="create"
              onSaved={async () => { setSelection({ kind: 'none' }); await refresh(); }}
            />
          )}
          {selection.kind === 'category' && (
            <CategoryFormPanel
              key={selection.code}
              mode="edit"
              code={selection.code}
              onSaved={async () => { await refresh(); }}
              onDeleted={async () => { setSelection({ kind: 'none' }); await refresh(); }}
            />
          )}
          {selection.kind === 'menu' && (
            <MenuItemPanel
              key={selection.menuCode}
              menuCode={selection.menuCode}
              tree={tree}
              onChange={async () => { await refresh(); }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 12-3: MenuTreePanel — 드래그앤드롭 트리**

`components/MenuTreePanel.tsx`:

```tsx
"use client";
/**
 * @file MenuTreePanel — 카테고리 + 메뉴 트리, dnd-kit로 순서/소속 변경
 *
 * 초보자 가이드:
 * - 카테고리 ↕ 카테고리: reorderCategories
 * - 메뉴 → 다른 카테고리: moveItem
 * - 미배치 ↔ 카테고리는 UnassignedTray에서 처리
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { menuCategoriesApi, type CategoryTreeNode } from '@/lib/api/menuCategories';

interface Props {
  tree: CategoryTreeNode[];
  onChange: () => Promise<void> | void;
  onSelectCategory: (code: string) => void;
  onSelectMenu: (menuCode: string) => void;
}

function SortableRow({ id, children, onClick }: { id: string; children: React.ReactNode; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <span {...attributes} {...listeners} className="cursor-grab text-text-muted select-none" aria-label="drag handle">⋮⋮</span>
      <button className="flex-1 text-left py-1.5 px-2 hover:bg-surface rounded-[var(--radius)] text-sm text-text" onClick={onClick}>
        {children}
      </button>
    </div>
  );
}

export default function MenuTreePanel({ tree, onChange, onSelectCategory, onSelectMenu }: Props) {
  const { t } = useTranslation();
  const sorted = useMemo(() => tree.slice().sort((a, b) => a.sortOrder - b.sortOrder), [tree]);
  const categoryIds = sorted.map((c) => `cat:${c.categoryCode}`);

  const onCategoriesDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = categoryIds.indexOf(active.id as string);
    const newIndex = categoryIds.indexOf(over.id as string);
    const next = arrayMove(sorted, oldIndex, newIndex);
    const payload = next.map((c, idx) => ({ code: c.categoryCode, sortOrder: (idx + 1) * 10 }));
    await menuCategoriesApi.reorderCategories(payload);
    await onChange();
  };

  const onItemsDragEnd = async (categoryCode: string, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const cat = sorted.find((c) => c.categoryCode === categoryCode);
    if (!cat) return;
    const items = cat.menus.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const ids = items.map((m) => `menu:${categoryCode}:${m.menuCode}`);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const next = arrayMove(items, oldIndex, newIndex);
    const payload = next.map((m, idx) => ({ menuCode: m.menuCode, sortOrder: (idx + 1) * 10 }));
    await menuCategoriesApi.reorderItems(categoryCode, payload);
    await onChange();
  };

  return (
    <div className="space-y-2">
      <DndContext collisionDetection={closestCenter} onDragEnd={onCategoriesDragEnd}>
        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
          {sorted.map((c) => (
            <div key={c.categoryCode} className="border border-border rounded-[var(--radius)] p-2 bg-surface">
              <SortableRow id={`cat:${c.categoryCode}`} onClick={() => onSelectCategory(c.categoryCode)}>
                <span className="font-medium">{t(c.labelKey)}</span>
                <span className="ml-2 text-xs text-text-muted">({c.categoryCode})</span>
              </SortableRow>

              <div className="mt-1 ml-6 pl-3 border-l border-border">
                <DndContext collisionDetection={closestCenter} onDragEnd={(e) => onItemsDragEnd(c.categoryCode, e)}>
                  <SortableContext
                    items={c.menus.map((m) => `menu:${c.categoryCode}:${m.menuCode}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {c.menus.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                      <SortableRow
                        key={m.menuCode}
                        id={`menu:${c.categoryCode}:${m.menuCode}`}
                        onClick={() => onSelectMenu(m.menuCode)}
                      >
                        <span className="text-sm">{m.menuCode}</span>
                      </SortableRow>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 12-4: CategoryFormPanel — 카테고리 신규/수정/삭제**

`components/CategoryFormPanel.tsx`:

```tsx
"use client";
/**
 * @file CategoryFormPanel — 카테고리 신규/수정 폼, 삭제 버튼 포함
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type MenuCategoryRow } from '@/lib/api/menuCategories';

type Mode = 'create' | 'edit';
interface Props {
  mode: Mode;
  code?: string;
  onSaved: () => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
}

const RESERVED = '__ROOT__';

export default function CategoryFormPanel({ mode, code, onSaved, onDeleted }: Props) {
  const { t } = useTranslation();
  const [row, setRow] = useState<MenuCategoryRow | null>(null);
  const [form, setForm] = useState({ code: '', labelKey: '', iconName: '', isActive: 'Y' as 'Y' | 'N', sortOrder: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && code) {
      menuCategoriesApi.list().then((rows) => {
        const r = rows.find((x) => x.categoryCode === code) ?? null;
        setRow(r);
        if (r) setForm({ code: r.categoryCode, labelKey: r.labelKey, iconName: r.iconName ?? '', isActive: r.isActive, sortOrder: r.sortOrder });
      });
    }
  }, [mode, code]);

  const isRoot = code === RESERVED;
  const submit = async () => {
    setError(null);
    try {
      if (mode === 'create') {
        await menuCategoriesApi.create({ code: form.code, labelKey: form.labelKey, iconName: form.iconName || undefined });
      } else if (mode === 'edit' && code) {
        await menuCategoriesApi.update(code, {
          labelKey: form.labelKey,
          iconName: form.iconName === '' ? null : form.iconName,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
      }
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  const remove = async () => {
    if (!code) return;
    setError(null);
    try {
      await menuCategoriesApi.delete(code);
      await onDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text">{mode === 'create' ? t('menuCategoryAdmin.addCategory') : t('menuCategoryAdmin.editCategory') || 'Edit'}</h3>

      <div>
        <label className="text-xs text-text-muted">code</label>
        <input
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={form.code}
          disabled={mode === 'edit'}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        />
      </div>
      <div>
        <label className="text-xs text-text-muted">labelKey</label>
        <input
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={form.labelKey}
          disabled={isRoot}
          onChange={(e) => setForm({ ...form, labelKey: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-text-muted">iconName (lucide-react)</label>
        <input
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={form.iconName}
          disabled={isRoot}
          onChange={(e) => setForm({ ...form, iconName: e.target.value })}
        />
      </div>
      {mode === 'edit' && !isRoot && (
        <div>
          <label className="text-xs text-text-muted">isActive</label>
          <select
            className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
            value={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.value as 'Y' | 'N' })}
          >
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
      )}
      {mode === 'edit' && (
        <div>
          <label className="text-xs text-text-muted">sortOrder</label>
          <input
            type="number"
            className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      )}

      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}

      <div className="flex gap-2 pt-2">
        <button className="px-3 py-1.5 rounded-[var(--radius)] bg-primary text-white text-sm font-medium" onClick={submit}>저장</button>
        {mode === 'edit' && !isRoot && row && (
          <button className="px-3 py-1.5 rounded-[var(--radius)] border border-border text-sm font-medium hover:bg-background" onClick={remove}>삭제</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 12-5: MenuItemPanel — 메뉴(leaf) 정보 표시 + 소속 변경**

`components/MenuItemPanel.tsx`:

```tsx
"use client";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type CategoryTreeNode } from '@/lib/api/menuCategories';

interface Props {
  menuCode: string;
  tree: CategoryTreeNode[];
  onChange: () => Promise<void> | void;
}

export default function MenuItemPanel({ menuCode, tree, onChange }: Props) {
  const { t } = useTranslation();
  const current = tree.find((c) => c.menus.some((m) => m.menuCode === menuCode));
  const [targetCategory, setTargetCategory] = useState(current?.categoryCode ?? '');

  const apply = async () => {
    await menuCategoriesApi.moveItem({ menuCode, toCategoryCode: targetCategory, sortOrder: 9999 });
    await onChange();
  };
  const unassign = async () => {
    await menuCategoriesApi.unassign(menuCode);
    await onChange();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text">메뉴 정보</h3>
      <div className="text-xs text-text-muted">menuCode</div>
      <div className="text-sm text-text">{menuCode}</div>
      <div className="text-xs text-text-muted mt-2">현재 카테고리</div>
      <div className="text-sm text-text">{current?.categoryCode ?? '(미배치)'}</div>

      <div className="pt-2">
        <label className="text-xs text-text-muted">이동할 카테고리</label>
        <select
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={targetCategory}
          onChange={(e) => setTargetCategory(e.target.value)}
        >
          <option value="">선택...</option>
          {tree.map((c) => (
            <option key={c.categoryCode} value={c.categoryCode}>{c.categoryCode}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-text-muted pt-2">
        이 메뉴는 코드(<code>menuConfig.ts</code>)에 정의되어 있어 라벨/경로는 코드에서만 변경할 수 있습니다.
      </div>

      <div className="flex gap-2 pt-2">
        <button className="px-3 py-1.5 rounded-[var(--radius)] bg-primary text-white text-sm font-medium" onClick={apply} disabled={!targetCategory}>이동</button>
        <button className="px-3 py-1.5 rounded-[var(--radius)] border border-border text-sm font-medium hover:bg-background" onClick={unassign}>미배치로 보내기</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 12-6: UnassignedTray — 미배치 메뉴 영역**

`components/UnassignedTray.tsx`:

```tsx
"use client";
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type CategoryTreeNode } from '@/lib/api/menuCategories';

interface Props {
  unassigned: string[];
  tree: CategoryTreeNode[];
  onChange: () => Promise<void> | void;
}

export default function UnassignedTray({ unassigned, tree, onChange }: Props) {
  const { t } = useTranslation();
  if (unassigned.length === 0) return null;
  return (
    <div className="border border-dashed border-border rounded-[var(--radius)] p-3 bg-surface">
      <h3 className="text-sm font-semibold text-text mb-2">📋 {t('menuCategoryAdmin.unassigned')} ({unassigned.length})</h3>
      <ul className="space-y-1">
        {unassigned.map((code) => (
          <li key={code} className="flex items-center justify-between gap-2 py-1 px-2 hover:bg-background rounded-[var(--radius)]">
            <span className="text-sm text-text">{code}</span>
            <select
              className="text-xs px-1 py-0.5 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
              defaultValue=""
              onChange={async (e) => {
                const v = e.target.value;
                if (!v) return;
                await menuCategoriesApi.moveItem({ menuCode: code, toCategoryCode: v, sortOrder: 9999 });
                await onChange();
              }}
            >
              <option value="">카테고리 선택</option>
              {tree.map((c) => (
                <option key={c.categoryCode} value={c.categoryCode}>{c.categoryCode}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 12-7: 빌드 확인 + 커밋**

```bash
pnpm --filter frontend build
git add apps/frontend/package.json apps/frontend/src/app/(authenticated)/system/menu-categories pnpm-lock.yaml
git commit -m "feat(menu-category): 관리 화면 — DnD 트리 + FormPanel 하이브리드"
```

---

## Task 13: Sidebar.tsx 머지된 트리 연동

**Files:**
- Modify: `apps/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 13-1: Sidebar에서 menuTreeStore 사용 + 코드 menuConfig fallback**

`apps/frontend/src/components/layout/Sidebar.tsx`를 다음과 같이 수정:

```tsx
"use client";
/**
 * @file src/components/layout/Sidebar.tsx
 * @description 사이드바 네비게이션 — DB 머지된 트리 + 코드 fallback
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Folder, LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
} from "lucide-react";
import { menuConfig, type MenuConfigItem } from "@/config/menuConfig";
import { useAuthStore } from "@/stores/authStore";
import { useMenuTreeStore } from "@/stores/menuTreeStore";
import SidebarMenu from "./SidebarMenu";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
};

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { user, allowedMenus } = useAuthStore();
  const groups = useMenuTreeStore((s) => s.groups);
  const loadTree = useMenuTreeStore((s) => s.load);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["DASHBOARD"]);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => { if (!groups) loadTree(); }, [groups, loadTree]);

  /** DB 머지된 트리를 SidebarMenu가 받는 MenuConfigItem 형식으로 변환. groups가 null이면 코드 menuConfig 사용. */
  const items: MenuConfigItem[] = useMemo(() => {
    if (!groups) return menuConfig;
    const leafLookup = new Map<string, MenuConfigItem>();
    const walk = (arr: MenuConfigItem[]) => {
      for (const x of arr) {
        if (x.path) leafLookup.set(x.code, x);
        if (x.children) walk(x.children);
      }
    };
    walk(menuConfig);

    const result: MenuConfigItem[] = [];
    for (const g of groups) {
      const childrenLeaf = g.children
        .map((c) => leafLookup.get(c.code))
        .filter((x): x is MenuConfigItem => !!x);

      if (g.categoryCode === '__ROOT__') {
        // 단독 메뉴 — 평탄화하여 최상위에 배치
        for (const leaf of childrenLeaf) {
          result.push({
            ...leaf,
            icon: ICON_MAP[g.iconName || ''] ?? leaf.icon ?? Folder, // 단독 메뉴는 leaf에 정의된 아이콘이 없을 수 있어 보조
          });
        }
        continue;
      }
      result.push({
        code: g.categoryCode,
        labelKey: g.labelKey,
        icon: ICON_MAP[g.iconName || ''] ?? Folder,
        children: childrenLeaf,
      });
    }
    return result;
  }, [groups]);

  const toggleMenu = (menuCode: string) => {
    if (collapsed) return;
    setExpandedMenus((prev) =>
      prev.includes(menuCode) ? prev.filter((c) => c !== menuCode) : [...prev, menuCode]
    );
  };

  const isMenuActive = (item: MenuConfigItem) => {
    if (item.path) return pathname === item.path;
    return item.children?.some((child) => pathname === child.path);
  };

  const isMenuDisabled = useCallback(
    (item: MenuConfigItem): boolean => {
      if (isAdmin) return false;
      if (item.children) return !item.children.some((child) => allowedMenus.includes(child.code));
      return !allowedMenus.includes(item.code);
    },
    [isAdmin, allowedMenus],
  );

  const sidebarWidth = collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed top-[var(--header-height)] left-0 z-30 h-[calc(100vh-var(--header-height))] bg-surface border-r border-border overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: sidebarWidth }}
      >
        <nav className="p-3">
          <SidebarMenu
            items={items}
            collapsed={collapsed}
            pathname={pathname}
            expandedMenus={expandedMenus}
            onToggleMenu={toggleMenu}
            isMenuActive={isMenuActive}
            isMenuDisabled={isMenuDisabled}
            onClose={onClose}
            t={t}
          />
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
```

- [ ] **Step 13-2: 빌드 + 사이드바 시각 회귀 확인**

Run: `pnpm --filter frontend build`
Expected: 0 에러

수동: 개발 서버(포트 3002) 새로고침 → 사이드바가 기존과 시각적으로 동일한지 확인. 시드 후 첫 렌더 시 fallback(코드 menuConfig) → API 응답 도착 후 머지 트리로 교체된다.

- [ ] **Step 13-3: 커밋**

```bash
git add apps/frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(menu-category): Sidebar에 머지된 DB 트리 연동 + 코드 fallback"
```

---

## Task 14: 통합 검증

**Files:** (검증 단계, 코드 변경 없음. 결과에 따라 fix-up 커밋 발생 가능.)

- [ ] **Step 14-1: 백엔드 풀 테스트**

Run: `pnpm --filter backend test`
Expected: 새로 작성한 spec 포함 전체 PASS

- [ ] **Step 14-2: 백엔드 빌드**

Run: `pnpm --filter backend build`
Expected: 0 에러

- [ ] **Step 14-3: 프론트엔드 빌드**

Run: `pnpm --filter frontend build`
Expected: 0 에러

- [ ] **Step 14-4: API 수동 검증 (백엔드 dev 서버 가동 중 가정)**

각 curl은 사용자 ADMIN 토큰 헤더 포함. 토큰 발급은 기존 로그인 흐름 사용.

```bash
# tree 응답 구조
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/menu-categories/tree | head -200

# 카테고리 생성
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"TEST_CAT","labelKey":"menu.test"}' \
  http://localhost:3001/menu-categories

# 메뉴 이동
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"menuCode":"MST_PART","toCategoryCode":"TEST_CAT","sortOrder":10}' \
  http://localhost:3001/menu-category-items/move

# 빈 카테고리 삭제 → 200
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3001/menu-categories/TEST_CAT
# (TEST_CAT에 메뉴가 들어있는 상태로 다시 시도하면 409 한국어 메시지)
```

기대값:
- tree 응답: 카테고리 + 메뉴 코드/순서 배열
- 메뉴 이동 후 다시 tree 조회 시 위치 변경 반영
- 빈 카테고리 삭제는 200, 차있는 카테고리 삭제는 409 + 한국어 메시지

- [ ] **Step 14-5: 권한 가드 수동 확인**

비-ADMIN 토큰으로 `/menu-categories` POST 호출 → 403 또는 권한 거부 응답인지 확인.
(현재 컨트롤러는 글로벌 JwtAuthGuard만 적용. 추가 권한 가드가 필요하다면 `@MenuCode('SYS_MENU_CATEGORY')`를 클래스 레벨에 적용. 이때 다른 master 컨트롤러 패턴 참고.)

- [ ] **Step 14-6: 시각적 회귀 — 사이드바**

브라우저에서 사이드바를 시드 적용 전/후로 비교한 캡처를 확인:
- 카테고리 순서 동일
- 카테고리 아이콘 동일
- 카테고리별 자식 메뉴 순서 동일
- DASHBOARD/WORKFLOW가 최상위에 표시
- 다크/라이트 모드 모두 정상

차이가 발견되면 `MENU_CATEGORIES.SORT_ORDER` 또는 `MENU_CATEGORY_ITEMS.SORT_ORDER`를 조정하고 재검증.

- [ ] **Step 14-7: 워크플로우 문서 작성**

`docs/standards/menu-add-workflow.md`:

```markdown
# 새 페이지/메뉴 추가 워크플로우

좌측 사이드바에 새 메뉴 항목을 추가할 때 반드시 다음 6단계를 모두 수행한다.

1. 페이지 라우트 파일 생성 — `apps/frontend/src/app/(authenticated)/.../page.tsx`
2. `apps/frontend/src/config/menuConfig.ts`의 적절한 카테고리 children에 leaf 추가
   ```ts
   { code: 'NEW_MENU_CODE', labelKey: 'menu.xxx.newPage', path: '/xxx/new-page' }
   ```
3. `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`의 `KNOWN_LEAF_CODES`에 코드 추가
4. i18n 4파일에 `labelKey` 라벨 추가 — `apps/frontend/src/locales/{ko,en,zh,vi}.json`
5. 마이그레이션 SQL 한 줄 추가 (JSHANES 적용):
   ```sql
   INSERT INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
   VALUES ('NEW_MENU_CODE', 'MASTER', 160, 'HANES', '-', SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system');
   ```
6. `apps/backend/src/seeds/menu-config.json`의 해당 카테고리 children에 코드 추가 → `seed-roles` 재실행하여 역할 권한 부여
7. `pnpm build` 통과 후 PR
```

- [ ] **Step 14-8: 최종 커밋**

```bash
git add docs/standards/menu-add-workflow.md
git commit -m "docs(menu-category): 새 페이지 추가 워크플로우 문서 추가"
```

---

## 자가 점검 결과

### 스펙 커버리지

| 스펙 섹션 | 구현 Task |
|---|---|
| 2.1 결정 사항 모음 | 전 Task |
| 3.1/3.2 데이터 모델 | Task 1, 2, 8 |
| 3.3 정합성 규칙 (__ROOT__, 미배치 정의) | Task 4, 5, 8 |
| 4 렌더링 흐름 | Task 11, 13 |
| 5.1~5.6 API/검증/캐싱/권한 | Task 3, 4, 5, 6, 7, 14 |
| 6.1~6.5 관리 화면 UI | Task 9, 10, 12 |
| 7.1~7.4 마이그레이션/시드/워크플로우 | Task 1, 8, 14 |
| 8.1~8.4 검증 기준 | Task 4, 5, 14 |
| 9 위험·완화 | Task 7(가드), 12(dnd-kit), 13(fallback) |

### Placeholder 스캔

- 모든 step은 실제 코드/SQL/명령어를 포함한다.
- "TBD/TODO/implement later" 없음.
- 캐싱(`인메모리 캐시 TTL 60초`)은 1차 구현에서 생략하고 후속 PR로 이관 권고 — 본 plan에서는 명시적으로 다루지 않으며, 필요 시 NestJS `CacheInterceptor` 적용 PR 추가.

### 타입 일관성

- `categoryCode/menuCode/sortOrder/labelKey/iconName` — 백엔드 엔티티/DTO/API 클라이언트/store 전 영역에서 동일 명명.
- `RESERVED_ROOT = '__ROOT__'` — 백엔드 DTO/Service와 프론트 store/Sidebar에서 동일 값 사용.

---

## 실행 옵션

Plan이 완료되어 `docs/plans/2026-05-18-menu-category-management.md`에 저장됨. 다음 두 가지 방식 중 선택:

1. **Subagent-Driven (권장)** — 각 Task마다 독립 subagent 디스패치, 사이사이 리뷰
2. **Inline Execution** — 현재 세션에서 Task 단위 실행 + 체크포인트

오빠는 어느 방식으로 진행할까?
