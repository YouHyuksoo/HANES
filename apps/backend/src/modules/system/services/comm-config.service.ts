/**
 * @file src/modules/system/services/comm-config.service.ts
 * @description 통신설정 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: 페이지네이션 + 필터 목록 조회
 * 2. **findById / findByName / findByType**: 단건/유형별 조회
 * 3. **create / update / remove**: CRUD 처리, 소프트 삭제
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CommConfig } from '../../../entities/comm-config.entity';
import {
  CreateCommConfigDto,
  UpdateCommConfigDto,
  CommConfigQueryDto,
} from '../dto/comm-config.dto';

@Injectable()
export class CommConfigService {
  private readonly logger = new Logger(CommConfigService.name);

  constructor(
    @InjectRepository(CommConfig)
    private readonly commConfigRepository: Repository<CommConfig>,
  ) {}

  /** 목록 조회 (페이지네이션 + 필터) */
  async findAll(query: CommConfigQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, commType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (commType) where.commType = commType;
    if (useYn) where.useYn = useYn;

    if (search) {
      where.configName = ILike(`%${search}%`);
    }

    const [data, total] = await Promise.all([
      this.commConfigRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.commConfigRepository.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 단건 조회 (ID) */
  async findById(id: string) {
    const config = await this.commConfigRepository.findOne({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('통신설정을 찾을 수 없습니다.');
    }

    return config;
  }

  /** 이름으로 조회 (다른 화면에서 참조용) */
  async findByName(configName: string) {
    const config = await this.commConfigRepository.findOne({
      where: { configName },
    });

    if (!config) {
      throw new NotFoundException(`통신설정 '${configName}'을 찾을 수 없습니다.`);
    }

    return config;
  }

  /** 유형별 목록 (드롭다운용) */
  async findByType(commType: string) {
    return this.commConfigRepository.find({
      where: {
        commType,
        useYn: 'Y',
      },
      select: [
        'id',
        'configName',
        'commType',
        'host',
        'port',
        'portName',
        'baudRate',
      ],
      order: { configName: 'ASC' },
    });
  }

  /** 생성 */
  async create(dto: CreateCommConfigDto) {
    const existing = await this.commConfigRepository.findOne({
      where: { configName: dto.configName },
    });

    if (existing) {
      throw new ConflictException(`이미 등록된 설정 이름입니다: ${dto.configName}`);
    }

    const config = this.commConfigRepository.create({
      configName: dto.configName,
      commType: dto.commType,
      description: dto.description,
      host: dto.host,
      port: dto.port,
      portName: dto.portName,
      baudRate: dto.baudRate,
      dataBits: dto.dataBits,
      stopBits: dto.stopBits,
      parity: dto.parity,
      flowControl: dto.flowControl,
      extraConfig: dto.extraConfig ? JSON.stringify(dto.extraConfig) : undefined,
      useYn: dto.useYn ?? 'Y',
    });

    return this.commConfigRepository.save(config);
  }

  /** 수정 */
  async update(id: string, dto: UpdateCommConfigDto) {
    await this.findById(id);

    // 이름 변경 시 중복 체크
    if (dto.configName) {
      const existing = await this.commConfigRepository.findOne({
        where: { configName: dto.configName },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`이미 등록된 설정 이름입니다: ${dto.configName}`);
      }
    }

    const updateData: Partial<CommConfig> = {};
    if (dto.configName !== undefined) updateData.configName = dto.configName;
    if (dto.commType !== undefined) updateData.commType = dto.commType;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.host !== undefined) updateData.host = dto.host;
    if (dto.port !== undefined) updateData.port = dto.port;
    if (dto.portName !== undefined) updateData.portName = dto.portName;
    if (dto.baudRate !== undefined) updateData.baudRate = dto.baudRate;
    if (dto.dataBits !== undefined) updateData.dataBits = dto.dataBits;
    if (dto.stopBits !== undefined) updateData.stopBits = dto.stopBits;
    if (dto.parity !== undefined) updateData.parity = dto.parity;
    if (dto.flowControl !== undefined) updateData.flowControl = dto.flowControl;
    if (dto.extraConfig !== undefined) updateData.extraConfig = JSON.stringify(dto.extraConfig);
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.commConfigRepository.update(id, updateData);
    return this.findById(id);
  }

  /** 삭제 (소프트 삭제) */
  async remove(id: string) {
    await this.findById(id);

    await this.commConfigRepository.delete(id);

    return { message: '통신설정이 삭제되었습니다.' };
  }
}
