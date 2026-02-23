# RBAC 역할/권한 관리 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 역할 기반 메뉴 접근 제어 시스템 구현 (하이브리드: 메뉴는 코드, 역할/권한은 DB)

**Architecture:** 메뉴 정의는 `menuConfig.ts`에 코드로 관리하고, 역할(ROLES)과 역할-메뉴 매핑(ROLE_MENU_PERMISSIONS)은 DB에 저장. 로그인 시 `/api/auth/me`가 허용 메뉴 목록을 반환하면, 프론트엔드에서 사이드바 비활성화 + URL 직접 접근 차단으로 제어.

**Tech Stack:** NestJS, TypeORM, Zustand, Next.js, Tailwind CSS, lucide-react

---

## Task 1: 메뉴 설정 파일 추출 (menuConfig.ts)

**Files:**
- Create: `apps/frontend/src/config/menuConfig.ts`

**Step 1: menuConfig.ts 생성**

사이드바의 `menuItems` 배열을 별도 config 파일로 추출. 각 메뉴 항목에 고유 `code`를 부여.

```ts
/**
 * @file menuConfig.ts
 * @description 전체 메뉴 구조 정의. 사이드바 렌더링 + 권한 관리에 사용.
 * code: 권한 매핑에 사용되는 고유 식별자 (DB ROLE_MENU_PERMISSIONS.menuCode와 매칭)
 * labelKey: i18n 번역 키
 * path: 라우트 경로 (null이면 그룹 메뉴)
 */
import {
  LayoutDashboard, Monitor, Database, Warehouse, ClipboardCheck,
  Package, ShoppingCart, Factory, ScanLine, Shield, Wrench,
  Truck, FileBox, Cog, Building2, ArrowLeftRight, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuConfigItem {
  code: string;
  labelKey: string;
  path?: string;
  icon?: LucideIcon;
  children?: MenuConfigItem[];
}

export const menuConfig: MenuConfigItem[] = [
  { code: "DASHBOARD", labelKey: "menu.dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    code: "MONITORING", labelKey: "menu.monitoring", icon: Monitor,
    children: [
      { code: "MON_EQUIP_STATUS", labelKey: "menu.equipment.status", path: "/equipment/status" },
    ],
  },
  {
    code: "MASTER", labelKey: "menu.master", icon: Database,
    children: [
      { code: "MST_PART", labelKey: "menu.master.part", path: "/master/part" },
      { code: "MST_BOM", labelKey: "menu.master.bom", path: "/master/bom" },
      { code: "MST_PARTNER", labelKey: "menu.master.partner", path: "/master/partner" },
      { code: "MST_PROD_LINE", labelKey: "menu.master.prodLine", path: "/master/prod-line" },
      { code: "MST_WORKER", labelKey: "menu.master.worker", path: "/master/worker" },
      { code: "MST_WORK_INST", labelKey: "menu.master.workInstruction", path: "/master/work-instruction" },
      { code: "MST_WAREHOUSE", labelKey: "menu.master.warehouse", path: "/master/warehouse" },
      { code: "MST_LABEL", labelKey: "menu.master.label", path: "/master/label" },
      { code: "MST_VENDOR_BARCODE", labelKey: "menu.master.vendorBarcode", path: "/master/vendor-barcode" },
    ],
  },
  // ... (현재 Sidebar.tsx의 모든 메뉴 항목을 code 부여하여 이전)
  {
    code: "SYSTEM", labelKey: "menu.system", icon: UserCog,
    children: [
      { code: "SYS_COMPANY", labelKey: "menu.master.company", path: "/master/company" },
      { code: "SYS_USER", labelKey: "menu.system.users", path: "/system/users" },
      { code: "SYS_ROLE", labelKey: "menu.system.roles", path: "/system/roles" },
      { code: "SYS_CONFIG", labelKey: "menu.system.config", path: "/system/config" },
      { code: "SYS_CODE", labelKey: "menu.master.code", path: "/master/code" },
    ],
  },
];

/** 모든 메뉴 코드를 플랫하게 추출 (하위 메뉴 포함) */
export function getAllMenuCodes(items: MenuConfigItem[] = menuConfig): string[] {
  return items.flatMap((item) => [
    item.code,
    ...(item.children ? getAllMenuCodes(item.children) : []),
  ]);
}

/** path로 메뉴 코드 찾기 */
export function findMenuCodeByPath(path: string, items: MenuConfigItem[] = menuConfig): string | null {
  for (const item of items) {
    if (item.path === path) return item.code;
    if (item.children) {
      const found = findMenuCodeByPath(path, item.children);
      if (found) return found;
    }
  }
  return null;
}

/** 부모 메뉴 코드 찾기 (하위 메뉴 코드가 허용되면 부모도 표시해야 함) */
export function getParentCodes(allowedCodes: string[], items: MenuConfigItem[] = menuConfig): string[] {
  const result = new Set<string>();
  for (const item of items) {
    if (item.children) {
      const hasAllowedChild = item.children.some((child) => allowedCodes.includes(child.code));
      if (hasAllowedChild || allowedCodes.includes(item.code)) {
        result.add(item.code);
      }
    }
  }
  return [...result];
}
```

