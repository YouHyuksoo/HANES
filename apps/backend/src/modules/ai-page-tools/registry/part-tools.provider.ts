import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PartService } from '../../master/services/part.service';
import { CreatePartDto, UpdatePartDto } from '../../master/dto/part.dto';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const ITEM_TYPES = ['RAW_MATERIAL', 'SEMI_PRODUCT', 'FINISHED', 'CONSUMABLE'];
const ITEM_TYPE_HINT =
  '품목유형 값: RAW_MATERIAL(원자재), SEMI_PRODUCT(반제품), FINISHED(완제품), CONSUMABLE(소모품). ' +
  '사용자 문구를 위 코드로 매핑(예: "원자재"→RAW_MATERIAL, "반제품"→SEMI_PRODUCT, "완제품"→FINISHED, "소모품"→CONSUMABLE).';
const INSPECT_METHODS = ['FULL', 'SKIP'];
const YN_HINT = '사용여부 값: Y(사용), N(미사용). "사용"→Y, "미사용"→N.';

/**
 * 품목마스터(/master/part) AI 페이지 도구 매니페스트 — 품목 CRUD.
 * 자연키는 itemCode(품목코드) 단일키. 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const PART_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.part',
  route: '/master/part',
  title: '품목마스터',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createPart',
      label: '품목 등록',
      description:
        `새 품목을 등록한다. 품목코드(itemCode)·품목명(itemName)·품번(itemNo)·품목유형(itemType) 필요. ${ITEM_TYPE_HINT} ` +
        '나머지(고객품번 custPartNo, 규격 spec, 리비전 rev, 마킹문구 markingText, 단위 unit, 색상 color, 차종 modelName, ' +
        '박스입수량 boxQty, 최소포장수량 minPackQty, 안전재고 safetyStock, 검사구분 inspectMethod(FULL/SKIP), 사용여부 useYn(Y/N))는 선택.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        itemCode: { type: 'string', required: true },
        itemName: { type: 'string', required: true },
        itemNo: { type: 'string', required: true },
        itemType: { type: 'string', required: true, enum: ITEM_TYPES },
        custPartNo: { type: 'string', required: false },
        productType: { type: 'string', required: false },
        modelName: { type: 'string', required: false },
        spec: { type: 'string', required: false },
        rev: { type: 'string', required: false },
        markingText: { type: 'string', required: false },
        unit: { type: 'string', required: false },
        color: { type: 'string', required: false },
        boxQty: { type: 'number', required: false },
        minPackQty: { type: 'number', required: false },
        safetyStock: { type: 'number', required: false },
        inspectMethod: { type: 'string', required: false, enum: INSPECT_METHODS },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updatePart',
      label: '품목 수정',
      description:
        `기존 품목 정보를 수정한다. 품목코드(itemCode)로 대상을 지정하고, 바꿀 항목만 넣는다(품목코드 자체는 변경 불가). ${ITEM_TYPE_HINT} ${YN_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        itemCode: { type: 'string', required: true },
        itemName: { type: 'string', required: false },
        itemNo: { type: 'string', required: false },
        itemType: { type: 'string', required: false, enum: ITEM_TYPES },
        custPartNo: { type: 'string', required: false },
        productType: { type: 'string', required: false },
        modelName: { type: 'string', required: false },
        spec: { type: 'string', required: false },
        rev: { type: 'string', required: false },
        markingText: { type: 'string', required: false },
        unit: { type: 'string', required: false },
        color: { type: 'string', required: false },
        boxQty: { type: 'number', required: false },
        minPackQty: { type: 'number', required: false },
        safetyStock: { type: 'number', required: false },
        inspectMethod: { type: 'string', required: false, enum: INSPECT_METHODS },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deletePart',
      label: '품목 삭제',
      description:
        '품목코드(itemCode)로 지정한 품목을 삭제한다. 입하/입고/재고/롯트/BOM/생산계획 등 이력이 있으면 삭제가 거부되며, ' +
        '이때는 대신 useYn=N으로 미사용 처리(updatePart)를 안내한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { itemCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 품목마스터(/master/part) 도구 Provider — 품목 CRUD.
 * 모든 도구는 기존 PartService를 재사용(중복체크·삭제 가드·멀티테넌시 준수). raw repository 우회 금지.
 */
