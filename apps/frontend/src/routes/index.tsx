/**
 * @file src/routes/index.tsx
 * @description React Router 설정 - 모든 페이지 라우팅 정의
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PrivateRoute from '@/components/layout/PrivateRoute';
import LoginPage from '@/pages/auth/LoginPage';

// Pages
import DashboardPage from '@/pages/dashboard/DashboardPage';
import { ComCodePage, PartPage, BomPage, EquipMasterPage } from '@/pages/master';
import { CuttingOrderPage, CuttingResultPage } from '@/pages/cutting';
import { CrimpingOrderPage, CrimpingResultPage, CrimpingMoldPage } from '@/pages/crimping';
import { JobOrderPage, ProdResultPage, SemiProductPage } from '@/pages/production';
import { DefectPage, InspectPage, TracePage } from '@/pages/quality';
import { EquipStatusPage, PmPage } from '@/pages/equipment';
import { PackPage, PalletPage, ShipmentPage } from '@/pages/shipping';
import { ReceivePage, StockPage, IssuePage } from '@/pages/material';
import { ResultPage as InspectionResultPage, EquipPage as InspectionEquipPage } from '@/pages/inspection';
// 신규 메뉴
import { CustomsEntryPage, CustomsStockPage, CustomsUsagePage } from '@/pages/customs';
import { ConsumableMasterPage, ConsumableLogPage, ConsumableLifePage } from '@/pages/consumables';
import { VendorPage, SubconOrderPage, SubconReceivePage } from '@/pages/outsourcing';
import { InterfaceDashboardPage, InterfaceLogPage, InterfaceManualPage } from '@/pages/interface';
// 재고관리
import { WarehousePage, InventoryStockPage, TransactionPage, LotPage } from '@/pages/inventory';
// 시스템관리
import { UserPage } from '@/pages/system';

function AppRoutes() {
  return (
    <Routes>
      {/* 로그인 페이지 (레이아웃 없음) */}
      <Route path="/login" element={<LoginPage />} />

      {/* 인증 필요 영역 - MainLayout 적용 */}
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          {/* 대시보드 */}
          <Route path="/" element={<DashboardPage />} />

        {/* 재고관리 (신규 - ERP 표준) */}
        <Route path="/inventory">
          <Route path="warehouse" element={<WarehousePage />} />
          <Route path="stock" element={<InventoryStockPage />} />
          <Route path="transaction" element={<TransactionPage />} />
          <Route path="lot" element={<LotPage />} />
        </Route>

        {/* 자재관리 */}
        <Route path="/material">
          <Route path="receive" element={<ReceivePage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="issue" element={<IssuePage />} />
        </Route>

        {/* 절단공정 */}
        <Route path="/cutting">
          <Route path="order" element={<CuttingOrderPage />} />
          <Route path="result" element={<CuttingResultPage />} />
        </Route>

        {/* 압착공정 */}
        <Route path="/crimping">
          <Route path="order" element={<CrimpingOrderPage />} />
          <Route path="result" element={<CrimpingResultPage />} />
          <Route path="mold" element={<CrimpingMoldPage />} />
        </Route>

        {/* 생산관리 */}
        <Route path="/production">
          <Route path="order" element={<JobOrderPage />} />
          <Route path="result" element={<ProdResultPage />} />
          <Route path="semi" element={<SemiProductPage />} />
        </Route>

        {/* 통전검사 */}
        <Route path="/inspection">
          <Route path="result" element={<InspectionResultPage />} />
          <Route path="equip" element={<InspectionEquipPage />} />
        </Route>

        {/* 품질관리 */}
        <Route path="/quality">
          <Route path="defect" element={<DefectPage />} />
          <Route path="inspect" element={<InspectPage />} />
          <Route path="trace" element={<TracePage />} />
        </Route>

        {/* 설비관리 */}
        <Route path="/equipment">
          <Route path="status" element={<EquipStatusPage />} />
          <Route path="pm" element={<PmPage />} />
        </Route>

        {/* 출하관리 */}
        <Route path="/shipping">
          <Route path="pack" element={<PackPage />} />
          <Route path="pallet" element={<PalletPage />} />
          <Route path="confirm" element={<ShipmentPage />} />
        </Route>

        {/* 기준정보 */}
        <Route path="/master">
          <Route path="code" element={<ComCodePage />} />
          <Route path="part" element={<PartPage />} />
          <Route path="bom" element={<BomPage />} />
          <Route path="equip" element={<EquipMasterPage />} />
        </Route>

        {/* 보세관리 */}
        <Route path="/customs">
          <Route path="entry" element={<CustomsEntryPage />} />
          <Route path="stock" element={<CustomsStockPage />} />
          <Route path="usage" element={<CustomsUsagePage />} />
        </Route>

        {/* 소모품관리 */}
        <Route path="/consumables">
          <Route path="master" element={<ConsumableMasterPage />} />
          <Route path="log" element={<ConsumableLogPage />} />
          <Route path="life" element={<ConsumableLifePage />} />
        </Route>

        {/* 외주관리 */}
        <Route path="/outsourcing">
          <Route path="vendor" element={<VendorPage />} />
          <Route path="order" element={<SubconOrderPage />} />
          <Route path="receive" element={<SubconReceivePage />} />
        </Route>

        {/* 인터페이스관리 */}
        <Route path="/interface">
          <Route path="dashboard" element={<InterfaceDashboardPage />} />
          <Route path="log" element={<InterfaceLogPage />} />
          <Route path="manual" element={<InterfaceManualPage />} />
        </Route>

        {/* 시스템관리 */}
        <Route path="/system">
          <Route path="users" element={<UserPage />} />
        </Route>

        {/* 404 - 알 수 없는 경로는 대시보드로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default AppRoutes;
