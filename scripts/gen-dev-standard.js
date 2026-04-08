/**
 * @file scripts/gen-dev-standard.js
 * @description HARNESS MES 개발표준정의서 Word 문서 생성
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const CW = 13440;
const MARGIN = 1200;
const C = { primary: '2B579A', hdr: 'D5E8F0', alt: 'F5F9FC', w: 'FFFFFF', warn: 'FFF2CC', code: 'F0F4F8' };
const tb = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const tbs = { top: tb, bottom: tb, left: tb, right: tb };

function c(text, width, opts = {}) {
  return new TableCell({
    borders: tbs, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    columnSpan: opts.span, verticalAlign: 'center',
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT, spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: text || '', bold: opts.bold || false, font: opts.font || 'Arial', size: opts.size || 17, color: opts.color || '000000' })],
    })],
  });
}

function multiCell(lines, width, opts = {}) {
  return new TableCell({
    borders: tbs, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    verticalAlign: 'top',
    children: lines.map(l => new Paragraph({ spacing: { before: 20, after: 20 }, children: [new TextRun({ text: l, font: opts.font || 'Consolas', size: 15 })] })),
  });
}

function dataTbl(headers, data, widths) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => c(h, widths[i], { bold: true, shading: C.hdr, align: AlignmentType.CENTER, size: 15 })) }),
      ...data.map((row, idx) => new TableRow({
        children: row.map((val, i) => c(val, widths[i], { size: 15, shading: idx % 2 === 1 ? C.alt : C.w })),
      })),
    ],
  });
}

function infoTbl(rows) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [3000, 10440],
    rows: rows.map(([k, v]) => new TableRow({ children: [c(k, 3000, { bold: true, shading: C.hdr }), c(v, 10440)] })),
  });
}

function codeBlock(lines) {
  return lines.map(l => new Paragraph({
    spacing: { before: 10, after: 10 }, indent: { left: 360 },
    children: [new TextRun({ text: l, font: 'Consolas', size: 16 })],
  }));
}

function sp() { return new Paragraph({ spacing: { after: 200 }, children: [] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: 'Arial' })] }); }
function p(t) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, font: 'Arial', size: 20 })] }); }

function buildDoc() {
  // 표지
  const cover = {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'HARNESS MES', font: 'Arial', size: 56, bold: true, color: C.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Manufacturing Execution System', font: 'Arial', size: 28, color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '\uAC1C\uBC1C\uD45C\uC900\uC815\uC758\uC11C', font: 'Arial', size: 48, bold: true, color: '333333' })] }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
        rows: [['프로젝트명', 'HARNESS MES'], ['산출물명', '개발표준정의서'], ['버전', 'v1.0'], ['작성일', '2026-03-18'], ['작성자', 'HANES MES팀']].map(([k, v]) =>
          new TableRow({ children: [c(k, 2000, { bold: true, shading: C.hdr, align: AlignmentType.CENTER }), c(v, 3000)] })
        ),
      }),
    ],
  };

  const body = [];

  // 개정이력 + 목차
  body.push(h1('\uAC1C\uC815\uC774\uB825'),
    dataTbl(['버전', '일자', '작성자', '변경내용'], [['1.0', '2026-03-18', 'HANES MES팀', '최초 작성']], [1500, 1500, 2000, 8440]),
    pb(), h1('\uBAA9\uCC28'), new TableOfContents('TOC', { hyperlink: true, headingStyleRange: '1-3' }), pb());

  // 1. 개요
  body.push(h1('1. \uAC1C\uC694'),
    h2('1.1 \uBAA9\uC801'), p('\uBCF8 \uBB38\uC11C\uB294 HARNESS MES \uD504\uB85C\uC81D\uD2B8\uC758 \uAC1C\uBC1C \uD45C\uC900\uC744 \uC815\uC758\uD55C\uB2E4. \uD504\uB85C\uC81D\uD2B8 \uAD6C\uC870, \uAE30\uC220 \uC2A4\uD0DD, \uB124\uC774\uBC0D \uADDC\uCE59, \uCF54\uB529 \uCEE8\uBCA4\uC158, \uC5D4\uD2F0\uD2F0/API/UI \uADDC\uCE59, \uD14C\uC2A4\uD2B8 \uADDC\uCE59\uC744 \uD3EC\uD568\uD55C\uB2E4.'),
    h2('1.2 \uBC94\uC704'), p('\uD504\uB860\uD2B8\uC5D4\uB4DC(Next.js), \uBC31\uC5D4\uB4DC(NestJS), \uB370\uC774\uD130\uBCA0\uC774\uC2A4(Oracle), \uBE4C\uB4DC \uC2DC\uC2A4\uD15C(Turborepo) \uC804\uBC18\uC5D0 \uC801\uC6A9'),
    pb());

  // 2. 프로젝트 구조
  body.push(h1('2. \uD504\uB85C\uC81D\uD2B8 \uAD6C\uC870'),
    h2('2.1 \uBAA8\uB178\uB808\uD3EC \uAD6C\uC870'),
    infoTbl([['빌드 시스템', 'Turborepo'], ['패키지 매니저', 'pnpm@10.28.1 (npm 사용 금지)'], ['워크스페이스', 'apps/backend, apps/frontend, packages/shared']]), sp(),
    h2('2.2 \uB514\uB809\uD1A0\uB9AC \uAD6C\uC870'),
    ...codeBlock([
      'HANES/',
      '\u251C\u2500 apps/',
      '\u2502  \u251C\u2500 backend/          # NestJS \uBC31\uC5D4\uB4DC',
      '\u2502  \u2502  \u2514\u2500 src/',
      '\u2502  \u2502     \u251C\u2500 common/       # \uACF5\uD1B5 (guards, decorators, dto)',
      '\u2502  \u2502     \u251C\u2500 entities/     # TypeORM \uC5D4\uD2F0\uD2F0 (\uC804\uC5ED)',
      '\u2502  \u2502     \u251C\u2500 modules/      # \uB3C4\uBA54\uC778 \uBAA8\uB4C8',
      '\u2502  \u2502     \u2502  \u251C\u2500 material/   controllers/ services/ dto/',
      '\u2502  \u2502     \u2502  \u251C\u2500 production/ controllers/ services/ dto/',
      '\u2502  \u2502     \u2502  \u2514\u2500 ...',
      '\u2502  \u2502     \u2514\u2500 shared/       # \uACF5\uC720 \uC11C\uBE44\uC2A4 (numbering, transaction)',
      '\u2502  \u2514\u2500 frontend/         # Next.js \uD504\uB860\uD2B8\uC5D4\uB4DC',
      '\u2502     \u2514\u2500 src/',
      '\u2502        \u251C\u2500 app/(authenticated)/  # \uC778\uC99D \uD544\uC694 \uD398\uC774\uC9C0',
      '\u2502        \u251C\u2500 components/     # \uACF5\uC6A9 \uCEF4\uD3EC\uB10C\uD2B8',
      '\u2502        \u251C\u2500 config/         # \uBA54\uB274/\uC124\uC815',
      '\u2502        \u251C\u2500 locales/        # i18n (ko, en, zh, vi)',
      '\u2502        \u251C\u2500 services/       # API \uC11C\uBE44\uC2A4 (Axios)',
      '\u2502        \u2514\u2500 stores/         # Zustand \uC2A4\uD1A0\uC5B4',
      '\u251C\u2500 packages/shared/      # \uACF5\uC720 \uD0C0\uC785/\uC720\uD2F8',
      '\u251C\u2500 docs/                 # \uBB38\uC11C/\uC0B0\uCD9C\uBB3C',
      '\u251C\u2500 scripts/              # \uC2A4\uD06C\uB9BD\uD2B8',
      '\u251C\u2500 turbo.json            # Turborepo \uC124\uC815',
      '\u2514\u2500 CLAUDE.md             # \uD504\uB85C\uC81D\uD2B8 \uADDC\uCE59',
    ]), pb());

  // 3. 기술 스택
  body.push(h1('3. \uAE30\uC220 \uC2A4\uD0DD'),
    h2('3.1 \uD504\uB860\uD2B8\uC5D4\uB4DC'),
    dataTbl(['\uBD84\uB958', '\uAE30\uC220', '\uBC84\uC804', '\uC124\uBA85'], [
      ['프레임워크', 'Next.js', '15.2.x', 'App Router, React 19'],
      ['UI 라이브러리', 'React', '19.0.x', 'Server/Client Components'],
      ['CSS', 'TailwindCSS', '4.0.x', '유틸리티 퍼스트 CSS'],
      ['상태 관리', 'Zustand', '5.0.x', '글로벌 상태 (authStore 등)'],
      ['데이터 페칭', 'TanStack React Query', '5.62.x', '서버 상태 캐싱'],
      ['테이블', 'TanStack React Table', '8.20.x', 'DataGrid 컴포넌트 기반'],
      ['HTTP', 'Axios', '1.7.x', 'JWT 인터셉터 포함'],
      ['i18n', 'i18next + react-i18next', '24.x', '4개 언어 (ko, en, zh, vi)'],
      ['차트', 'Recharts', '3.8.x', 'SPC/대시보드 차트'],
      ['아이콘', 'Lucide React', '0.468.x', 'SVG 아이콘'],
      ['바코드', 'bwip-js', '4.8.x', '바코드/QR 생성'],
      ['PDF', 'jsPDF + jspdf-autotable', '4.2.x', '라벨/리포트 출력'],
      ['PWA', '@ducanh2912/next-pwa', '10.2.x', 'PDA 모바일 앱'],
    ], [1500, 2500, 1200, 8240]),
    sp(), h2('3.2 \uBC31\uC5D4\uB4DC'),
    dataTbl(['\uBD84\uB958', '\uAE30\uC220', '\uBC84\uC804', '\uC124\uBA85'], [
      ['프레임워크', 'NestJS', '11.0.x', '모듈형 Node.js 프레임워크'],
      ['ORM', 'TypeORM', '0.3.x', 'Oracle DB 연동'],
      ['DB 드라이버', 'oracledb', '6.7.x', 'Oracle Instant Client'],
      ['인증', 'JWT', '-', 'Bearer Token (자체 구현)'],
      ['문서화', '@nestjs/swagger', '11.0.x', 'Swagger/OpenAPI'],
      ['스케줄링', '@nestjs/schedule + cron', '6.1.x', '배치 작업'],
      ['시리얼', 'serialport', '13.0.x', '바코드 스캐너/라벨 프린터'],
      ['검증', 'class-validator + class-transformer', '0.14.x', 'DTO 유효성 검증'],
      ['테스트', 'Jest + @golevelup/ts-jest', '-', '단위 테스트 (Mock)'],
    ], [1500, 2800, 1200, 7940]),
    sp(), h2('3.3 \uB370\uC774\uD130\uBCA0\uC774\uC2A4'),
    infoTbl([['DBMS', 'Oracle Database'], ['문자셋', 'AL32UTF8'], ['ORM 전략', 'TypeORM synchronize=false (DDL 수동 관리)'], ['PK 전략', '자연키/복합키 (Auto Increment 미사용)'], ['멀티테넌시', 'COMPANY + PLANT_CD 컬럼']]),
    sp(), h2('3.4 \uBE4C\uB4DC/\uBC30\uD3EC'),
    infoTbl([['빌드', 'Turborepo (병렬 빌드, 캐싱)'], ['패키지 매니저', 'pnpm@10.28.1'], ['프로세스', 'PM2 (프로덕션)'], ['CI/CD', 'GitHub Actions'], ['포트', 'Frontend: 3002, Backend: 3000']]),
    pb());

  // 4. 네이밍 규칙
  body.push(h1('4. \uB124\uC774\uBC0D \uADDC\uCE59'),
    dataTbl(['\uBD84\uB958', '\uADDC\uCE59', '\uC608\uC2DC', '\uBE44\uACE0'], [
      ['React 컴포넌트 파일', 'PascalCase.tsx', 'EquipBomTab.tsx, SpcChartView.tsx', ''],
      ['페이지 파일', 'page.tsx (App Router)', 'material/arrival/page.tsx', 'Next.js 규칙'],
      ['NestJS 모듈/서비스/컨트롤러', 'kebab-case.ts', 'arrival.service.ts', ''],
      ['NestJS DTO', 'kebab-case.dto.ts', 'arrival.dto.ts', ''],
      ['엔티티 파일', 'kebab-case.entity.ts', 'mat-lot.entity.ts', ''],
      ['테스트 파일', '*.spec.ts', 'arrival.service.spec.ts', 'Jest'],
      ['변수/함수', 'camelCase', 'createPoArrival, matUid', ''],
      ['클래스/인터페이스', 'PascalCase', 'ArrivalService, MatLot', ''],
      ['상수', 'UPPER_SNAKE_CASE', 'MAX_RETRY_COUNT', ''],
      ['DB 테이블', 'UPPER_SNAKE_CASE (복수형)', 'MAT_ARRIVALS, MAT_LOTS', 'Oracle 컨벤션'],
      ['DB 컬럼', 'UPPER_SNAKE_CASE', 'ITEM_CODE, WAREHOUSE_CODE', '@Column({ name: })'],
      ['API 경로', 'kebab-case (복수형)', '/material/arrivals, /master/parts', 'REST'],
      ['i18n 키', 'dot notation', 'menu.material.arrival', '4개 언어 동시 관리'],
      ['메뉴 코드 (RBAC)', 'UPPER_SNAKE_CASE', 'MAT_ARRIVAL, PROD_ORDER', ''],
    ], [2500, 2500, 3500, 4940]),
    pb());

  // 5. 코딩 컨벤션
  body.push(h1('5. \uCF54\uB529 \uCEE8\uBCA4\uC158'),
    h2('5.1 TypeScript \uACF5\uD1B5'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85', '\uC608\uC2DC'], [
      ['as any 금지', '처음부터 올바른 타입으로 작성', 'as any 대신 제네릭 또는 인터페이스 정의'],
      ['catch 타입 지정', 'catch (error: unknown) 필수', 'catch (e) 금지'],
      ['폴백값 금지', "|| '기본값', ?? '기본값' 패턴 금지", '에러는 명시적으로 처리'],
      ['JSDoc 필수', '@file, @description 포함 (초보자 가이드)', '모든 파일 상단에 작성'],
      ['파일 크기 제한', '페이지 300줄, 컴포넌트 200줄, 절대 500줄 초과 금지', '초과 시 분리'],
    ], [2500, 5000, 5940]),
    sp(), h2('5.2 React/Next.js'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85'], [
      ['alert/confirm/prompt 금지', 'Modal, ConfirmModal 컴포넌트 사용'],
      ['통계 카드', 'StatCard 공용 컴포넌트 사용 (@/components/ui)'],
      ['dark: 클래스', '반드시 기본값과 함께 지정 (bg-white dark:bg-slate-900)'],
      ['flex 스크롤', 'overflow-y-auto 사용 시 min-h-0 함께 적용'],
      ['코드/마스터 입력', '셀렉트/콤보박스 우선, 텍스트 직접입력은 자유 텍스트만'],
      ['공통코드', 'ComCodeBadge + useComCodeOptions (하드코딩 금지)'],
      ['필터 컴포넌트', 'components/shared/ 공용 컴포넌트 우선 (labelPrefix 패턴)'],
      ['UI 패턴 복붙 금지', '같은 UI 패턴을 복사-붙여넣기 하지 않고 공용 컴포넌트 추출'],
      ['i18n', 'UI 변경 시 ko, en, zh, vi 4개 파일 동시 수정'],
    ], [3000, 10440]),
    sp(), h2('5.3 NestJS'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85'], [
      ['모듈 구조', 'controllers/ + services/ + dto/ + module.ts'],
      ['DI (의존성 주입)', '@Injectable() + constructor 주입'],
      ['DTO 검증', 'class-validator 데코레이터 사용 (@IsString, @IsInt, @Min 등)'],
      ['API 문서화', '@ApiTags, @ApiOperation (Swagger 자동 생성)'],
      ['트랜잭션', 'DataSource.createQueryRunner() → startTransaction/commit/rollback'],
      ['멀티테넌시', '@Company(), @Plant() 커스텀 데코레이터 사용'],
      ['응답 형식', 'ResponseUtil.success(data) / ResponseUtil.paged(data, total, page, limit)'],
    ], [3000, 10440]),
    pb());

  // 6. 엔티티 규칙
  body.push(h1('6. \uC5D4\uD2F0\uD2F0/\uBAA8\uB378 \uADDC\uCE59'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85', '\uC608\uC2DC'], [
      ['@PrimaryGeneratedColumn 금지', '@PrimaryColumn 자연키/복합키 사용', "@PrimaryColumn({ name: 'PO_NO' })"],
      ['PK 우선순위', '자연키 > 부모FK+seq > 비즈니스일자+seq > 채번', 'PO_NO, ARRIVAL_NO+SEQ'],
      ['컬럼명 명시', "모든 컬럼에 name: 'UPPER_SNAKE_CASE'", "{ name: 'ITEM_CODE' }"],
      ['감사 컬럼', 'COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT', '모든 테이블 공통'],
      ['재고수량', 'MatStock 단일 관리', 'MatLot에 재고수량 컬럼 금지'],
      ['삭제 정책', '물리 삭제 금지, STATUS=CANCELED + 역분개', '수불원장 원칙'],
      ['인덱스', '@Index 데코레이터 사용', '@Index(["itemCode"])'],
    ], [2500, 5000, 5940]),
    pb());

  // 7. API 설계 규칙
  body.push(h1('7. API \uC124\uACC4 \uADDC\uCE59'),
    h2('7.1 REST API'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85', '\uC608\uC2DC'], [
      ['경로 패턴', '/<모듈>/<리소스복수형>', '/material/arrivals, /master/parts'],
      ['HTTP 메서드', 'GET(조회), POST(등록), PUT(수정), DELETE(삭제)', ''],
      ['경로 확정 우선', '백엔드 경로 확정 후 프론트엔드 작성', '경로 불일치 방지'],
      ['페이지네이션', 'page, limit Query 파라미터', '?page=1&limit=50'],
      ['검색', 'search Query 파라미터 (OR 조건)', '?search=품목코드'],
      ['날짜 필터', 'fromDate, toDate (ISO 8601)', '?fromDate=2026-03-01'],
    ], [2500, 5000, 5940]),
    sp(), h2('7.2 \uC778\uC99D/\uC778\uAC00'),
    infoTbl([['방식', 'JWT Bearer Token'], ['헤더', 'Authorization: Bearer {token}'], ['Guard', 'JwtAuthGuard (글로벌 적용, Public 제외)'], ['RBAC', 'menuConfig 코드 기반 권한 체크'], ['멀티테넌시', 'JWT 페이로드에서 COMPANY, PLANT_CD 추출']]),
    sp(), h2('7.3 \uC5D0\uB7EC \uCC98\uB9AC'),
    dataTbl(['\uC0C1\uD0DC \uCF54\uB4DC', '\uC6A9\uB3C4', '\uC608\uC2DC'], [
      ['200 OK', '조회/수정/삭제 성공', '{ success: true, data: ... }'],
      ['201 Created', '등록 성공', 'POST 응답'],
      ['400 Bad Request', '유효성 검증 실패', '잔량 초과, 상태 부적합'],
      ['401 Unauthorized', '인증 실패', '토큰 만료/미제공'],
      ['403 Forbidden', '권한 없음', '재고동결 기간'],
      ['404 Not Found', '리소스 미존재', 'PO/LOT 미발견'],
      ['500 Internal Server Error', '서버 오류', '채번 실패, DB 오류'],
    ], [2000, 3000, 8440]),
    pb());

  // 8. UI/UX 규칙
  body.push(h1('8. UI/UX \uADDC\uCE59'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85'], [
      ['모달 크기', 'DataGrid 포함: xl+, 폼: lg+, 확인: md+'],
      ['모달 사용', 'alert()/confirm() 금지 → Modal/ConfirmModal 사용'],
      ['다크 모드', 'dark: 클래스 사용 시 반드시 기본값 동시 지정'],
      ['DataGrid 고정 컬럼', "'split'/'pin' 요청 = 고정/핀 컬럼 (듀얼 그리드 아님)"],
      ['통계 카드', 'StatCard 컴포넌트 사용 (아이콘, 색상, 값)'],
      ['스크롤 없는 뷰', '한눈에 볼 수 있도록 설계'],
      ['공통코드 표시', 'ComCodeBadge + useComCodeOptions (한국어 하드코딩 금지)'],
      ['코드/마스터 입력', '셀렉트/콤보박스 우선 (텍스트 직접입력은 비고 등만)'],
      ['필터 컴포넌트', 'components/shared/ 공용 필터 우선 사용'],
    ], [3000, 10440]),
    pb());

  // 9. 테스트 규칙
  body.push(h1('9. \uD14C\uC2A4\uD2B8 \uADDC\uCE59'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85'], [
      ['프레임워크', 'Jest + @nestjs/testing'],
      ['Mock', '@golevelup/ts-jest (createMock/DeepMocked)'],
      ['패턴', 'AAA (Arrange-Act-Assert) / Given-When-Then'],
      ['파일명', '*.spec.ts (서비스 파일 옆에 위치)'],
      ['Playwright 금지', '브라우저 테스트는 사용자가 직접 수행'],
      ['검증 방식', 'API 호출, CLI 체크, pnpm build'],
      ['빌드 검증', '수정 후 pnpm build 에러 0건 확인 후 완료 보고'],
    ], [3000, 10440]),
    pb());

  // 10. 형상 관리
  body.push(h1('10. \uD615\uC0C1 \uAD00\uB9AC'),
    h2('10.1 Git \uBE0C\uB79C\uCE58'),
    infoTbl([['기본 브랜치', 'main'], ['기능 브랜치', 'feature/{기능명}'], ['버그픽스', 'fix/{이슈명}'], ['배포', 'GitHub Actions → PM2 재시작']]),
    sp(), h2('10.2 \uCEE4\uBC0B \uBA54\uC2DC\uC9C0'),
    dataTbl(['\uC811\uB450\uC5B4', '\uC6A9\uB3C4', '\uC608\uC2DC'], [
      ['feat', '새 기능', 'feat(scheduler): add notification bell'],
      ['fix', '버그 수정', 'fix(material): arrival cancel rollback'],
      ['refactor', '리팩토링', 'refactor: quality 모듈 서브모듈 분리'],
      ['docs', '문서', 'docs: update CLAUDE.md'],
      ['test', '테스트', 'test: add arrival.service unit tests'],
      ['chore', '빌드/설정', 'chore: update pnpm-lock.yaml'],
    ], [1500, 2500, 9440]),
    sp(), h2('10.3 PM2 \uC6B4\uC601 \uADDC\uCE59'),
    dataTbl(['\uADDC\uCE59', '\uC124\uBA85'], [
      ['PM2 kill 금지', '프로세스 이름으로만 제어 (pm2 restart app-name)'],
      ['재시작은 PowerShell', 'cmd는 exit code 문제 발생'],
    ], [3000, 10440]),
  );

  const bodySection = {
    properties: { page: { size: { width: 11906, height: 16838, orientation: 'landscape' }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'HARNESS MES - \uAC1C\uBC1C\uD45C\uC900\uC815\uC758\uC11C', font: 'Arial', size: 16, color: '999999' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' })] })] }) },
    children: body,
  };

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial', color: C.primary }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial', color: '333333' }, paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      ],
    },
    sections: [cover, bodySection],
  });
}

async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync('exports/system', { recursive: true });
  const outPath = 'exports/system/개발표준정의서_2026-03-18.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
}
main().catch(console.error);
