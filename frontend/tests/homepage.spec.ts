import { expect, test } from '@playwright/test';

test('news scroll container loads the next page without a search box or losing previous news', async ({ page }) => {
  const cursors: (string | null)[] = [];
  await page.route('**/api/backend/posts/public*', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    cursors.push(cursor);
    const items = Array.from({ length: cursor ? 2 : 10 }, (_, i) => ({ id: i + (cursor ? 11 : 1), title: `Tin tức ${i + (cursor ? 11 : 1)}`, html: '<p>Nội dung hoạt động cộng đồng.</p>', author: 'CM UTE', publishedAt: '2026-11-01T00:00:00Z', editedAt: null }));
    await route.fulfill({ json: { items, nextCursor: cursor ? null : 'next-page' } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Thông báo:/ })).toHaveCount(0);
  const feed = page.getByRole('region', { name: 'Danh sách tin tức', exact: true });
  await expect(feed.getByRole('article')).toHaveCount(10);
  expect(await feed.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await feed.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(feed.getByRole('article')).toHaveCount(12);
  expect(cursors).toEqual([null, 'next-page']);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Danh mục hệ thống' })).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Đề xuất hoạt động' })).toBeVisible();
});

test('session lookup failure displays an error without presenting guest-only actions', async ({ page }) => {
  await page.route('**/api/backend/auth/session', (route) => route.fulfill({ status: 503, json: { message: 'Dịch vụ tạm thời không khả dụng.' } }));
  await page.goto('/');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Đề xuất hoạt động', exact: true })).toHaveCount(0);
});

test('homepage uses equal news/activity columns and header links reach public sections and footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const news = await page.locator('#tin-tuc').boundingBox();
  const activities = await page.locator('#hoat-dong').boundingBox();
  expect(news && activities).toBeTruthy();
  expect(Math.abs(news!.width - activities!.width)).toBeLessThan(1);
  expect(Math.abs(news!.y - activities!.y)).toBeLessThan(1);
  expect(activities!.x).toBeGreaterThan(news!.x);
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(navigation.getByRole('link')).toHaveText(['Trang chủ', 'Tin tức', 'Liên hệ']);
  await navigation.getByRole('link', { name: 'Tin tức', exact: true }).click();
  await expect(page).toHaveURL('/#bang-tin');
  await navigation.getByRole('link', { name: 'Liên hệ', exact: true }).click();
  await expect(page).toHaveURL('/#lien-he');
  await expect(page.getByRole('contentinfo')).toBeInViewport();
  await navigation.getByRole('link', { name: 'Trang chủ', exact: true }).click();
  await expect(page).toHaveURL('/');
});
