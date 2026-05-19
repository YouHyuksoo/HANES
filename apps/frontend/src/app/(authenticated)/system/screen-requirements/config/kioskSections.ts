/**
 * @file config/kioskSections.ts
 * @description 생산실적 키오스크 요구사항 수집 — 섹션/질문 데이터 정의
 */

export type QuestionType = 'radio' | 'multiselect' | 'boolean' | 'text' | 'textarea';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: QuestionOption[];
  placeholder?: string;
  hint?: string;
}

export interface OverlayArea {
  x: number; // % 기준 (0~100)
  y: number;
  w: number;
  h: number;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
  overlayArea: OverlayArea;
  questions: Question[];
}

export type Answers = Record<string, string | string[]>;

export const KIOSK_SECTIONS: Section[] = [
  {
    id: 'header',
    title: '헤더 / 준비체크',
    description: '설비 선택, 작업지시 연결, 작업자 등록, 인터락 4단계 설정',
    color: 'blue',
    overlayArea: { x: 0, y: 0, w: 100, h: 17 },
    questions: [
      {
        id: 'equip_select_method',
        label: '설비 선택 방식은?',
        type: 'radio',
        required: true,
        options: [
          { value: 'dropdown', label: '드롭다운 목록에서 선택' },
          { value: 'barcode', label: '바코드/QR 스캔으로 자동 선택' },
          { value: 'auto', label: '로그인 사용자에 자동 할당' },
        ],
      },
      {
        id: 'job_order_method',
        label: '작업지시 선택 방식은?',
        type: 'radio',
        required: true,
        options: [
          { value: 'search', label: '검색 팝업에서 선택' },
          { value: 'qr', label: 'QR코드 스캔으로 자동 연결' },
          { value: 'auto', label: '설비에 배정된 것 자동 로드' },
        ],
      },
      {
        id: 'worker_method',
        label: '작업자 등록 방식은?',
        type: 'radio',
        required: true,
        options: [
          { value: 'search', label: '사번/이름 검색' },
          { value: 'card', label: '사원증 카드 태그 (NFC/RFID)' },
          { value: 'pin', label: 'PIN 번호 입력' },
        ],
      },
      {
        id: 'interlock_required',
        label: '필수 인터락 단계는? (모두 완료 후 실적 입력 허용)',
        type: 'multiselect',
        options: [
          { value: 'daily_inspect', label: '① 설비 일일점검' },
          { value: 'worker_inspect', label: '② 작업자 자가점검' },
          { value: 'material_scan', label: '③ 자재 스캔' },
          { value: 'consumable_scan', label: '④ 소모품 스캔' },
        ],
      },
      {
        id: 'interlock_block',
        label: '인터락 미완료 시 처리 방식은?',
        type: 'radio',
        options: [
          { value: 'block_result', label: '실적입력 버튼만 비활성화' },
          { value: 'block_all', label: '모든 기능 차단 (화면 잠금)' },
          { value: 'warn_only', label: '경고 배너만 표시, 강제 입력 허용' },
        ],
      },
      {
        id: 'auto_daily_check',
        label: '설비 일일점검 완료 여부를 자동으로 조회하여 인터락을 해제하나요?',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'material',
    title: '자재 / 소모도구 패널',
    description: 'BOM 자재 목록, 스캔 인식, 수량 차감, 소모성 부품 관리',
    color: 'green',
    overlayArea: { x: 0, y: 17, w: 22, h: 66 },
    questions: [
      {
        id: 'material_source',
        label: '자재 목록 출처는?',
        type: 'radio',
        required: true,
        options: [
          { value: 'bom', label: 'BOM에서 자동 조회 (작업지시 연결 시)' },
          { value: 'manual', label: '수동으로 품목 직접 추가' },
          { value: 'mixed', label: 'BOM 자동 + 수동 추가 혼합' },
        ],
      },
      {
        id: 'material_confirm_method',
        label: '자재 투입 확인 방식은?',
        type: 'radio',
        options: [
          { value: 'barcode', label: '바코드 스캔 후 자동 매칭' },
          { value: 'manual_check', label: '목록에서 수동 체크' },
          { value: 'auto', label: '실적 저장 시 자동 처리' },
        ],
      },
      {
        id: 'consumable_include',
        label: '소모성 설비 부품 (JIG, 치공구 등) 관리를 포함하나요?',
        type: 'boolean',
      },
      {
        id: 'qty_deduction_timing',
        label: '자재/소모품 수량 차감 시점은?',
        type: 'radio',
        options: [
          { value: 'on_result', label: '실적 저장 시 자동 차감' },
          { value: 'on_scan', label: '스캔/확인 즉시 차감' },
          { value: 'manual', label: '별도 출고 처리 후 차감' },
        ],
      },
      {
        id: 'material_shortage_action',
        label: '자재 부족/불일치 발생 시 처리 방식은?',
        type: 'radio',
        options: [
          { value: 'warn_popup', label: '경고 팝업 표시 후 계속 허용' },
          { value: 'block', label: '실적 입력 차단' },
          { value: 'badge', label: '배지만 표시, 계속 진행 가능' },
        ],
      },
    ],
  },
  {
    id: 'workinstr',
    title: '작업지도서 / 자주검사 / 불량',
    description: '이미지 뷰어, 자주검사 타이밍, 불량 입력 방식',
    color: 'orange',
    overlayArea: { x: 22, y: 17, w: 56, h: 66 },
    questions: [
      {
        id: 'work_instr_source',
        label: '작업지도서 이미지는 어디서 가져오나요?',
        type: 'radio',
        required: true,
        options: [
          { value: 'routing', label: '라우팅 마스터에서 자동 연동' },
          { value: 'upload', label: '담당자가 직접 업로드 (파일 관리)' },
          { value: 'url', label: '외부 URL 링크' },
        ],
      },
      {
        id: 'work_instr_viewer',
        label: '이미지 뷰어에 필요한 기능은? (복수 선택)',
        type: 'multiselect',
        options: [
          { value: 'zoom', label: '확대/축소' },
          { value: 'rotate', label: '회전' },
          { value: 'multi_page', label: '다중 페이지 (슬라이드)' },
          { value: 'fullscreen', label: '전체화면' },
        ],
      },
      {
        id: 'self_inspect_timing',
        label: '자주검사 실행 타이밍은? (복수 선택)',
        type: 'multiselect',
        options: [
          { value: 'FIRST', label: '초물: 첫 번째 실적 저장 직후' },
          { value: 'MID', label: '중물: 작업자 수동 클릭' },
          { value: 'LAST', label: '종물: 작업지시 완료 시' },
        ],
      },
      {
        id: 'self_inspect_result',
        label: '자주검사 결과 처리 방식은?',
        type: 'radio',
        options: [
          { value: 'pass_fail', label: '합격/불합격 즉시 확정' },
          { value: 'delegate', label: '의뢰 가능 (품질부서 대신 검사)' },
          { value: 'pending', label: '보류 후 재검사 가능' },
        ],
      },
      {
        id: 'defect_input_method',
        label: '불량 입력 방식은?',
        type: 'radio',
        options: [
          { value: 'code_qty', label: '불량 유형 선택 + 수량 입력' },
          { value: 'free_text', label: '자유 텍스트 메모' },
          { value: 'qc_code', label: 'QC 코드 + 불량 위치 지정' },
        ],
      },
      {
        id: 'defect_block_production',
        label: '불량 발생 시 이후 실적 입력을 차단하나요?',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'result',
    title: '실적입력 / 양품조건 / 이력',
    description: '시리얼 번호 생성, 묶음단위, 수량 검증, 이력 갱신 주기',
    color: 'purple',
    overlayArea: { x: 78, y: 17, w: 22, h: 83 },
    questions: [
      {
        id: 'serial_rule',
        label: '시리얼 번호 생성 규칙은?',
        type: 'radio',
        required: true,
        options: [
          { value: 'order_seq', label: '작업지시번호 + 순번 (예: W26001-001)' },
          { value: 'custom', label: '사용자 정의 포맷' },
          { value: 'barcode', label: '바코드 스캔으로 직접 입력' },
        ],
      },
      {
        id: 'serial_custom_format',
        label: '사용자 정의 시리얼 포맷 (위에서 "사용자 정의" 선택 시 입력)',
        type: 'text',
        placeholder: '예: {YEAR}{MONTH}-{SEQ4}',
        hint: '"사용자 정의" 선택 시에만 작성',
      },
      {
        id: 'lot_size_enabled',
        label: '묶음 단위 (로트 사이즈) 설정 기능이 필요하나요?',
        type: 'boolean',
      },
      {
        id: 'qty_validation',
        label: '수량 검증 방식은?',
        type: 'radio',
        options: [
          { value: 'total_equal', label: '작업수 = 양품 + 불량 (필수 일치)' },
          { value: 'good_only', label: '양품 수량만 입력' },
          { value: 'separate', label: '양품/불량 각각 독립 입력' },
        ],
      },
      {
        id: 'history_refresh',
        label: '작업이력 자동 갱신 주기는?',
        type: 'radio',
        options: [
          { value: '10', label: '10초마다 자동 갱신' },
          { value: '30', label: '30초마다 자동 갱신' },
          { value: 'manual', label: '수동 새로고침만' },
        ],
      },
      {
        id: 'quality_criteria_source',
        label: '우측 패널 양품조건 데이터 출처는?',
        type: 'radio',
        options: [
          { value: 'self_inspect', label: '자주검사 항목 기준으로 표시' },
          { value: 'separate', label: '별도 양품기준 마스터 사용' },
          { value: 'none', label: '표시 안 함' },
        ],
      },
      {
        id: 'additional_requirements',
        label: '추가 요구사항 또는 제약사항',
        type: 'textarea',
        placeholder: '예: 바코드 입력창 항상 포커스 유지, 터치스크린 최적화, 야간 다크모드 필수, 다국어 지원 등',
      },
    ],
  },
];
