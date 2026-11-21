import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

test('staff creates/edits a draft, preserves local assignments and cannot edit an activity after it starts', async ({ page, context }, testInfo) => {
  test.setTimeout(60000);
  // Real API writes are checked against MySQL using isolated fixtures.
  const backendRequire = createRequire(resolve('../backend/package.json'));
  backendRequire('dotenv').config({ path: resolve('../backend/.env'), quiet: true });
  const { PrismaService } = backendRequire('./dist/prisma/prisma.service');
  const { hashPassword } = backendRequire('./dist/common/security/password');
  const db = new PrismaService();
  let id: number | undefined;
  let staffId: number | undefined;
  const prefix = `ui-test-${randomUUID()}`;
  const password = randomUUID();
  try {
    const staff = await db.nguoi_dung.create({ data: {
      ten_dang_nhap: prefix, email: `${prefix}@example.invalid`, ho_ten: 'Cán bộ kiểm thử',
      mat_khau: await hashPassword(password), trang_thai: 'active', loai_nguoi_dung: 'staff',
      vai_tro: { connect: { ten_vai_tro: 'staff' } },
    } });
    staffId = staff.id_nguoi_dung;
    await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64') }));
    await page.route('https://photon.komoot.io/api/**', (route) => route.fulfill({ json: { features: [] } }));
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 16.08, longitude: 108.23, accuracy: 10 });
    await page.goto('/login');
    await page.getByLabel('Mã sinh viên / Mã nhân sự').fill(prefix);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/system?view=activities');
    await expect(page.getByRole('group', { name: 'Nhóm hoạt động' }).getByRole('button', { name: 'Bản nháp', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: 'Tạo hoạt động', exact: true }).click();
    const back = page.getByRole('link', { name: 'Quay lại', exact: true });
    await expect(back).toHaveAttribute('href', '/system?view=activities');
    await expect(back.locator('svg')).toHaveCount(1);
    const backBox = await back.boundingBox(), titleBox = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(backBox!.y).toBeLessThan(titleBox!.y); expect(backBox!.x).toBe(titleBox!.x);
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(prefix);
    const confirmation = page.waitForEvent('dialog');
    const leaving = back.click();
    const dialog = await confirmation;
    expect(dialog.message()).toBe('Bạn có thay đổi chưa lưu. Rời trang?');
    await dialog.dismiss();
    await leaving;
    const created = page.waitForResponse((response) => response.url().endsWith('/api/backend/activities') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201); id = (await response.json()).id;
    await expect(page).toHaveURL(`/system?view=activities&editor=${id}`);
    const toasts = page.getByRole('list', { name: 'Thông báo thao tác' });
    await expect(toasts.getByText('Đã lưu hoạt động nháp.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(prefix);
    await expect(page.getByRole('button', { name: 'Công bố', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Phân công', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm nhiệm vụ', exact: true }).click();
    await page.getByLabel('Tên nhiệm vụ', { exact: true }).fill('Chuẩn bị vật dụng');
    await page.getByLabel('Người phụ trách', { exact: true }).selectOption({ label: 'sinhvien1 — Sinh viên 1' });
    await page.getByRole('button', { name: 'Lưu tạm', exact: true }).click();
    await expect(toasts.getByText('Đã lưu phân công tạm trong trình duyệt.', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Phân công', exact: true }).click();
    await expect(page.getByLabel('Tên nhiệm vụ', { exact: true })).toHaveValue('Chuẩn bị vật dụng');
    const detail = await db.chi_tiet_hoat_dong.findUnique({ where: { id_hoat_dong: id } });
    expect(detail).toBeNull();
    await page.getByRole('button', { name: 'Lịch và địa điểm', exact: true }).click();
    await page.getByLabel('Bắt đầu (giờ Việt Nam)', { exact: true }).fill('2027-03-01T08:00');
    await page.getByLabel('Kết thúc (giờ Việt Nam)', { exact: true }).fill('2027-03-01T11:00');
    await page.getByLabel('Địa điểm', { exact: true }).fill('Cơ sở 1');
    await expect(page.getByRole('button', { name: 'Vị trí hiện tại', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Vị trí hiện tại', exact: true }).click();
    await expect(page.getByText('Đã tìm thấy vị trí hiện tại. Nhấn Ghim vị trí để xác nhận.')).toBeVisible();
    await page.getByRole('button', { name: 'Ghim vị trí', exact: true }).click();
    await page.getByRole('button', { name: 'Thông tin chung', exact: true }).click();
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(`${prefix}-updated`);
    const updated = page.waitForResponse((response) => response.url().endsWith(`/api/backend/activities/${id}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
    expect((await updated).status()).toBe(200);
    await expect(toasts.getByText('Đã lưu hoạt động nháp.', { exact: true })).toBeVisible();
    const stored = await db.chi_tiet_hoat_dong.findUnique({ where: { id_hoat_dong: id } });
    expect(stored.thoi_gian_bat_dau.toISOString()).toBe('2027-03-01T01:00:00.000Z');
    expect(Number(stored.vi_do)).toBeCloseTo(16.08, 6);
    expect(Number(stored.kinh_do)).toBeCloseTo(108.23, 6);
    expect(await db.phan_cong_nhiem_vu.count({ where: { id_chi_tiet_hoat_dong: stored.id_chi_tiet_hoat_dong } })).toBe(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`editor-${width}.png`), fullPage: true });
    }
    await db.hoat_dong.update({ where: { id_hoat_dong: id }, data: { trang_thai: 'progress' } });
    await page.reload();
    await expect(page.getByLabel('Tên hoạt động', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeDisabled();
    await page.goto('/system?view=published');
    await expect(page.getByRole('heading', { name: `${prefix}-updated`, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chỉnh sửa hoạt động', exact: true })).toHaveCount(0);
  } finally {
    if (id) await db.hoat_dong.deleteMany({ where: { id_hoat_dong: id, ten_hoat_dong: { startsWith: prefix } } });
    if (staffId) await db.nguoi_dung.deleteMany({ where: { id_nguoi_dung: staffId, ten_dang_nhap: prefix } });
    await db.$disconnect();
  }
});
