/**
 * @file src/routes/index.tsx
 * @description React Router 설정 - 모든 페이지 라우팅 정의
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';

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

function AppRoutes() {
  return (
    <Routes>
      {/* MainLayout을 공통 레이아웃으로 사용 */}
      <Route element={<MainLayout />}>
        {/* 대시보드 */}
        <Route path="/" element={<DashboardPage />} />

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

        {/* 404 - 알 수 없는 경로는 대시보드로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
