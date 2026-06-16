/**
 * 신규/추가 공통코드의 ko/en/zh/vi i18n 라벨을 각 locale의 comCode 블록에 add-only 머지.
 * 기존 키는 절대 덮어쓰지 않는다(기존 라벨 보존). BOM 미사용, 2-space, trailing newline.
 * 1회성 도구. 실행: node tools/merge-comcode-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

// group -> code -> { ko, en, zh, vi }
const TR = {
  CHANGE_TYPE: {
    MAN: { ko: '인력변경', en: 'Personnel', zh: '人员变更', vi: 'Thay đổi nhân lực' },
    MACHINE: { ko: '설비변경', en: 'Equipment', zh: '设备变更', vi: 'Thay đổi thiết bị' },
    MATERIAL: { ko: '자재변경', en: 'Material', zh: '物料变更', vi: 'Thay đổi vật tư' },
    METHOD: { ko: '방법변경', en: 'Method', zh: '方法变更', vi: 'Thay đổi phương pháp' },
  },
  CHANGE_PRIORITY: {
    HIGH: { ko: '긴급', en: 'High', zh: '紧急', vi: 'Cao' },
    MEDIUM: { ko: '보통', en: 'Medium', zh: '普通', vi: 'Trung bình' },
    LOW: { ko: '낮음', en: 'Low', zh: '低', vi: 'Thấp' },
  },
  CHANGE_STATUS: {
    DRAFT: { ko: '초안', en: 'Draft', zh: '草稿', vi: 'Bản nháp' },
    SUBMITTED: { ko: '제출', en: 'Submitted', zh: '已提交', vi: 'Đã nộp' },
    REVIEWING: { ko: '검토중', en: 'Reviewing', zh: '审核中', vi: 'Đang xem xét' },
    APPROVED: { ko: '승인', en: 'Approved', zh: '已批准', vi: 'Đã duyệt' },
    REJECTED: { ko: '반려', en: 'Rejected', zh: '已驳回', vi: 'Bị từ chối' },
    IN_PROGRESS: { ko: '진행중', en: 'In Progress', zh: '进行中', vi: 'Đang tiến hành' },
    COMPLETED: { ko: '완료', en: 'Completed', zh: '已完成', vi: 'Hoàn thành' },
    CLOSED: { ko: '종결', en: 'Closed', zh: '已关闭', vi: 'Đã đóng' },
  },
  CAL_TYPE: {
    INTERNAL: { ko: '자체교정', en: 'Internal', zh: '内部校准', vi: 'Hiệu chuẩn nội bộ' },
    EXTERNAL: { ko: '외부교정', en: 'External', zh: '外部校准', vi: 'Hiệu chuẩn bên ngoài' },
  },
  CAL_RESULT: {
    PASS: { ko: '합격', en: 'Pass', zh: '合格', vi: 'Đạt' },
    FAIL: { ko: '불합격', en: 'Fail', zh: '不合格', vi: 'Không đạt' },
    CONDITIONAL: { ko: '조건부합격', en: 'Conditional', zh: '有条件合格', vi: 'Đạt có điều kiện' },
  },
  PROD_PLAN_STATUS: {
    DRAFT: { ko: '초안', en: 'Draft', zh: '草稿', vi: 'Bản nháp' },
    CONFIRMED: { ko: '확정', en: 'Confirmed', zh: '已确认', vi: 'Đã xác nhận' },
    CLOSED: { ko: '마감', en: 'Closed', zh: '已关闭', vi: 'Đã đóng' },
  },
  MOLD_TYPE: {
    INJECTION: { ko: '사출금형', en: 'Injection', zh: '注塑模', vi: 'Khuôn ép phun' },
    PRESS: { ko: '프레스금형', en: 'Press', zh: '冲压模', vi: 'Khuôn dập' },
    CRIMPING: { ko: '크림핑금형', en: 'Crimping', zh: '压接模', vi: 'Khuôn bấm' },
    OTHER: { ko: '기타', en: 'Other', zh: '其他', vi: 'Khác' },
  },
  CONSUMABLE_OPER_STATUS: {
    WAREHOUSE: { ko: '창고대기', en: 'In Warehouse', zh: '库存待用', vi: 'Trong kho' },
    MOUNTED: { ko: '장착중', en: 'Mounted', zh: '已装机', vi: 'Đã lắp' },
    REPAIR: { ko: '수리중', en: 'Under Repair', zh: '维修中', vi: 'Đang sửa' },
  },
  CONSUMABLE_LIFE_STATUS: {
    NORMAL: { ko: '정상', en: 'Normal', zh: '正常', vi: 'Bình thường' },
    WARNING: { ko: '주의', en: 'Warning', zh: '警告', vi: 'Cảnh báo' },
    REPLACE: { ko: '교체필요', en: 'Replace', zh: '需更换', vi: 'Cần thay' },
  },
  PRODUCT_HOLD_STATUS: {
    NORMAL: { ko: '정상', en: 'Normal', zh: '正常', vi: 'Bình thường' },
    HOLD: { ko: '홀드', en: 'Hold', zh: '保留', vi: 'Tạm giữ' },
  },
  CAPA_TYPE: {
    CORRECTIVE: { ko: '시정조치', en: 'Corrective', zh: '纠正措施', vi: 'Khắc phục' },
    PREVENTIVE: { ko: '예방조치', en: 'Preventive', zh: '预防措施', vi: 'Phòng ngừa' },
  },
  CAPA_SOURCE_TYPE: {
    DEFECT: { ko: '불량', en: 'Defect', zh: '不良', vi: 'Lỗi' },
    COMPLAINT: { ko: '고객클레임', en: 'Complaint', zh: '客诉', vi: 'Khiếu nại' },
    AUDIT: { ko: '감사', en: 'Audit', zh: '审核', vi: 'Đánh giá' },
    REWORK: { ko: '재작업', en: 'Rework', zh: '返工', vi: 'Làm lại' },
  },
  CAPA_STATUS: {
    OPEN: { ko: '접수', en: 'Open', zh: '受理', vi: 'Tiếp nhận' },
    ANALYZING: { ko: '원인분석중', en: 'Analyzing', zh: '原因分析中', vi: 'Đang phân tích' },
    ACTION_PLANNED: { ko: '조치계획', en: 'Action Planned', zh: '措施计划', vi: 'Lên kế hoạch' },
    IN_PROGRESS: { ko: '조치진행', en: 'In Progress', zh: '措施进行', vi: 'Đang thực hiện' },
    VERIFYING: { ko: '검증중', en: 'Verifying', zh: '验证中', vi: 'Đang xác minh' },
    CLOSED: { ko: '종결', en: 'Closed', zh: '关闭', vi: 'Đã đóng' },
  },
  CAPA_ACTION_STATUS: {
    PENDING: { ko: '대기', en: 'Pending', zh: '待处理', vi: 'Chờ' },
    IN_PROGRESS: { ko: '진행중', en: 'In Progress', zh: '进行中', vi: 'Đang tiến hành' },
    DONE: { ko: '완료', en: 'Done', zh: '完成', vi: 'Hoàn thành' },
  },
  COMPLAINT_TYPE: {
    QUALITY: { ko: '품질불량', en: 'Quality', zh: '质量', vi: 'Chất lượng' },
    DELIVERY: { ko: '납기지연', en: 'Delivery', zh: '交期', vi: 'Giao hàng' },
    DAMAGE: { ko: '파손', en: 'Damage', zh: '破损', vi: 'Hư hỏng' },
  },
  COMPLAINT_URGENCY: {
    CRITICAL: { ko: '긴급', en: 'Critical', zh: '紧急', vi: 'Khẩn cấp' },
    HIGH: { ko: '높음', en: 'High', zh: '高', vi: 'Cao' },
    MEDIUM: { ko: '보통', en: 'Medium', zh: '普通', vi: 'Trung bình' },
    LOW: { ko: '낮음', en: 'Low', zh: '低', vi: 'Thấp' },
  },
  COMPLAINT_STATUS: {
    RECEIVED: { ko: '접수', en: 'Received', zh: '受理', vi: 'Tiếp nhận' },
    INVESTIGATING: { ko: '조사중', en: 'Investigating', zh: '调查中', vi: 'Đang điều tra' },
    RESPONDING: { ko: '대응중', en: 'Responding', zh: '应对中', vi: 'Đang xử lý' },
    RESOLVED: { ko: '해결', en: 'Resolved', zh: '已解决', vi: 'Đã giải quyết' },
    CLOSED: { ko: '종결', en: 'Closed', zh: '关闭', vi: 'Đã đóng' },
  },
  DOC_TYPE: {
    PROCEDURE: { ko: '절차서', en: 'Procedure', zh: '程序书', vi: 'Quy trình' },
    WI: { ko: '작업표준서', en: 'Work Instruction', zh: '作业标准书', vi: 'Hướng dẫn công việc' },
    FORM: { ko: '양식', en: 'Form', zh: '表单', vi: 'Biểu mẫu' },
    SPEC: { ko: '규격서', en: 'Specification', zh: '规格书', vi: 'Quy cách' },
    DRAWING: { ko: '도면', en: 'Drawing', zh: '图纸', vi: 'Bản vẽ' },
    MANUAL: { ko: '매뉴얼', en: 'Manual', zh: '手册', vi: 'Sổ tay' },
  },
  DOC_STATUS: {
    DRAFT: { ko: '작성중', en: 'Draft', zh: '编制中', vi: 'Đang soạn' },
    REVIEW: { ko: '검토중', en: 'Review', zh: '审核中', vi: 'Đang xem xét' },
    APPROVED: { ko: '승인됨', en: 'Approved', zh: '已批准', vi: 'Đã duyệt' },
    OBSOLETE: { ko: '폐기', en: 'Obsolete', zh: '作废', vi: 'Hủy bỏ' },
  },
  CP_PHASE: {
    PROTOTYPE: { ko: '시작품', en: 'Prototype', zh: '样件', vi: 'Mẫu thử' },
    PRE_LAUNCH: { ko: '양산준비', en: 'Pre-Launch', zh: '试产', vi: 'Tiền sản xuất' },
    PRODUCTION: { ko: '양산', en: 'Production', zh: '量产', vi: 'Sản xuất' },
  },
  CP_STATUS: {
    DRAFT: { ko: '작성중', en: 'Draft', zh: '编制中', vi: 'Đang soạn' },
    REVIEW: { ko: '검토중', en: 'Review', zh: '审核中', vi: 'Đang xem xét' },
    APPROVED: { ko: '승인됨', en: 'Approved', zh: '已批准', vi: 'Đã duyệt' },
    OBSOLETE: { ko: '폐기', en: 'Obsolete', zh: '作废', vi: 'Hủy bỏ' },
  },
  OQC_STATUS: {
    PENDING: { ko: '대기', en: 'Pending', zh: '待检', vi: 'Chờ' },
    IN_PROGRESS: { ko: '검사중', en: 'Inspecting', zh: '检查中', vi: 'Đang kiểm' },
    PASS: { ko: '합격', en: 'Pass', zh: '合格', vi: 'Đạt' },
    FAIL: { ko: '불합격', en: 'Fail', zh: '不合格', vi: 'Không đạt' },
  },
  SHIP_ORDER_STATUS: {
    DRAFT: { ko: '임시저장', en: 'Draft', zh: '暂存', vi: 'Bản nháp' },
    CONFIRMED: { ko: '확정', en: 'Confirmed', zh: '已确认', vi: 'Đã xác nhận' },
    SHIPPING: { ko: '출하중', en: 'Shipping', zh: '出货中', vi: 'Đang xuất' },
    SHIPPED: { ko: '출하완료', en: 'Shipped', zh: '已出货', vi: 'Đã xuất' },
    CLOSED: { ko: '마감', en: 'Closed', zh: '关闭', vi: 'Đã đóng' },
  },
  INSPECT_CHECK_TYPE: {
    DAILY: { ko: '일상점검', en: 'Daily', zh: '日常点检', vi: 'Hàng ngày' },
    PERIODIC: { ko: '정기점검', en: 'Periodic', zh: '定期点检', vi: 'Định kỳ' },
    WORKER: { ko: '작업자점검', en: 'Worker', zh: '作业者点检', vi: 'Người vận hành' },
  },
  INSPECT_JUDGE: {
    PASS: { ko: '합격', en: 'Pass', zh: '合格', vi: 'Đạt' },
    FAIL: { ko: '불합격', en: 'Fail', zh: '不合格', vi: 'Không đạt' },
    CONDITIONAL: { ko: '조건부합격', en: 'Conditional', zh: '有条件合格', vi: 'Đạt có điều kiện' },
  },
  // ===== 유형 A: 기존 그룹에 추가된 신규 코드만 =====
  EQUIP_STATUS: { INTERLOCK: { ko: '인터록', en: 'Interlock', zh: '联锁', vi: 'Khóa liên động' } },
  ISSUE_STATUS: { APPROVED: { ko: '승인', en: 'Approved', zh: '已批准', vi: 'Đã duyệt' } },
  PARTNER_TYPE: { MFG: { ko: '제조사', en: 'Manufacturer', zh: '制造商', vi: 'Nhà sản xuất' } },
  RECEIVE_STATUS: { DONE: { ko: '입고완료', en: 'Received', zh: '入库完成', vi: 'Đã nhập kho' } },
  ARRIVAL_RESULT_STATUS: { DONE: { ko: '완료', en: 'Done', zh: '完成', vi: 'Hoàn tất' } },
  ARRIVAL_PO_TYPE: { PO: { ko: '발주', en: 'PO', zh: '采购订单', vi: 'Đơn đặt hàng' } },
};

const LOCALES = ['ko', 'en', 'zh', 'vi'];
const baseDir = 'apps/frontend/src/locales';
let totalAdded = 0;

for (const loc of LOCALES) {
  const path = `${baseDir}/${loc}.json`;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  if (!json.comCode) json.comCode = {};
  let added = 0;
  for (const [group, codes] of Object.entries(TR)) {
    if (!json.comCode[group]) json.comCode[group] = {};
    for (const [code, labels] of Object.entries(codes)) {
      if (json.comCode[group][code] === undefined) {
        json.comCode[group][code] = labels[loc];
        added++;
      }
    }
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${loc}.json: +${added} keys`);
  totalAdded += added;
}
console.log(`TOTAL added: ${totalAdded}`);
