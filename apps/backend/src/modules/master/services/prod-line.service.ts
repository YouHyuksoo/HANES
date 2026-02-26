/**
 * @file src/modules/master/services/prod-line.service.ts
 * @description 생산라인마스터 비즈니스 로직 서비스 - TypeORM
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProdLineMaster } from '../../../entities/prod-line-master.entity';
import { CreateProdLineDto, UpdateProdLineDto, ProdLineQueryDto } from '../dto/prod-line.dto';

@Injectable()
export class ProdLineService {
  constructor(
    @InjectRepository(ProdLineMaster)
    private readonly prodLineRepository: Repository<ProdLineMaster>,
  ) {}

  async findAll(query: ProdLineQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.prodLineRepository.createQueryBuilder('prodLine')

    if (company) {
      queryBuilder.andWhere('prodLine.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('prodLine.plant = :plant', { plant });
    }

    if (useYn) {
      queryBuilder.andWhere('prodLine.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(prodLine.lineCode) LIKE UPPER(:search) OR UPPER(prodLine.lineName) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('prodLine.lineCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(lineCode: string) {
    const prodLine = await this.prodLineRepository.findOne({
      where: { lineCode },
    });
    if (!prodLine) throw new NotFoundException(`생산라인을 찾을 수 없습니다: ${lineCode}`);
    return prodLine;
  }

  async create(dto: CreateProdLineDto) {
    const existing = await this.prodLineRepository.findOne({
      where: { lineCode: dto.lineCode },
    });
    if (existing) throw new ConflictException(`이미 존재하는 라인 코드입니다: ${dto.lineCode}`);

    const prodLine = this.prodLineRepository.create({
      lineCode: dto.lineCode,
      lineName: dto.lineName,
      whLoc: dto.whLoc,
      erpCode: dto.erpCode,
      oper: dto.oper,
      lineType: dto.lineType,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    return this.prodLineRepository.save(prodLine);
  }

  async update(lineCode: string, dto: UpdateProdLineDto) {
    await this.findById(lineCode);
    await this.prodLineRepository.update({ lineCode }, dto);
    return this.findById(lineCode);
  }

  async delete(lineCode: string) {
    await this.findById(lineCode);
    await this.prodLineRepository.delete({ lineCode });
    return { lineCode };
  }
}