**Step 2: Sidebar.tsx에서 menuConfig import로 변경**

`Sidebar.tsx`에서 기존 `menuItems` 배열을 제거하고 `menuConfig`를 import.
기존 `MenuItem` 타입을 `MenuConfigItem`으로 교체.
`id` → `code`, `labelKey` 유지, `path`/`icon`/`children` 동일.

**Step 3: Commit**

```bash
git add apps/frontend/src/config/menuConfig.ts apps/frontend/src/components/layout/Sidebar.tsx
git commit -m "refactor: extract menu config to menuConfig.ts with unique codes for RBAC"
```

---

## Task 2: 백엔드 엔티티 생성 (Role, RoleMenuPermission)

**Files:**
- Create: `apps/backend/src/entities/role.entity.ts`
- Create: `apps/backend/src/entities/role-menu-permission.entity.ts`

**Step 1: Role 엔티티 생성**

기존 `user.entity.ts` 패턴을 따름. 테이블명 대문자, 컬럼명 대문자, softDelete 지원.

```ts
/**
 * @file role.entity.ts
 * @description 역할 정의 엔티티. 사용자에게 할당되며 메뉴 접근 권한을 결정.
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn, Index, OneToMany,
} from "typeorm";
import { RoleMenuPermission } from "./role-menu-permission.entity";

@Entity({ name: "ROLES" })
@Index(["code"], { unique: true })
export class Role {
  @PrimaryGeneratedColumn("uuid", { name: "ID" })
  id: string;

  @Column({ name: "CODE", length: 50 })
  code: string;

  @Column({ name: "NAME", length: 100 })
  name: string;

  @Column({ name: "DESCRIPTION", length: 500, nullable: true })
  description: string | null;

  @Column({ name: "IS_SYSTEM", type: "boolean", default: false })
  isSystem: boolean;

  @Column({ name: "SORT_ORDER", type: "int", default: 0 })
  sortOrder: number;

  @Column({ name: "COMPANY", length: 50, nullable: true })
  company: string | null;

  @Column({ name: "PLANT_CD", length: 50, nullable: true })
  plant: string | null;

  @Column({ name: "CREATED_BY", length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: "UPDATED_BY", length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: "CREATED_AT", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "UPDATED_AT", type: "timestamp" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "DELETED_AT", type: "timestamp", nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => RoleMenuPermission, (p) => p.role)
  permissions: RoleMenuPermission[];
}
```

**Step 2: RoleMenuPermission 엔티티 생성**

```ts
/**
 * @file role-menu-permission.entity.ts
 * @description 역할-메뉴 접근 권한 매핑 엔티티.
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from "typeorm";
import { Role } from "./role.entity";

@Entity({ name: "ROLE_MENU_PERMISSIONS" })
@Index(["roleId", "menuCode"], { unique: true })
export class RoleMenuPermission {
  @PrimaryGeneratedColumn("uuid", { name: "ID" })
  id: string;

  @Column({ name: "ROLE_ID", type: "uuid" })
  roleId: string;

  @Column({ name: "MENU_CODE", length: 50 })
  menuCode: string;

  @Column({ name: "CAN_ACCESS", type: "boolean", default: true })
  canAccess: boolean;

  @CreateDateColumn({ name: "CREATED_AT", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "UPDATED_AT", type: "timestamp" })
  updatedAt: Date;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ROLE_ID" })
  role: Role;
}
```

