/**
 * @file src/modules/production/services/subprocess-kitting.service.ts
 * @description 서브공정 키팅 서비스 — 완제품 작업지시의 서브공정에서 스캔된 반제품 묶음(SG_LABELS)에서
 *              가닥을 소비해 제품라벨(FG_LABELS)을 발행하고 genealogy(PRODUCT_GENEALOGY)를 남기며
 *              제품 WIP 재고(WIP_MAIN)를 올린다.
 *
 * 핵심 원칙:
 * - 단일 트랜잭션(this.tx.run) 내에서 채번/저장/재고적재를 모두 처리한다.
 * - 모든 쿼리는 멀티테넌시(company / PLANT_CD) 스코프를 적용한다.
 * - 채번은 모두 동일한 QueryRunner(qr)를 전달한다.
 * - cancel()은 본 범위에서 구현하지 않는다(별도 후속).
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { JobOrder } from '../../../entities/job-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ProductGenealogy } from '../../../entities/product-genealogy.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { KitDto } from '../dto/subprocess-kitting.dto';
import { In } from 'typeorm';

/** 제품 WIP 공정창고 코드 — 생산실적 자동 적재(adsorbProductStockInTx)와 동일하게 WIP_MAIN 사용 */
const WIP_WAREHOUSE = 'WIP_MAIN';

@Injectable()
export class SubprocessKittingService {
  private readonly logger = new Logger(SubprocessKittingService.name);

  constructor(
    @InjectRepository(SgLabel)
    private readonly sgLabelRepository: Repository<SgLabel>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
    private readonly productInventory: ProductInventoryService,
  ) {}

