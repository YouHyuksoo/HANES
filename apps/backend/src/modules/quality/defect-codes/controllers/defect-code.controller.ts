import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import {
  CreateDefectCategoryDto,
  CreateDefectCodeDto,
  DefectCodeQueryDto,
  UpdateDefectCategoryDto,
  UpdateDefectCodeDto,
} from '../dto/defect-code.dto';
import { DefectCodeService } from '../services/defect-code.service';

@ApiTags('품질관리 - 불량코드관리')
@Controller('quality/defect-codes')
export class DefectCodeController {
  constructor(private readonly defectCodeService: DefectCodeService) {}

  @Get('categories')
  @ApiOperation({ summary: '불량 3레벨 분류 트리 조회' })
  async findCategoryTree(@Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.defectCodeService.findCategoryTree(company, plant));
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '불량 분류 등록' })
  async createCategory(
    @Body() dto: CreateDefectCategoryDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.defectCodeService.createCategory(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '불량 분류가 등록되었습니다.');
  }

  @Put('categories/:categoryCode')
  @ApiOperation({ summary: '불량 분류 수정' })
  async updateCategory(
    @Param('categoryCode') categoryCode: string,
    @Body() dto: UpdateDefectCategoryDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.defectCodeService.updateCategory(categoryCode, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '불량 분류가 수정되었습니다.');
  }

  @Get('options')
  @ApiOperation({ summary: '활성 불량코드 선택 목록 조회' })
  async findOptions(
    @Query() query: DefectCodeQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    return ResponseUtil.success(await this.defectCodeService.findOptions(query, company, plant));
  }

  @Get()
  @ApiOperation({ summary: '불량코드 목록 조회' })
  async findAll(
    @Query() query: DefectCodeQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.defectCodeService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '불량코드 등록' })
  async createCode(
    @Body() dto: CreateDefectCodeDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.defectCodeService.createCode(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '불량코드가 등록되었습니다.');
  }

  @Put(':defectCode')
  @ApiOperation({ summary: '불량코드 수정' })
  async updateCode(
    @Param('defectCode') defectCode: string,
    @Body() dto: UpdateDefectCodeDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.defectCodeService.updateCode(defectCode, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '불량코드가 수정되었습니다.');
  }

  @Delete(':defectCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '불량코드 사용중지' })
  async disableCode(
    @Param('defectCode') defectCode: string,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.defectCodeService.disableCode(defectCode, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '불량코드가 사용중지되었습니다.');
  }
}
