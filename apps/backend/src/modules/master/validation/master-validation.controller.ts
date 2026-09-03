/**
 * @file src/modules/master/validation/master-validation.controller.ts
 * @description 기준정보 검증 API 컨트롤러 — 온디맨드 실행
 */
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { MasterValidationService } from './master-validation.service';
import type { RuleCategory } from './rules';

@ApiTags('기준정보 - 기준정보검증')
@Controller('master/validation')
export class MasterValidationController {
  constructor(private readonly validationService: MasterValidationService) {}

  @Post('run')
  @ApiOperation({ summary: '기준정보 검증 실행 (온디맨드)' })
  async run(
    @Body() body: { categories?: RuleCategory[] },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.validationService.run(body?.categories, company, plant);
    return ResponseUtil.success(result);
  }
}
