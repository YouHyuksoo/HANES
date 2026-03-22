/**
 * @file src/modules/master/services/shift-pattern.service.ts
 * @description 교대 패턴(Shift Pattern) CRUD 비즈니스 로직
 *
 * 초보자 가이드:
 * 1. 교대 패턴은 주간/야간 등 근무 교대 정보를 관리한다.
 * 2. 복합 PK: COMPANY + PLANT_CD + SHIFT_CODE
 * 3. 생산월력(WorkCalendar) 생성 시 교대 패턴을 참조하여 근무 시간을 계산한다.
 * 4. sortOrder 기준으로 정렬하여 교대 순서를 유지한다.
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { CreateShiftPatternDto, UpdateShiftPatternDto } from '../dto/work-calendar.dto';

@Injectable()
export class ShiftPatternService {
  constructor(
    @InjectRepository(ShiftPattern)
    private readonly repo: Repository<ShiftPattern>,
  ) {}

  /** 교대 패턴 전체 조회 (sortOrder 기준 정렬) */
  async findAll(company: string, plant: string) {
    return this.repo.find({
      where: { company, plant },
      order: { sortOrder: 'ASC' },
    });
  }

  /** 교대 패턴 생성 (중복 체크 포함) */
  async create(dto: CreateShiftPatternDto, company: string, plant: string) {
    const existing = await this.repo.findOne({
      where: { company, plant, shiftCode: dto.shiftCode },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 교대 코드: ${dto.shiftCode}`);
    }

    const entity = this.repo.create({
      ...dto,
      company,
      plant,
    });
    return this.repo.save(entity);
  }

  /** 교대 패턴 수정 */
  async update(shiftCode: string, dto: UpdateShiftPatternDto, company: string, plant: string) {
    const existing = await this.repo.findOne({
      where: { company, plant, shiftCode },
    });
    if (!existing) {
      throw new NotFoundException(`교대 패턴을 찾을 수 없습니다: ${shiftCode}`);
    }

    const { shiftCode: _sc, ...updateData } = dto;
    await this.repo.update({ company, plant, shiftCode }, updateData);
    return this.repo.findOne({ where: { company, plant, shiftCode } });
  }

  /** 교대 패턴 삭제 */
  async delete(shiftCode: string, company: string, plant: string) {
    const existing = await this.repo.findOne({
      where: { company, plant, shiftCode },
    });
    if (!existing) {
      throw new NotFoundException(`교대 패턴을 찾을 수 없습니다: ${shiftCode}`);
    }

    await this.repo.delete({ company, plant, shiftCode });
    return { shiftCode };
  }
}
