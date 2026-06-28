import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { EquipMasterService } from '../../equipment/services/equip-master.service';
import { CreateEquipMasterDto, UpdateEquipMasterDto } from '../../equipment/dto/equip-master.dto';
import { AiPageToolManifest, AiPageToolWriteResult, PageToolContext, PageToolProvider } from '../types';

const EQUIP_TYPES = [
  'COMMON', 'AUTO_CRIMP', 'SINGLE_CUT', 'MULTI_CUT', 'TWIST', 'SOLDER',
  'HOUSING', 'TESTER', 'LABEL_PRINTER', 'INSPECTION', 'PACKING', 'OTHER',
];
const COMM_TYPES = ['MQTT', 'SERIAL', 'TCP', 'OPC_UA', 'MODBUS'];
const EQUIP_STATUSES = ['NORMAL', 'MAINT', 'STOP'];

const EQUIP_TYPE_HINT =
  '설비유형 값: COMMON(공통), AUTO_CRIMP(자동압착), SINGLE_CUT(단선절단), MULTI_CUT(다선절단), ' +
  'TWIST(트위스트), SOLDER(납땜), HOUSING(하우징), TESTER(검사기), LABEL_PRINTER(라벨프린터), ' +
  'INSPECTION(검사), PACKING(포장), OTHER(기타). 사용자 문구를 위 코드로 매핑(예: "압착기"→AUTO_CRIMP, "검사기"→TESTER).';
const COMM_TYPE_HINT =
  '통신방식 값: MQTT, SERIAL(시리얼), TCP, OPC_UA, MODBUS. TCP/MQTT일 때만 ipAddress·port가 의미있다.';
const STATUS_HINT =
  '설비상태 값: NORMAL(정상), MAINT(정비중), STOP(가동중지). 기본값 NORMAL.';

/**
 * 설비 관리(/master/equip) AI 페이지 도구 매니페스트 — 설비마스터 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const EQUIP_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.equip',
  route: '/master/equip',
  title: '설비 관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createEquip',
      label: '설비 등록',
      description:
        `새 설비를 등록한다. 설비코드(equipCode)·설비명(equipName) 필수. ` +
        `${EQUIP_TYPE_HINT} ${COMM_TYPE_HINT} ${STATUS_HINT} ` +
        `lineCode(라인코드)·processCode(공정코드)·modelName(모델명)·maker(제조사)·installDate(설치일 YYYY-MM-DD)·useYn(Y|N)은 선택.`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        equipCode: { type: 'string', required: true },
        equipName: { type: 'string', required: true },
        equipType: { type: 'string', required: false, enum: EQUIP_TYPES },
        lineCode: { type: 'string', required: false },
        processCode: { type: 'string', required: false },
        modelName: { type: 'string', required: false },
        maker: { type: 'string', required: false },
        commType: { type: 'string', required: false, enum: COMM_TYPES },
        ipAddress: { type: 'string', required: false },
        port: { type: 'number', required: false },
        installDate: { type: 'string', required: false },
        status: { type: 'string', required: false, enum: EQUIP_STATUSES },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateEquip',
      label: '설비 수정',
      description:
        `기존 설비 정보를 수정한다. 설비코드(equipCode)로 대상을 지정하고, 바꿀 항목만 넣는다. ` +
        `${EQUIP_TYPE_HINT} ${COMM_TYPE_HINT} ${STATUS_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        equipCode: { type: 'string', required: true },
        equipName: { type: 'string', required: false },
        equipType: { type: 'string', required: false, enum: EQUIP_TYPES },
        lineCode: { type: 'string', required: false },
        processCode: { type: 'string', required: false },
        modelName: { type: 'string', required: false },
        maker: { type: 'string', required: false },
        commType: { type: 'string', required: false, enum: COMM_TYPES },
        ipAddress: { type: 'string', required: false },
        port: { type: 'number', required: false },
        installDate: { type: 'string', required: false },
        status: { type: 'string', required: false, enum: EQUIP_STATUSES },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteEquip',
      label: '설비 삭제',
      description: '설비코드(equipCode)로 지정한 설비를 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { equipCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};

/**
 * 설비 관리(/master/equip) 도구 Provider — 설비마스터 CRUD.
 * 모든 도구는 기존 도메인 서비스(EquipMasterService)를 재사용해
 * 검증·중복체크·멀티테넌시(COMPANY/PLANT_CD) 규칙을 그대로 따른다.
 */
@Injectable()
export class EquipToolsProvider implements PageToolProvider {
  readonly pageId = EQUIP_MASTER_TOOL_MANIFEST.pageId;
  readonly manifest = EQUIP_MASTER_TOOL_MANIFEST;

