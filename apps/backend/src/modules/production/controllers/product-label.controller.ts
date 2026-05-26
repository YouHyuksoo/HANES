import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreatePrdLabelsDto } from '../dto/product-label.dto';
import { ProductLabelService } from '../services/product-label.service';

@ApiTags('Production - Product Label')
@Controller('production/product-label')
export class ProductLabelController {
  constructor(private readonly service: ProductLabelService) {}

  @Get('results')
  @ApiOperation({ summary: 'List labelable production results' })
  async findLabelableResults(@Company() company: string, @Plant() plant: string) {
    const data = await this.service.findLabelableResults(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('oqc-passed')
  @ApiOperation({ summary: 'List OQC passed and labelable production results' })
  async findLabelableOqcPassed(@Company() company: string, @Plant() plant: string) {
    const data = await this.service.findLabelableOqcPassed(company, plant);
    return ResponseUtil.success(data);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue product labels (prdUid)' })
  async createLabels(
    @Body() dto: CreatePrdLabelsDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.createPrdLabels(dto, company, plant);
    return ResponseUtil.success(data, `${data.length} product labels created`);
  }
}
