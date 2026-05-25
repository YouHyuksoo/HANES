/**
 * @file services/job-material-lot.service.ts
 * @description 작업지시별 자재 롯트 스캔 등록/조회/삭제
 *
 * 초보자 가이드:
 * - findByJobOrder: 작업지시에 스캔된 자재 롯트 목록 반환
 * - scanAndRegister: 바코드 스캔 후 BOM 매칭, 오장착 검증, 중복 처리 포함
 * - remove: 특정 BOM 항목의 롯트 등록 취소
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobMaterialLot } from '../../../entities/job-material-lot.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ScanBarcodeDto } from '../dto/job-material-lot.dto';
import { isRecord } from '../../../common/utils/json-record.util';

@Injectable()
export class JobMaterialLotService {
  constructor(
    @InjectRepository(JobMaterialLot)
    private readonly repo: Repository<JobMaterialLot>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /** 작업지시의 자재 롯트 목록 조회 */
  async findByJobOrder(jobOrderNo: string, company?: string, plant?: string): Promise<JobMaterialLot[]> {
    return this.repo.find({ where: { jobOrderNo, ...this.tenantWhere(company, plant) } });
  }

  /**
   * 바코드(matUid) 스캔 후 BOM 항목에 롯트 등록
   * bomItems: 프론트에서 전달한 BOM 항목 [{itemCode, seq}]
   */
  async scanAndRegister(
    jobOrderNo: string,
    dto: ScanBarcodeDto,
    bomItems: { itemCode: string; seq: number }[],
    company?: string,
    plant?: string,
  ): Promise<JobMaterialLot> {
    const tenantWhere = this.tenantWhere(company, plant);
    const matLot = await this.matLotRepo.findOne({ where: { matUid: dto.matUid, ...tenantWhere } });
    if (!matLot) {
      throw new NotFoundException(`LOT를 찾을 수 없습니다: ${dto.matUid}`);
    }

    const matched = bomItems.find(b => b.itemCode === matLot.itemCode);
    if (!matched) {
      throw new BadRequestException(`오장착: BOM에 없는 자재입니다 (${matLot.itemCode})`);
    }

    const existing = await this.repo.findOne({
      where: { jobOrderNo, itemCode: matched.itemCode, seq: matched.seq, ...tenantWhere },
    });
    if (existing) {
      if (existing.matUid === dto.matUid) return existing;
      existing.matUid = dto.matUid;
      existing.initQty = matLot.initQty;
      existing.scannedBy = dto.scannedBy ?? null;
      existing.scannedAt = new Date();
      return this.repo.save(existing);
    }

    try {
      const record = this.repo.create({
        jobOrderNo,
        itemCode: matched.itemCode,
        seq: matched.seq,
        matUid: dto.matUid,
        initQty: matLot.initQty,
        scannedBy: dto.scannedBy ?? null,
        scannedAt: new Date(),
        company: company ?? null,
        plant: plant ?? null,
      });
      return await this.repo.save(record);
    } catch (err: unknown) {
      const driverError = isRecord(err) && isRecord(err.driverError) ? err.driverError : undefined;
      const driverMessage = typeof driverError?.message === 'string' ? driverError.message : undefined;
      const isUnique = (isRecord(err) && err.code === 'ORA-00001') ||
        driverMessage?.includes('ORA-00001') ||
        driverMessage?.includes('unique constraint');
      if (isUnique) {
        const conflict = await this.repo.findOne({
          where: { jobOrderNo, itemCode: matched.itemCode, seq: matched.seq, ...tenantWhere },
        });
        if (conflict) return conflict;
      }
      throw err;
    }
  }

  /** 특정 BOM 항목의 롯트 등록 취소 */
  async remove(jobOrderNo: string, itemCode: string, seq: number, company?: string, plant?: string): Promise<void> {
    await this.repo.delete({ jobOrderNo, itemCode, seq, ...this.tenantWhere(company, plant) });
  }
}
