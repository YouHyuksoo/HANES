import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PartnerService } from '../../master/services/partner.service';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const PARTNER_TYPES = ['SUPPLIER', 'CUSTOMER', 'MFG'];
const INSPECTION_MODES = ['TIGHTENED', 'NORMAL', 'REDUCED'];

const PARTNER_TYPE_HINT =
  '거래처유형 값: SUPPLIER(공급사/매입처), CUSTOMER(고객/매출처), MFG(제조사). ' +
  '사용자 문구를 위 코드로 매핑(예: "공급사"·"매입처"·"구매처"→SUPPLIER, "고객"·"매출처"→CUSTOMER, "제조사"·"메이커"→MFG).';
const USE_YN_HINT = '사용여부 useYn: Y(사용), N(미사용).';
const INSPECTION_HINT =
  '검사모드 inspectionMode: TIGHTENED(까다로운검사), NORMAL(보통검사), REDUCED(완화검사).';

/**
 * 거래처관리(/master/partner) AI 페이지 도구 — 거래처 마스터 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
const PARTNER_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.partner',
  route: '/master/partner',
  title: '거래처관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createPartner',
      label: '거래처 등록',
      description:
        `새 거래처를 등록한다. 거래처코드(partnerCode)·거래처명(partnerName)·거래처유형(partnerType) 필요. ` +
        `${PARTNER_TYPE_HINT} 나머지(사업자번호 bizNo, 대표자 ceoName, 주소 address, 전화 tel, 팩스 fax, ` +
        `이메일 email, 담당자 contactPerson, 품질등급 qualityGrade, 검사모드 inspectionMode, 비고 remark, ` +
        `사용여부 useYn)는 선택. ${INSPECTION_HINT} ${USE_YN_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        partnerCode: { type: 'string', required: true },
        partnerName: { type: 'string', required: true },
        partnerType: { type: 'string', required: true, enum: PARTNER_TYPES },
        bizNo: { type: 'string', required: false },
        ceoName: { type: 'string', required: false },
        address: { type: 'string', required: false },
        tel: { type: 'string', required: false },
        fax: { type: 'string', required: false },
        email: { type: 'string', required: false },
        contactPerson: { type: 'string', required: false },
        qualityGrade: { type: 'string', required: false },
        inspectionMode: { type: 'string', required: false, enum: INSPECTION_MODES },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updatePartner',
      label: '거래처 수정',
      description:
        `기존 거래처 정보를 수정한다. 거래처코드(partnerCode)로 대상을 지정하고, 바꿀 항목만 넣는다. ` +
        `(거래처명 partnerName, 거래처유형 partnerType, 사업자번호 bizNo, 대표자 ceoName, 주소 address, ` +
        `전화 tel, 팩스 fax, 이메일 email, 담당자 contactPerson, 품질등급 qualityGrade, 검사모드 inspectionMode, ` +
        `비고 remark, 사용여부 useYn). ${PARTNER_TYPE_HINT} ${INSPECTION_HINT} ${USE_YN_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        partnerCode: { type: 'string', required: true },
        partnerName: { type: 'string', required: false },
        partnerType: { type: 'string', required: false, enum: PARTNER_TYPES },
        bizNo: { type: 'string', required: false },
        ceoName: { type: 'string', required: false },
        address: { type: 'string', required: false },
        tel: { type: 'string', required: false },
        fax: { type: 'string', required: false },
        email: { type: 'string', required: false },
        contactPerson: { type: 'string', required: false },
        qualityGrade: { type: 'string', required: false },
        inspectionMode: { type: 'string', required: false, enum: INSPECTION_MODES },
        remark: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deletePartner',
      label: '거래처 삭제',
      description: '거래처코드(partnerCode)로 지정한 거래처를 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { partnerCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 거래처관리(/master/partner) 도구 Provider — 거래처 마스터 CRUD.
 * 모든 도구는 기존 PartnerService를 재사용(중복체크·존재확인·멀티테넌시 준수).
 */
