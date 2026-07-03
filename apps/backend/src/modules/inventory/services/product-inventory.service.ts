/**
 * @file src/modules/inventory/services/product-inventory.service.ts
 * @description 제품(WIP/FG) 수불관리 서비스 - PRODUCT_STOCKS/PRODUCT_TRANSACTIONS 테이블 사용
 *
 * 초보자 가이드:
 * - 원자재(RAW)는 InventoryService(MAT_STOCKS) 사용
 * - 제품(WIP/FG)은 이 서비스(PRODUCT_STOCKS) 사용
 * - 핵심 원칙: 모든 수불 이력 보존, 취소 시 역분개
 */
import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryRunner, FindOptionsWhere, EntityManager } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
import {
  ProductReceiveStockDto,
  ProductIssueStockDto,
  ProductDefectTransferDto,
  ProductTransactionQueryDto,
  ProductStockQueryDto,
} from '../dto/product-inventory.dto';
import { CancelTransactionDto } from '../dto/inventory.dto';

@Injectable()
export class ProductInventoryService {
  private readonly logger = new Logger(ProductInventoryService.name);

  constructor(
    @InjectRepository(ProductTransaction)
    private readonly transactionRepository: Repository<ProductTransaction>,
    @InjectRepository(ProductStock)
    private readonly stockRepository: Repository<ProductStock>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepository: Repository<FgLabel>,
    @InjectRepository(BoxMaster)
    private readonly boxRepository: Repository<BoxMaster>,
    private readonly tx: TransactionService,
  ) {}

