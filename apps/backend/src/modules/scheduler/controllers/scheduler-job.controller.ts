/**
 * @file src/modules/scheduler/controllers/scheduler-job.controller.ts
 * @description 스케줄러 작업(Job) API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /scheduler/jobs**: 작업 목록 조회 (인증된 사용자 모두)
 * 2. **POST /scheduler/jobs**: 작업 생성 (ADMIN만)
 * 3. **PUT /scheduler/jobs/:jobCode**: 작업 수정 (ADMIN만)
 * 4. **DELETE /scheduler/jobs/:jobCode**: 작업 삭제 (ADMIN만)
 * 5. **POST /scheduler/jobs/:jobCode/run**: 즉시 실행 (ADMIN만)
 * 6. **PATCH /scheduler/jobs/:jobCode/toggle**: 활성/비활성 토글 (ADMIN만)
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SchedulerJobService } from '../services/scheduler-job.service';
import {
  CreateSchedulerJobDto,
  UpdateSchedulerJobDto,
  SchedulerJobFilterDto,
} from '../dto/scheduler-job.dto';

@ApiTags('Scheduler')
@Controller('scheduler/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulerJobController {
  constructor(private readonly jobService: SchedulerJobService) {}

  @Get()
  @ApiOperation({ summary: '스케줄러 작업 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() filter: SchedulerJobFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.jobService.findAll(filter, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '스케줄러 작업 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateSchedulerJobDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.jobService.create(dto, company, plant, req.user.id);
    return ResponseUtil.success(data, '스케줄러 작업이 생성되었습니다.');
  }

  @Put(':jobCode')
  @Roles('ADMIN')
  @ApiOperation({ summary: '스케줄러 작업 수정' })
  @ApiParam({ name: 'jobCode', description: '작업 코드' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('jobCode') jobCode: string,
    @Body() dto: UpdateSchedulerJobDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.jobService.update(jobCode, dto, company, plant, req.user.id);
    return ResponseUtil.success(data, '스케줄러 작업이 수정되었습니다.');
  }

  @Delete(':jobCode')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '스케줄러 작업 삭제' })
  @ApiParam({ name: 'jobCode', description: '작업 코드' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async remove(
    @Param('jobCode') jobCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.jobService.remove(jobCode, company, plant);
    return ResponseUtil.success(null, '스케줄러 작업이 삭제되었습니다.');
  }

  @Post(':jobCode/run')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '스케줄러 작업 즉시 실행' })
  @ApiParam({ name: 'jobCode', description: '작업 코드' })
  @ApiResponse({ status: 200, description: '실행 요청 성공' })
  async runNow(
    @Param('jobCode') jobCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.jobService.runNow(jobCode, company, plant);
    return ResponseUtil.success(null, '작업 실행이 요청되었습니다.');
  }

  @Patch(':jobCode/toggle')
  @Roles('ADMIN')
  @ApiOperation({ summary: '스케줄러 작업 활성/비활성 토글' })
  @ApiParam({ name: 'jobCode', description: '작업 코드' })
  @ApiResponse({ status: 200, description: '토글 성공' })
  async toggle(
    @Param('jobCode') jobCode: string,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.jobService.toggle(jobCode, company, plant, req.user.id);
    return ResponseUtil.success(data, `작업이 ${data.isActive === 'Y' ? '활성화' : '비활성화'}되었습니다.`);
  }
}
