import { test, expect } from '@playwright/test';

/**
 * testid 가 실제 DOM 까지 도달하는지 확인한다.
 * 공용 컴포넌트가 props 를 DOM 에 안 뿌리면 심어도 무의미하므로 실측이 필요하다.
 *
 *   npx playwright test e2e/verify-testids.spec.ts --project=chromium --no-deps
 */
test('작업지시 화면 testid 8개가 DOM 에 존재한다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/production/order');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  // 목록 화면
  await expect(page.getByTestId('job-order-create')).toBeVisible({ timeout: 20000 });

  // 생성 모달을 열고 내부 요소 확인
  await page.getByTestId('job-order-create').click();
  const inModal = [
    'job-order-item-code',
    'job-order-item-search',
    'job-order-plan-qty',
    'job-order-plan-date',
    'job-order-line',
    'job-order-save',
    'job-order-cancel',
  ];
  for (const id of inModal) {
    await expect(page.getByTestId(id), `${id} 가 DOM 에 없다`).toBeVisible({ timeout: 15000 });
    console.log('[testid] OK', id);
  }

  // 저장 버튼은 입력 전이라 비활성이어야 한다 (드라이버가 선행조건 미충족을 잡는 지점)
  await expect(page.getByTestId('job-order-save')).toBeDisabled();
  console.log('[testid] 저장 버튼 초기 비활성 확인');
});

test('생산계획 화면 testid 가 DOM 에 존재한다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/production/monthly-plan');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  for (const id of ['prod-plan-add', 'prod-plan-search']) {
    await expect(page.getByTestId(id), `${id} 가 DOM 에 없다`).toBeVisible({ timeout: 20000 });
    console.log('[testid] OK', id);
  }

  // 계획 추가 패널을 열고 폼 요소 확인
  await page.getByTestId('prod-plan-add').click();
  for (const id of [
    'prod-plan-month',
    'prod-plan-item-code',
    'prod-plan-item-search',
    'prod-plan-qty',
    'prod-plan-save',
    'prod-plan-cancel',
  ]) {
    await expect(page.getByTestId(id), `${id} 가 DOM 에 없다`).toBeVisible({ timeout: 15000 });
    console.log('[testid] OK', id);
  }

  // 행의 "작업지시 발행" 버튼 — 계획 데이터가 있을 때만 존재한다
  await page.getByTestId('prod-plan-cancel').click();
  const issueCount = await page.getByTestId('prod-plan-issue-job-order').count();
  console.log('[testid] 행 발행버튼', issueCount, '개 (계획 데이터가 없으면 0)');
});

test('자재출고요청 화면 testid 가 DOM 에 존재한다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/material/request');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  for (const id of ['mat-request-order-search', 'mat-request-order-row']) {
    await expect(page.getByTestId(id).first(), `${id} 가 DOM 에 없다`).toBeVisible({ timeout: 25000 });
    console.log('[testid] OK', id);
  }

  // 작업지시를 선택해야 우측에 요청 작성 버튼이 나타난다
  await page.getByTestId('mat-request-order-row').first().click();
  await expect(page.getByTestId('mat-request-new'), 'mat-request-new 가 DOM 에 없다').toBeVisible({ timeout: 20000 });
  console.log('[testid] OK mat-request-new');

  // 작성 모드로 들어가야 등록(쓰기) 버튼이 나타난다
  await page.getByTestId('mat-request-new').click();
  await expect(page.getByTestId('mat-request-submit'), 'mat-request-submit 가 DOM 에 없다').toBeVisible({ timeout: 20000 });
  console.log('[testid] OK mat-request-submit');
});