  /**
   * 서브공정 키팅 — FG 발행 + SG 소비 + genealogy + 제품 WIP 재고 적재.
   * @returns { resultNo, fgBarcodes }
   */
  async kit(
    dto: KitDto,
    company: string,
    plant: string,
    workerId?: string,
  ): Promise<{ resultNo: string; fgBarcodes: string[] }> {
    const tenantWhere = { company, plant };

    return this.tx.run(async (qr) => {
      // 1. 작업지시 조회 + 완제품 검증
      const jobOrder = await qr.manager.findOne(JobOrder, {
        where: { orderNo: dto.orderNo, ...tenantWhere },
        relations: ['part'],
      });
      if (!jobOrder) {
        throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.orderNo}`);
      }
      if (jobOrder.part?.itemType !== 'FINISHED') {
        throw new BadRequestException('완제품 작업지시만 키팅 가능합니다.');
      }

      // 2. 완제품 BOM의 반제품(SEMI_PRODUCT) 자식 종류 조회 (RAW 자식은 이 단계에서 무시 — matLots로 별도)
      const bomRows = await qr.manager.find(BomMaster, {
        where: { parentItemCode: jobOrder.itemCode, useYn: 'Y', ...tenantWhere },
      });
      if (bomRows.length === 0) {
        throw new BadRequestException(`완제품 BOM이 없습니다: ${jobOrder.itemCode}`);
      }

      // 자식 품목의 itemType 조회 → SEMI_PRODUCT 만 화이트리스트로 채택
      const childCodes = [...new Set(bomRows.map((b) => b.childItemCode))];
      const childParts = await qr.manager.find(PartMaster, {
        where: { itemCode: In(childCodes), ...tenantWhere },
        select: ['itemCode', 'itemType'],
      });
      const semiCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'SEMI_PRODUCT').map((p) => p.itemCode),
      );
      // itemCode → qtyPer 매핑 (SEMI 자식만)
      const qtyPerByItem = new Map<string, number>();
      for (const b of bomRows) {
        if (semiCodeSet.has(b.childItemCode)) {
          qtyPerByItem.set(b.childItemCode, Number(b.qtyPer));
        }
      }
      if (qtyPerByItem.size === 0) {
        throw new BadRequestException(
          `완제품 BOM에 반제품(SEMI_PRODUCT) 자식이 없습니다: ${jobOrder.itemCode}`,
        );
      }

      // 3. 스캔된 SG 검증 (status / remainQty / 화이트리스트)
      const sgBarcodes = [...new Set(dto.sgBarcodes)];
      const sgLabels = await qr.manager.find(SgLabel, {
        where: { sgBarcode: In(sgBarcodes), ...tenantWhere },
      });
      const foundSet = new Set(sgLabels.map((s) => s.sgBarcode));
      const missing = sgBarcodes.filter((b) => !foundSet.has(b));
      if (missing.length > 0) {
        throw new BadRequestException(`존재하지 않는 SG 라벨: ${missing.join(', ')}`);
      }
      for (const sg of sgLabels) {
        if (!['IN_STOCK', 'MOUNTED'].includes(sg.status)) {
          throw new BadRequestException(
            `사용할 수 없는 SG 라벨 상태입니다: ${sg.sgBarcode} (${sg.status})`,
          );
        }
        if (sg.remainQty <= 0) {
          throw new BadRequestException(`잔량이 없는 SG 라벨입니다: ${sg.sgBarcode}`);
        }
        if (!semiCodeSet.has(sg.itemCode)) {
          throw new BadRequestException(
            `BOM에 없는 반제품 SG 라벨입니다: ${sg.sgBarcode} (${sg.itemCode})`,
          );
        }
      }

      // 4. 용량 검증 — 각 SEMI 자식 itemCode에 대해 required vs available
      for (const [itemCode, qtyPer] of qtyPerByItem) {
        const required = dto.qty * qtyPer;
        const available = sgLabels
          .filter((s) => s.itemCode === itemCode)
          .reduce((sum, s) => sum + s.remainQty, 0);
        if (available < required) {
          throw new BadRequestException(
            `재고 부족: ${itemCode} 필요 ${required}, 가용 ${available}`,
          );
        }
      }

      // 5. 제품 루프 — 제품 수량만큼 FG 발행 + SG 소비 + genealogy
      const fgBarcodes: string[] = [];
      for (let i = 0; i < dto.qty; i++) {
        // FG 발행
        const fg = await this.numbering.nextFgBarcode(qr);
        await qr.manager.save(FgLabel, {
          fgBarcode: fg,
          itemCode: jobOrder.itemCode,
          orderNo: dto.orderNo,
          status: 'ISSUED',
          equipCode: dto.equipCode ?? null,
          workerId: workerId ?? null,
          inspectPassYn: null,
          company,
          plant,
        });
        fgBarcodes.push(fg);

        // 각 SEMI 자식 itemCode 별로 qtyPer 만큼 FIFO 소비
        for (const [itemCode, qtyPer] of qtyPerByItem) {
          let need = qtyPer;
          // 해당 itemCode 의 SG 중 잔량 있는 것을 FIFO(issuedAt ASC) 정렬
          const candidates = sgLabels
            .filter((s) => s.itemCode === itemCode && s.remainQty > 0)
            .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
          for (const sg of candidates) {
            if (need <= 0) break;
            if (sg.remainQty <= 0) continue;
            const take = Math.min(need, sg.remainQty);
            sg.remainQty -= take;
            sg.status = sg.remainQty === 0 ? 'CONSUMED' : 'MOUNTED';
            sg.currentProcessCode = dto.processCode;
            await qr.manager.save(SgLabel, sg);

            await qr.manager.save(ProductGenealogy, {
              genealogyId: await this.numbering.nextGenealogyId(qr),
              parentType: 'FG',
              parentKey: fg,
              childType: 'SG',
              childKey: sg.sgBarcode,
              itemCode: sg.itemCode,
              qty: take,
              processCode: dto.processCode,
              circuitNo: dto.circuitNo ?? null,
              company,
              plant,
            });
            need -= take;
          }
          // 용량 검증을 통과했으므로 need 는 0이 되어야 한다. 방어적 체크.
          if (need > 0) {
            throw new BadRequestException(
              `재고 부족: ${itemCode} (제품 ${i + 1}/${dto.qty} 처리 중 잔량 소진)`,
            );
          }
        }

        // matLots(원자재 직접투입) — genealogy 만 기록. 원자재 재고 차감은 Phase 2 범위 밖.
        if (dto.matLots && dto.matLots.length > 0) {
          for (const lot of dto.matLots) {
            await qr.manager.save(ProductGenealogy, {
              genealogyId: await this.numbering.nextGenealogyId(qr),
              parentType: 'FG',
              parentKey: fg,
              childType: 'MAT_LOT',
              childKey: lot.matUid,
              itemCode: lot.itemCode,
              qty: lot.qty ?? 1,
              processCode: dto.processCode,
              circuitNo: dto.circuitNo ?? null,
              company,
              plant,
            });
          }
        }
      }

      // 6. 생산실적 1건
      const resultNo = await this.numbering.nextProdResultNo(qr);
      const now = new Date();
      await qr.manager.save(ProdResult, {
        resultNo,
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        goodQty: dto.qty,
        defectQty: 0,
        status: 'DONE',
        startAt: now,
        endAt: now,
        equipCode: dto.equipCode ?? null,
        workerId: workerId ?? null,
        company,
        plant,
      });

      // 7. 제품 WIP 재고 +qty (WIP_MAIN). prdUid 센티넬 '*' 집계 적재.
      await this.productInventory.receiveStockInTx(qr, {
        warehouseId: WIP_WAREHOUSE,
        itemCode: jobOrder.itemCode,
        itemType: 'FINISHED',
        prdUid: '*',
        qty: dto.qty,
        transType: 'WIP_IN',
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        refType: 'KITTING',
        refId: resultNo,
        workerId: workerId ?? undefined,
        remark: '서브공정 키팅 적재',
        company,
        plant,
      });

      this.logger.log(
        `서브공정 키팅: ${jobOrder.itemCode} × ${dto.qty} → ${WIP_WAREHOUSE} (실적 #${resultNo}, FG ${fgBarcodes.length}건)`,
      );

      return { resultNo, fgBarcodes };
    });
  }

  /** SG 라벨 단건 조회 (tenant). 없으면 NotFound. */
  async getSgLabel(
    sgBarcode: string,
    company: string,
    plant: string,
  ): Promise<{
    sgBarcode: string;
    itemCode: string;
    remainQty: number;
    status: string;
    orderNo: string | null;
  }> {
    const sg = await this.sgLabelRepository.findOne({
      where: { sgBarcode, company, plant },
    });
    if (!sg) {
      throw new NotFoundException(`SG 라벨을 찾을 수 없습니다: ${sgBarcode}`);
    }
    return {
      sgBarcode: sg.sgBarcode,
      itemCode: sg.itemCode,
      remainQty: sg.remainQty,
      status: sg.status,
      orderNo: sg.orderNo,
    };
  }
}