**Step 3: Commit**

```bash
git add apps/backend/src/entities/role.entity.ts apps/backend/src/entities/role-menu-permission.entity.ts
git commit -m "feat: add Role and RoleMenuPermission entities for RBAC"
```

---

## Task 3: 백엔드 DTO 생성

**Files:**
- Create: `apps/backend/src/modules/role/role.dto.ts`

**Step 1: DTO 작성**

기존 `user.dto.ts` 패턴을 따름. class-validator + Swagger 데코레이터.

```ts
/**
 * @file role.dto.ts
 * @description 역할 관리 DTO 정의
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsArray, MaxLength, IsInt, Min,
} from "class-validator";

export class CreateRoleDto {
  @ApiProperty({ description: "역할 코드 (영문 대문자, 언더스코어)", example: "LINE_LEADER" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: "역할 이름", example: "라인 리더" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: "역할 설명" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "정렬 순서", default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: "역할 이름" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: "역할 설명" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "정렬 순서" })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePermissionsDto {
  @ApiProperty({
    description: "메뉴 코드 목록 (접근 허용할 메뉴들)",
    example: ["DASHBOARD", "PRODUCTION", "PROD_ORDER"],
  })
  @IsArray()
  @IsString({ each: true })
  menuCodes: string[];
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/role/role.dto.ts
git commit -m "feat: add Role DTOs for RBAC"
```

---

## Task 4: 백엔드 Role 서비스

**Files:**
- Create: `apps/backend/src/modules/role/role.service.ts`

**Step 1: 서비스 작성**

기존 `user.service.ts` 패턴을 따름. Repository 주입, Logger, 에러 처리.

```ts
/**
 * @file role.service.ts
 * @description 역할 CRUD + 메뉴 권한 매핑 서비스
 */
import {
  Injectable, Logger, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, In } from "typeorm";
import { Role } from "../../entities/role.entity";
import { RoleMenuPermission } from "../../entities/role-menu-permission.entity";
import { CreateRoleDto, UpdateRoleDto, UpdatePermissionsDto } from "./role.dto";

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RoleMenuPermission)
    private readonly permissionRepository: Repository<RoleMenuPermission>,
  ) {}

  /** 역할 목록 조회 */
  async findAll(company?: string) {
    const where: Record<string, unknown> = { deletedAt: IsNull() };
    if (company) where.company = company;

    return this.roleRepository.find({
      where,
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /** 역할 상세 조회 */
  async findOne(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!role) throw new NotFoundException("역할을 찾을 수 없습니다.");
    return role;
  }

  /** 역할 생성 */
  async create(dto: CreateRoleDto, company?: string, userId?: string) {
    const existing = await this.roleRepository.findOne({
      where: { code: dto.code, deletedAt: IsNull() },
    });
    if (existing) throw new ConflictException("이미 존재하는 역할 코드입니다.");

    const role = this.roleRepository.create({
      ...dto,
      company: company || null,
      createdBy: userId || null,
      updatedBy: userId || null,
    });
    const saved = await this.roleRepository.save(role);
    this.logger.log(`Role created: ${saved.code}`);
    return saved;
  }

  /** 역할 수정 */
  async update(id: string, dto: UpdateRoleDto, userId?: string) {
    const role = await this.findOne(id);
    await this.roleRepository.update(id, { ...dto, updatedBy: userId || null });
    this.logger.log(`Role updated: ${role.code}`);
    return this.findOne(id);
  }

  /** 역할 삭제 (isSystem이면 거부) */
  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new BadRequestException("시스템 기본 역할은 삭제할 수 없습니다.");
    }
    await this.roleRepository.softDelete(id);
    this.logger.log(`Role deleted: ${role.code}`);
    return { message: "역할이 삭제되었습니다." };
  }

  /** 역할의 메뉴 권한 조회 */
  async getPermissions(roleId: string): Promise<string[]> {
    await this.findOne(roleId); // 존재 확인
    const permissions = await this.permissionRepository.find({
      where: { roleId, canAccess: true },
    });
    return permissions.map((p) => p.menuCode);
  }

  /** 역할의 메뉴 권한 일괄 수정 (기존 삭제 후 새로 INSERT) */
  async updatePermissions(roleId: string, dto: UpdatePermissionsDto) {
    const role = await this.findOne(roleId);
    if (role.code === "ADMIN") {
      throw new BadRequestException("ADMIN 역할의 권한은 변경할 수 없습니다.");
    }

    // 기존 권한 삭제
    await this.permissionRepository.delete({ roleId });

    // 새 권한 INSERT
    if (dto.menuCodes.length > 0) {
      const permissions = dto.menuCodes.map((menuCode) =>
        this.permissionRepository.create({ roleId, menuCode, canAccess: true }),
      );
      await this.permissionRepository.save(permissions);
    }

    this.logger.log(`Permissions updated for role: ${role.code}, menus: ${dto.menuCodes.length}`);
    return { message: "권한이 저장되었습니다.", menuCodes: dto.menuCodes };
  }

  /** roleCode로 허용 메뉴 조회 (auth/me에서 사용) */
  async getAllowedMenusByRoleCode(roleCode: string): Promise<string[]> {
    if (roleCode === "ADMIN") return []; // ADMIN은 빈 배열 → 프론트에서 전체 허용 처리

    const role = await this.roleRepository.findOne({
      where: { code: roleCode, deletedAt: IsNull() },
    });
    if (!role) return [];

    const permissions = await this.permissionRepository.find({
      where: { roleId: role.id, canAccess: true },
    });
    return permissions.map((p) => p.menuCode);
  }
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/role/role.service.ts
git commit -m "feat: add RoleService with CRUD and permission mapping"
```

