import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateIqcItemDto, IqcItemQueryDto, UpdateIqcItemDto } from '../dto/iqc-item.dto';
import { IqcItemService } from '../services/iqc-item.service';

@ApiTags('Master - IQC Items')
@Controller('master/iqc-items')
export class IqcItemController {
  constructor(private readonly iqcItemService: IqcItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get IQC item list' })
  async findAll(
    @Query() query: IqcItemQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.iqcItemService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':itemCode/:seq')
  @ApiOperation({ summary: 'Get one IQC item' })
  async findByCompositeKey(
    @Param('itemCode') itemCode: string,
    @Param('seq') seq: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.iqcItemService.findByCompositeKey(itemCode, +seq, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create IQC item' })
  async create(
    @Body() dto: CreateIqcItemDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.iqcItemService.create(dto, company, plant);
    return ResponseUtil.success(data, 'IQC item created');
  }

  @Put(':itemCode/:seq')
  @ApiOperation({ summary: 'Update IQC item' })
  async update(
    @Param('itemCode') itemCode: string,
    @Param('seq') seq: string,
    @Body() dto: UpdateIqcItemDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.iqcItemService.update(itemCode, +seq, dto, company, plant);
    return ResponseUtil.success(data, 'IQC item updated');
  }

  @Delete(':itemCode/:seq')
  @ApiOperation({ summary: 'Delete IQC item' })
  async delete(
    @Param('itemCode') itemCode: string,
    @Param('seq') seq: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.iqcItemService.delete(itemCode, +seq, company, plant);
    return ResponseUtil.success(null, 'IQC item deleted');
  }
}
