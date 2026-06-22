import { AiPageToolManifest } from '../types';

/**
 * 창고관리(/master/warehouse) AI 페이지 도구.
 * createWarehouse는 write 도구이며, 채팅은 반드시 사용자 승인 후 실행한다(approval-required).
 */
export const WAREHOUSE_MASTER_TOOL_MANIFEST: AiPageToolManifest = {
  pageId: 'master.warehouse',
  route: '/master/warehouse',
  title: '창고관리',
  executionLevel: 'approval-required',
  tools: [
    {
      name: 'createWarehouse',
      label: '창고 등록',
      description:
        '새 창고를 등록한다. 창고코드(warehouseCode)·창고명(warehouseName)·창고유형(warehouseType)이 필요하다. ' +
        '창고유형 값: RAW(원자재), WIP(재공), FG(완제품), FLOOR(생산현장), DEFECT(불량), SCRAP(폐기), SUBCON(외주). ' +
        '사용자 문구를 위 코드로 매핑하라(예: "원자재 창고"→RAW, "완제품"→FG, "불량"→DEFECT).',
      riskLevel: 'write',
      source: 'backend',
      inputSchema: {
        warehouseCode: { type: 'string', required: true },
        warehouseName: { type: 'string', required: true },
        warehouseType: {
          type: 'string',
          required: true,
          enum: ['RAW', 'WIP', 'FG', 'FLOOR', 'DEFECT', 'SCRAP', 'SUBCON'],
        },
        isDefault: { type: 'boolean', required: false },
      },
      requiresConfirmation: true,
      confirmationPolicy: 'write_requires_user_approval',
    },
  ],
};
