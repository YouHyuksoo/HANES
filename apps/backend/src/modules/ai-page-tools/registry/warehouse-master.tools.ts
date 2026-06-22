import { AiPageToolManifest } from '../types';

const WH_TYPES = ['RAW', 'WIP', 'FG', 'FLOOR', 'DEFECT', 'SCRAP', 'SUBCON'];
const WH_TYPE_HINT =
  '창고유형 값: RAW(원자재), WIP(재공), FG(완제품), FLOOR(생산현장), DEFECT(불량), SCRAP(폐기), SUBCON(외주). ' +
  '사용자 문구를 위 코드로 매핑(예: "원자재"→RAW, "완제품"→FG, "불량"→DEFECT).';

/**
 * 창고관리(/master/warehouse) AI 페이지 도구 — 창고·로케이션·이동규칙 CRUD.
 * 모든 write 도구는 채팅에서 사용자 승인 후에만 실행한다(approval-required).
 */
export const WAREHOUSE_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.warehouse',
  route: '/master/warehouse',
  title: '창고관리',
  executionLevel: 'approval-required',
  tools: [
    // ── 창고 ─────────────────────────────────────────────
    {
      name: 'createWarehouse',
      label: '창고 등록',
      description: `새 창고를 등록한다. 창고코드·창고명·창고유형 필요. ${WH_TYPE_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        warehouseCode: { type: 'string', required: true },
        warehouseName: { type: 'string', required: true },
        warehouseType: { type: 'string', required: true, enum: WH_TYPES },
        isDefault: { type: 'boolean', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateWarehouse',
      label: '창고 수정',
      description: `기존 창고 정보를 수정한다. 창고코드로 대상을 지정하고, 바꿀 항목(창고명/창고유형/기본여부)만 넣는다. ${WH_TYPE_HINT}`,
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        warehouseCode: { type: 'string', required: true },
        warehouseName: { type: 'string', required: false },
        warehouseType: { type: 'string', required: false, enum: WH_TYPES },
        isDefault: { type: 'boolean', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteWarehouse',
      label: '창고 삭제',
      description: '창고코드로 지정한 창고를 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: { warehouseCode: { type: 'string', required: true } },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    // ── 로케이션 ─────────────────────────────────────────
    {
      name: 'createLocation',
      label: '로케이션 등록',
      description: '창고 내 세부 위치(로케이션)를 등록한다. 창고코드·로케이션코드·로케이션명 필요. zone(구역)은 선택.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        warehouseCode: { type: 'string', required: true },
        locationCode: { type: 'string', required: true },
        locationName: { type: 'string', required: true },
        zone: { type: 'string', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateLocation',
      label: '로케이션 수정',
      description: '창고코드+로케이션코드로 지정한 로케이션을 수정한다. 바꿀 항목(로케이션명/zone/사용여부 useYn=Y|N)만 넣는다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        warehouseCode: { type: 'string', required: true },
        locationCode: { type: 'string', required: true },
        locationName: { type: 'string', required: false },
        zone: { type: 'string', required: false },
        useYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteLocation',
      label: '로케이션 삭제',
      description: '창고코드+로케이션코드로 지정한 로케이션을 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        warehouseCode: { type: 'string', required: true },
        locationCode: { type: 'string', required: true },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    // ── 창고이동규칙 ─────────────────────────────────────
    {
      name: 'createTransferRule',
      label: '창고이동규칙 등록',
      description: '출발창고→도착창고 간 이동 허용/금지 규칙을 등록한다. fromWarehouseId(출발 창고코드)·toWarehouseId(도착 창고코드) 필요. allowYn(Y=허용/N=금지) 선택.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        fromWarehouseId: { type: 'string', required: true },
        toWarehouseId: { type: 'string', required: true },
        allowYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'updateTransferRule',
      label: '창고이동규칙 수정',
      description: '출발창고+도착창고로 지정한 이동규칙을 수정한다. 보통 allowYn(Y/N)을 바꾼다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        fromWarehouseId: { type: 'string', required: true },
        toWarehouseId: { type: 'string', required: true },
        allowYn: { type: 'string', required: false, enum: ['Y', 'N'] },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
    {
      name: 'deleteTransferRule',
      label: '창고이동규칙 삭제',
      description: '출발창고+도착창고로 지정한 이동규칙을 삭제한다.',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        fromWarehouseId: { type: 'string', required: true },
        toWarehouseId: { type: 'string', required: true },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};
