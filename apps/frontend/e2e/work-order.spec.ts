import { test, expect } from '@playwright/test';

/**
 * 작업지시 관리 화면(/production/order) E2E.
 *
 * 검증 목표: 사용자 UI를 실제로 구동하며 컴포넌트 경계 흐름을 확인한다.
 *  - 검색/액션바/그리드/우측 폼 패널이 하나의 화면에서 어떻게 연동되는가
 *  - 그리드 행 선택 상태가 액션바 컴포넌트로 전파되는가 (경계 흐름)
 *  - 생성 버튼 → 우측 폼 패널 마운트/언마운트 (경계 흐름)
 *
 * 읽기 전용 시나리오만 다룬다. 저장/상태전이/삭제 등 데이터 변경은 하지 않는다.
 */
test.describe('작업지시 관리 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/production/order');
    await expect(
      page.getByRole('heading', { name: '작업지시 관리' }),
    ).toBeVisible();
  });

  test('화면 로드: 제목·검색창·액션바 기본 상태', async ({ page }) => {
    // 검색 입력
    await expect(
      page.getByPlaceholder('작업지시번호, 품목코드, 품목명 검색...'),
    ).toBeVisible();

    // 행 미선택 → 액션바 안내 문구 + 액션 버튼 비활성
    await expect(page.getByText('작업지시를 선택해주세요')).toBeVisible();
    await expect(page.getByRole('button', { name: '작업지시서 출력' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '시작', exact: true })).toBeDisabled();
  });

  test('생성 버튼 → 우측 폼 패널 열림/닫힘 (버튼→패널 경계)', async ({ page }) => {
    // 처음엔 패널 없음
    await expect(
      page.getByRole('heading', { name: '작업지시 생성' }),
    ).toHaveCount(0);

    // 생성 버튼 클릭 → 우측 폼 패널 마운트
    await page.getByRole('button', { name: '작업지시 생성' }).click();
    await expect(
      page.getByRole('heading', { name: '작업지시 생성' }),
    ).toBeVisible();

    // 취소 → 패널 언마운트
    await page.locator('form, [class*="border-l"]')
      .getByRole('button', { name: '취소' })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: '작업지시 생성' }),
    ).toHaveCount(0);
  });

  test('그리드 행 선택 → 액션바로 선택 상태 전파 (그리드→액션바 경계)', async ({
    page,
  }) => {
    // 날짜 필터(기본 당일)를 비워 전체 조회 → 데이터 확보
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('');
    await dateInputs.nth(1).fill('');

    // 새로고침 클릭 → 그 요청의 실제 응답을 기다려 결정론적으로 처리.
    // (이전 빈 상태를 먼저 보고 건너뛰는 레이스 방지)
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/production/job-orders') && r.request().method() === 'GET',
    );
    await page.getByRole('button', { name: '새로고침' }).click();
    const body = await (await respPromise).json();
    const rowData = body?.data ?? [];
    test.skip(
      rowData.length === 0,
      '작업지시 데이터가 없어 선택 흐름 검증을 건너뜀',
    );

    // 응답 데이터가 그리드에 반영(데이터 행의 둘째 셀 렌더)될 때까지 대기
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.getByRole('cell').nth(1)).toBeVisible({ timeout: 15000 });

    // 선택 전: 액션바 출력 버튼 비활성 + 안내 문구 표시
    const printBtn = page.getByRole('button', { name: '작업지시서 출력' });
    await expect(printBtn).toBeDisabled();
    await expect(page.getByText('작업지시를 선택해주세요')).toBeVisible();

    // 그리드 행 클릭 → 선택 상태가 액션바 컴포넌트로 전파
    await firstRow.click();

    // 선택 후: 안내 문구 사라지고 출력 버튼 활성화 (경계 흐름 성립)
    await expect(page.getByText('작업지시를 선택해주세요')).toBeHidden();
    await expect(printBtn).toBeEnabled();

    // 다시 클릭하면 선택 해제 → 원상복귀 (토글)
    await firstRow.click();
    await expect(printBtn).toBeDisabled();
    await expect(page.getByText('작업지시를 선택해주세요')).toBeVisible();
  });
});
