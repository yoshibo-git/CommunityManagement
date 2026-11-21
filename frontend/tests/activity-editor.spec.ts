import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';

test('staff creates/edits a draft, preserves local assignments and cannot edit an activity after it starts', async ({ page, context, request }, testInfo) => {
  test.setTimeout(60000);
  // Real API writes are checked against MySQL using isolated fixtures.
  const backendRequire = createRequire(resolve('../backend/package.json'));
  backendRequire('dotenv').config({ path: resolve('../backend/.env'), quiet: true });
  const { PrismaService } = backendRequire('./dist/prisma/prisma.service');
  const { hashPassword } = backendRequire('./dist/common/security/password');
  const db = new PrismaService();
  let id: number | undefined;
  let deleteId: number | undefined;
  let staffId: number | undefined;
  let planKey: string | undefined;
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
    await expect(page.getByRole('group', { name: 'Nhóm hoạt động' }).getByRole('button', { name: 'Khởi tạo', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: 'Tạo hoạt động', exact: true }).click();
    const back = page.getByRole('link', { name: 'Quay lại', exact: true });
    await expect(back).toHaveAttribute('href', '/system?view=activities');
    await expect(back.locator('svg')).toHaveCount(1);
    const backBox = await back.boundingBox(), titleBox = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(backBox!.y).toBeLessThan(titleBox!.y); expect(backBox!.x).toBe(titleBox!.x);
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Thông báo thao tác' })).toContainText('Dữ liệu không hợp lệ.');
    await expect(page.locator('p.form-error')).toHaveCount(0);
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(prefix);
    await back.click();
    const dialog = page.getByRole('dialog', { name: 'Hoạt động chưa được lưu' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(prefix);
    const editorHeading = page.locator('.activity-editor-heading');
    await expect(editorHeading.getByRole('heading', { name: 'Thông tin chung' })).toBeVisible();
    await expect(editorHeading.getByRole('button', { name: 'Nháp' })).toBeVisible();
    const checkout = page.getByText('Checkout', { exact: true });
    const checkbox = page.getByRole('checkbox', { name: 'Checkout' });
    await checkout.click();
    await expect(checkbox).toBeChecked();
    await checkout.click();
    await expect(checkbox).not.toBeChecked();
    await expect(page.locator('.activity-image-upload').getByRole('button', { name: 'Xem', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Gỡ ảnh', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Gỡ tệp', exact: true })).toBeDisabled();
    const created = page.waitForResponse((response) => response.url().endsWith('/api/backend/activities') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201); id = (await response.json()).id;
    await expect(page).toHaveURL(`/system?view=activities&editor=${id}`);
    const toasts = page.getByRole('list', { name: 'Thông báo thao tác' });
    await expect(toasts.getByText('Đã lưu hoạt động nháp.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(prefix);
    await page.getByRole('button', { name: 'Công bố', exact: true }).click();
    await expect(toasts).toContainText('Chọn đúng một Trưởng BTC trước khi công bố.');
    await page.getByRole('button', { name: 'Phân công', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm nhiệm vụ', exact: true }).click();
    await page.getByLabel('Tên nhiệm vụ', { exact: true }).fill('Chuẩn bị vật dụng');
    await page.getByLabel('Người phụ trách', { exact: true }).selectOption({ label: 'sinhvien1 — Sinh viên 1' });
    await expect(page.getByRole('button', { name: 'Lưu tạm', exact: true })).toHaveCount(0);
    await page.getByLabel('Loại nhiệm vụ', { exact: true }).selectOption('leader');
    await expect(page.getByLabel('Người phụ trách', { exact: true }).locator('option').filter({ hasText: 'sinhvien1' })).toHaveCount(0);
    await page.getByLabel('Người phụ trách', { exact: true }).selectOption(String(staffId));
    await page.getByRole('button', { name: 'Thêm nhiệm vụ', exact: true }).click();
    await expect(page.getByLabel('Loại nhiệm vụ', { exact: true }).nth(1).locator('option[value=leader]')).toBeDisabled();
    await expect(page.getByLabel('Loại nhiệm vụ', { exact: true }).nth(1)).toHaveValue('member');
    await page.getByRole('button', { name: 'Xóa nhiệm vụ', exact: true }).nth(1).click();
    const duplicate = await page.evaluate(async () => {
      const response = await fetch('/api/backend/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Kiểm tra Trưởng BTC trùng', assignmentTypes: ['leader', 'leader'] }),
      });
      return { status: response.status, code: (await response.json()).code };
    });
    expect(duplicate).toEqual({ status: 400, code: 'DUPLICATE_LEADER' });
    const studentId = (await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'sinhvien1' } })).id_nguoi_dung;
    const roleFailures = await page.evaluate(async ({ studentId, staffId }) => {
      const submit = async (assignments: object[]) => {
        const response = await fetch('/api/backend/activities', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Kiểm tra công bố', publish: true, assignments }),
        });
        return { status: response.status, code: (await response.json()).code };
      };
      const leader = { name: 'Điều phối', userId: staffId, type: 'leader' };
      return [await submit([]), await submit([{ ...leader, userId: studentId }]), await submit([leader, leader])];
    }, { studentId, staffId });
    expect(roleFailures).toEqual([
      { status: 400, code: 'LEADER_REQUIRED' }, { status: 400, code: 'INVALID_LEADER_ROLE' }, { status: 400, code: 'DUPLICATE_LEADER' },
    ]);
    const savedAssignments = page.waitForResponse((response) => response.url().endsWith(`/api/backend/activities/${id}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    expect((await savedAssignments).status()).toBe(200);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), `cm:assignment-draft:${staffId}:${id}`)).toContain('Chuẩn bị vật dụng');
    await page.reload();
    await page.getByRole('button', { name: 'Phân công', exact: true }).click();
    await expect(page.getByLabel('Tên nhiệm vụ', { exact: true })).toHaveValue('Chuẩn bị vật dụng');
    const detail = await db.chi_tiet_hoat_dong.findUnique({ where: { id_hoat_dong: id } });
    expect(detail).toBeNull();
    await page.getByRole('button', { name: 'Lịch và địa điểm', exact: true }).click();
    await page.getByLabel('Bắt đầu', { exact: true }).fill('2027-03-01T08:00');
    await page.getByLabel('Kết thúc', { exact: true }).fill('2027-03-01T11:00');
    await page.getByLabel('Địa điểm', { exact: true }).fill('Cơ sở 1');
    await page.getByLabel('Ghi chú địa điểm', { exact: true }).fill('Vào cổng phía đông');
    await expect(page.getByRole('button', { name: 'Vị trí hiện tại', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Vị trí hiện tại', exact: true }).click();
    await expect(page.getByText('Đã tìm thấy vị trí hiện tại. Nhấn Ghim vị trí để xác nhận.')).toBeVisible();
    await page.getByRole('button', { name: 'Ghim vị trí', exact: true }).click();
    await page.getByRole('button', { name: 'Thông tin chung', exact: true }).click();
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(`${prefix}-updated`);
    const points = page.getByLabel('Điểm hoạt động', { exact: true });
    await points.fill('');
    await expect(points).toHaveValue('');
    await points.fill('005');
    await expect(points).toHaveValue('005');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('textbox', { name: 'Tên tệp kế hoạch' }).locator('..').getByRole('button', { name: 'Tải lên', exact: true }).click();
    const plan = Buffer.from('%PDF-1.4\n%%EOF');
    await (await chooser).setFiles({ name: 'test-plan.pdf', mimeType: 'application/pdf', buffer: plan });
    await expect(page.getByRole('textbox', { name: 'Tên tệp kế hoạch' })).toHaveValue('test-plan.pdf');
    const updated = page.waitForResponse((response) => response.url().endsWith(`/api/backend/activities/${id}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    expect((await updated).status()).toBe(200);
    await expect(toasts.getByText('Đã lưu bản nháp và tải tệp lên.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tải tệp đã lưu' })).toBeVisible();
    const storedActivity = await db.hoat_dong.findUniqueOrThrow({ where: { id_hoat_dong: id } });
    planKey = storedActivity.ke_hoach_hoat_dong?.split('|')[0];
    expect(storedActivity.diem_hoat_dong).toBe(5);
    expect(storedActivity.mo_ta).toBeNull();
    expect(await (await context.request.get(`/api/backend/activities/${id}/plan`)).body()).toEqual(plan);
    expect((await request.get(`/api/backend/activities/${id}/plan`)).status()).toBe(401);
    await page.locator('input[type=file][accept=".pdf,.xls,.xlsx"]').setInputFiles({
      name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid'),
    });
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    await expect(toasts).toContainText('Chọn tệp PDF, XLS hoặc XLSX hợp lệ, tối đa 5 MB.');
    expect(await (await context.request.get(`/api/backend/activities/${id}/plan`)).body()).toEqual(plan);
    await page.getByRole('button', { name: 'Gỡ tệp', exact: true }).click();
    await page.getByRole('button', { name: 'Gỡ tệp', exact: true }).click();
    await page.getByRole('dialog', { name: 'Gỡ tệp kế hoạch?' }).getByRole('button', { name: 'Xác nhận gỡ' }).click();
    expect((await context.request.get(`/api/backend/activities/${id}/plan`)).status()).toBe(200);
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    await expect.poll(async () => (await context.request.get(`/api/backend/activities/${id}/plan`)).status()).toBe(404);
    await expect(page.getByRole('button', { name: 'Nháp', exact: true })).toBeEnabled();
    await page.locator('input[type=file][accept=".pdf,.xls,.xlsx"]').setInputFiles({ name: 'new-plan.pdf', mimeType: 'application/pdf', buffer: plan });
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Tải tệp đã lưu' })).toBeVisible();
    planKey = (await db.hoat_dong.findUniqueOrThrow({ where: { id_hoat_dong: id } })).ke_hoach_hoat_dong?.split('|')[0];
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
    await db.hoat_dong.createMany({ data: Array.from({ length: 11 }, (_, index) => ({
      id_nguoi_tao: staff.id_nguoi_dung, trang_thai: 'draft', ten_hoat_dong: `${prefix}-scroll-${index}`,
    })) });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/system?view=activities');
    await expect(page.getByRole('searchbox', { name: 'Tìm kiếm' })).toHaveCount(0);
    const activityList = page.getByRole('region', { name: 'Danh sách thẻ hoạt động' });
    await expect.poll(() => activityList.evaluate((list) => {
      const rect = list.getBoundingClientRect();
      return [...list.children].filter((card) => card.getBoundingClientRect().bottom <= rect.bottom + 1).length;
    })).toBe(4);
    await activityList.evaluate((list) => { list.scrollTop = list.scrollHeight; });
    await expect(activityList.locator('article')).toHaveCount(12);
    await activityList.evaluate((list) => { list.scrollTop = 0; });
    const card = page.locator('.activity-list > .activity-card').filter({ hasText: `${prefix}-updated` });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(card.getByRole('img', { name: 'Chưa có ảnh minh họa' })).toBeVisible();
    await expect(card.getByText('Khởi tạo', { exact: true })).toHaveCount(0);
    await expect(card.getByRole('link', { name: 'Chỉnh sửa hoạt động' })).toHaveCount(0);
    await card.getByRole('link', { name: `Xem ${prefix}-updated`, exact: true }).click();
    await expect(page).toHaveURL(`/system?view=activities&activity=${id}`);
    await expect(page.getByRole('navigation', { name: 'Các mục hoạt động' })).toHaveCount(0);
    await expect(page.locator('.activity-detail > h2')).toHaveText(['Thông tin chung', 'Phân công']);
    await expect(page.locator('.activity-detail').first().getByText('Khởi tạo', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Chuẩn bị vật dụng', { exact: true })).toBeVisible();
    await expect(page.getByText('Vào cổng phía đông', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Chỉnh sửa hoạt động', exact: true }).click();
    await expect(page).toHaveURL(`/system?view=activities&editor=${id}`);
    await page.getByRole('button', { name: 'Công bố', exact: true }).click();
    await page.getByRole('dialog', { name: 'Công bố hoạt động?' }).getByRole('button', { name: 'Xác nhận công bố' }).click();
    await expect(page).toHaveURL(`/system?view=published&activity=${id}`);
    const publishedTask = await db.phan_cong_nhiem_vu.findFirstOrThrow({ where: { id_chi_tiet_hoat_dong: stored.id_chi_tiet_hoat_dong } });
    expect(publishedTask.loai_nhiem_vu).toBe('leader');
    expect(publishedTask.thoi_gian_bat_dau).toBeNull();
    await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
    await expect(page.getByRole('cell', { name: 'Hoàn thành', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('cell', { name: 'Hoàn thành', exact: true })).toBeVisible();
    await db.hoat_dong.update({ where: { id_hoat_dong: id }, data: { trang_thai: 'progress' } });
    await page.goto(`/system?view=activities&editor=${id}`);
    await expect(page.getByLabel('Tên hoạt động', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Nháp', exact: true })).toBeDisabled();
    await db.hoat_dong.updateMany({
      where: { id_nguoi_tao: staff.id_nguoi_dung, ten_hoat_dong: { startsWith: `${prefix}-scroll-` } },
      data: { trang_thai: 'published' },
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/system?view=published');
    await expect.poll(() => activityList.evaluate((list) => {
      const rect = list.getBoundingClientRect();
      return [...list.children].filter((card) => card.getBoundingClientRect().bottom <= rect.bottom + 1).length;
    })).toBe(4);
    await activityList.evaluate((list) => { list.scrollTop = list.scrollHeight; });
    await expect.poll(() => activityList.locator('article').count()).toBeGreaterThan(10);
    const searchBox = page.getByRole('searchbox', { name: 'Tìm kiếm' });
    await expect(searchBox).toHaveAttribute('placeholder', 'Nhập tên hoạt động');
    await page.getByRole('combobox', { name: 'Trạng thái hoạt động' }).selectOption('progress');
    await searchBox.fill('khong-co-ket-qua-kiem-thu');
    await expect(page.getByText('Chưa có hoạt động phù hợp', { exact: true })).toBeVisible();
    await searchBox.clear();
    await expect(page.getByRole('heading', { name: `${prefix}-updated`, exact: true })).toBeVisible();
    await db.hoat_dong.updateMany({
      where: { id_nguoi_tao: staff.id_nguoi_dung, ten_hoat_dong: { startsWith: `${prefix}-scroll-` } },
      data: { trang_thai: 'draft' },
    });
    await expect(page.getByRole('link', { name: 'Chỉnh sửa hoạt động', exact: true })).toHaveCount(0);
    const blocked = await page.evaluate(async (activityId) => (await fetch(`/api/backend/activities/${activityId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    })).status, id);
    expect(blocked).toBe(409);
    await db.hoat_dong.update({ where: { id_hoat_dong: id }, data: { trang_thai: 'published' } });
    const registrant = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'sinhvien1' } });
    await db.dang_ky_hoat_dong.create({ data: { id_hoat_dong: id, id_nguoi_dung: registrant.id_nguoi_dung } });
    const publicRows = (await (await request.get('/api/backend/activities')).json()).items as { id: number; status: string }[];
    expect(publicRows.some((row) => row.id === id)).toBe(true);
    expect(publicRows.every((row) => ['published', 'pending', 'progress'].includes(row.status))).toBe(true);
    await page.goto(`/system?view=published&activity=${id}`);
    await expect(page.getByRole('link', { name: 'Quay lại', exact: true })).toHaveAttribute('href', '/system?view=published');
    await page.getByRole('button', { name: 'Chỉnh sửa hoạt động', exact: true }).click();
    const publishedEdit = page.getByRole('dialog', { name: 'Chỉnh sửa hoạt động' });
    await publishedEdit.getByLabel('Tên hoạt động').fill(`${prefix}-renamed`);
    await publishedEdit.getByLabel('Mô tả').fill('Mô tả cập nhật');
    await publishedEdit.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(toasts).toContainText('Đã cập nhật hoạt động.');
    expect(await db.thong_bao.count({ where: { id_hoat_dong: id, loai_thong_bao: 'NOTI-02', nguoi_nhan_thong_bao: { some: { id_nguoi_dung: registrant.id_nguoi_dung } } } })).toBe(1);
    await page.getByRole('button', { name: 'Hủy hoạt động', exact: true }).click();
    const cancel = page.getByRole('dialog', { name: 'Xác nhận hủy hoạt động' });
    await cancel.getByLabel('Lý do hủy').fill('Lý do kiểm thử');
    await cancel.getByRole('button', { name: 'Hủy hoạt động', exact: true }).click();
    await expect(toasts).toContainText('Đã hủy hoạt động.');
    expect((await db.hoat_dong.findUniqueOrThrow({ where: { id_hoat_dong: id } })).trang_thai).toBe('cancelled');
    expect(await db.dang_ky_hoat_dong.count({ where: { id_hoat_dong: id, id_nguoi_dung: registrant.id_nguoi_dung } })).toBe(1);
    expect(await db.thong_bao.count({ where: { id_hoat_dong: id, loai_thong_bao: 'NOTI-01', nguoi_nhan_thong_bao: { some: { id_nguoi_dung: registrant.id_nguoi_dung } } } })).toBe(1);
    const afterCancel = (await (await request.get('/api/backend/activities')).json()).items as { id: number }[];
    expect(afterCancel.some((row) => row.id === id)).toBe(false);
    const deletedName = `${prefix}-delete`;
    await page.goto('/system?view=activities&editor=new');
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(deletedName);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
    await page.locator('#activity-image').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    await expect(toasts).toContainText('Chọn ảnh JPG, PNG hoặc WebP hợp lệ, tối đa 10 MB.');
    expect(await db.hoat_dong.count({ where: { ten_hoat_dong: deletedName } })).toBe(0);
    const imagePicker = page.waitForEvent('filechooser');
    await page.locator('.activity-image-upload').getByRole('button', { name: 'Tải lên' }).click();
    await (await imagePicker).setFiles({ name: 'cover.png', mimeType: 'image/png', buffer: image });
    await expect(page.getByRole('textbox', { name: 'Tên tệp hình ảnh minh họa' })).toHaveValue('cover.png');
    await page.locator('.activity-image-upload').getByRole('button', { name: 'Xem', exact: true }).click();
    const editorPreview = page.getByRole('dialog', { name: 'Xem trước ảnh trong biểu mẫu' });
    await expect(editorPreview.getByRole('img')).toHaveAttribute('src', /^blob:/);
    await editorPreview.getByRole('button', { name: 'Đóng' }).click();
    const uploaded = page.waitForResponse((response) => response.url().endsWith('/api/backend/activities') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    const uploadedResponse = await uploaded;
    expect(uploadedResponse.status()).toBe(201);
    deleteId = (await uploadedResponse.json()).id;
    await expect(page).toHaveURL(`/system?view=activities&editor=${deleteId}`);
    await expect(page.getByRole('textbox', { name: 'Tên tệp hình ảnh minh họa' })).toHaveValue('cover.png');
    const imageUrl = `/api/backend/activities/${deleteId}/image`;
    const savedImage = await context.request.get(imageUrl);
    expect(savedImage.status()).toBe(200);
    expect(savedImage.headers()['content-type']).toBe('image/png');
    expect(await savedImage.body()).toEqual(image);
    expect((await request.get(imageUrl)).status()).toBe(404);
    await page.locator('#activity-image').setInputFiles({ name: 'unsaved.png', mimeType: 'image/png', buffer: image });
    await page.getByRole('button', { name: 'Gỡ ảnh', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Tên tệp hình ảnh minh họa' })).toHaveValue('cover.png');
    const originalKey = (await db.hoat_dong.findUniqueOrThrow({ where: { id_hoat_dong: deleteId } })).hinh_anh;
    await page.locator('#activity-image').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: image });
    const replacing = page.waitForResponse((response) => response.url().endsWith(`/api/backend/activities/${deleteId}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    expect((await replacing).status()).toBe(200);
    expect((await db.hoat_dong.findUniqueOrThrow({ where: { id_hoat_dong: deleteId } })).hinh_anh).not.toBe(originalKey);
    await expect(page.locator('#activity-image')).toHaveValue('');
    await db.hoat_dong.update({ where: { id_hoat_dong: deleteId }, data: { trang_thai: 'published' } });
    expect((await request.get(imageUrl)).status()).toBe(200);
    await db.hoat_dong.update({ where: { id_hoat_dong: deleteId }, data: { trang_thai: 'draft' } });
    await page.goto(`/system?view=activities&activity=${deleteId}`);
    await expect(page.getByRole('img', { name: 'Ảnh minh họa hoạt động' })).toBeVisible();
    await page.getByRole('button', { name: 'Xem ảnh minh họa' }).click();
    const lightbox = page.getByRole('dialog', { name: 'Ảnh minh họa hoạt động' });
    await expect(lightbox).toBeVisible();
    await lightbox.getByRole('button', { name: 'Đóng' }).click();
    await page.getByRole('link', { name: 'Chỉnh sửa hoạt động', exact: true }).click();
    await page.getByRole('button', { name: 'Gỡ ảnh', exact: true }).click();
    await page.getByRole('dialog', { name: 'Gỡ ảnh minh họa?' }).getByRole('button', { name: 'Xác nhận gỡ' }).click();
    const removingImage = page.waitForResponse((response) => response.url().endsWith(`/api/backend/activities/${deleteId}`) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Nháp', exact: true }).click();
    expect((await removingImage).status()).toBe(200);
    expect((await context.request.get(imageUrl)).status()).toBe(404);
    await expect(page.getByRole('button', { name: 'Nháp', exact: true })).toBeEnabled();
    await page.goto(`/system?view=activities&activity=${deleteId}`);
    const openDelete = page.getByRole('button', { name: 'Xóa bản nháp', exact: true });
    await expect(page.getByRole('button', { name: 'Xem ảnh minh họa' })).toHaveCount(0);
    const deleteDialog = page.getByRole('dialog', { name: 'Xác nhận xóa bản nháp' });
    await openDelete.click();
    await deleteDialog.getByRole('button', { name: 'Giữ bản nháp' }).click();
    expect(await db.hoat_dong.count({ where: { id_hoat_dong: deleteId } })).toBe(1);
    const registration = await db.dang_ky_hoat_dong.create({ data: { id_hoat_dong: deleteId, id_nguoi_dung: staff.id_nguoi_dung } });
    const linked = await page.evaluate(async (activityId) => (await fetch(`/api/backend/activities/${activityId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    })).status, deleteId);
    expect(linked).toBe(409);
    await db.dang_ky_hoat_dong.delete({ where: { id_dang_ky: registration.id_dang_ky } });
    await openDelete.click();
    await deleteDialog.getByRole('button', { name: 'Xóa bản nháp', exact: true }).click();
    await expect(page).toHaveURL('/system?view=activities');
    await expect(toasts.getByText('Đã xóa bản nháp.', { exact: true })).toBeVisible();
    expect(await db.hoat_dong.count({ where: { id_hoat_dong: deleteId } })).toBe(0);
    expect((await context.request.get(imageUrl)).status()).toBe(404);
  } finally {
    if (staffId) await db.hoat_dong.deleteMany({ where: { id_nguoi_tao: staffId, ten_hoat_dong: { startsWith: `${prefix}-scroll-` } } });
    if (deleteId) await db.hoat_dong.deleteMany({ where: { id_hoat_dong: deleteId, ten_hoat_dong: { startsWith: prefix } } });
    if (id) {
      await db.thong_bao.deleteMany({ where: { id_hoat_dong: id, hoat_dong: { ten_hoat_dong: { startsWith: prefix } } } });
      await db.hoat_dong.deleteMany({ where: { id_hoat_dong: id, ten_hoat_dong: { startsWith: prefix } } });
    }
    if (planKey && /^[a-f0-9-]{36}\.pdf$/.test(planKey)) {
      await unlink(resolve('../backend', process.env.ACTIVITY_IMAGE_DIR || 'storage/private/activities', planKey)).catch(() => undefined);
    }
    if (staffId) await db.nguoi_dung.deleteMany({ where: { id_nguoi_dung: staffId, ten_dang_nhap: prefix } });
    await db.$disconnect();
  }
});
