/**
 * @file src/modules/role/role.controller.ts
 * @description 역할 관리 API 엔드포인트
 *
 * 초보자 가이드:
 * 1. **인증 필수**: 모든 엔드포인트에 JwtAuthGuard 적용
 * 2. **CRUD**: 역할 목록/상세/생성/수정/삭제
 * 3. **권한 관리**: 역할별 메뉴 권한 조회/수정 (PUT으로 전체 교체)
 *
 * 엔드포인트:
 * - GET    /api/roles            - 역할 목록 조회
 * - GET    /api/roles/:id        - 역할 상세 조회
 * - POST   /api/roles            - 역할 생성
 * - PATCH  /api/roles/:id        - 역할 수정
 * - DELETE /api/roles/:id        - 역할 삭제
 * - GET    /api/roles/:id/permissions  - 메뉴 권한 조회
 * - PUT    /api/roles/:id/permissions  - 메뉴 권한 수정
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto, UpdatePermissionsDto } from './role.dto';
import {
  JwtAuthGuard,
  AuthenticatedRequest,
} from '../../common/guards/jwt-auth.guard';
import { Company } from '../../common/decorators/tenant.decorator';

@ApiTags('역할')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: '역할 목록 조회' })
  findAll(@Company() company?: string) {
    return this.roleService.findAll(company);
  }

  @Get(':id')
  @ApiOperation({ summary: '역할 상세 조회' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '역할 생성' })
  create(
    @Body() dto: CreateRoleDto,
    @Company() company?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.roleService.create(dto, company, req?.user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '역할 수정' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.roleService.update(id, dto, req?.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '역할 삭제' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.remove(id);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: '역할 메뉴 권한 조회' })
  getPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.getPermissions(id);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: '역할 메뉴 권한 수정' })
  updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.roleService.updatePermissions(id, dto);
  }
}
