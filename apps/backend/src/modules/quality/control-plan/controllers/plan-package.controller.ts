import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { CreatePlanOutputEventDto, CreatePlanPackageDto, UpdatePlanPackageDto } from '../dto/plan-package.dto';
import { PlanPackageService } from '../services/plan-package.service';
import { QualityPlanDraftGeneratorService } from '../services/quality-plan-draft-generator.service';
import { QualityPlanPrintModelService } from '../services/quality-plan-print-model.service';

@ApiTags('품질관리 - 관리계획 문서패키지')
@Controller('quality/plan-packages')
export class PlanPackageController {
  constructor(private readonly service: PlanPackageService, private readonly draftGenerator: QualityPlanDraftGeneratorService,
    private readonly printModel: QualityPlanPrintModelService) {}

  @Get() @ApiOperation({ summary: '관리계획 문서패키지 목록' })
  async findAll(@Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findAll(company, plant));
  }

  @Get(':packageId/print-model') @ApiOperation({ summary: '발행 Revision 공식 출력 snapshot' })
  async getPrintModel(@Param('packageId', ParseIntPipe) packageId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.printModel.getPackagePrintModel(packageId, company, plant));
  }

  @Get(':packageId/events') @ApiOperation({ summary: '문서 생성·개정·발행·출력 감사 이력' })
  async listEvents(@Param('packageId', ParseIntPipe) packageId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.listEvents(packageId, company, plant));
  }

  @Get(':packageId') @ApiOperation({ summary: '관리계획 문서패키지와 Revision 조회' })
  async findOne(@Param('packageId', ParseIntPipe) packageId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findOne(packageId, company, plant));
  }

  @Put(':packageId') @ApiOperation({ summary: '최초 발행 전 패키지 기본정보 수정' })
  async update(@Param('packageId', ParseIntPipe) packageId: number, @Body() dto: UpdatePlanPackageDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.update(packageId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Post() @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'PFD/PFMEA/Control Plan 빈 문서패키지 생성' })
  async create(@Body() dto: CreatePlanPackageDto, @Company() company: string, @Plant() plant: string,
    @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.create(dto, company, plant, req.user?.id ?? 'system'));
  }

  @Post(':packageId/generate-draft') @ApiOperation({ summary: '기준정보 기반 PFD/PFMEA/Control Plan 초안 생성' })
  async generateDraft(@Param('packageId', ParseIntPipe) packageId: number, @Company() company: string, @Plant() plant: string,
    @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.draftGenerator.generate(packageId, company, plant, req.user?.id ?? 'system'));
  }

  @Post(':packageId/output-events') @ApiOperation({ summary: '미리보기·다운로드·인쇄 감사 이벤트 기록' })
  async recordOutputEvent(@Param('packageId', ParseIntPipe) packageId: number, @Body() dto: CreatePlanOutputEventDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.recordOutputEvent(
      packageId, company, plant, req.user?.id ?? 'system', dto.eventType, dto.documentType,
    ));
  }
}