---

## Task 5: 백엔드 Role 컨트롤러

**Files:**
- Create: `apps/backend/src/modules/role/role.controller.ts`

**Step 1: 컨트롤러 작성**

기존 `user.controller.ts` 패턴. UseGuards(JwtAuthGuard), Swagger 데코레이터.

```ts
/**
 * @file role.controller.ts
 * @description 역할 관리 API 엔드포인트
 */
import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, UseGuards, Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, AuthenticatedRequest } from "../../common/guards/jwt-auth.guard";
import { Company } from "../../common/decorators/tenant.decorator";
import { RoleService } from "./role.service";
import { CreateRoleDto, UpdateRoleDto, UpdatePermissionsDto } from "./role.dto";

@ApiTags("역할")
@ApiBearerAuth()
@Controller("roles")
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: "역할 목록 조회" })
  findAll(@Company() company: string) {
    return this.roleService.findAll(company);
  }

  @Get(":id")
  @ApiOperation({ summary: "역할 상세 조회" })
  findOne(@Param("id") id: string) {
    return this.roleService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "역할 생성" })
  create(
    @Body() dto: CreateRoleDto,
    @Company() company: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.roleService.create(dto, company, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "역할 수정" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.roleService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "역할 삭제" })
  remove(@Param("id") id: string) {
    return this.roleService.remove(id);
  }

  @Get(":id/permissions")
  @ApiOperation({ summary: "역할의 메뉴 권한 조회" })
  getPermissions(@Param("id") id: string) {
    return this.roleService.getPermissions(id);
  }

  @Put(":id/permissions")
  @ApiOperation({ summary: "역할의 메뉴 권한 일괄 수정" })
  updatePermissions(
    @Param("id") id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.roleService.updatePermissions(id, dto);
  }
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/role/role.controller.ts
git commit -m "feat: add RoleController with CRUD and permission endpoints"
```

---

## Task 6: 백엔드 Role 모듈 + 앱 등록

