import { test, expect } from '@playwright/test';

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',
  admin01: process.env.SEED_PASSWORD_ADMIN ?? '',
};

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  const reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  expect(reset.status()).toBe(200);
});

test.describe('page-login', () => {
  test('E2E-LOGIN-1 (FR-0.1.1, FR-0.1.2) login failure shows error and login success redirects to role-specific page', async ({ page }) => {
    // 1. Login with invalid credentials -> shows error banner and stays on /login
    await page.goto('http://localhost:5173/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill('wrong_password_999');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-login')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'AUTH_INVALID_CREDENTIALS');

    // 2. Login with valid Customer credentials -> redirects to /products
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-products')).toBeVisible();

    // 3. Logout, then login as Admin -> redirects to /admin/products
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    await page.getByTestId('login-username').fill('admin01');
    await page.getByTestId('login-password').fill(PASSWORD.admin01);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-admin-products')).toBeVisible();
  });
});
