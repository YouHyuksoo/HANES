import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Company, Plant } from '../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../common/dto/response.dto';
import { AiPageToolsService } from './ai-page-tools.service';

@Controller('ai/page-tools')
export class AiPageToolsController {
  constructor(private readonly service: AiPageToolsService) {}

  @Get(':pageId')
  getManifest(@Param('pageId') pageId: string) {
    return ResponseUtil.success(this.service.getManifest(pageId));
  }

  @Post(':pageId/execute')
  async execute(
    @Param('pageId') pageId: string,
    @Body() body: { toolName: string; input: Record<string, unknown> },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.executeBackendTool(
      pageId,
      body.toolName,
      body.input ?? {},
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }
}
