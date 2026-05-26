import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductHoldService } from '../services/product-hold.service';
import { ProductHoldActionDto, ProductReleaseHoldDto, ProductHoldQueryDto } from '../dto/product-hold.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';

@ApiTags('��ǰ������- ��ǰȦ��')
@Controller('inventory/product-hold')
export class ProductHoldController {
  constructor(private readonly productHoldService: ProductHoldService) {}

  @Get()
  @ApiOperation({ summary: '��ǰ ��� ��� ��ȸ (Ȧ�� ����)' })
  async findAll(
    @Query() query: ProductHoldQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.productHoldService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('hold')
  @ApiOperation({ summary: '��ǰ ��� Ȧ��' })
  async hold(
    @Body() dto: ProductHoldActionDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.productHoldService.hold(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '��ǰ ���� Ȧ�� ó���Ǿ����ϴ�.');
  }

  @Post('release')
  @ApiOperation({ summary: '��ǰ ��� Ȧ�� ����' })
  async release(
    @Body() dto: ProductReleaseHoldDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.productHoldService.release(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '��ǰ ��� Ȧ�尡 �����Ǿ����ϴ�.');
  }
}
