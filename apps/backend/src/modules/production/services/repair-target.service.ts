/**
 * @file repair-target.service.ts
 * @description 수리 품목/기준정보 검증과 FG 라벨 잠금·종결을 담당한다.
 * 시리얼 수리는 포장 전 외관불합격 FG만 지원하고, 수동 수리는 품목 수량 단위로 처리한다.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Not, QueryRunner } from 'typeorm';
import { ItemMaster } from '../../../entities/item-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { RepairOrder } from '../../../entities/repair-order.entity';

export interface RepairTargetDraft {
  itemCode: string;
  qty?: number;
  fgBarcode?: string | null;
  prdUid?: string | null;
  sourceProcess?: string | null;
  returnProcess?: string | null;
  workerId?: string | null;
  usedParts?: { itemCode: string; qty?: number }[];
}

@Injectable()
export class RepairTargetService {
  async validateDraftInTx(qr: QueryRunner, draft: RepairTargetDraft, company: string, plant: string): Promise<void> {
    if (!company?.trim() || !plant?.trim()) throw new BadRequestException('회사와 공장 정보가 필요합니다.');
    this.positiveQty(draft.qty ?? 1);
    const item = await this.activeItem(qr, draft.itemCode, company, plant);
    if (!['FINISHED', 'SEMI_PRODUCT'].includes(item.itemType)) {
      throw new BadRequestException('수리 대상은 반제품 또는 완제품이어야 합니다.');
    }
    for (const processCode of [draft.sourceProcess, draft.returnProcess]) {
      if (!processCode) continue;
      const process = await qr.manager.findOne(ProcessMaster, { where: { processCode, company, plant } });
      if (!process || process.useYn !== 'Y') throw new BadRequestException('사용 중인 공정을 선택하세요.');
    }
    if (draft.workerId) {
      const worker = await qr.manager.findOne(WorkerMaster, { where: { workerCode: draft.workerId, company, plant } });
      if (!worker || worker.useYn !== 'Y') throw new BadRequestException('사용 중인 작업자를 선택하세요.');
    }
    const seen = new Set<string>();
    for (const part of draft.usedParts ?? []) {
      this.positiveQty(part.qty ?? 1);
      if (seen.has(part.itemCode)) throw new BadRequestException('같은 사용부품은 한 행에 합산하세요.');
      seen.add(part.itemCode);
      const material = await this.activeItem(qr, part.itemCode, company, plant);
      if (material.itemType !== 'RAW_MATERIAL') throw new BadRequestException('사용부품은 원자재 품목이어야 합니다.');
    }
    if (draft.fgBarcode) {
      await this.repairableLabel(qr, draft, company, plant, false);
    } else if (draft.prdUid) {
      throw new BadRequestException('수동 품목 수리에는 시리얼을 지정할 수 없습니다. FG 바코드를 스캔하세요.');
    }
  }

  async validateStartInTx(qr: QueryRunner, order: RepairOrder): Promise<void> {
    await this.validateDraftInTx(qr, order, order.company, order.plant);
    if (!order.fgBarcode) return;
    // 다른 오더가 동일 FG를 시작해도 라벨 잠금을 얻은 후 커밋된 IN_REPAIR를 다시 확인한다.
    await this.repairableLabel(qr, order, order.company, order.plant, true);
    const existing = await qr.manager.findOne(RepairOrder, {
      where: {
        fgBarcode: order.fgBarcode, status: 'IN_REPAIR', seq: Not(order.seq),
        company: order.company, plant: order.plant,
      },
    });
    if (existing) throw new BadRequestException('같은 FG 바코드가 다른 수리오더에서 수리 중입니다.');
  }

  async finishLabelInTx(qr: QueryRunner, order: RepairOrder, inspectedPass: boolean): Promise<void> {
    if (!order.fgBarcode) {
      if (order.prdUid) throw new BadRequestException('수동 품목 수리의 시리얼은 지원하지 않습니다.');
      return;
    }
    await this.repairableLabel(qr, order, order.company, order.plant, true);
    let update: Partial<FgLabel>;
    if (order.disposition === 'SCRAP') {
      update = { status: 'VOIDED', inspectPassYn: 'N', voidReason: `REPAIR:${order.seq} 수리 폐기` };
    } else if (inspectedPass) {
      update = { status: 'VISUAL_PASS', inspectPassYn: 'Y' };
    } else if (order.disposition === 'REUSE') {
      // 공정 복귀 시 검사 상태를 초기화하여 지정 공정의 검사를 다시 수행한다.
      update = { status: 'ISSUED', inspectPassYn: null, inspectResultId: null };
    } else {
      throw new BadRequestException('재검사 합격 후 FG 라벨을 종결할 수 있습니다.');
    }
    await qr.manager.update(FgLabel,
      { fgBarcode: order.fgBarcode, company: order.company, plant: order.plant }, update);
  }

  private async repairableLabel(qr: QueryRunner, draft: RepairTargetDraft, company: string, plant: string, lock: boolean) {
    if (!draft.fgBarcode?.trim() || draft.fgBarcode.length > 30
      || draft.prdUid !== draft.fgBarcode || (draft.qty ?? 1) !== 1) {
      throw new BadRequestException('FG 수리는 실제 바코드와 동일한 시리얼, 수량 1로 등록해야 합니다.');
    }
    const label = await qr.manager.findOne(FgLabel, {
      where: { fgBarcode: draft.fgBarcode, company, plant },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!label || label.itemCode !== draft.itemCode || label.status !== 'VISUAL_FAIL' || label.boxNo || label.replacedBy) {
      throw new BadRequestException('품목이 일치하는 포장 전 외관불합격 FG 라벨만 수리할 수 있습니다.');
    }
    return label;
  }

  private async activeItem(qr: QueryRunner, itemCode: string, company: string, plant: string) {
    if (!itemCode?.trim()) throw new BadRequestException('품목을 선택하세요.');
    const item = await qr.manager.findOne(ItemMaster, { where: { itemCode, company, plant } });
    if (!item || item.useYn !== 'Y') throw new BadRequestException(`사용 중인 품목이 아닙니다: ${itemCode}`);
    return item;
  }

  private positiveQty(qty: number) {
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new BadRequestException('수량은 양의 정수여야 합니다.');
  }
}
