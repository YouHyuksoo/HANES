/**
 * @file services/sys-config.service.ts
 * @description 시스템 환경설정 서비스
 *
 * 초보자 가이드:
 * 1. findAll: 그룹별/전체 설정 조회 (프론트엔드 관리 페이지용)
 * 2. findAllActive: 활성 설정만 key-value 맵으로 반환 (앱 로딩 시)
 * 3. getValue: 특정 키의 값 조회 (서비스 로직에서 사용)
 * 4. isEnabled: BOOLEAN 타입 설정의 활성 여부 (서비스 로직에서 사용)
 * 5. bulkUpdate: 여러 설정을 한번에 저장 (관리 페이지에서 저장 버튼)
 */
import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { SysConfig } from '../../../entities/sys-config.entity';
import {
  CreateSysConfigDto,
  UpdateSysConfigDto,
  BulkUpdateSysConfigDto,
  SysConfigQueryDto,
} from '../dto/sys-config.dto';

@Injectable()
export class SysConfigService {
  constructor(
    @InjectRepository(SysConfig)
    private readonly sysConfigRepository: Repository<SysConfig>,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`,
      );
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`,
      );
    }
  }

  /** 설정 목록 조회 (관리 페이지용) */
  async findAll(query: SysConfigQueryDto, company?: string, plant?: string) {
    const where: FindOptionsWhere<SysConfig> = {
      ...(company && { company }),
      ...(plant && { plant }),
    };
    if (query.configGroup) where.configGroup = query.configGroup;

    const data = await this.sysConfigRepository.find({
      where,
      order: { configGroup: 'ASC', sortOrder: 'ASC' },
    });

    let result = data;
    if (query.search) {
      const s = query.search.toLowerCase();
      result = data.filter(
        (c) =>
          c.label.toLowerCase().includes(s) ||
          c.configKey.toLowerCase().includes(s) ||
          c.description?.toLowerCase().includes(s),
      );
    }

    // 그룹별로 묶어서 반환
    const grouped: Record<string, SysConfig[]> = {};
    for (const item of result) {
      if (!grouped[item.configGroup]) grouped[item.configGroup] = [];
      grouped[item.configGroup].push(item);
    }

    return { data: result, grouped, total: result.length };
  }

  /** 활성 설정만 key-value 맵으로 반환 (앱 초기 로딩용) */
  async findAllActive() {
    const configs = await this.sysConfigRepository.find({
      where: { isActive: 'Y' },
      order: { configGroup: 'ASC', sortOrder: 'ASC' },
    });

    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.configKey] = c.configValue;
    }

    return { data: configs, map };
  }

  /** 특정 키 값 조회 (다른 서비스에서 호출) */
  async getValue(key: string): Promise<string | null> {
    const config = await this.sysConfigRepository.findOne({
      where: { configKey: key, isActive: 'Y' },
    });
    return config?.configValue ?? null;
  }

  /** BOOLEAN 타입 설정 활성 여부 (다른 서비스에서 호출) */
  async isEnabled(key: string): Promise<boolean> {
    const value = await this.getValue(key);
    return value === 'Y';
  }

  /** 설정 생성 */
  async create(dto: CreateSysConfigDto, company?: string, plant?: string) {
    const existing = await this.sysConfigRepository.findOne({
      where: {
        configGroup: dto.configGroup,
        configKey: dto.configKey,
        ...this.tenantWhere(company, plant),
      },
    });
    if (existing) {
      throw new ConflictException(
        `이미 존재하는 설정입니다: ${dto.configGroup}.${dto.configKey}`,
      );
    }
    const entity = this.sysConfigRepository.create({
      configGroup: dto.configGroup,
      configKey: dto.configKey,
      configValue: dto.configValue,
      configType: dto.configType,
      label: dto.label,
      description: dto.description ?? null,
      options: dto.options ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: 'Y',
      company,
      plant,
    });
    return this.sysConfigRepository.save(entity);
  }

  /** 설정 수정 */
  async update(
    id: string,
    dto: UpdateSysConfigDto,
    company?: string,
    plant?: string,
  ) {
    const config = await this.sysConfigRepository.findOne({
      where: { configKey: id, ...this.tenantWhere(company, plant) },
    });
    if (!config) throw new NotFoundException(`설정을 찾을 수 없습니다: ${id}`);
    this.assertSameTenant('시스템 설정', config, company, plant);
    await this.sysConfigRepository.update(
      { configKey: id, ...this.tenantWhere(company, plant) },
      dto,
    );
    return this.sysConfigRepository.findOne({
      where: { configKey: id, ...this.tenantWhere(company, plant) },
    });
  }

  /** 일괄 수정 (관리 페이지 저장 버튼) */
  async bulkUpdate(
    dto: BulkUpdateSysConfigDto,
    company?: string,
    plant?: string,
  ) {
    const results = [];
    for (const item of dto.items) {
      await this.sysConfigRepository.update(
        { configKey: item.id, ...this.tenantWhere(company, plant) },
        {
          configValue: item.configValue,
        },
      );
      const updated = await this.sysConfigRepository.findOne({
        where: { configKey: item.id, ...this.tenantWhere(company, plant) },
      });
      if (updated) results.push(updated);
    }
    return results;
  }

  /** 설정 삭제 */
  async remove(id: string, company?: string, plant?: string) {
    const config = await this.sysConfigRepository.findOne({
      where: { configKey: id, ...this.tenantWhere(company, plant) },
    });
    if (!config) throw new NotFoundException(`설정을 찾을 수 없습니다: ${id}`);
    this.assertSameTenant('시스템 설정', config, company, plant);
    await this.sysConfigRepository.delete({
      configKey: id,
      ...this.tenantWhere(company, plant),
    });
    return { id, deleted: true };
  }
}
