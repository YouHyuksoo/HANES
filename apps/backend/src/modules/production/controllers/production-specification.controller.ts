import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import {
  CreateProductionSpecificationDto,
  ProductionSpecificationQueryDto,
  ReviseProductionSpecificationDto,
  UpdateProductionSpecificationDto,
  UpdateProductionSpecificationRevisionDto,
} from '../dto/production-specification.dto';
import { ProductionSpecificationService } from '../services/production-specification.service';

@ApiTags('생산관리 - 제품 도면관리')
@Controller('production/specifications')
export class ProductionSpecificationController {
  constructor(private readonly service: ProductionSpecificationService) {}

  @Get()
  @ApiOperation({ summary: '제품 도면 목록 조회' })
  async findAll(
    @Query() query: ProductionSpecificationQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('revisions/:revisionId')
  @ApiOperation({ summary: '제품 도면 Revision 상세 조회' })
  async findRevision(
    @Param('revisionId', ParseIntPipe) revisionId: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.findRevision(revisionId, company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '제품 도면 상세 조회' })
  @ApiParam({ name: 'id', description: '도면 ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.findOne(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '제품 도면 생성' })
  async create(
    @Body() dto: CreateProductionSpecificationDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '제품 도면이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '제품 도면 Header 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductionSpecificationDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(id, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '제품 도면이 수정되었습니다.');
  }

  @Put('revisions/:revisionId')
  @ApiOperation({ summary: '제품 도면 Revision/회로 사양 수정' })
  async updateRevision(
    @Param('revisionId', ParseIntPipe) revisionId: number,
    @Body() dto: UpdateProductionSpecificationRevisionDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.updateRevision(revisionId, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '도면 Revision이 수정되었습니다.');
  }

  @Post('revisions/:revisionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '제품 도면 Revision 승인' })
  async approveRevision(
    @Param('revisionId', ParseIntPipe) revisionId: number,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.approveRevision(revisionId, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '도면 Revision이 승인되었습니다.');
  }

  @Post('revisions/:revisionId/revise')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '제품 도면 신규 Revision 생성' })
  async revise(
    @Param('revisionId', ParseIntPipe) revisionId: number,
    @Body() dto: ReviseProductionSpecificationDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.revise(revisionId, dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '새 도면 Revision이 생성되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '제품 도면 삭제' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.delete(id, company, plant);
    return ResponseUtil.success(data, '제품 도면이 삭제되었습니다.');
  }
}
