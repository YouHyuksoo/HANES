import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { VendorBarcodeMappingService } from '../../master/services/vendor-barcode-mapping.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const MATCH_TYPES = ['EXACT', 'PREFIX', 'REGEX'];
const MATCH_TYPE_HINT =
  '매칭유형 값: EXACT(정확 일치), PREFIX(접두사 일치), REGEX(정규식 일치). ' +
  '사용자 문구를 위 코드로 매핑(예: "정확히 같음"→EXACT, "접두사/앞부분"→PREFIX, "정규식"→REGEX). 미지정 시 EXACT.';

/**
 * 제조사 바코드 매핑(/master/vendor-barcode) AI 페이지 도구 — 매핑 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 * 자연키 = vendorBarcode(제조사 바코드).
 */
export const VENDOR_BARCODE_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.vendor-barcode',
  route: '/master/vendor-barcode',
  title: '제조사 바코드 매핑',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createVendorBarcodeMapping',
      label: '바코드 매핑 등록',
      description:
        `제조사 바코드를 MES 품목과 매핑하는 새 항목을 등록한다. vendorBarcode(제조사 바코드)·itemCode(MES 품번)가 필수. ` +
        `itemName(품명)·vendorCode(제조사코드)·vendorName(제조사명)·mappingRule(매핑규칙 설명)·remark(비고)는 선택. ` +
        `useYn(사용여부 Y/N, 기본 Y). ${MATCH_TYPE_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        vendorBarcode: { type: 'string', required: true },
        itemCode: { type: 'string', required: true },
        itemName: { type: 'string', required: false },
        vendorCode: { type: 'string', required: false },
        vendorName: { type: 'string', required: false },
        mappingRule: { type: 'string', required: false },
        matchType: { type: 'string', required: false, enum: MATCH_TYPES },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateVendorBarcodeMapping',
      label: '바코드 매핑 수정',
      description:
        `기존 바코드 매핑을 수정한다. vendorBarcode(제조사 바코드)로 대상을 지정하고, 바꿀 항목만 넣는다 ` +
        `(itemCode/itemName/vendorCode/vendorName/mappingRule/matchType/remark/useYn). ${MATCH_TYPE_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        vendorBarcode: { type: 'string', required: true },
        itemCode: { type: 'string', required: false },
        itemName: { type: 'string', required: false },
        vendorCode: { type: 'string', required: false },
        vendorName: { type: 'string', required: false },
        mappingRule: { type: 'string', required: false },
        matchType: { type: 'string', required: false, enum: MATCH_TYPES },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteVendorBarcodeMapping',
      label: '바코드 매핑 삭제',
      description: 'vendorBarcode(제조사 바코드)로 지정한 바코드 매핑을 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { vendorBarcode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 제조사 바코드 매핑(/master/vendor-barcode) 도구 Provider.
 * 모든 도구는 기존 도메인 서비스(VendorBarcodeMappingService)를 재사용한다
 * (중복체크·검증·멀티테넌시 준수). raw repository 우회 없음.
 */
@Injectable()
export class VendorBarcodeToolsProvider implements PageToolProvider {
  readonly pageId = VENDOR_BARCODE_TOOL_MANIFEST.pageId;
  readonly manifest = VENDOR_BARCODE_TOOL_MANIFEST;

  constructor(
    @Optional() private readonly mappingService?: VendorBarcodeMappingService,
  ) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createVendorBarcodeMapping':
        return this.createMapping(input, company, plant);
      case 'updateVendorBarcodeMapping':
        return this.updateMapping(input, company, plant);
      case 'deleteVendorBarcodeMapping':
        return this.deleteMapping(input, company, plant);
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

  private normalizeMatchType(v: unknown): string {
    const mt = this.str(v).toUpperCase();
    if (!MATCH_TYPES.includes(mt)) {
      throw new BadRequestException(`매칭유형이 올바르지 않습니다(${MATCH_TYPES.join('/')}): ${mt}`);
    }
    return mt;
  }

  private normalizeUseYn(v: unknown): string {
    const yn = this.str(v).toUpperCase();
    if (yn !== 'Y' && yn !== 'N') {
      throw new BadRequestException(`사용여부는 Y 또는 N이어야 합니다: ${yn}`);
    }
    return yn;
  }

  private async createMapping(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.mappingService) throw new BadRequestException('제조사 바코드 매핑 서비스가 준비되지 않았습니다.');
    const vendorBarcode = this.str(input.vendorBarcode);
    const itemCode = this.str(input.itemCode);
    const vendorCode = this.str(input.vendorCode);
    if (!vendorBarcode || !itemCode || !vendorCode) throw new BadRequestException('제조사 바코드(vendorBarcode)·품번(itemCode)·제조사코드(vendorCode)가 필요합니다.');
    const dto = {
      vendorBarcode,
      itemCode,
      vendorCode,
      ...(input.itemName !== undefined ? { itemName: this.str(input.itemName) } : {}),
      ...(input.vendorName !== undefined ? { vendorName: this.str(input.vendorName) } : {}),
      ...(input.mappingRule !== undefined ? { mappingRule: this.str(input.mappingRule) } : {}),
      ...(input.matchType !== undefined ? { matchType: this.normalizeMatchType(input.matchType) } : {}),
      ...(input.remark !== undefined ? { remark: this.str(input.remark) } : {}),
      ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
    };
    const saved = await this.mappingService.create(dto, company, plant);
    return this.result(
      'createVendorBarcodeMapping',
      `제조사 바코드 '${saved.vendorBarcode}'를 품번 ${saved.itemCode}(${saved.matchType})에 매핑했습니다.`,
      { vendorBarcode: saved.vendorBarcode, itemCode: saved.itemCode, matchType: saved.matchType },
    );
  }

  private async updateMapping(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.mappingService) throw new BadRequestException('제조사 바코드 매핑 서비스가 준비되지 않았습니다.');
    const vendorBarcode = this.str(input.vendorBarcode);
    if (!vendorBarcode) throw new BadRequestException('제조사 바코드(vendorBarcode)가 필요합니다.');
    const dto: {
      itemCode?: string;
      itemName?: string;
      vendorCode?: string;
      vendorName?: string;
      mappingRule?: string;
      matchType?: string;
      remark?: string;
      useYn?: string;
    } = {};
    if (input.itemCode !== undefined) dto.itemCode = this.str(input.itemCode);
    if (input.itemName !== undefined) dto.itemName = this.str(input.itemName);
    if (input.vendorCode !== undefined) dto.vendorCode = this.str(input.vendorCode);
    if (input.vendorName !== undefined) dto.vendorName = this.str(input.vendorName);
    if (input.mappingRule !== undefined) dto.mappingRule = this.str(input.mappingRule);
    if (input.matchType !== undefined) dto.matchType = this.normalizeMatchType(input.matchType);
    if (input.remark !== undefined) dto.remark = this.str(input.remark);
    if (input.useYn !== undefined) dto.useYn = this.normalizeUseYn(input.useYn);
    await this.mappingService.update(vendorBarcode, dto, company, plant);
    return this.result('updateVendorBarcodeMapping', `제조사 바코드 '${vendorBarcode}' 매핑을 수정했습니다.`, { vendorBarcode });
  }

  private async deleteMapping(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.mappingService) throw new BadRequestException('제조사 바코드 매핑 서비스가 준비되지 않았습니다.');
    const vendorBarcode = this.str(input.vendorBarcode);
    if (!vendorBarcode) throw new BadRequestException('제조사 바코드(vendorBarcode)가 필요합니다.');
    await this.mappingService.delete(vendorBarcode, company, plant);
    return this.result('deleteVendorBarcodeMapping', `제조사 바코드 '${vendorBarcode}' 매핑을 삭제했습니다.`, { vendorBarcode });
  }
}
