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
import { Repository, QueryRunner } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { AutoIssueService } from './auto-issue.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
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
    private readonly wipMatStockService: WipMatStockService,
    private readonly autoIssueService: AutoIssueService,
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
      // 원자재(RAW_MATERIAL) 자식 화이트리스트 — matLots(직접투입) 검증용
      const rawCodeSet = new Set(
        childParts.filter((p) => p.itemType === 'RAW_MATERIAL').map((p) => p.itemCode),
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

        // matLots(원자재 직접투입) — genealogy(FG←MAT_LOT)는 각 FG에 대해 기록(기존 동작 유지).
        // 실제 재고 차감은 FG 루프와 별개로 1회만 수행(아래 5-1).
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

      // 6-1. matLots(직접투입 원자재) 실제 재고 차감 — FG 루프와 별개로 1회 처리.
      //   · 화이트리스트: 완제품 BOM의 RAW_MATERIAL 자식만 허용.
      //   · equipCode 있고 해당 LOT가 공정재고(WIP_MAT_STOCKS)에 있으면 → 공정재고 차감.
      //   · 아니면 → 원자재창고(MAT_STOCKS) 차감(auto-issue fallback 저수준 경로 재사용).
      //   · qty 의미: dto의 qty(스캔 입력) 신뢰, 없으면 1 (BOM qtyPer 자동계산은 범위 밖).
      //   · 부족/미존재면 BadRequest로 throw → 트랜잭션 롤백.
      if (dto.matLots && dto.matLots.length > 0) {
        await this.deductMatLotsInTx(qr, {
          matLots: dto.matLots,
          rawCodeSet,
          equipCode: dto.equipCode ?? null,
          orderNo: dto.orderNo,
          resultNo,
          workerId: workerId ?? null,
          company,
          plant,
        });
      }

      // 7. 제품 WIP 재고 +qty (WIP_MAIN). 품목+창고 단일행 집계 적재.
      await this.productInventory.receiveStockInTx(qr, {
        warehouseId: WIP_WAREHOUSE,
        itemCode: jobOrder.itemCode,
        itemType: 'FINISHED',
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

  /**
   * matLots(직접투입 원자재 LOT) 실제 재고 차감 + 수불 기록.
   * - kit() 트랜잭션 내에서 1회 호출(FG 루프와 별개).
   * - 각 LOT: RAW_MATERIAL 화이트리스트 검증 → equipCode+공정재고 보유 시 WIP 차감, 아니면 원자재창고 차감.
   * - genealogy(FG←MAT_LOT) 기록은 호출부(kit)에서 별도로 이미 처리됨(차감과 genealogy 둘 다 남음).
   */
  private async deductMatLotsInTx(
    qr: QueryRunner,
    p: {
      matLots: { matUid: string; itemCode: string; qty?: number }[];
      rawCodeSet: Set<string>;
      equipCode: string | null;
      orderNo: string;
      resultNo: string;
      workerId: string | null;
      company: string;
      plant: string;
    },
  ): Promise<void> {
    for (const lot of p.matLots) {
      // 1) BOM RAW_MATERIAL 자식 화이트리스트 검증
      if (!p.rawCodeSet.has(lot.itemCode)) {
        throw new BadRequestException(
          `BOM에 없는 원자재 직접투입 LOT입니다: ${lot.matUid} (${lot.itemCode})`,
        );
      }
      const qty = lot.qty ?? 1;
      if (qty <= 0) {
        throw new BadRequestException(`직접투입 수량이 올바르지 않습니다: ${lot.matUid} (${qty})`);
      }

      // 2) equipCode 있고 해당 LOT가 공정재고(WIP_MAT_STOCKS)에 존재하면 공정재고 차감
      let usedWip = false;
      if (p.equipCode) {
        const wipRow = await qr.manager.findOne(WipMatStock, {
          where: {
            company: p.company,
            plant: p.plant,
            equipCode: p.equipCode,
            itemCode: lot.itemCode,
            matUid: lot.matUid,
          },
        });
        if (wipRow) {
          // 지정 LOT 우선 차감(scannedMatUids) + 부족 시 예외(BLOCK)
          const deducted = await this.wipMatStockService.deductStockInTx(qr, {
            equipCode: p.equipCode,
            itemCode: lot.itemCode,
            qty,
            transType: 'PROD_CONSUME',
            refType: 'KITTING',
            refId: p.resultNo,
            orderNo: p.orderNo,
            scannedMatUids: [lot.matUid],
            stockPolicy: 'BLOCK',
            workerId: p.workerId,
            company: p.company,
            plant: p.plant,
          });
          // deductStockInTx는 (equip,item) FIFO라 다른 LOT가 차감될 수 있으므로 지정 LOT 일치 검증
          const tookSpecified = deducted.some((d) => d.matUid === lot.matUid);
          if (!tookSpecified) {
            throw new BadRequestException(
              `공정재고에서 지정 LOT를 차감하지 못했습니다: ${lot.matUid} (${lot.itemCode})`,
            );
          }
          usedWip = true;
        }
      }

      // 3) 공정재고 미사용 → 원자재창고(MAT_STOCKS) 지정 LOT 차감(auto-issue 저수준 경로 재사용)
      if (!usedWip) {
        await this.autoIssueService.consumeMatLotInTx(qr, {
          matUid: lot.matUid,
          itemCode: lot.itemCode,
          qty,
          orderNo: p.orderNo,
          prodResultNo: p.resultNo,
          refType: 'KITTING',
          refId: p.resultNo,
          workerId: p.workerId,
          company: p.company,
          plant: p.plant,
        });
      }
    }
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