  /**
   * 박스 입고 시 박스에 담긴 시리얼(FG_LABELS)의 BOX_NO 스탬프.
   * BOX_NO는 포장 식별자이므로 입고 취소 시에도 지우지 않는다.
   * 창고재고 여부는 PRODUCT_TRANSACTIONS의 BOX 입고 이동 이력으로 판정한다.
   */
  private async stampBoxSerials(
    manager: EntityManager,
    boxNo: string,
    assign: boolean,
    company?: string | null,
    plant?: string | null,
  ): Promise<void> {
    const tenantWhere = this.tenantWhere(company, plant);
    if (assign) {
      const box = await manager.findOne(BoxMaster, { where: { boxNo, ...tenantWhere } });
      const serials: string[] = box?.serialList ? JSON.parse(box.serialList) : [];
      if (serials.length === 0) return;
      await manager.update(
        FgLabel,
        { fgBarcode: In(serials), ...tenantWhere },
        { boxNo },
      );
    } else {
      return;
    }
  }

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    expected: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (expected.company && actual.company !== expected.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. expected=${expected.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (expected.plant && actual.plant !== expected.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. expected=${expected.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  private normalizeQualityStatus(value?: string | null): 'GOOD' | 'DEFECT' {
    return value === 'DEFECT' ? 'DEFECT' : 'GOOD';
  }

  /** 제품 트랜잭션 번호 생성 (PTX20260224XXXXX 형식) */
  private async generateTransNo(qr?: QueryRunner): Promise<string> {
    const today = new Date();
    const prefix = `PTX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const repo = qr ? qr.manager.getRepository(ProductTransaction) : this.transactionRepository;
    const lastTrans = await repo
      .createQueryBuilder('t')
      .where('t.transNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('t.transNo', 'DESC')
      .getOne();

    let seq = 1;
    if (lastTrans) {
      const lastSeq = parseInt(lastTrans.transNo.slice(-5), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /** 제품 입고 처리 */
  async receiveStock(dto: ProductReceiveStockDto) {
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);
    const qualityStatus = this.normalizeQualityStatus(dto.qualityStatus);

    // 이중입고 가드: 박스(refType='BOX')는 1회만 입고. 동일 박스의 정상(DONE) 입고가 이미 있으면 거부.
    // 취소(_CANCEL) 트랜잭션과 취소된(CANCELED) 원본은 제외 → 취소 후 재입고는 허용.
    if (dto.refType === 'BOX' && dto.refId) {
      const dup = await this.transactionRepository.findOne({
        where: {
          refType: 'BOX',
          refId: dto.refId,
          transType: In(['FG_IN', 'WIP_IN']),
          status: 'DONE',
          ...tenantWhere,
        },
      });
      if (dup) {
        throw new ConflictException(`이미 입고된 박스입니다: ${dto.refId} (${dup.transNo})`);
      }
    }

    const transNo = await this.generateTransNo();

    return this.tx.run(async (queryRunner) => {
      // 1. 트랜잭션 생성
      const transaction = this.transactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        toWarehouseId: dto.warehouseId,
        itemCode: dto.itemCode,
        itemType: dto.itemType,
        // PRODUCT_TRANSACTIONS는 원장이므로 prdUid 원본 보존(없으면 null). PRODUCT_STOCKS 키엔 미사용.
        prdUid: dto.prdUid ?? null,
        qualityStatus,
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        qty: dto.qty,
        unitPrice: dto.unitPrice,
        totalAmount: dto.unitPrice ? dto.unitPrice * dto.qty : null,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
        company: dto.company,
        plant: dto.plant,
      });

      const savedTransaction = await queryRunner.manager.save(ProductTransaction, transaction);

      // 박스 입고: 박스 시리얼(FG_LABELS)에 BOX_NO 스탬프 → 제품재고(미출하)로 인식
      if (dto.refType === 'BOX' && dto.refId) {
        await this.stampBoxSerials(queryRunner.manager, dto.refId, true, dto.company, dto.plant);
      }

      // 2. 재고 업데이트 (품목+창고+품질상태)
      const existingStock = await queryRunner.manager.findOne(ProductStock, {
        where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
        /* Oracle PDB 호환: pessimistic_write 제거, 트랜잭션 isolation으로 보장 */
      });

      if (existingStock) {
        await queryRunner.manager.update(ProductStock,
          { warehouseCode: existingStock.warehouseCode, itemCode: existingStock.itemCode, qualityStatus, ...tenantWhere },
          { qty: existingStock.qty + dto.qty, availableQty: existingStock.qty + dto.qty - existingStock.reservedQty },
        );
      } else {
        await queryRunner.manager.save(ProductStock, {
          warehouseCode: dto.warehouseId,
          itemCode: dto.itemCode,
          qualityStatus,
          itemType: dto.itemType,
          prdUid: dto.prdUid ?? null,
          orderNo: dto.orderNo || null,
          processCode: dto.processCode || null,
          qty: dto.qty,
          reservedQty: 0,
          availableQty: dto.qty,
          company: dto.company,
          plant: dto.plant,
        });
      }

      return savedTransaction;
    });
  }

  /**
   * 외부 트랜잭션(QueryRunner) 내에서 제품 입고 처리
   * - 생산실적 완료 시 공정창고 자동 적재 등에 사용
   * - 호출측 트랜잭션에 참여하므로 commit/rollback은 호출측이 담당
   */
  async receiveStockInTx(qr: QueryRunner, dto: ProductReceiveStockDto): Promise<ProductTransaction> {
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);
    const qualityStatus = this.normalizeQualityStatus(dto.qualityStatus);

    // 이중입고 가드: 박스(refType='BOX')는 1회만 입고
    if (dto.refType === 'BOX' && dto.refId) {
      const dup = await qr.manager.findOne(ProductTransaction, {
        where: {
          refType: 'BOX',
          refId: dto.refId,
          transType: In(['FG_IN', 'WIP_IN']),
          status: 'DONE',
          ...tenantWhere,
        },
      });
      if (dup) {
        throw new ConflictException(`이미 입고된 박스입니다: ${dto.refId} (${dup.transNo})`);
      }
    }

    const transNo = await this.generateTransNo(qr);

    const transaction = qr.manager.create(ProductTransaction, {
      transNo,
      transType: dto.transType,
      transDate: new Date(),
      toWarehouseId: dto.warehouseId,
      itemCode: dto.itemCode,
      itemType: dto.itemType,
      prdUid: dto.prdUid ?? null,
      qualityStatus,
      orderNo: dto.orderNo,
      processCode: dto.processCode,
      qty: dto.qty,
      unitPrice: dto.unitPrice,
      totalAmount: dto.unitPrice ? dto.unitPrice * dto.qty : null,
      refType: dto.refType,
      refId: dto.refId,
      workerId: dto.workerId,
      remark: dto.remark,
      status: 'DONE',
      company: dto.company,
      plant: dto.plant,
    });

    const saved = await qr.manager.save(ProductTransaction, transaction);

    // 박스 입고: 박스 시리얼(FG_LABELS)에 BOX_NO 스탬프
    if (dto.refType === 'BOX' && dto.refId) {
      await this.stampBoxSerials(qr.manager, dto.refId, true, dto.company, dto.plant);
    }

    const existingStock = await qr.manager.findOne(ProductStock, {
      where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
    });

    if (existingStock) {
      await qr.manager.update(ProductStock,
        { warehouseCode: existingStock.warehouseCode, itemCode: existingStock.itemCode, qualityStatus, ...tenantWhere },
        { qty: existingStock.qty + dto.qty, availableQty: existingStock.qty + dto.qty - existingStock.reservedQty },
      );
    } else {
      await qr.manager.save(ProductStock, {
        warehouseCode: dto.warehouseId,
        itemCode: dto.itemCode,
        qualityStatus,
        itemType: dto.itemType,
        prdUid: dto.prdUid ?? null,
        orderNo: dto.orderNo || null,
        processCode: dto.processCode || null,
        qty: dto.qty,
        reservedQty: 0,
        availableQty: dto.qty,
        company: dto.company,
        plant: dto.plant,
      });
    }

    this.logger.log(`제품 입고(Tx): ${dto.itemCode} × ${dto.qty} → ${dto.warehouseId} (${dto.transType})`);
    return saved;
  }

  /**
   * 완제품 입고: FG_WIP(완제품 공정창고) → FG 창고 이동.
   * 박스 입고는 prdUid를 지정하지 않으므로, 생산이 시리얼(배치) 키로 적재한 FG_WIP 재고를
   * itemCode 기준 FIFO로 수량만큼 차감한다(행마다 WIP_OUT+FG_IN 거래 → 시리얼 보존 + 취소 가역성).
   * 시리얼 단위 추적은 FG_LABELS(BOX_NO 스탬프)가 담당한다.
   */
  async receiveFinishedFromWip(dto: ProductReceiveStockDto) {
    return this.tx.run(async (qr) => {
      const tenantWhere = this.tenantWhere(dto.company, dto.plant);

      // 박스 이중입고 가드 (fg/receive 경로에도 적용 — 기존 issueStock 경로엔 없던 방어)
      if (dto.refType === 'BOX' && dto.refId) {
        const dup = await qr.manager.findOne(ProductTransaction, {
          where: {
            refType: 'BOX',
            refId: dto.refId,
            transType: In(['WIP_OUT', 'FG_IN', 'WIP_IN']),
            status: 'DONE',
            ...tenantWhere,
          },
        });
        if (dup) {
          throw new ConflictException(`이미 입고된 박스입니다: ${dto.refId} (${dup.transNo})`);
        }
      }

      // FG_WIP 양품 재고에서 qty만큼 1회 출고(WIP_OUT) → 목적 창고로 입고.
      // 시리얼 추적은 FG_LABELS(BOX_NO 스탬프)가 담당하므로 현재고는 수량 버킷으로 다룬다.
      const lastTx = await this.issueStockInTx(qr, {
        warehouseId: 'FG_WIP',
        toWarehouseId: dto.warehouseId,
        itemCode: dto.itemCode,
        itemType: 'FINISHED',
        prdUid: dto.prdUid ?? undefined,
        qty: dto.qty,
        transType: 'WIP_OUT',
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark ?? '제품입고 WIP->FG 이동',
        company: dto.company,
        plant: dto.plant,
      });

      // 박스 입고: 박스 시리얼(FG_LABELS)에 BOX_NO 스탬프
      if (dto.refType === 'BOX' && dto.refId) {
        await this.stampBoxSerials(qr.manager, dto.refId, true, dto.company, dto.plant);
      }

      return lastTx;
    });
  }

  /** 제품 출고 처리 */
  async issueStock(dto: ProductIssueStockDto) {
    const transNo = await this.generateTransNo();
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);
    const qualityStatus = this.normalizeQualityStatus(dto.qualityStatus);

    return this.tx.run(async (queryRunner) => {
      // 1. 재고 확인 (품목+창고+품질상태)
      const stock = await queryRunner.manager.findOne(ProductStock, {
        where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
      });

      if (!stock || stock.availableQty < dto.qty) {
        throw new BadRequestException(`재고 부족: 가용 ${stock?.availableQty || 0}, 요청 ${dto.qty}`);
      }
      if (stock.status === 'HOLD') {
        throw new BadRequestException(`HOLD stock cannot be issued: ${dto.itemCode}`);
      }

      // 2. 트랜잭션 생성
      const transaction = this.transactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        fromWarehouseId: dto.warehouseId,
        toWarehouseId: dto.toWarehouseId,
        itemCode: dto.itemCode,
        itemType: dto.itemType,
        prdUid: dto.prdUid ?? null,
        qualityStatus,
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        qty: -dto.qty,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        issueType: dto.issueType,
        remark: dto.remark,
        status: 'DONE',
        company: dto.company,
        plant: dto.plant,
      });

      const savedTransaction = await queryRunner.manager.save(ProductTransaction, transaction);

      // 3. 출고 창고 재고 감소
      await queryRunner.manager.update(ProductStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, qualityStatus, ...tenantWhere },
        { qty: stock.qty - dto.qty, availableQty: stock.availableQty - dto.qty },
      );

      // 4. 이동 대상 창고가 있으면 입고 처리
      if (dto.toWarehouseId) {
        const targetStock = await queryRunner.manager.findOne(ProductStock, {
          where: { warehouseCode: dto.toWarehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
          /* Oracle PDB 호환: pessimistic_write 제거, 트랜잭션 isolation으로 보장 */
        });

        if (targetStock) {
          await queryRunner.manager.update(ProductStock,
            { warehouseCode: targetStock.warehouseCode, itemCode: targetStock.itemCode, qualityStatus, ...tenantWhere },
            { qty: targetStock.qty + dto.qty, availableQty: targetStock.qty + dto.qty - targetStock.reservedQty },
          );
        } else {
          await queryRunner.manager.save(ProductStock, {
            warehouseCode: dto.toWarehouseId,
            itemCode: dto.itemCode,
            qualityStatus,
            itemType: dto.itemType,
            prdUid: dto.prdUid ?? null,
            orderNo: dto.orderNo || null,
            processCode: dto.processCode || null,
            qty: dto.qty,
            reservedQty: 0,
            availableQty: dto.qty,
            company: dto.company,
            plant: dto.plant,
          });
        }
      }

      return savedTransaction;
    });
  }

  /**
   * 외부 트랜잭션(QueryRunner) 내에서 제품 출고 처리
   * - 출하 처리 시 제품재고 차감 등에 사용
   * - 호출측 트랜잭션에 참여하므로 commit/rollback은 호출측이 담당
   */
  async issueStockInTx(qr: QueryRunner, dto: ProductIssueStockDto): Promise<ProductTransaction> {
    const transNo = await this.generateTransNo(qr);
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);
    const qualityStatus = this.normalizeQualityStatus(dto.qualityStatus);

    // 1. 재고 확인 (품목+창고+품질상태)
    const stock = await qr.manager.findOne(ProductStock, {
      where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
    });

    if (!stock || stock.availableQty < dto.qty) {
      throw new BadRequestException(
        `재고 부족으로 출고할 수 없습니다: ${dto.itemCode} (가용 ${stock?.availableQty || 0}, 요청 ${dto.qty})`,
      );
    }
    if (stock.status === 'HOLD') {
      throw new BadRequestException(`HOLD stock cannot be issued: ${dto.itemCode}`);
    }

    // 2. 트랜잭션 생성
    const transaction = qr.manager.create(ProductTransaction, {
      transNo,
      transType: dto.transType,
      transDate: new Date(),
      fromWarehouseId: dto.warehouseId,
      toWarehouseId: dto.toWarehouseId,
      itemCode: dto.itemCode,
      itemType: dto.itemType,
      prdUid: dto.prdUid ?? null,
      qualityStatus,
      orderNo: dto.orderNo,
      processCode: dto.processCode,
      qty: -dto.qty,
      refType: dto.refType,
      refId: dto.refId,
      workerId: dto.workerId,
      issueType: dto.issueType,
      remark: dto.remark,
      status: 'DONE',
      company: dto.company,
      plant: dto.plant,
    });

    const saved = await qr.manager.save(ProductTransaction, transaction);

    // 3. 출고 창고 재고 감소 (소진 시 행 삭제 — qty0 잔재 방지, FIFO/transfer 차감과 일관)
    const newFromQty = stock.qty - dto.qty;
    if (newFromQty <= 0 && stock.reservedQty === 0) {
      await qr.manager.delete(ProductStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, qualityStatus, ...tenantWhere },
      );
    } else {
      await qr.manager.update(ProductStock,
        { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, qualityStatus, ...tenantWhere },
        { qty: newFromQty, availableQty: stock.availableQty - dto.qty },
      );
    }

    // 4. 이동 대상 창고가 있으면 입고 처리
    if (dto.toWarehouseId) {
      const targetStock = await qr.manager.findOne(ProductStock, {
        where: { warehouseCode: dto.toWarehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
      });

      if (targetStock) {
        await qr.manager.update(ProductStock,
          { warehouseCode: targetStock.warehouseCode, itemCode: targetStock.itemCode, qualityStatus, ...tenantWhere },
          { qty: targetStock.qty + dto.qty, availableQty: targetStock.qty + dto.qty - targetStock.reservedQty },
        );
      } else {
        await qr.manager.save(ProductStock, {
          warehouseCode: dto.toWarehouseId,
          itemCode: dto.itemCode,
          qualityStatus,
          itemType: dto.itemType,
          prdUid: dto.prdUid ?? null,
          orderNo: dto.orderNo || null,
          processCode: dto.processCode || null,
          qty: dto.qty,
          reservedQty: 0,
          availableQty: dto.qty,
          company: dto.company,
          plant: dto.plant,
        });
      }
    }

    this.logger.log(`제품 출고(Tx): ${dto.itemCode} × ${dto.qty} ← ${dto.warehouseId} (${dto.transType})`);
    return saved;
  }

  /** 제품 트랜잭션 취소 (입고취소, 출고취소) */
  /**
   * 창고 간 수량 이동 — fromWarehouse 의 itemCode 재고를 시리얼(prdUid) 행 단위 FIFO로
   * qty 만큼 toWarehouse 로 이동한다(시리얼 보존, 소진 행 정리). 재고 부족 시 가용분만 이동.
   * 재작업 합격(DEFECT→WIP_MAIN)·폐기(DEFECT→SCRAP) 등 집계 수량 이동에 사용.
   * @returns 실제 이동된 수량
   */
  /**
   * 창고 itemCode 재고를 시리얼(prdUid) 행 단위 FIFO로 qty 만큼 출고(차감)한다. 이동 대상 없음(시스템 외부로 출하).
   * FG_MAIN 재고 키 체계(배치 시리얼/FG바코드)와 무관하게 수량 기준으로 차감해, 입고-출하 시리얼 키 불일치로
   * "재고 부족"이 나던 문제를 막는다. 시리얼 단위 추적은 FG_LABELS(SHIPPED 전이)가 담당한다.
   * 호출측 트랜잭션(qr)에 참여한다.
   */
  async issueStockByItemFifoInTx(
    qr: QueryRunner,
    dto: {
      warehouseId: string;
      itemCode: string;
      qty: number;
      transType: string;
      qualityStatus?: string;
      refType?: string;
      refId?: string;
      workerId?: string;
      remark?: string;
      company?: string;
      plant?: string;
    },
  ): Promise<number> {
    if (!dto.qty || dto.qty <= 0) return 0;
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);
    const qualityStatus = this.normalizeQualityStatus(dto.qualityStatus);
    // 품목+창고+품질상태에서 qty만큼 1회 차감(시스템 외부 출하). 시리얼 추적은 FG_LABELS가 담당.
    const stock = await qr.manager.findOne(ProductStock, {
      where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
    });
    const totalAvail = stock?.availableQty ?? 0;
    if (totalAvail < dto.qty) {
      throw new BadRequestException(`재고 부족: 가용 ${totalAvail}, 요청 ${dto.qty} (${dto.itemCode})`);
    }
    await this.issueStockInTx(qr, {
      warehouseId: dto.warehouseId,
      itemCode: dto.itemCode,
      itemType: stock!.itemType,
      prdUid: stock!.prdUid ?? undefined,
      qualityStatus,
      qty: dto.qty,
      transType: dto.transType,
      refType: dto.refType,
      refId: dto.refId,
      workerId: dto.workerId,
      remark: dto.remark,
      company: dto.company,
      plant: dto.plant,
    });
    // 소진된 행(qty 0, 예약 0) 정리
    await qr.manager
      .createQueryBuilder()
      .delete()
      .from(ProductStock)
      .where('WAREHOUSE_CODE = :wh AND ITEM_CODE = :item AND QUALITY_STATUS = :qualityStatus AND QTY <= 0 AND RESERVED_QTY = 0', {
        wh: dto.warehouseId,
        item: dto.itemCode,
        qualityStatus,
      })
      .andWhere(dto.company ? 'COMPANY = :company' : '1=1', dto.company ? { company: dto.company } : {})
      .andWhere(dto.plant ? 'PLANT_CD = :plant' : '1=1', dto.plant ? { plant: dto.plant } : {})
      .execute();
    return dto.qty;
  }

  async transferStockByItem(dto: {
    fromWarehouseId: string;
    toWarehouseId: string;
    itemCode: string;
    itemType?: string;
    qty: number;
    transType: string;
    qualityStatus?: string;
    refType?: string;
    refId?: string;
    remark?: string;
    company?: string;
    plant?: string;
  }): Promise<number> {
    if (!dto.qty || dto.qty <= 0) return 0;
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);
    const qualityStatus = this.normalizeQualityStatus(dto.qualityStatus);
    return this.tx.run(async (qr) => {
      // 품목+창고+품질상태에서 가용분만큼 1회 이동
      const stock = await qr.manager.findOne(ProductStock, {
        where: { warehouseCode: dto.fromWarehouseId, itemCode: dto.itemCode, qualityStatus, ...tenantWhere },
      });
      const moved = Math.min(dto.qty, stock?.availableQty ?? 0);
      if (moved > 0 && stock) {
        await this.issueStockInTx(qr, {
          warehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          itemCode: dto.itemCode,
          itemType: dto.itemType ?? stock.itemType,
          prdUid: stock.prdUid ?? undefined,
          qualityStatus,
          qty: moved,
          transType: dto.transType,
          refType: dto.refType,
          refId: dto.refId,
          remark: dto.remark,
          company: dto.company,
          plant: dto.plant,
        });
      }
      // 소진된 from 창고 행(qty 0, 예약 0) 정리
      await qr.manager
        .createQueryBuilder()
        .delete()
        .from(ProductStock)
        .where('WAREHOUSE_CODE = :wh AND ITEM_CODE = :item AND QUALITY_STATUS = :qualityStatus AND QTY <= 0 AND RESERVED_QTY = 0', {
          wh: dto.fromWarehouseId,
          item: dto.itemCode,
          qualityStatus,
        })
        .andWhere(dto.company ? 'COMPANY = :company' : '1=1', dto.company ? { company: dto.company } : {})
        .andWhere(dto.plant ? 'PLANT_CD = :plant' : '1=1', dto.plant ? { plant: dto.plant } : {})
        .execute();
      this.logger.log(`재고 이동: ${dto.itemCode} × ${moved} ${dto.fromWarehouseId} → ${dto.toWarehouseId} (${dto.transType})`);
      return moved;
    });
  }

  async transferDefectStockToWarehouse(dto: ProductDefectTransferDto): Promise<ProductTransaction> {
    if (!['SFG_WIP', 'FG_WIP'].includes(dto.fromWarehouseId)) {
      throw new BadRequestException('불량창고 입고는 공정 WIP 제품재고에서만 처리할 수 있습니다.');
    }

    const targetWarehouseCode = dto.toWarehouseId || 'DEFECT';
    const itemType = dto.itemType || (dto.fromWarehouseId === 'FG_WIP' ? 'FINISHED' : 'SEMI_PRODUCT');
    const tenantWhere = this.tenantWhere(dto.company, dto.plant);

    return this.tx.run(async (qr) => {
      let defectWarehouse = await qr.manager.findOne(Warehouse, {
        where: { warehouseCode: targetWarehouseCode, ...tenantWhere },
      });

      if (!defectWarehouse && !dto.toWarehouseId) {
        defectWarehouse = await qr.manager.findOne(Warehouse, {
          where: { warehouseType: 'DEFECT', isDefault: 'Y', ...tenantWhere },
        });
      }

      if (!defectWarehouse) {
        throw new BadRequestException('불량창고가 설정되어 있지 않습니다.');
      }
      if (defectWarehouse.warehouseType !== 'DEFECT' && defectWarehouse.warehouseCode !== 'DEFECT') {
        throw new BadRequestException('도착 창고는 불량창고여야 합니다.');
      }

      return this.issueStockInTx(qr, {
        warehouseId: dto.fromWarehouseId,
        toWarehouseId: defectWarehouse.warehouseCode,
        itemCode: dto.itemCode,
        itemType,
        qualityStatus: 'DEFECT',
        qty: dto.qty,
        transType: 'DEFECT_IN',
        refType: 'ADJUST',
        workerId: dto.workerId,
        remark: dto.remark || '불량창고 입고',
        company: dto.company,
        plant: dto.plant,
      });
    });
  }

  async cancelTransaction(dto: CancelTransactionDto, company?: string, plant?: string) {
    const originalTrans = await this.transactionRepository.findOne({
      where: {
        transNo: dto.transactionId,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });

    if (!originalTrans) {
      throw new NotFoundException('원본 트랜잭션을 찾을 수 없습니다.');
    }

    if (originalTrans.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    }
    this.assertSameTenant('원본 제품거래', { company, plant }, originalTrans);

    return this.tx.run(async (queryRunner) => {
      return this.cancelTransactionInTx(queryRunner, originalTrans, dto);
    });
  }

  /**
   * 외부 트랜잭션(QueryRunner) 내에서 제품 트랜잭션 취소
   * - 호출측 트랜잭션에 참여하므로 commit/rollback은 호출측이 담당
   */
  async cancelTransactionInTx(
    qr: QueryRunner,
    originalTrans: ProductTransaction,
    dto: CancelTransactionDto,
  ): Promise<ProductTransaction> {
    const cancelTransType = this.getCancelTransType(originalTrans.transType);
    const transNo = await this.generateTransNo(qr);
    const tenantWhere = this.tenantWhere(originalTrans.company, originalTrans.plant);
    const qualityStatus = this.normalizeQualityStatus(originalTrans.qualityStatus);

    // 1. 원본 트랜잭션 상태 변경
    await qr.manager.update(ProductTransaction, { transNo: originalTrans.transNo, ...tenantWhere }, { status: 'CANCELED' });

    // 2. 취소 트랜잭션 생성 (반대 수량)
    const cancelTrans = qr.manager.create(ProductTransaction, {
      transNo,
      transType: cancelTransType,
      transDate: new Date(),
      fromWarehouseId: originalTrans.toWarehouseId,
      toWarehouseId: originalTrans.fromWarehouseId,
      itemCode: originalTrans.itemCode,
      itemType: originalTrans.itemType,
      prdUid: originalTrans.prdUid,
      qualityStatus,
      orderNo: originalTrans.orderNo,
      processCode: originalTrans.processCode,
      qty: -originalTrans.qty,
      unitPrice: originalTrans.unitPrice,
      totalAmount: originalTrans.totalAmount ? -Number(originalTrans.totalAmount) : null,
      refType: originalTrans.refType,
      refId: originalTrans.refId,
      cancelRefId: originalTrans.transNo,
      workerId: dto.workerId,
      issueType: originalTrans.issueType,
      remark: dto.remark || `취소: ${originalTrans.transNo}`,
      status: 'DONE',
      company: originalTrans.company,
      plant: originalTrans.plant,
    });

    const savedCancelTrans = await qr.manager.save(ProductTransaction, cancelTrans);

    // BOX_NO는 포장 식별자이므로 입고 취소 시에도 유지한다.
    // 창고재고 여부는 아래 원본 전표 CANCELED 상태와 재고 역분개 결과로 판단한다.

    // 3. 재고 복구 — 원래 입고/이동-입고 창고에서 감소
    if (originalTrans.toWarehouseId) {
      const stock = await qr.manager.findOne(ProductStock, {
        where: {
          warehouseCode: originalTrans.toWarehouseId,
          itemCode: originalTrans.itemCode,
          qualityStatus,
          ...tenantWhere,
        },
        /* Oracle PDB 호환: pessimistic_write 제거, 트랜잭션 isolation으로 보장 */
      });

      if (stock) {
        this.assertSameTenant('취소 대상 제품재고', originalTrans, stock);
        const newQty = stock.qty - Math.abs(originalTrans.qty);
        if (newQty < 0) {
          throw new BadRequestException('재고가 부족하여 취소할 수 없습니다.');
        }
        const stockKey = { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, qualityStatus, ...tenantWhere };
        // 입고 취소로 수량이 0이 되고 예약도 없으면 빈 행을 남기지 않는다(qty0 잔재 방지).
        if (newQty === 0 && stock.reservedQty === 0) {
          await qr.manager.delete(ProductStock, stockKey);
        } else {
          await qr.manager.update(ProductStock, stockKey, { qty: newQty, availableQty: newQty - stock.reservedQty });
        }
      }
    }

    // 원래 출고 창고로 복구
    if (originalTrans.fromWarehouseId) {
      const stock = await qr.manager.findOne(ProductStock, {
        where: {
          warehouseCode: originalTrans.fromWarehouseId,
          itemCode: originalTrans.itemCode,
          qualityStatus,
          ...tenantWhere,
        },
        /* Oracle PDB 호환: pessimistic_write 제거, 트랜잭션 isolation으로 보장 */
      });

      if (stock) {
        this.assertSameTenant('복구 대상 제품재고', originalTrans, stock);
        await qr.manager.update(ProductStock,
          { warehouseCode: stock.warehouseCode, itemCode: stock.itemCode, qualityStatus, ...tenantWhere },
          { qty: stock.qty + Math.abs(originalTrans.qty), availableQty: stock.availableQty + Math.abs(originalTrans.qty) },
        );
      } else {
        await qr.manager.save(ProductStock, {
          warehouseCode: originalTrans.fromWarehouseId,
          itemCode: originalTrans.itemCode,
          qualityStatus,
          itemType: originalTrans.itemType || 'SEMI_PRODUCT',
          prdUid: originalTrans.prdUid ?? null,
          qty: Math.abs(originalTrans.qty),
          reservedQty: 0,
          availableQty: Math.abs(originalTrans.qty),
          company: originalTrans.company,
          plant: originalTrans.plant,
        });
      }
    }

    return savedCancelTrans;
  }

  /** 취소 트랜잭션 유형 결정 */
  private getCancelTransType(originalType: string): string {
    const cancelMap: Record<string, string> = {
      'WIP_IN': 'WIP_IN_CANCEL',
      'WIP_OUT': 'WIP_OUT_CANCEL',
      'FG_IN': 'FG_IN_CANCEL',
      'FG_OUT': 'FG_OUT_CANCEL',
    };
    return cancelMap[originalType] || `${originalType}_CANCEL`;
  }

  /** 제품 현재고 조회 */
  async getStock(query: ProductStockQueryDto, company?: string, plant?: string) {
    const where: FindOptionsWhere<ProductStock> = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.warehouseId) where.warehouseCode = query.warehouseId;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.itemType) where.itemType = query.itemType;
    if (query.qualityStatus) where.qualityStatus = query.qualityStatus;
    // prdUid는 더 이상 재고 키가 아니므로 필터에서 제외(품목+창고+품질상태)

    const stocks = await this.stockRepository.find({
      where,
      select: ['warehouseCode', 'itemCode', 'itemType', 'qualityStatus', 'prdUid', 'orderNo', 'processCode', 'qty', 'reservedQty', 'availableQty'],
      order: { warehouseCode: 'ASC', itemCode: 'ASC', qualityStatus: 'ASC' },
    });

    let filtered = query.includeZero ? stocks : stocks.filter((s) => s.qty > 0);
    if (filtered.length === 0) return [];

    const whCodes = [...new Set(filtered.map((s) => s.warehouseCode).filter(Boolean))];
    const itemCodes = [...new Set(filtered.map((s) => s.itemCode).filter(Boolean))];
    const tenantWhere = this.tenantWhere(company, plant);

    const warehouses = whCodes.length > 0 ? await this.warehouseRepository.find({
      where: { warehouseCode: In(whCodes), ...tenantWhere },
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    }) : [];
    const parts = itemCodes.length > 0 ? await this.itemMasterRepository.find({
      where: { itemCode: In(itemCodes), ...tenantWhere },
      select: ['itemCode', 'itemName', 'itemType', 'unit'],
    }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w] as const));
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    if (query.warehouseType) {
      filtered = filtered.filter((s) => whMap.get(s.warehouseCode)?.warehouseType === query.warehouseType);
    }

    return filtered.map((s) => {
      const wh = whMap.get(s.warehouseCode);
      const part = partMap.get(s.itemCode);
      return {
        warehouseId: s.warehouseCode,
        itemCode: s.itemCode,
        itemType: s.itemType,
        qualityStatus: s.qualityStatus,
        prdUid: s.prdUid,
        orderNo: s.orderNo,
        processCode: s.processCode,
        qty: s.qty,
        reservedQty: s.reservedQty,
        availableQty: s.availableQty,
        itemName: part?.itemName || null,
        unit: part?.unit || null,
        warehouseCode: wh?.warehouseCode || null,
        warehouseName: wh?.warehouseName || null,
        warehouseType: wh?.warehouseType || null,
      };
    });
  }

  /** 제품 수불 이력 조회 */
  async getTransactions(query: ProductTransactionQueryDto, company?: string, plant?: string) {
    const where: FindOptionsWhere<ProductTransaction> = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.itemType) where.itemType = query.itemType;
    if (query.qualityStatus) where.qualityStatus = query.qualityStatus;
    if (query.prdUid) where.prdUid = query.prdUid;
    if (query.refType) where.refType = query.refType;
    if (query.refId) where.refId = query.refId;

    const qb = this.transactionRepository.createQueryBuilder('trans')
      .where(where);

    // transType은 쉼표 구분 복수 값 지원
    if (query.transType) {
      const types = query.transType.split(',').map((t) => t.trim());
      if (types.length === 1) {
        qb.andWhere('trans.transType = :transType', { transType: types[0] });
      } else {
        qb.andWhere('trans.transType IN (:...transTypes)', { transTypes: types });
      }
    }

    if (query.warehouseId) {
      qb.andWhere(
        '(trans.fromWarehouseId = :warehouseId OR trans.toWarehouseId = :warehouseId)',
        { warehouseId: query.warehouseId },
      );
    }
    if (query.fromDate) {
      qb.andWhere("trans.transDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere("trans.transDate < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate: query.toDate });
    }

    const transactions = await qb
      .orderBy('trans.transDate', 'DESC')
      .take(query.limit || 100)
      .skip(query.offset || 0)
      .getMany();

    if (transactions.length === 0) return [];

    // 관련 데이터 일괄 조회
    const whIds = [...new Set(transactions.flatMap((t) => [t.fromWarehouseId, t.toWarehouseId].filter(Boolean)))];
    const itemCodes = [...new Set(transactions.map((t) => t.itemCode).filter(Boolean))];
    const tenantWhere = this.tenantWhere(company, plant);

    const warehouses = whIds.length > 0 ? await this.warehouseRepository.find({ where: { warehouseCode: In(whIds as string[]), ...tenantWhere } }) : [];
    const parts = itemCodes.length > 0 ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes as string[]), ...tenantWhere } }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return transactions.map((t) => ({
      ...t,
      id: t.transNo,
      fromWarehouse: t.fromWarehouseId ? whMap.get(t.fromWarehouseId) || null : null,
      toWarehouse: t.toWarehouseId ? whMap.get(t.toWarehouseId) || null : null,
      part: partMap.get(t.itemCode) || null,
    }));
  }
}
