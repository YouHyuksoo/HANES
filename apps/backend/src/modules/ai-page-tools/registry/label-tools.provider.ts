import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { LabelTemplateService } from '../../master/services/label-template.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const LABEL_CATEGORIES = ['equip', 'jig', 'worker', 'part', 'mat_lot', 'box', 'pallet'];
const CATEGORY_HINT =
  '카테고리 값: equip(설비), jig(지그/소모품), worker(작업자), part(부품), mat_lot(자재 LOT), box(박스), pallet(파레트). ' +
  '사용자 문구를 위 코드로 매핑(예: "설비"→equip, "지그"→jig, "작업자"→worker, "자재로트"→mat_lot).';
const PRINT_MODES = ['BROWSER', 'ZPL', 'BOTH'];

/**
 * 라벨 템플릿(/master/label) AI 페이지 도구 매니페스트 — 템플릿 등록·수정·삭제.
 * 라벨 템플릿은 복합 자연키(templateName + category)로 식별한다.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const LABEL_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.label',
  route: '/master/label',
  title: '라벨 템플릿',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createLabelTemplate',
      label: '라벨 템플릿 등록',
      description:
        `새 라벨 템플릿을 등록한다. 템플릿이름(templateName)·카테고리(category)·디자인데이터(designData) 필요. ` +
        `designData는 라벨 디자인 JSON 객체(라벨 크기·요소 등). ${CATEGORY_HINT} ` +
        `isDefault(기본 템플릿 여부) 선택. printMode(BROWSER/ZPL/BOTH) 선택(기본 BROWSER). remark(비고) 선택.`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        templateName: { type: 'string', required: true },
        category: { type: 'string', required: true, enum: LABEL_CATEGORIES },
        designData: { type: 'object', required: true },
        isDefault: { type: 'boolean', required: false },
        printMode: { type: 'string', required: false, enum: PRINT_MODES },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateLabelTemplate',
      label: '라벨 템플릿 수정',
      description:
        `기존 라벨 템플릿을 수정한다. 대상은 템플릿이름(templateName)+카테고리(category) 복합키로 지정한다. ` +
        `바꿀 항목(designData/isDefault/printMode/remark)만 넣는다. ${CATEGORY_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        templateName: { type: 'string', required: true },
        category: { type: 'string', required: true, enum: LABEL_CATEGORIES },
        designData: { type: 'object', required: false },
        isDefault: { type: 'boolean', required: false },
        printMode: { type: 'string', required: false, enum: PRINT_MODES },
        remark: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteLabelTemplate',
      label: '라벨 템플릿 삭제',
      description:
        `템플릿이름(templateName)+카테고리(category) 복합키로 지정한 라벨 템플릿을 삭제한다. ${CATEGORY_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        templateName: { type: 'string', required: true },
        category: { type: 'string', required: true, enum: LABEL_CATEGORIES },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 라벨 템플릿(/master/label) 도구 Provider — 라벨 템플릿 CRUD.
 * 모든 도구는 기존 LabelTemplateService를 재사용(검증·중복체크·기본템플릿 처리·멀티테넌시 준수).
 */
@Injectable()
export class LabelToolsProvider implements PageToolProvider {
  readonly pageId = LABEL_TOOL_MANIFEST.pageId;
  readonly manifest = LABEL_TOOL_MANIFEST;

  constructor(
    @Optional() private readonly labelTemplateService?: LabelTemplateService,
  ) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createLabelTemplate':
        return this.createLabelTemplate(input, company, plant);
      case 'updateLabelTemplate':
        return this.updateLabelTemplate(input, company, plant);
      case 'deleteLabelTemplate':
        return this.deleteLabelTemplate(input, company, plant);
      default:
        throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }
  }

  private str(v: unknown): string {
    return String(v ?? '').trim();
  }

  private result(toolName: string, summary: string, result?: Record<string, unknown>): AiPageToolWriteResult {
    return { status: 'ok', toolName, summary, result };
  }

  private normalizeCategory(v: unknown): string {
    const c = this.str(v).toLowerCase();
    if (!LABEL_CATEGORIES.includes(c)) {
      throw new BadRequestException(`카테고리가 올바르지 않습니다(${LABEL_CATEGORIES.join('/')}): ${c}`);
    }
    return c;
  }

  private normalizePrintMode(v: unknown): string {
    const m = this.str(v).toUpperCase();
    if (!PRINT_MODES.includes(m)) {
      throw new BadRequestException(`인쇄 모드가 올바르지 않습니다(${PRINT_MODES.join('/')}): ${m}`);
    }
    return m;
  }

  /** 복합 자연키(templateName + category)를 서비스용 id 문자열로 합친다. */
  private buildKey(templateName: string, category: string): string {
    return `${templateName}::${category}`;
  }

  private async createLabelTemplate(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.labelTemplateService) throw new BadRequestException('라벨 템플릿 서비스가 준비되지 않았습니다.');
    const templateName = this.str(input.templateName);
    if (!templateName) throw new BadRequestException('템플릿이름이 필요합니다.');
    const category = this.normalizeCategory(input.category);
    if (input.designData === undefined || input.designData === null || typeof input.designData !== 'object') {
      throw new BadRequestException('디자인데이터(designData) 객체가 필요합니다.');
    }
    const designData = input.designData as Record<string, unknown>;
    const saved = await this.labelTemplateService.create(
      {
        templateName,
        category,
        designData,
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault === true } : {}),
        ...(input.printMode !== undefined ? { printMode: this.normalizePrintMode(input.printMode) } : {}),
        ...(input.remark !== undefined ? { remark: this.str(input.remark) } : {}),
      },
      company,
      plant,
    );
    return this.result('createLabelTemplate', `라벨 템플릿 '${saved.templateName}'(${saved.category})를 등록했습니다.`, {
      templateName: saved.templateName,
      category: saved.category,
    });
  }

  private async updateLabelTemplate(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.labelTemplateService) throw new BadRequestException('라벨 템플릿 서비스가 준비되지 않았습니다.');
    const templateName = this.str(input.templateName);
    if (!templateName) throw new BadRequestException('템플릿이름이 필요합니다.');
    const category = this.normalizeCategory(input.category);
    const dto: { designData?: Record<string, unknown>; isDefault?: boolean; printMode?: string; remark?: string } = {};
    if (input.designData !== undefined) {
      if (input.designData === null || typeof input.designData !== 'object') {
        throw new BadRequestException('디자인데이터(designData)는 객체여야 합니다.');
      }
      dto.designData = input.designData as Record<string, unknown>;
    }
    if (input.isDefault !== undefined) dto.isDefault = input.isDefault === true;
    if (input.printMode !== undefined) dto.printMode = this.normalizePrintMode(input.printMode);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);
    await this.labelTemplateService.update(this.buildKey(templateName, category), dto, company, plant);
    return this.result('updateLabelTemplate', `라벨 템플릿 ${templateName}(${category})를 수정했습니다.`, { templateName, category });
  }

  private async deleteLabelTemplate(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.labelTemplateService) throw new BadRequestException('라벨 템플릿 서비스가 준비되지 않았습니다.');
    const templateName = this.str(input.templateName);
    if (!templateName) throw new BadRequestException('템플릿이름이 필요합니다.');
    const category = this.normalizeCategory(input.category);
    await this.labelTemplateService.delete(this.buildKey(templateName, category), company, plant);
    return this.result('deleteLabelTemplate', `라벨 템플릿 ${templateName}(${category})를 삭제했습니다.`, { templateName, category });
  }
}
