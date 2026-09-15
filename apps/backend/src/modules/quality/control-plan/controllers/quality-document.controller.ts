import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { CreateQualityRevisionDto, UpdateQualityRevisionDto } from '../dto/quality-document.dto';
import { QualityDocumentRevisionService } from '../services/quality-document-revision.service';
import { CreateProcessFlowRowDto, ReorderProcessFlowRowsDto, UpdateProcessFlowRowDto } from '../dto/process-flow.dto';
import { ProcessFlowDocumentService } from '../services/process-flow-document.service';
import { CreatePfmeaRowDto, UpdatePfmeaRowDto } from '../dto/pfmea.dto';
import { PfmeaDocumentService } from '../services/pfmea-document.service';
import { CreateControlPlanRowDto, UpdateControlPlanRowDto } from '../dto/control-plan-row.dto';
import { ControlPlanDocumentService } from '../services/control-plan-document.service';
import { QualityPlanValidationService } from '../services/quality-plan-validation.service';
import { CreateQualityPlanParticipantDto } from '../dto/quality-plan-participant.dto';
import { QualityPlanParticipantService } from '../services/quality-plan-participant.service';

@ApiTags('품질관리 - 관리계획 Revision')
@Controller('quality')
export class QualityDocumentController {
  constructor(private readonly service: QualityDocumentRevisionService, private readonly processFlow: ProcessFlowDocumentService,
    private readonly pfmea: PfmeaDocumentService, private readonly controlPlan: ControlPlanDocumentService,
    private readonly validation: QualityPlanValidationService, private readonly participants: QualityPlanParticipantService) {}

  @Get('documents/:documentId/revisions')
  async findByDocument(@Param('documentId', ParseIntPipe) documentId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findByDocument(documentId, company, plant));
  }

  @Get('revisions/:revisionId')
  async findOne(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findOne(revisionId, company, plant));
  }

  @Get('revisions/:revisionId/compare/:otherRevisionId')
  async compare(@Param('revisionId', ParseIntPipe) revisionId: number,
    @Param('otherRevisionId', ParseIntPipe) otherRevisionId: number,
    @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.compare(revisionId, otherRevisionId, company, plant));
  }

  @Put('revisions/:revisionId')
  async update(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: UpdateQualityRevisionDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.updateMetadata(revisionId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Delete('revisions/:revisionId')
  async delete(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.deleteDraft(revisionId, company, plant));
  }

  @Post('revisions/:revisionId/create-revision') @ApiOperation({ summary: '발행본에서 새 Revision 생성' })
  async createRevision(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: CreateQualityRevisionDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.createRevision(revisionId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Post('revisions/:revisionId/publish') @ApiOperation({ summary: 'DRAFT Revision 발행' })
  async publish(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string,
    @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.publish(revisionId, company, plant, req.user?.id ?? 'system'));
  }

  @Post('revisions/:revisionId/validate')
  async validate(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string,
    @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.validation.validateRevision(revisionId, company, plant, req.user?.id ?? 'system'));
  }

  @Get('revisions/:revisionId/pfd-rows')
  async findPfdRows(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.processFlow.findRows(revisionId, company, plant));
  }

  @Post('revisions/:revisionId/pfd-rows')
  async createPfdRow(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: CreateProcessFlowRowDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.processFlow.createRow(revisionId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Put('pfd-rows/:rowId')
  async updatePfdRow(@Param('rowId', ParseIntPipe) rowId: number, @Body() dto: UpdateProcessFlowRowDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.processFlow.updateRow(rowId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Delete('pfd-rows/:rowId')
  async deletePfdRow(@Param('rowId', ParseIntPipe) rowId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.processFlow.deleteRow(rowId, company, plant));
  }

  @Patch('revisions/:revisionId/pfd-rows/reorder')
  async reorderPfdRows(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: ReorderProcessFlowRowsDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.processFlow.reorder(revisionId, dto.rowIds, company, plant, req.user?.id ?? 'system'));
  }

  @Get('revisions/:revisionId/pfmea-rows')
  async findPfmeaRows(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.pfmea.findRows(revisionId, company, plant));
  }

  @Post('revisions/:revisionId/pfmea-rows')
  async createPfmeaRow(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: CreatePfmeaRowDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.pfmea.createRow(revisionId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Put('pfmea-rows/:rowId')
  async updatePfmeaRow(@Param('rowId', ParseIntPipe) rowId: number, @Body() dto: UpdatePfmeaRowDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.pfmea.updateRow(rowId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Delete('pfmea-rows/:rowId')
  async deletePfmeaRow(@Param('rowId', ParseIntPipe) rowId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.pfmea.deleteRow(rowId, company, plant));
  }

  @Get('revisions/:revisionId/participants')
  async findParticipants(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.participants.findByRevision(revisionId, company, plant));
  }

  @Post('revisions/:revisionId/participants')
  async createParticipant(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: CreateQualityPlanParticipantDto,
    @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.participants.create(revisionId, dto, company, plant));
  }

  @Delete('participants/:participantId')
  async deleteParticipant(@Param('participantId', ParseIntPipe) participantId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.participants.delete(participantId, company, plant));
  }

  @Get('revisions/:revisionId/control-plan-rows')
  async findControlPlanRows(@Param('revisionId', ParseIntPipe) revisionId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.controlPlan.findRows(revisionId, company, plant));
  }

  @Post('revisions/:revisionId/control-plan-rows')
  async createControlPlanRow(@Param('revisionId', ParseIntPipe) revisionId: number, @Body() dto: CreateControlPlanRowDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.controlPlan.createRow(revisionId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Put('control-plan-rows/:rowId')
  async updateControlPlanRow(@Param('rowId', ParseIntPipe) rowId: number, @Body() dto: UpdateControlPlanRowDto,
    @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.controlPlan.updateRow(rowId, dto, company, plant, req.user?.id ?? 'system'));
  }

  @Delete('control-plan-rows/:rowId')
  async deleteControlPlanRow(@Param('rowId', ParseIntPipe) rowId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.controlPlan.deleteRow(rowId, company, plant));
  }
}
