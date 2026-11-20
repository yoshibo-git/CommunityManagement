import { expect, test, type Page } from '@playwright/test';

const tiles = 'https://tile.openstreetmap.org/**';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
async function tileImages(page: Page) {
  // Exercise the real Leaflet library; isolate remote image responses to avoid loading public tiles in automated tests.
  await page.route(tiles, (route) => route.fulfill({ contentType: 'image/png', body: png }));
}
async function editor(page: Page, id = 'new') {
  await page.goto('/login');
  await page.getByLabel('Mã sinh viên / Mã nhân sự').fill('canbo1');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.TEST_ACCOUNT_PASSWORD!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto(`/system?view=activities&editor=${id}`);
  await page.getByRole('button', { name: 'Lịch và địa điểm', exact: true }).click();
}

test('Leaflet opens without a key, displays attribution and supports confirmed pinning/GPS/clear', async ({ page }, testInfo) => {
  await tileImages(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(_success: unknown, failure: (reason: { code: number }) => void) { failure({ code: 1 }); } } });
  });
  await editor(page);
  await page.getByRole('button', { name: 'Thông tin chung', exact: true }).click();
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Leaflet contract test');
  await page.getByRole('button', { name: 'Lịch và địa điểm', exact: true }).click();
  await expect(page.getByLabel('Vĩ độ', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Kinh độ', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chọn vị trí trên bản đồ', exact: true }).click();
  const map = page.getByRole('region', { name: 'Bản đồ chọn vị trí hoạt động' });
  const pin = page.getByRole('button', { name: 'Ghim vị trí', exact: true });
  await expect(pin).toBeEnabled();
  await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(map.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible();
  await map.click({ position: { x: 170, y: 110 } });
  await page.route('**/api/backend/activities', (route) => route.fulfill({ status: 503, json: { message: 'Dịch vụ tạm thời không khả dụng.' } }));
  const before = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/backend/activities'));
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  expect((await before).postDataJSON().latitude).toBeNull();
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Vị trí hiện tại', exact: true }).click();
  await expect(page.getByText('Quyền định vị đã bị từ chối. Bạn có thể chọn trực tiếp trên bản đồ.')).toBeVisible();
  await expect(pin).toBeEnabled(); await pin.click();
  await expect(map.locator('.activity-map-marker')).toBeVisible();
  const selected = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/backend/activities'));
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const body = (await selected).postDataJSON();
  expect(Number.isFinite(body.latitude)).toBe(true); expect(Number.isFinite(body.longitude)).toBe(true);
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Bỏ ghim', exact: true }).click();
  await expect(map.locator('.activity-map-marker')).toHaveCount(0);
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (success) => success({ coords: { latitude: 16.08, longitude: 108.23 }, timestamp: Date.now() } as GeolocationPosition);
  });
  await page.getByRole('button', { name: 'Vị trí hiện tại', exact: true }).click();
  await expect(page.getByText('Đã tìm thấy vị trí hiện tại. Nhấn Ghim vị trí để xác nhận.')).toBeVisible();
  await expect(map.locator('.activity-map-marker')).toHaveCount(0);
  await pin.click();
  const gps = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/backend/activities'));
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const point = (await gps).postDataJSON();
  expect(point.latitude).toBeCloseTo(16.08, 6); expect(point.longitude).toBeCloseTo(108.23, 6);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`leaflet-${width}.png`), fullPage: true });
  }
});

test('zoom controls never prompt about unsaved changes; leaving the editor still requires confirmation', async ({ page }) => {
  await tileImages(page);
  await editor(page);
  await page.getByRole('button', { name: 'Thông tin chung', exact: true }).click();
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Unsaved activity');
  await page.getByRole('button', { name: 'Lịch và địa điểm', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn vị trí trên bản đồ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeEnabled();
  const dialogs: string[] = [];
  const dismiss = async (dialog: import('@playwright/test').Dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); };
  page.on('dialog', dismiss);
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
  await page.getByRole('button', { name: 'Thu nhỏ', exact: true }).click();
  expect(dialogs).toEqual([]);
  await page.getByRole('link', { name: 'Quay lại', exact: true }).click();
  expect(dialogs).toEqual(['confirm']);
  await expect(page).toHaveURL('/system?view=activities&editor=new');
  page.off('dialog', dismiss);
  page.once('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.accept(); });
  await page.getByRole('link', { name: 'Quay lại', exact: true }).click();
  await expect(page).toHaveURL('/system?view=activities');
  expect(dialogs).toEqual(['confirm', 'confirm']);
});

test('failed tiles display a retry state; retry removes the previous map cleanly', async ({ page }) => {
  await page.route(tiles, (route) => route.abort());
  await editor(page);
  await page.getByRole('button', { name: 'Chọn vị trí trên bản đồ', exact: true }).click();
  await expect(page.getByText('Không thể tải bản đồ. Kiểm tra kết nối hoặc thử lại.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeDisabled();
  await page.unroute(tiles); await tileImages(page);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeEnabled();
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
});

test('tile timeout displays an error instead of leaving a permanent spinner', async ({ page }) => {
  await page.route(tiles, () => {});
  await editor(page);
  await page.clock.install();
  await page.getByRole('button', { name: 'Chọn vị trí trên bản đồ', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.clock.fastForward(16000);
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeDisabled();
});

test('saved coordinates render a marker and published activity remains read-only', async ({ page }) => {
  await tileImages(page);
  await page.route('**/api/backend/activities/4000000000/editor', (route) => route.fulfill({ json: { id: 4000000000, name: 'Published activity', editable: false, status: 'published', revision: 'a'.repeat(64), description: '', latitude: 16.06, longitude: 108.22, startAt: null, endAt: null, capacity: null, points: 0, location: '', requiresCheckout: false } }));
  await editor(page, '4000000000');
  await expect(page.locator('.activity-map-marker')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Vị trí hiện tại', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bỏ ghim', exact: true })).toBeDisabled();
  await expect(page.locator('.leaflet-control-zoom')).toHaveCount(0);
});
