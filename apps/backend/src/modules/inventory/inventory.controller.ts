/**
 * @file src/modules/inventory/inventory.controller.ts
 * @description 재고관리 컨트롤러 - 창고, 재고, 수불 API
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Company, Plant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InventoryService } from './services/inventory.service';
import { WarehouseService } from './services/warehouse.service';
import { ProductInventoryService } from './services/product-inventory.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  ReceiveStockDto,
  IssueStockDto,
  TransferStockDto,
  CancelTransactionDto,
  StockQueryDto,
  TransactionQueryDto,
  CreateLotDto,
} from './dto/inventory.dto';
import {
  ProductReceiveStockDto,
  ProductIssueStockDto,
  ProductTransactionQueryDto,
  ProductStockQueryDto,
} from './dto/product-inventory.dto';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly warehouseService: WarehouseService,
    private readonly productInventoryService: ProductInventoryService,
  ) {}

  // ============================================================================
  // 창고 관리 API
  // ============================================================================

  /**
   * 창고 목록 조회
   */
  @Get('warehouses')
  async getWarehouses(@Query('warehouseType') warehouseType?: string, @Company() company?: string, @Plant() plant?: string) {
    return this.warehouseService.findAll(warehouseType, company, plant);
  }

  /**
   * 창고 상세 조회
   */
  @Get('warehouses/:id')
  async getWarehouse(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    return this.warehouseService.findOne(id, company, plant);
  }

  /**
   * 창고 생성
   */
  @Post('warehouses')
  async createWarehouse(@Body() dto: CreateWarehouseDto, @Company() company: string, @Plant() plant: string) {
    return this.warehouseService.create(dto, company, plant);
  }

  /**
   * 창고 수정
   */
  @Put('warehouses/:id')
  async updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    return this.warehouseService.update(id, dto, company, plant);
  }

  /**
   * 창고 삭제 (소프트 삭제)
   */
  @Delete('warehouses/:id')
  async deleteWarehouse(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    return this.warehouseService.remove(id, company, plant);
  }

  /**
   * 기본 창고 초기화
   */
  @Post('warehouses/init')
  async initWarehouses(@Company() company?: string, @Plant() plant?: string) {
    return this.warehouseService.initDefaultWarehouses(company, plant);
  }

  // ============================================================================
  // LOT 관리 API
  // ============================================================================

  /**
   * LOT 목록 조회
   */
  @Get('lots')
  async getLots(
    @Query('itemCode') itemCode?: string,
    @Query('itemType') itemType?: string,
    @Query('status') status?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    return this.inventoryService.getLots({ itemCode, itemType, status }, company, plant);
  }

  /**
   * LOT 상세 조회
   */
  @Get('lots/:id')
  async getLot(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    return this.inventoryService.getLotById(id, company, plant);
  }

  /**
   * LOT 생성
   */
  @Post('lots')
  async createLot(@Body() dto: CreateLotDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.createLot(dto, company, plant);
  }

  // ============================================================================
  // 재고 조회 API
  // ============================================================================

  /**
   * 현재고 조회
   */
  @Get('stocks')
  async getStocks(@Query() query: StockQueryDto, @Company() company?: string, @Plant() plant?: string) {
    return this.inventoryService.getStock(query, company, plant);
  }

  /**
   * 재고 집계 (창고유형/품목유형별)
   */
  @Get('stocks/summary')
  async getStockSummary(
    @Query('warehouseType') warehouseType?: string,
    @Query('itemType') itemType?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    return this.inventoryService.getStockSummary({ warehouseType, itemType }, company, plant);
  }

  /**
   * 특정 품목의 창고별 재고
   */
  @Get('stocks/by-part/:itemCode')
  async getStockByPart(@Param('itemCode') itemCode: string, @Company() company?: string, @Plant() plant?: string) {
    return this.inventoryService.getStock({ itemCode }, company, plant);
  }

  /**
   * 특정 창고의 재고 목록
   */
  @Get('stocks/by-warehouse/:warehouseId')
  async getStockByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('includeZero') includeZero?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    return this.inventoryService.getStock({
      warehouseCode: warehouseId,
      includeZero: includeZero === 'true',
    }, company, plant);
  }

  // ============================================================================
  // 수불 트랜잭션 API
  // ============================================================================

  /**
   * 수불 이력 조회
   */
  @Get('transactions')
  async getTransactions(@Query() query: TransactionQueryDto, @Company() company?: string, @Plant() plant?: string) {
    return this.inventoryService.getTransactions(query, company, plant);
  }

  /**
   * 트랜잭션 상세 조회
   */
  @Get('transactions/:id')
  async getTransaction(@Param('id') id: string, @Company() company?: string, @Plant() plant?: string) {
    return this.inventoryService.getTransactionById(id, company, plant);
  }

  /**
   * 입고 처리
   */
  @Post('receive')
  async receiveStock(@Body() dto: ReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.receiveStock(dto, company, plant);
  }

  /**
   * 출고 처리
   */
  @Post('issue')
  async issueStock(@Body() dto: IssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.issueStock(dto, company, plant);
  }

  /**
   * 창고간 이동
   */
  @Post('transfer')
  async transferStock(@Body() dto: TransferStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.transferStock(dto, company, plant);
  }

  /**
   * 트랜잭션 취소 (원자재 vs 제품 자동 분기)
   * WIP/FG 계열 → productInventoryService, 그 외 → inventoryService
   */
  @Post('cancel')
  async cancelTransaction(
    @Body() dto: CancelTransactionDto & { source?: string },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    if (dto.source === 'product') {
      return this.productInventoryService.cancelTransaction(dto, company, plant);
    }
    return this.inventoryService.cancelTransaction(dto, company, plant);
  }

  // ============================================================================
  // 품목 유형별 전용 API
  // ============================================================================

  /**
   * 원자재 입고
   */
  @Post('material/receive')
  async receiveMaterial(@Body() dto: ReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'MAT_IN' as any,
    }, company, plant);
  }

  /**
   * 원자재 출고 (생산투입)
   */
  @Post('material/issue')
  async issueMaterial(@Body() dto: IssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'MAT_OUT' as any,
    }, company, plant);
  }

  /**
   * 반제품 창고입고 → PRODUCT_STOCKS 테이블
   */
  @Post('wip/receive')
  async receiveWip(@Body() dto: ProductReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    return this.productInventoryService.receiveStock({
      ...dto,
      itemType: 'SEMI_PRODUCT',
      transType: 'WIP_IN',
      company,
      plant,
    });
  }

  /**
   * 반제품 출고 → PRODUCT_STOCKS 테이블
   */
  @Post('wip/issue')
  async issueWip(@Body() dto: ProductIssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.productInventoryService.issueStock({
      ...dto,
      itemType: 'SEMI_PRODUCT',
      transType: 'WIP_OUT',
      company,
      plant,
    });
  }

  /**
   * 완제품 창고입고 → PRODUCT_STOCKS 테이블
   */
  @Post('fg/receive')
  async receiveFg(@Body() dto: ProductReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    return this.productInventoryService.receiveStock({
      ...dto,
      itemType: 'FINISHED',
      transType: 'FG_IN',
      company,
      plant,
    });
  }

  /**
   * 완제품 출하 → PRODUCT_STOCKS 테이블
   */
  @Post('fg/issue')
  async issueFg(@Body() dto: ProductIssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.productInventoryService.issueStock({
      ...dto,
      itemType: 'FINISHED',
      transType: 'FG_OUT',
      company,
      plant,
    });
  }

  // ============================================================================
  // 제품 전용 조회 API (PRODUCT_STOCKS / PRODUCT_TRANSACTIONS)
  // ============================================================================

  /**
   * 제품 현재고 조회
   */
  @Get('product/stocks')
  async getProductStocks(@Query() query: ProductStockQueryDto, @Company() company?: string, @Plant() plant?: string) {
    return this.productInventoryService.getStock(query, company, plant);
  }

  /**
   * 제품 수불 이력 조회
   */
  @Get('product/transactions')
  async getProductTransactions(@Query() query: ProductTransactionQueryDto, @Company() company?: string, @Plant() plant?: string) {
    return this.productInventoryService.getTransactions(query, company, plant);
  }

  /**
   * 외주 자재지급
   */
  @Post('subcon/issue')
  async issueSubcon(@Body() dto: IssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'SUBCON_OUT' as any,
    }, company, plant);
  }

  /**
   * 외주 입고
   */
  @Post('subcon/receive')
  async receiveSubcon(@Body() dto: ReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'SUBCON_IN' as any,
    }, company, plant);
  }

  /**
   * 재고 조정 (+)
   */
  @Post('adjust/plus')
  async adjustPlus(@Body() dto: ReceiveStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'ADJ_PLUS' as any,
    }, company, plant);
  }

  /**
   * 재고 조정 (-)
   */
  @Post('adjust/minus')
  async adjustMinus(@Body() dto: IssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'ADJ_MINUS' as any,
    }, company, plant);
  }

  /**
   * 폐기 처리
   */
  @Post('scrap')
  async scrap(@Body() dto: IssueStockDto, @Company() company: string, @Plant() plant: string) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'SCRAP' as any,
    }, company, plant);
  }
}