**Files:**
- Create: `apps/backend/src/modules/role/role.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Step 1: 모듈 생성**

```ts
/**
 * @file role.module.ts
 * @description 역할 관리 모듈
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Role } from "../../entities/role.entity";
import { RoleMenuPermission } from "../../entities/role-menu-permission.entity";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";

@Module({
  imports: [TypeOrmModule.forFeature([Role, RoleMenuPermission])],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
```

**Step 2: app.module.ts에 RoleModule 등록**

`imports` 배열에 `RoleModule` 추가 (UserModule 근처에).

**Step 3: Commit**

```bash
git add apps/backend/src/modules/role/role.module.ts apps/backend/src/app.module.ts
git commit -m "feat: register RoleModule in AppModule"
```

---

## Task 7: Auth 서비스 수정 (allowedMenus 포함)

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`

**Step 1: auth.module.ts에 RoleModule import 추가**

```ts
imports: [TypeOrmModule.forFeature([User]), RoleModule],
```

**Step 2: auth.service.ts의 me() 메서드 수정**

RoleService 주입 후, me() 응답에 allowedMenus 포함.

```ts
constructor(
  @InjectRepository(User)
  private readonly userRepository: Repository<User>,
  private readonly roleService: RoleService,  // 추가
) {}

async me(userId: string) {
  const user = await this.userRepository.findOne({
    where: { id: userId },
    select: ["id", "email", "name", "role", "status", "company", "plant", "empNo", "dept", "photoUrl"],
  });

  if (!user) throw new UnauthorizedException("유효하지 않은 토큰입니다.");
  if (user.status !== "ACTIVE") throw new UnauthorizedException("비활성화된 계정입니다.");

  // 역할별 허용 메뉴 조회
  const allowedMenus = await this.roleService.getAllowedMenusByRoleCode(user.role);

  return {
    ...user,
    allowedMenus, // ADMIN이면 빈 배열 (프론트에서 전체 허용 처리)
  };
}
```

**Step 3: login() 응답에도 allowedMenus 추가**

```ts
async login(dto: LoginDto) {
  // ... 기존 로직 ...
  const allowedMenus = await this.roleService.getAllowedMenusByRoleCode(user.role);

  return {
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: dto.company || user.company || "",
    },
    allowedMenus,
  };
}
```

**Step 4: Commit**

```bash
git add apps/backend/src/modules/auth/auth.service.ts apps/backend/src/modules/auth/auth.module.ts
git commit -m "feat: include allowedMenus in auth/me and login responses"
```

---

## Task 8: 프론트엔드 authStore 수정

**Files:**
- Modify: `apps/frontend/src/stores/authStore.ts`

**Step 1: AuthState에 allowedMenus 추가**

```ts
interface AuthState {
  // ... 기존 필드 ...
  allowedMenus: string[];  // 추가: 접근 허용된 메뉴 코드 목록
}
```

**Step 2: login 액션에서 allowedMenus 저장**

```ts
login: async (email, password, company?, plant?) => {
  // ... 기존 로직 ...
  const { token, user, allowedMenus } = responseData;
  set({
    // ... 기존 필드 ...
    allowedMenus: allowedMenus || [],
  });
},
```

**Step 3: fetchMe 액션에서 allowedMenus 갱신**

```ts
fetchMe: async () => {
  // ... 기존 로직 ...
  const userData = res.data?.data ?? res.data;
  const { allowedMenus, ...userInfo } = userData;
  set({
    user: userInfo,
    allowedMenus: allowedMenus || [],
    isAuthenticated: true,
  });
},
```

**Step 4: persist partialize에 allowedMenus 포함**

```ts
partialize: (state) => ({
  // ... 기존 필드 ...
  allowedMenus: state.allowedMenus,
}),
```

**Step 5: 초기값 설정**

```ts
// 초기 상태에 추가
allowedMenus: [],
```

**Step 6: logout에서 초기화**

```ts
logout: () => {
  // ... 기존 필드 ...
  set({ allowedMenus: [] });
},
```

**Step 7: Commit**

```bash
git add apps/frontend/src/stores/authStore.ts
git commit -m "feat: add allowedMenus to authStore for RBAC"
```

---

## Task 9: Sidebar 권한 체크 적용

**Files:**
- Modify: `apps/frontend/src/components/layout/Sidebar.tsx`
- Modify: `apps/frontend/src/components/layout/SidebarMenu.tsx`

**Step 1: Sidebar.tsx 수정**

- `menuItems` 배열을 `menuConfig`에서 import
- `useAuthStore`에서 `allowedMenus`, `user.role` 가져오기
- 메뉴 렌더링 시 권한 체크 로직 추가

```tsx
import { menuConfig, type MenuConfigItem } from "@/config/menuConfig";
import { useAuthStore } from "@/stores/authStore";

// 컴포넌트 내부
const { user, allowedMenus } = useAuthStore();
const isAdmin = user?.role === "ADMIN";

/** 메뉴 접근 가능 여부 체크 */
const canAccessMenu = (item: MenuConfigItem): boolean => {
  if (isAdmin) return true; // ADMIN은 모든 메뉴 접근 가능
  if (allowedMenus.includes(item.code)) return true;
  // 하위 메뉴 중 하나라도 접근 가능하면 부모도 표시
  if (item.children?.some((child) => allowedMenus.includes(child.code))) return true;
  return false;
};

