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
} from '@nestjs/common';
import { Company, Plant } from '../../common/decorators/tenant.decorator';
import { InventoryService } from './services/inventory.service';
import { WarehouseService } from './services/warehouse.service';
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

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly warehouseService: WarehouseService,
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
  async getWarehouse(@Param('id') id: string) {
    return this.warehouseService.findOne(id);
  }

  /**
   * 창고 생성
   */
  @Post('warehouses')
  async createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.warehouseService.create(dto);
  }

  /**
   * 창고 수정
   */
  @Put('warehouses/:id')
  async updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouseService.update(id, dto);
  }

  /**
   * 창고 삭제 (소프트 삭제)
   */
  @Delete('warehouses/:id')
  async deleteWarehouse(@Param('id') id: string) {
    return this.warehouseService.remove(id);
  }

  /**
   * 기본 창고 초기화
   */
  @Post('warehouses/init')
  async initWarehouses() {
    return this.warehouseService.initDefaultWarehouses();
  }

  // ============================================================================
  // LOT 관리 API
  // ============================================================================

  /**
   * LOT 목록 조회
   */
  @Get('lots')
  async getLots(
    @Query('partId') partId?: string,
    @Query('partType') partType?: string,
    @Query('status') status?: string,
  ) {
    return this.inventoryService.getLots({ partId, partType, status });
  }

  /**
   * LOT 상세 조회
   */
  @Get('lots/:id')
  async getLot(@Param('id') id: string) {
    return this.inventoryService.getLotById(id);
  }

  /**
   * LOT 생성
   */
  @Post('lots')
  async createLot(@Body() dto: CreateLotDto) {
    return this.inventoryService.createLot(dto);
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
    @Query('partType') partType?: string,
  ) {
    return this.inventoryService.getStockSummary({ warehouseType, partType });
  }

  /**
   * 특정 품목의 창고별 재고
   */
  @Get('stocks/by-part/:partId')
  async getStockByPart(@Param('partId') partId: string) {
    return this.inventoryService.getStock({ partId });
  }

  /**
   * 특정 창고의 재고 목록
   */
  @Get('stocks/by-warehouse/:warehouseId')
  async getStockByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('includeZero') includeZero?: string,
  ) {
    return this.inventoryService.getStock({
      warehouseId,
      includeZero: includeZero === 'true',
    });
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
  async getTransaction(@Param('id') id: string) {
    return this.inventoryService.getTransactionById(id);
  }

  /**
   * 입고 처리
   */
  @Post('receive')
  async receiveStock(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock(dto);
  }

  /**
   * 출고 처리
   */
  @Post('issue')
  async issueStock(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock(dto);
  }

  /**
   * 창고간 이동
   */
  @Post('transfer')
  async transferStock(@Body() dto: TransferStockDto) {
    return this.inventoryService.transferStock(dto);
  }

  /**
   * 트랜잭션 취소
   */
  @Post('cancel')
  async cancelTransaction(@Body() dto: CancelTransactionDto) {
    return this.inventoryService.cancelTransaction(dto);
  }

  // ============================================================================
  // 품목 유형별 전용 API
  // ============================================================================

  /**
   * 원자재 입고
   */
  @Post('material/receive')
  async receiveMaterial(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'MAT_IN' as any,
    });
  }

  /**
   * 원자재 출고 (생산투입)
   */
  @Post('material/issue')
  async issueMaterial(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'MAT_OUT' as any,
    });
  }

  /**
   * 반제품 창고입고
   */
  @Post('wip/receive')
  async receiveWip(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'WIP_IN' as any,
    });
  }

  /**
   * 반제품 출고
   */
  @Post('wip/issue')
  async issueWip(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'WIP_OUT' as any,
    });
  }

  /**
   * 완제품 창고입고
   */
  @Post('fg/receive')
  async receiveFg(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'FG_IN' as any,
    });
  }

  /**
   * 완제품 출하
   */
  @Post('fg/issue')
  async issueFg(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'FG_OUT' as any,
    });
  }

  /**
   * 외주 자재지급
   */
  @Post('subcon/issue')
  async issueSubcon(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'SUBCON_OUT' as any,
    });
  }

  /**
   * 외주 입고
   */
  @Post('subcon/receive')
  async receiveSubcon(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'SUBCON_IN' as any,
    });
  }

  /**
   * 재고 조정 (+)
   */
  @Post('adjust/plus')
  async adjustPlus(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock({
      ...dto,
      transType: 'ADJ_PLUS' as any,
    });
  }

  /**
   * 재고 조정 (-)
   */
  @Post('adjust/minus')
  async adjustMinus(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'ADJ_MINUS' as any,
    });
  }

  /**
   * 폐기 처리
   */
  @Post('scrap')
  async scrap(@Body() dto: IssueStockDto) {
    return this.inventoryService.issueStock({
      ...dto,
      transType: 'SCRAP' as any,
    });
  }
}
