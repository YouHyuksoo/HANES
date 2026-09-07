/** 수리 화면 전용 신규 문구. 공용 locale 파일의 다른 작업과 분리한다. */
import { useTranslation } from 'react-i18next';
const messages = {
  start:['수리 시작','Start repair','开始维修','Bắt đầu sửa chữa'],
  finish:['수리 완료 처리','Finish repair','完成维修','Hoàn tất sửa chữa'],
  inspect:['재검사 판정','Record reinspection','复检判定','Ghi kết quả tái kiểm tra'],
  pending:['재검사 대기','Awaiting reinspection','等待复检','Chờ tái kiểm tra'],
  warehouse:['수리대상 출고 창고','Repair source warehouse','维修出库仓库','Kho xuất sửa chữa'],
  returnWarehouse:['복귀 창고','Return warehouse','返回仓库','Kho trả về'],
  saveFirst:['변경사항을 저장하면 다음 단계를 진행할 수 있습니다.','Save changes before proceeding.','请保存更改后继续。','Lưu thay đổi trước khi tiếp tục.'],
  startHelp:['작업자와 출고 창고를 선택하세요. FG 외관불합격은 검사 전 재고에서, 품목 수리는 불량재고에서 인수합니다.','Save a worker and select source stock. Failed FG labels use pre-inspection stock; manual item repairs use defect stock.','保存维修人员并选择出库仓库。外观不合格FG从检验前库存领出，品目维修从不良库存领出。','Lưu người sửa và chọn kho xuất. FG lỗi ngoại quan lấy từ tồn trước kiểm tra, sửa theo mã hàng lấy từ tồn lỗi.'],
  completeHelp:['재사용·폐기는 선택 LOT의 부품을 차감하고 종결합니다. 재검후재사용은 검사 대기로 전환합니다.','Reuse or scrap consumes selected materials and closes the repair. Reinspection moves to the inspection step.','再用或报废会消耗选定材料并结束维修。复检再用进入复检步骤。','Tái sử dụng hoặc phế sẽ trừ vật tư đã chọn và kết thúc. Tái kiểm tra chuyển sang bước kiểm tra.'],
  inspectHelp:['수리수량 전량을 판정합니다. 합격은 양품 복귀, 불합격은 재수리로 전환합니다.','Judge the full repair quantity. PASS returns good stock; FAIL returns to repair.','判定全部维修数量。合格返回良品库存，不合格返回维修。','Đánh giá toàn bộ số lượng. Đạt trả hàng tốt, không đạt quay lại sửa chữa.'],
  pass:['합격','PASS','合格','Đạt'],
  fail:['불합격','FAIL','不合格','Không đạt'],
  partsHelp:['사용부품은 재수리를 포함한 누적 사용수량으로 입력하세요.','Enter cumulative material usage, including repair retries.','请输入累计材料用量，包括重复维修。','Nhập tổng vật tư sử dụng, bao gồm các lần sửa lại.'],
  lot:['사용부품 LOT 배분','Material LOT allocation','使用材料批次分配','Phân bổ LOT vật tư'],
  addLot:['LOT 추가','Add LOT','添加批次','Thêm LOT'],
  selectLot:['LOT 선택','Select LOT','选择批次','Chọn LOT'],
  selectWarehouse:['창고 선택','Select warehouse','选择仓库','Chọn kho'],
  noStock:['해당 수리대상의 가용재고가 없습니다.','No available stock for this repair target.','该维修对象没有可用库存。','Không có tồn khả dụng cho đối tượng sửa chữa.'],
  actionConfirm:['선택한 처리로 수리 상태와 재고를 반영합니다.','Apply the selected repair action and stock changes.','执行所选维修操作并更新库存。','Thực hiện xử lý sửa chữa và cập nhật tồn kho.'],
  history:['재검사 이력','Reinspection history','复检记录','Lịch sử tái kiểm tra'],
  readOnly:['종결된 수리는 조회만 가능합니다.','Completed repairs are read-only.','已完成的维修仅可查看。','Sửa chữa hoàn tất chỉ được xem.'],
  failed:['처리에 실패했습니다. 입력값과 재고를 확인하세요.','Action failed. Check input and stock.','处理失败，请检查输入和库存。','Xử lý thất bại. Kiểm tra thông tin và tồn kho.'],
  selectRequired:['필수 선택값을 확인하세요.','Complete the required selections.','请完成必选项。','Vui lòng chọn các mục bắt buộc.'],
} as const;
export function useRepairText() {
  const {i18n}=useTranslation();
  const index=i18n.language.startsWith('ko')?0:i18n.language.startsWith('zh')?2:i18n.language.startsWith('vi')?3:1;
  return Object.fromEntries(Object.entries(messages).map(([key,values])=>[key,values[index]])) as Record<keyof typeof messages,string>;
}