/** 메뉴 비활성화 여부 (보이지만 클릭 불가) */
const isMenuDisabled = (item: MenuConfigItem): boolean => {
  if (isAdmin) return false;
  return !allowedMenus.includes(item.code);
};
```

**Step 2: SidebarMenu.tsx에 disabled 스타일 적용**

비활성화된 메뉴:
- `opacity-40 cursor-not-allowed` 클래스 추가
- `onClick` 이벤트 무시
- 툴팁으로 "접근 권한이 없습니다" 표시

**Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/Sidebar.tsx apps/frontend/src/components/layout/SidebarMenu.tsx
git commit -m "feat: apply RBAC menu permission check in Sidebar"
```

---

## Task 10: AuthGuard URL 권한 체크

**Files:**
- Modify: `apps/frontend/src/components/layout/AuthGuard.tsx`

**Step 1: URL 접근 시 메뉴 권한 체크 추가**

```tsx
import { findMenuCodeByPath } from "@/config/menuConfig";

// 컴포넌트 내부
const { isAuthenticated, user, allowedMenus } = useAuthStore();
const isAdmin = user?.role === "ADMIN";

// 메뉴 권한 체크
const menuCode = findMenuCodeByPath(pathname);
const hasPermission = isAdmin || !menuCode || allowedMenus.includes(menuCode);

// 권한 없으면 접근 거부 페이지 표시
if (hydrated && isAuthenticated && !hasPermission) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <ShieldX className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">{t("auth.noPermission")}</h2>
      <p className="text-muted-foreground mb-4">{t("auth.noPermissionDesc")}</p>
      <button onClick={() => router.push("/dashboard")}>{t("common.goHome")}</button>
    </div>
  );
}
```

**Step 2: i18n 키 추가 (4개 언어)**

```json
// ko.json
"auth": {
  "noPermission": "접근 권한이 없습니다",
  "noPermissionDesc": "이 페이지에 대한 접근 권한이 없습니다. 관리자에게 문의하세요."
}

// en.json
"auth": {
  "noPermission": "Access Denied",
  "noPermissionDesc": "You do not have permission to access this page. Please contact your administrator."
}

// zh.json, vi.json도 동일하게 추가
```

**Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/AuthGuard.tsx apps/frontend/src/locales/*.json
git commit -m "feat: add URL-based permission check in AuthGuard"
```

---

## Task 11: 역할 관리 페이지 (프론트엔드)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/roles/page.tsx`

**Step 1: 페이지 구현**

좌측: 역할 목록 (DataGrid 또는 리스트), 우측: 메뉴 권한 트리 체크박스.

**레이아웃:**
```
┌─────────────────────────────────────────────────────┐
│  역할 관리                           [+ 역할 추가]   │
├────────────┬────────────────────────────────────────┤
│ 역할 목록   │  메뉴 권한 설정 (선택된 역할명)          │
│            │                                        │
│ [ADMIN]    │  ☑ 대시보드                             │
│ [MANAGER]  │  ☑ 모니터링                             │
│ [OPERATOR] │    ☑ 설비 상태                          │
│ [VIEWER]   │  ☐ 기준정보                             │
│            │    ☐ BOM 관리                           │
│            │    ☐ ...                                │
│            │                                        │
│ [수정][삭제]│             [저장] [초기화]              │
└────────────┴────────────────────────────────────────┘
```

**주요 기능:**
- 역할 목록: API `GET /api/roles` 조회
- 역할 선택 시: `GET /api/roles/:id/permissions`로 허용 메뉴 조회
- 메뉴 트리: `menuConfig`에서 렌더링, 체크박스로 권한 토글
- 저장: `PUT /api/roles/:id/permissions` 호출
- ADMIN 선택 시: 모든 체크박스 체크 + disabled (수정 불가)
- 역할 추가 모달: code, name, description 입력
- 역할 삭제: isSystem이면 삭제 버튼 숨김

**체크박스 트리 로직:**
- 부모 메뉴 체크 → 모든 하위 메뉴 자동 체크
- 부모 메뉴 체크 해제 → 모든 하위 메뉴 자동 해제
- 하위 메뉴 일부만 체크 → 부모는 indeterminate 상태

**Step 2: i18n 키 추가 (4개 언어)**

```json
// ko.json
"menu": { "system": { "roles": "역할 관리" } },
"role": {
  "title": "역할 관리",
  "addRole": "역할 추가",
  "editRole": "역할 수정",
  "deleteRole": "역할 삭제",
  "code": "역할 코드",
  "name": "역할 이름",
  "description": "설명",
  "isSystem": "시스템 역할",
  "menuPermissions": "메뉴 권한 설정",
  "selectRole": "좌측에서 역할을 선택하세요",
  "savePermissions": "권한 저장",
  "resetPermissions": "초기화",
  "adminAllAccess": "관리자는 모든 메뉴에 접근할 수 있습니다",
  "cannotDeleteSystem": "시스템 기본 역할은 삭제할 수 없습니다",
  "permissionsSaved": "권한이 저장되었습니다",
  "confirmDelete": "이 역할을 삭제하시겠습니까?"
}
```

**Step 3: Commit**

```bash
git add apps/frontend/src/app/(authenticated)/system/roles/page.tsx apps/frontend/src/locales/*.json
git commit -m "feat: add role management page with menu permission tree"
```

---

## Task 12: 시드 데이터 (기본 역할 + ADMIN 권한)

**Files:**
- Create: `apps/backend/src/seeds/seed-roles.ts` (또는 기존 시드 파일에 추가)

**Step 1: 시드 스크립트 작성**

기본 4개 역할(ADMIN, MANAGER, OPERATOR, VIEWER) INSERT.
ADMIN은 권한 매핑 없음 (코드에서 전체 허용).
MANAGER/OPERATOR/VIEWER는 적절한 기본 메뉴 매핑.

```ts
// 기본 역할 시드
const roles = [
  { code: "ADMIN", name: "관리자", description: "전체 시스템 관리 권한", isSystem: true, sortOrder: 1 },
  { code: "MANAGER", name: "관리자급", description: "대부분의 메뉴 접근 가능", isSystem: true, sortOrder: 2 },
  { code: "OPERATOR", name: "작업자", description: "생산/작업 관련 메뉴만 접근", isSystem: true, sortOrder: 3 },
  { code: "VIEWER", name: "조회자", description: "조회만 가능", isSystem: true, sortOrder: 4 },
];

// MANAGER 기본 권한: 시스템 관리 제외 전체
// OPERATOR 기본 권한: 대시보드 + 생산 + 품질 + 설비
// VIEWER 기본 권한: 대시보드만
```

**Step 2: TypeORM synchronize로 테이블 자동 생성 확인**

개발 환경에서 `synchronize: true`면 엔티티 기반으로 테이블이 자동 생성됨.
프로덕션에서는 migration 필요.

**Step 3: Commit**

```bash
git add apps/backend/src/seeds/seed-roles.ts
git commit -m "feat: add seed data for default RBAC roles"
```

---

## 구현 순서 요약

| 순서 | Task | 의존성 |
|------|------|--------|
| 1 | menuConfig.ts 추출 | 없음 |
| 2 | 백엔드 엔티티 | 없음 |
| 3 | 백엔드 DTO | Task 2 |
| 4 | 백엔드 서비스 | Task 2, 3 |
| 5 | 백엔드 컨트롤러 | Task 4 |
| 6 | 백엔드 모듈 등록 | Task 5 |
| 7 | Auth 서비스 수정 | Task 6 |
| 8 | authStore 수정 | Task 7 |
| 9 | Sidebar 권한 체크 | Task 1, 8 |
| 10 | AuthGuard URL 체크 | Task 1, 8 |
| 11 | 역할 관리 페이지 | Task 1~10 전체 |
| 12 | 시드 데이터 | Task 6 |

**병렬 가능:** Task 1 + Task 2~6 동시 진행 가능
