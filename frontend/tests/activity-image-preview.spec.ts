import { expect, test as base } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');

const test = base.extend<{ draftId: number }>({
  draftId: async ({ context, baseURL }, runWithDraft) => {
    const backendRequire = createRequire(resolve('../backend/package.json'));
    backendRequire('dotenv').config({ path: resolve('../backend/.env'), quiet: true });
    const { PrismaService } = backendRequire('./dist/prisma/prisma.service');
    const { hashPassword } = backendRequire('./dist/common/security/password');
    const db = new PrismaService();
    const username = `image-preview-test-${randomUUID()}`;
    const password = randomUUID();
    const origin = new URL(baseURL!).origin;
    let staffId: number | undefined;
    let draftId: number | undefined;
    try {
      const staff = await db.nguoi_dung.create({ data: {
        ten_dang_nhap: username, email: `${username}@example.invalid`, ho_ten: 'Cán bộ kiểm thử',
        mat_khau: await hashPassword(password), trang_thai: 'active', loai_nguoi_dung: 'staff',
        vai_tro: { connect: { ten_vai_tro: 'staff' } },
      } });
      staffId = staff.id_nguoi_dung;
      const login = await context.request.post('/api/backend/auth/login/password', { headers: { Origin: origin }, data: { username, password } });
      expect(login.status()).toBe(201);
      const draft = await context.request.post('/api/backend/activities', {
        headers: { Origin: origin },
        multipart: { draft: JSON.stringify({ name: username }), image: { name: 'anh-da-luu.png', mimeType: 'image/png', buffer: png } },
      });
      expect(draft.status()).toBe(201);
      const created: { id: number } = await draft.json();
      draftId = created.id;
      await runWithDraft(draftId);
    } finally {
      try {
        if (draftId !== undefined) await context.request.delete(`/api/backend/activities/${draftId}`, {
          headers: { Origin: origin, 'Content-Type': 'application/json' },
        });
        await context.request.post('/api/backend/auth/logout', { headers: { Origin: origin }, data: {} });
        if (staffId !== undefined) await db.nguoi_dung.deleteMany({ where: { id_nguoi_dung: staffId, ten_dang_nhap: username } });
      } finally { await db.$disconnect(); }
    }
  },
});

test('editor previews the chosen image and discarding the selection preserves the saved image', async ({ page, draftId }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/system?view=activities&editor=${draftId}`);
  const upload = page.locator('.activity-image-upload');
  const fileName = upload.getByRole('textbox');
  await expect(fileName).toHaveValue('anh-da-luu.png');
  await page.locator('#activity-image').setInputFiles({ name: 'anh-moi.png', mimeType: 'image/png', buffer: png });
  await expect(fileName).toHaveValue('anh-moi.png');
  await upload.getByRole('button', { name: 'Xem', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Xem trước ảnh trong biểu mẫu' });
  await expect(preview.getByRole('img')).toHaveAttribute('src', /^blob:/);
  await preview.getByRole('button', { name: 'Đóng' }).click();
  await upload.getByRole('button', { name: 'Gỡ ảnh' }).click();
  await page.reload();
  await expect(fileName).toHaveValue('anh-da-luu.png');
  await upload.getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(preview.getByRole('img')).toHaveAttribute('src', /\/image\?v=/);
});

test('detail opens and closes its own lightbox with the view button inside the rounded frame', async ({ page, draftId }) => {
  await page.goto(`/system?view=activities&activity=${draftId}`);
  const frame = page.locator('.activity-detail > .activity-media');
  const view = frame.getByRole('button', { name: 'Xem ảnh minh họa' });
  const bounds = (await frame.boundingBox())!;
  const button = (await view.boundingBox())!;
  expect(button.x + button.width).toBeLessThan(bounds.x + bounds.width);
  expect(button.y).toBeGreaterThan(bounds.y);
  await expect(frame).toHaveCSS('overflow', 'hidden');
  await expect(frame).toHaveCSS('border-radius', '12px');
  await view.click();
  const lightbox = page.getByRole('dialog', { name: 'Ảnh minh họa hoạt động' });
  await expect(lightbox.getByRole('img')).toBeVisible();
  await expect(lightbox.getByRole('img')).toHaveCSS('object-fit', 'contain');
  await lightbox.getByRole('button', { name: 'Đóng' }).click();
  await expect(lightbox).not.toBeVisible();
});
