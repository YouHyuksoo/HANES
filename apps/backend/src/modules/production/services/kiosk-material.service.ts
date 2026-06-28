/**
 * @file services/kiosk-material.service.ts
 * @description 키오스크 자재 — BOM 오장착 검증 후 설비(equipCode) 기준 장착
 *
 * 초보자 가이드:
 * - 소모품과 동일하게, 자재도 설비에 귀속 장착(WIP_MAT_STOCKS)되어 작업지시가 바뀌어도 유지된다.
 * - 스캔된 matUid의 품목이 작업지시 제품 BOM(USE_YN='Y')에 없으면 오장착으로 거부한다
 *   (프론트 BOM 표시(/master/boms/parent)와 동일한 기준).
 * - 실제 장착(WIP 적재·MAT_LOTS 차감·이력)은 EquipMaterialService.mount에 위임한다(중복 로직 방지).
 * - 목록 조회/해제는 키오스크가 보유한 equipCode로 기존 /production/equip-material/* 를 재사용한다.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { EquipMaterialService, MountedRow } from './equip-material.service';

@Injectable()
export class KioskMaterialService {
  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(BomMaster)
    private readonly bomRepo: Repository<BomMaster>,
    @InjectRepository(MatLot)
    private readonly matLotRepo: Repository<MatLot>,
    private readonly equipMaterialService: EquipMaterialService,
  ) {}

  /**
   * 바코드(matUid) 스캔 → 자재 LOT를 설비에 장착(BOM 오장착 검증 후 위임).
   * @param equipCodeOverride 지정 시 작업지시 설비 대신 이 설비에 장착.
   */
  async scanMount(
    orderNo: string,
    matUid: string,
    company: string,
    plant: string,
    equipCodeOverride?: string,
  ): Promise<MountedRow> {
    const jobOrder = await this.jobOrderRepo.findOne({
      where: { orderNo, company, plant },
    });
    if (!jobOrder?.itemCode) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }

    const effectiveEquip = equipCodeOverride ?? jobOrder.equipCode;
    if (!effectiveEquip) {
      throw new BadRequestException('장착 대상 설비가 지정되지 않았습니다. (작업지시 설비 필요)');
    }
    const bomEffectiveDate = this.resolveBomEffectiveDate(jobOrder);

    // 1. 스캔 LOT 조회 — 실제 품목 확인
    const lot = await this.matLotRepo.findOne({
      where: { matUid, company, plant },
    });
    if (!lot) {
      throw new NotFoundException(`자재 LOT를 찾을 수 없습니다: ${matUid}`);
    }

    // 2. 오장착 검증 — 스캔 LOT 품목이 작업지시 제품 BOM(USE_YN='Y')에 있는지
    const inBom = await this.bomRepo.count({
      where: {
        parentItemCode: jobOrder.itemCode,
        childItemCode: lot.itemCode,
        useYn: 'Y',
        validFrom: LessThanOrEqual(bomEffectiveDate),
        validTo: MoreThanOrEqual(bomEffectiveDate),
        company,
        plant,
      },
    });
    if (inBom === 0) {
      throw new BadRequestException(
        `오장착: 이 제품 BOM에 없는 자재입니다 (${lot.itemCode})`,
      );
    }

    // 3. 설비 장착(WIP 적재 + MAT_LOTS 차감 + 이력)은 공용 서비스에 위임
    return this.equipMaterialService.mount(effectiveEquip, matUid, company, plant);
  }

  private resolveBomEffectiveDate(jobOrder: JobOrder): Date {
    if (!jobOrder.planDate) {
      throw new BadRequestException(
        `작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다: ${jobOrder.orderNo}`,
      );
    }

    const date = new Date(jobOrder.planDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `작업지시 계획일이 올바르지 않아 BOM 기준일을 결정할 수 없습니다: ${jobOrder.orderNo}`,
      );
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
