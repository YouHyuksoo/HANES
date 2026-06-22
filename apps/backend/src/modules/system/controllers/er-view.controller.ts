/**
 * @file src/modules/system/controllers/er-view.controller.ts
 * @description ER VIEW 스키마 거버넌스 API
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActionPayload, ErViewService } from '../services/er-view.service';

@ApiTags('system')
@Controller('system/er-view')
export class ErViewController {
  constructor(private readonly erViewService: ErViewService) {}

  @Get('summary')
  @ApiOperation({ summary: 'ER VIEW schema summary' })
  getSummary() {
    return this.erViewService.getSummary();
  }

  @Get('tables')
  @ApiOperation({ summary: 'ER VIEW table list' })
  getTables() {
    return this.erViewService.getTables();
  }

  @Get('tables/:table')
  @ApiOperation({ summary: 'ER VIEW table detail' })
  getTableDetail(@Param('table') table: string) {
    return this.erViewService.getTableDetail(table);
  }

  @Get('graph')
  @ApiOperation({ summary: 'ER VIEW selected table graph' })
  getGraph(@Query('table') table: string, @Query('depth') depth?: string) {
    return this.erViewService.getGraph(table, Number(depth ?? 1));
  }

  @Get('relationships')
  @ApiOperation({ summary: 'ER VIEW relationships' })
  getRelationships(@Query('table') table?: string) {
    return this.erViewService.getRelationships(table);
  }

  @Post('relationships/scan-orphans')
  @ApiOperation({ summary: 'ER VIEW orphan scan' })
  scanOrphans(@Body() body: { childTable: string; childColumns: string[]; parentTable: string; parentColumns: string[]; sampleLimit?: number }) {
    return this.erViewService.scanOrphans(body, body.sampleLimit ?? 20);
  }

  @Post('actions/dry-run')
  @ApiOperation({ summary: 'ER VIEW action dry-run' })
  dryRun(@Body() body: ActionPayload) {
    return this.erViewService.previewAction(body);
  }

  @Post('actions/execute')
  @ApiOperation({ summary: 'ER VIEW action execute' })
  execute(@Body() body: ActionPayload) {
    return this.erViewService.executeAction(body);
  }

  @Get('actions')
  @ApiOperation({ summary: 'ER VIEW action logs' })
  getActions() {
    return this.erViewService.getActions();
  }
}