@Injectable()
export class PartnerToolsProvider implements PageToolProvider {
  readonly pageId = PARTNER_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = PARTNER_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly partnerService?: PartnerService) {}

  async execute(toolName: string, input: Record<string, unknown>, ctx: PageToolContext): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createPartner':
        return this.createPartner(input, company, plant);
      case 'updatePartner':
        return this.updatePartner(input, company, plant);
      case 'deletePartner':
        return this.deletePartner(input, company, plant);
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

  private normalizePartnerType(v: unknown): string {
    const pt = this.str(v).toUpperCase();
    if (!PARTNER_TYPES.includes(pt)) {
      throw new BadRequestException(`거래처유형이 올바르지 않습니다(${PARTNER_TYPES.join('/')}): ${pt}`);
    }
    return pt;
  }

  private normalizeInspectionMode(v: unknown): string {
    const im = this.str(v).toUpperCase();
    if (!INSPECTION_MODES.includes(im)) {
      throw new BadRequestException(`검사모드가 올바르지 않습니다(${INSPECTION_MODES.join('/')}): ${im}`);
    }
    return im;
  }

  private normalizeUseYn(v: unknown): string {
    const yn = this.str(v).toUpperCase();
    if (yn !== 'Y' && yn !== 'N') {
      throw new BadRequestException(`사용여부는 Y 또는 N 이어야 합니다: ${yn}`);
    }
    return yn;
  }

  private async createPartner(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.partnerService) throw new BadRequestException('거래처 서비스가 준비되지 않았습니다.');
    const partnerCode = this.str(input.partnerCode);
    const partnerName = this.str(input.partnerName);
    if (!partnerCode || !partnerName) throw new BadRequestException('거래처코드·거래처명이 필요합니다.');
    const partnerType = this.normalizePartnerType(input.partnerType);

    const dto = {
      partnerCode,
      partnerName,
      partnerType,
      ...(input.bizNo !== undefined ? { bizNo: this.str(input.bizNo) } : {}),
      ...(input.ceoName !== undefined ? { ceoName: this.str(input.ceoName) } : {}),
      ...(input.address !== undefined ? { address: this.str(input.address) } : {}),
      ...(input.tel !== undefined ? { tel: this.str(input.tel) } : {}),
      ...(input.fax !== undefined ? { fax: this.str(input.fax) } : {}),
      ...(input.email !== undefined ? { email: this.str(input.email) } : {}),
      ...(input.contactPerson !== undefined ? { contactPerson: this.str(input.contactPerson) } : {}),
      ...(input.qualityGrade !== undefined ? { qualityGrade: this.str(input.qualityGrade) } : {}),
      ...(input.inspectionMode !== undefined ? { inspectionMode: this.normalizeInspectionMode(input.inspectionMode) } : {}),
      ...(input.remark !== undefined ? { remark: this.str(input.remark) } : {}),
      ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
    };

    const saved = await this.partnerService.create(dto, company, plant);
    return this.result('createPartner', `거래처 '${saved.partnerName}'(${saved.partnerCode}, ${saved.partnerType})를 등록했습니다.`, {
      partnerCode: saved.partnerCode,
      partnerName: saved.partnerName,
      partnerType: saved.partnerType,
    });
  }

  private async updatePartner(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.partnerService) throw new BadRequestException('거래처 서비스가 준비되지 않았습니다.');
    const partnerCode = this.str(input.partnerCode);
    if (!partnerCode) throw new BadRequestException('거래처코드가 필요합니다.');

    const dto = {
      ...(input.partnerName !== undefined ? { partnerName: this.str(input.partnerName) } : {}),
      ...(input.partnerType !== undefined ? { partnerType: this.normalizePartnerType(input.partnerType) } : {}),
      ...(input.bizNo !== undefined ? { bizNo: this.str(input.bizNo) } : {}),
      ...(input.ceoName !== undefined ? { ceoName: this.str(input.ceoName) } : {}),
      ...(input.address !== undefined ? { address: this.str(input.address) } : {}),
      ...(input.tel !== undefined ? { tel: this.str(input.tel) } : {}),
      ...(input.fax !== undefined ? { fax: this.str(input.fax) } : {}),
      ...(input.email !== undefined ? { email: this.str(input.email) } : {}),
      ...(input.contactPerson !== undefined ? { contactPerson: this.str(input.contactPerson) } : {}),
      ...(input.qualityGrade !== undefined ? { qualityGrade: this.str(input.qualityGrade) } : {}),
      ...(input.inspectionMode !== undefined ? { inspectionMode: this.normalizeInspectionMode(input.inspectionMode) } : {}),
      ...(input.remark !== undefined ? { remark: this.str(input.remark) } : {}),
      ...(input.useYn !== undefined ? { useYn: this.normalizeUseYn(input.useYn) } : {}),
    };

    if (Object.keys(dto).length === 0) throw new BadRequestException('수정할 항목이 없습니다.');

    const saved = await this.partnerService.update(partnerCode, dto, company, plant);
    return this.result('updatePartner', `거래처 '${saved.partnerName}'(${partnerCode})를 수정했습니다.`, { partnerCode });
  }

  private async deletePartner(input: Record<string, unknown>, company?: string, plant?: string): Promise<AiPageToolWriteResult> {
    if (!this.partnerService) throw new BadRequestException('거래처 서비스가 준비되지 않았습니다.');
    const partnerCode = this.str(input.partnerCode);
    if (!partnerCode) throw new BadRequestException('거래처코드가 필요합니다.');
    await this.partnerService.delete(partnerCode, company, plant);
    return this.result('deletePartner', `거래처 ${partnerCode}를 삭제했습니다.`, { partnerCode });
  }
}
