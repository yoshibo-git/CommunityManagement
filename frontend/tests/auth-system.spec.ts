import { expect, test } from '@playwright/test';

const password = process.env.TEST_ACCOUNT_PASSWORD;
test.beforeAll(() => { expect(password, 'TEST_ACCOUNT_PASSWORD is required').toBeTruthy(); });

for (const account of [
  { username: 'sinhvien1', name: 'Sinh viên 1', role: 'user' },
  { username: 'canbo1', name: 'Cán bộ 1', role: 'staff' },
  { username: 'admin1', name: 'Quản trị viên', role: 'admin' },
]) {
  test(`${account.role}: account navigation retains public header/footer and exposes correct tabs`, async ({ page, context }, testInfo) => {
    await page.goto('/login');
    await page.getByLabel('Mã sinh viên / Mã nhân sự').fill(account.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(account.role === 'admin' ? '/system' : '/');
    await page.goto('/');
    const trigger = page.getByRole('banner').getByRole('button', { name: account.name, exact: true });
    const bell = page.getByRole('banner').getByRole('button', { name: /^Thông báo:/ });
    await expect(bell).toBeVisible();
    const bellBox = await bell.boundingBox(), accountBox = await trigger.boundingBox();
    expect(bellBox!.x + bellBox!.width).toBeLessThanOrEqual(accountBox!.x);
    await bell.click(); await expect(page.getByRole('region', { name: 'Thông báo', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await trigger.click();
    const menu = page.getByRole('navigation', { name: 'Tài khoản', exact: true });
    await expect(menu.getByRole('link')).toHaveCount(2);
    await expect(menu.locator('svg')).toHaveCount(3);
    const destination = account.role === 'admin' ? 'Quản lý tài khoản' : 'Hoạt động';
    await expect(menu.getByRole('link', { name: destination, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible(); await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('heading', { level: 1 }).click();
    await expect(menu).not.toBeVisible();
    await trigger.click(); await menu.getByRole('link', { name: destination, exact: true }).click();
    await expect(page.getByRole('banner')).toBeVisible(); await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(destination);
    await expect(page.getByRole('link', { name: 'Đề xuất hoạt động', exact: true })).toHaveCount(0);
    if (account.role === 'admin') {
      for (const username of ['sinhvien1', 'canbo1', 'admin1']) await expect(page.getByRole('cell', { name: username, exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Các mục hoạt động' })).toHaveCount(0);
    } else {
      const tabs = page.getByRole('navigation', { name: 'Các mục hoạt động' });
      const labels = account.role === 'user' ? ['Hoạt động', 'Kết quả tham gia', 'Minh chứng'] : ['Hoạt động', 'Danh sách hoạt động', 'Minh chứng'];
      await expect(tabs.getByRole('link')).toHaveText(labels);
      for (const label of labels) {
        await tabs.getByRole('link', { name: label, exact: true }).click();
        await expect(tabs.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(page.getByRole('banner')).toBeVisible(); await expect(page.getByRole('contentinfo')).toBeVisible();
        if (label !== 'Hoạt động') {
          const back = page.getByRole('link', { name: 'Quay lại', exact: true });
          await expect(back).toHaveAttribute('href', '/system?view=activities');
          await expect(back.locator('svg')).toHaveCount(1);
        }
      }
      if (account.role === 'staff') {
        await expect(page.getByRole('button', { name: 'Duyệt', exact: true })).toBeDisabled();
        await expect(page.getByText('Chức năng duyệt minh chứng chưa khả dụng.')).toBeVisible();
      }
      await page.goto('/system?view=accounts');
      await expect(page.getByRole('heading', { name: 'Trang bạn tìm hiện không tồn tại' })).toBeVisible();
    }
    await page.goto(`/system?view=${account.role === 'admin' ? 'accounts' : 'activities'}`);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`system-${width}.png`), fullPage: true });
    }
    await trigger.click(); await menu.getByRole('link', { name: 'Hồ sơ', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ cá nhân');
    await expect(page.getByRole('banner')).toBeVisible(); await expect(page.getByRole('contentinfo')).toBeVisible();
    await page.goto('/proposals'); await expect(page).toHaveURL('/');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
    const drawer = page.getByRole('dialog');
    const mobileTrigger = drawer.getByRole('button', { name: account.name, exact: true });
    await mobileTrigger.click(); await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible(); await expect(drawer).toBeVisible(); await expect(mobileTrigger).toBeFocused();
    await mobileTrigger.press('Enter');
    await menu.getByRole('link', { name: 'Hồ sơ', exact: true }).click();
    await expect(drawer).not.toBeVisible(); await expect(page).toHaveURL('/system?view=profile');
    const sid = (await context.cookies()).find((cookie) => cookie.name === 'cm_sid');
    expect(sid?.httpOnly).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await trigger.click(); await menu.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await page.goto('/system'); await expect(page).toHaveURL('/login');
  });
}

test('public feed lists persisted posts without search; login failure never claims success or invokes FaceIO', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.feed-post')).toHaveCount(3);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tin tức', exact: true })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Quên mật khẩu?' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Đặt lại FaceIO', exact: true })).toBeDisabled();
  await page.getByLabel('Mã sinh viên / Mã nhân sự').fill(`missing-${Date.now()}`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('không đúng');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('button', { name: 'Quét khuôn mặt' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('account dropdown logs out directly from the homepage', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Mã sinh viên / Mã nhân sự').fill('canbo1');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.getByRole('button', { name: 'Cán bộ 1', exact: true }).click();
  await page.getByRole('navigation', { name: 'Tài khoản', exact: true }).getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Đề xuất hoạt động', exact: true })).toBeVisible();
});

test('same-origin proxy rejects foreign origins and endpoints outside its allowlist', async ({ request }) => {
  const response = await request.post('/api/backend/auth/login/password', { headers: { Origin: 'https://evil.example' }, data: { username: 'sinhvien1', password } });
  expect(response.status()).toBe(403);
  expect(response.headers()['set-cookie']).toBeUndefined();
  expect((await request.get('/api/backend/system/workspace')).status()).toBe(404);
});

test('network failure displays Vietnamese error without navigating or claiming success', async ({ page }) => {
  await page.goto('/login');
  await page.route('**/api/backend/auth/login/password', (route) => route.abort());
  await page.getByLabel('Mã sinh viên / Mã nhân sự').fill('sinhvien1');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại.');
  await expect(page).toHaveURL('/login');
});
