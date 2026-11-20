import { expect, test, type Page } from '@playwright/test';

const endpoint = 'https://photon.komoot.io/api/**';
const feature = (name: string, lat: number, lng: number) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name, city: 'Đà Nẵng', country: 'Việt Nam' } });
async function editor(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64') }));
  await page.goto('/login');
  await page.getByLabel('Mã sinh viên / Mã nhân sự').fill('canbo1');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.TEST_ACCOUNT_PASSWORD!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/system?view=activities&editor=new');
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Geocoder interface test');
  await page.getByRole('button', { name: 'Lịch và địa điểm', exact: true }).click();
}

test('address input opens and pans the real Leaflet map, alternative result controls pinned coordinates', async ({ page }) => {
  const queries: string[] = [];
  await page.route(endpoint, (route) => {
    queries.push(new URL(route.request().url()).searchParams.get('q')!);
    return route.fulfill({ json: { features: [feature('Cơ sở một', 16.075, 108.18), feature('Cơ sở hai', 16.04, 108.24)] } });
  });
  await editor(page);
  const address = page.getByLabel('Địa điểm', { exact: true });
  await address.fill('48 Cao Thắng'); await address.fill('48 Cao Thắng, Đà Nẵng');
  const results = page.getByRole('list', { name: 'Địa điểm tìm thấy' });
  await expect(results.getByRole('button')).toHaveCount(2);
  expect(queries).toEqual(['48 Cao Thắng, Đà Nẵng']);
  await expect(page.getByRole('button', { name: 'Chọn vị trí trên bản đồ', exact: true })).toHaveCount(0);
  const pin = page.getByRole('button', { name: 'Ghim vị trí', exact: true });
  await expect(pin).toBeEnabled();
  await page.route('**/api/backend/activities', (route) => route.fulfill({ status: 503, json: { message: 'Dịch vụ tạm thời không khả dụng.' } }));
  const unpinned = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/backend/activities'));
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  expect((await unpinned).postDataJSON().latitude).toBeNull();
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  // The first suggested result automatically moved the map before any result button was clicked.
  await pin.click();
  const first = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/backend/activities'));
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const firstPoint = (await first).postDataJSON();
  expect(firstPoint.latitude).toBeCloseTo(16.075, 6); expect(firstPoint.longitude).toBeCloseTo(108.18, 6);
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  await address.fill('Cơ sở khác, Đà Nẵng');
  await results.getByRole('button', { name: /Cơ sở hai/ }).focus();
  await page.keyboard.press('Enter');
  await expect(address).toHaveValue('Cơ sở hai, Đà Nẵng, Việt Nam');
  await expect(results.getByRole('button', { name: /Cơ sở hai/ })).toHaveAttribute('aria-pressed', 'true');
  await pin.click();
  const second = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/backend/activities'));
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const secondPoint = (await second).postDataJSON();
  expect(secondPoint.location).toBe('Cơ sở hai, Đà Nẵng, Việt Nam');
  expect(secondPoint.latitude).toBeCloseTo(16.04, 6); expect(secondPoint.longitude).toBeCloseTo(108.24, 6);
});

test('empty or invalid coordinates never become a suggested position', async ({ page }) => {
  await page.route(endpoint, (route) => route.fulfill({ json: { features: [feature('Invalid', 999, 108)] } }));
  await editor(page);
  await page.getByLabel('Địa điểm', { exact: true }).fill('Địa chỉ chưa có dữ liệu');
  await expect(page.getByText('Không tìm thấy địa điểm. Thêm quận, tỉnh/thành hoặc chọn trực tiếp trên bản đồ.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Địa điểm tìm thấy' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeEnabled();
});

test('provider failure stays explicit and manual map selection remains available', async ({ page }) => {
  await page.route(endpoint, (route) => route.fulfill({ status: 503, json: {} }));
  await editor(page);
  await page.getByLabel('Địa điểm', { exact: true }).fill('Địa chỉ tìm kiếm');
  await expect(page.getByText('Không thể tìm địa điểm. Bạn có thể chọn trực tiếp trên bản đồ.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghim vị trí', exact: true })).toBeEnabled();
});

test('slow older search cannot overwrite the newer query', async ({ page }) => {
  await page.route(endpoint, async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')!;
    if (q === 'Địa chỉ cũ') await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.fulfill({ json: { features: [feature(q, 16.08, 108.23)] } }).catch(() => {});
  });
  await editor(page);
  const old = page.waitForRequest((request) => request.url().includes('photon.komoot.io') && new URL(request.url()).searchParams.get('q') === 'Địa chỉ cũ');
  await page.getByLabel('Địa điểm', { exact: true }).fill('Địa chỉ cũ'); await old;
  await page.getByLabel('Địa điểm', { exact: true }).fill('Địa chỉ mới');
  const results = page.getByRole('list', { name: 'Địa điểm tìm thấy' });
  await expect(results.getByRole('button')).toHaveText(['Địa chỉ mới, Đà Nẵng, Việt Nam']);
  await expect(results).not.toContainText('Địa chỉ cũ');
});