@Injectable()
export class PartToolsProvider implements PageToolProvider {
  readonly pageId = PART_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = PART_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly partService?: PartService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createPart':
        return this.createPart(input, company, plant);
      case 'updatePart':
        return this.updatePart(input, company, plant);
      case 'deletePart':
        return this.deletePart(input, company, plant);
      default:
        throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
    }
  }

  private str(v: unknown): string {
    return String(v ?? '').trim();
  }

  private num(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new BadRequestException(`숫자 값이 올바르지 않습니다: ${String(v)}`);
    return n;
  }

  private result(toolName: string, summary: string, result?: Record<string, unknown>): AiPageToolWriteResult {
    return { status: 'ok', toolName, summary, result };
  }

  private normalizeItemType(v: unknown): string {
    const it = this.str(v).toUpperCase();
    if (!ITEM_TYPES.includes(it)) {
      throw new BadRequestException(`품목유형이 올바르지 않습니다(${ITEM_TYPES.join('/')}): ${it}`);
    }
    return it;
  }

  private normalizeInspectMethod(v: unknown): string {
    const im = this.str(v).toUpperCase();
    if (!INSPECT_METHODS.includes(im)) {
      throw new BadRequestException(`검사구분이 올바르지 않습니다(${INSPECT_METHODS.join('/')}): ${im}`);
    }
    return im;
  }

  private normalizeYn(v: unknown): string {
    const yn = this.str(v).toUpperCase();
    if (yn !== 'Y' && yn !== 'N') throw new BadRequestException(`사용여부는 Y 또는 N이어야 합니다: ${yn}`);
    return yn;
  }

  private async createPart(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.partService) throw new BadRequestException('품목 서비스가 준비되지 않았습니다.');
    const itemCode = this.str(input.itemCode);
    const itemName = this.str(input.itemName);
    const itemNo = this.str(input.itemNo);
    const productType = this.str(input.productType);
    if (!itemCode || !itemName || !itemNo || !productType) {
      throw new BadRequestException('품목코드·품목명·품번·품목그룹(productType)이 필요합니다.');
    }
    const dto: CreatePartDto = {
      itemCode,
      itemName,
      itemNo,
      itemType: this.normalizeItemType(input.itemType),
      productType,
    };
    if (input.custPartNo !== undefined) dto.custPartNo = this.str(input.custPartNo);
    if (input.modelName !== undefined) dto.modelName = this.str(input.modelName);
    if (input.spec !== undefined) dto.spec = this.str(input.spec);
    if (input.rev !== undefined) dto.rev = this.str(input.rev);
    if (input.markingText !== undefined) dto.markingText = this.str(input.markingText);
    if (input.unit !== undefined) dto.unit = this.str(input.unit);
    if (input.color !== undefined) dto.color = this.str(input.color);
    if (input.boxQty !== undefined) dto.boxQty = this.num(input.boxQty);
    if (input.minPackQty !== undefined) dto.minPackQty = this.num(input.minPackQty);
    if (input.safetyStock !== undefined) dto.safetyStock = this.num(input.safetyStock);
    if (input.inspectMethod !== undefined) dto.inspectMethod = this.normalizeInspectMethod(input.inspectMethod);
    if (input.useYn !== undefined) dto.useYn = this.normalizeYn(input.useYn);

    const saved = await this.partService.create(dto, company, plant);
    return this.result('createPart', `품목 '${saved.itemName}'(${saved.itemCode}, 품번 ${saved.itemNo}, ${saved.itemType})를 등록했습니다.`, {
      itemCode: saved.itemCode,
      itemName: saved.itemName,
      itemNo: saved.itemNo,
      itemType: saved.itemType,
    });
  }

  private async updatePart(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.partService) throw new BadRequestException('품목 서비스가 준비되지 않았습니다.');
    const itemCode = this.str(input.itemCode);
    if (!itemCode) throw new BadRequestException('품목코드가 필요합니다.');

    const dto: UpdatePartDto = {};
    if (input.itemName !== undefined) dto.itemName = this.str(input.itemName);
    if (input.itemNo !== undefined) dto.itemNo = this.str(input.itemNo);
    if (input.itemType !== undefined) dto.itemType = this.normalizeItemType(input.itemType);
    if (input.custPartNo !== undefined) dto.custPartNo = this.str(input.custPartNo);
    if (input.productType !== undefined) dto.productType = this.str(input.productType);
    if (input.modelName !== undefined) dto.modelName = this.str(input.modelName);
    if (input.spec !== undefined) dto.spec = this.str(input.spec);
    if (input.rev !== undefined) dto.rev = this.str(input.rev);
    if (input.markingText !== undefined) dto.markingText = this.str(input.markingText);
    if (input.unit !== undefined) dto.unit = this.str(input.unit);
    if (input.color !== undefined) dto.color = this.str(input.color);
    if (input.boxQty !== undefined) dto.boxQty = this.num(input.boxQty);
    if (input.minPackQty !== undefined) dto.minPackQty = this.num(input.minPackQty);
    if (input.safetyStock !== undefined) dto.safetyStock = this.num(input.safetyStock);
    if (input.inspectMethod !== undefined) dto.inspectMethod = this.normalizeInspectMethod(input.inspectMethod);
    if (input.useYn !== undefined) dto.useYn = this.normalizeYn(input.useYn);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('수정할 항목이 없습니다.');
    }
    await this.partService.update(itemCode, dto, company, plant);
    return this.result('updatePart', `품목 ${itemCode}를 수정했습니다.`, { itemCode });
  }

  private async deletePart(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.partService) throw new BadRequestException('품목 서비스가 준비되지 않았습니다.');
    const itemCode = this.str(input.itemCode);
    if (!itemCode) throw new BadRequestException('품목코드가 필요합니다.');
    await this.partService.delete(itemCode, company, plant);
    return this.result('deletePart', `품목 ${itemCode}를 삭제했습니다.`, { itemCode });
  }
}
