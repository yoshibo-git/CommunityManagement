import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 768, 1024, 1280, 1440];
const pages = [
  { path: '/', title: 'Cùng hành động.', name: 'home' },
  { path: '/login', title: 'Đăng nhập', name: 'login' },
  { path: '/proposals', title: 'Cùng xây dựng hoạt động ý nghĩa', name: 'proposals' },
];

for (const route of pages) {
  test(`${route.name}: responsive layout and unavailable state`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(route.title);
      if (route.name === 'proposals') await expect(page.getByRole('main')).toContainText('chưa khả dụng');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (route.name === 'proposals') {
        expect(await page.locator('.form-grid').first().evaluate((grid) => {
          const columns = getComputedStyle(grid).gridTemplateColumns.split(' ');
          return columns.length === 1 || columns.every((column) => parseFloat(column) >= 280);
        })).toBe(true);
      }
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`${route.name}-${width}.png`), fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('header links navigate to login and proposals on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.getByRole('banner').getByRole('link', { name: 'Đề xuất hoạt động', exact: true }).click();
  await expect(page).toHaveURL('/proposals');
});

test('mobile menu traps focus, closes on Escape and navigation, and preserves form input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/proposals');
  await page.getByLabel('Tên đơn vị').fill('Đơn vị cộng đồng');
  const trigger = page.getByRole('button', { name: 'Mở menu' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel('Tên đơn vị')).toHaveValue('Đơn vị cộng đồng');
  await trigger.click();
  await dialog.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(dialog).not.toBeVisible();
});


test('password visibility works before typing, after blur/refocus and with the keyboard', async ({ page }, testInfo) => {
  await page.goto('/login');
  const password = page.getByLabel('Mật khẩu', { exact: true });
  const toggle = page.locator('.password-input button');
  await expect(toggle).toHaveCount(1);
  await toggle.click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(toggle).toHaveAccessibleName('Ẩn mật khẩu');
  await toggle.click();
  await page.reload();
  await password.pressSequentially('test-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.locator('.password-input').screenshot({ path: testInfo.outputPath('password-control.png') });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('heading', { level: 1 }).click();
    await password.click();
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveValue('test-password');
  }
  await password.focus();
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'text');
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'password');
});

test('proposal form contains all documented fields and does not submit unavailable service', async ({ page }) => {
  await page.goto('/proposals');
  for (const label of ['Tên đơn vị', 'Loại đơn vị', 'Người liên hệ', 'Số điện thoại', 'Email liên hệ', 'Tên hoạt động', 'Mô tả hoạt động', 'Địa điểm dự kiến', 'Thời gian dự kiến']) {
    await expect(page.getByLabel(label)).toBeVisible();
  }
  await page.getByLabel('Tên đơn vị').fill('Tên đơn vị rất dài '.repeat(10));
  await page.getByLabel('Tên hoạt động').fill('Hoạt động cộng đồng');
  await page.getByLabel('Tôi xác nhận').check();
  await expect(page.getByRole('button', { name: 'Gửi đề xuất', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('chưa được gửi hoặc lưu lại');
});

test('keyboard skip link, reduced motion and narrow reflow remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Chuyển đến nội dung chính' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  for (const route of pages) {
    await page.goto(route.path);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('development preview cannot be opened in production', async ({ page }) => {
  await page.goto('/preview/user');
  await expect(page.getByRole('heading', { name: 'Trang bạn tìm hiện không tồn tại' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chức năng Người dùng cuối' })).toHaveCount(0);
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Xem trước giao diện Người dùng cuối' })).toHaveCount(0);
});