  constructor(@Optional() private readonly equipMasterService?: EquipMasterService) {}

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    ctx: PageToolContext,
  ): Promise<AiPageToolWriteResult> {
    const { company, plant } = ctx;
    switch (toolName) {
      case 'createEquip':
        return this.createEquip(input, company, plant);
      case 'updateEquip':
        return this.updateEquip(input, company, plant);
      case 'deleteEquip':
        return this.deleteEquip(input, company, plant);
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

  private normalizeEnum(label: string, raw: unknown, allowed: string[]): string {
    const v = this.str(raw).toUpperCase();
    if (!allowed.includes(v)) {
      throw new BadRequestException(`${label}이(가) 올바르지 않습니다(${allowed.join('/')}): ${v}`);
    }
    return v;
  }

  private parsePort(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      throw new BadRequestException(`포트 번호가 올바르지 않습니다(1~65535): ${this.str(raw)}`);
    }
    return n;
  }

  private async createEquip(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.equipMasterService) throw new BadRequestException('설비 서비스가 준비되지 않았습니다.');
    const equipCode = this.str(input.equipCode);
    const equipName = this.str(input.equipName);
    if (!equipCode || !equipName) throw new BadRequestException('설비코드·설비명이 필요합니다.');

    const dto: CreateEquipMasterDto = { equipCode, equipName, equipType: 'OTHER' };
    if (input.equipType !== undefined) dto.equipType = this.normalizeEnum('설비유형', input.equipType, EQUIP_TYPES);
    if (input.commType !== undefined) dto.commType = this.normalizeEnum('통신방식', input.commType, COMM_TYPES);
    if (input.status !== undefined) dto.status = this.normalizeEnum('설비상태', input.status, EQUIP_STATUSES);
    if (input.useYn !== undefined) dto.useYn = this.normalizeEnum('사용여부', input.useYn, ['Y', 'N']);
    if (input.lineCode !== undefined) dto.lineCode = this.str(input.lineCode) || undefined;
    if (input.processCode !== undefined) dto.processCode = this.str(input.processCode) || undefined;
    if (input.modelName !== undefined) dto.modelName = this.str(input.modelName) || undefined;
    if (input.maker !== undefined) dto.maker = this.str(input.maker) || undefined;
    if (input.ipAddress !== undefined) dto.ipAddress = this.str(input.ipAddress) || undefined;
    if (input.installDate !== undefined) dto.installDate = this.str(input.installDate) || undefined;
    if (input.port !== undefined) dto.port = this.parsePort(input.port);

    const saved = await this.equipMasterService.create(dto, company, plant);
    return this.result('createEquip', `설비 '${saved.equipName}'(${saved.equipCode})를 등록했습니다.`, {
      equipCode: saved.equipCode,
      equipName: saved.equipName,
      equipType: saved.equipType,
    });
  }

  private async updateEquip(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.equipMasterService) throw new BadRequestException('설비 서비스가 준비되지 않았습니다.');
    const equipCode = this.str(input.equipCode);
    if (!equipCode) throw new BadRequestException('설비코드가 필요합니다.');

    const dto: UpdateEquipMasterDto = {};
    if (input.equipName !== undefined) dto.equipName = this.str(input.equipName);
    if (input.equipType !== undefined) dto.equipType = this.normalizeEnum('설비유형', input.equipType, EQUIP_TYPES);
    if (input.commType !== undefined) dto.commType = this.normalizeEnum('통신방식', input.commType, COMM_TYPES);
    if (input.status !== undefined) dto.status = this.normalizeEnum('설비상태', input.status, EQUIP_STATUSES);
    if (input.useYn !== undefined) dto.useYn = this.normalizeEnum('사용여부', input.useYn, ['Y', 'N']);
    if (input.lineCode !== undefined) dto.lineCode = this.str(input.lineCode) || undefined;
    if (input.processCode !== undefined) dto.processCode = this.str(input.processCode) || undefined;
    if (input.modelName !== undefined) dto.modelName = this.str(input.modelName) || undefined;
    if (input.maker !== undefined) dto.maker = this.str(input.maker) || undefined;
    if (input.ipAddress !== undefined) dto.ipAddress = this.str(input.ipAddress) || undefined;
    if (input.installDate !== undefined) dto.installDate = this.str(input.installDate) || undefined;
    if (input.port !== undefined) dto.port = this.parsePort(input.port);

    await this.equipMasterService.update(equipCode, dto, company, plant);
    return this.result('updateEquip', `설비 ${equipCode}를 수정했습니다.`, { equipCode });
  }

  private async deleteEquip(
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolWriteResult> {
    if (!this.equipMasterService) throw new BadRequestException('설비 서비스가 준비되지 않았습니다.');
    const equipCode = this.str(input.equipCode);
    if (!equipCode) throw new BadRequestException('설비코드가 필요합니다.');
    await this.equipMasterService.delete(equipCode, company, plant);
    return this.result('deleteEquip', `설비 ${equipCode}를 삭제했습니다.`, { equipCode });
  }
}
