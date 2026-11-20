const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { createHash, randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { createClient } = require('redis');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/app/configure-app');
const { readEnvironment } = require('../dist/common/config/environment');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { seedSystem } = require('../dist/prisma/seed-system');
const { hashPassword, verifyPassword } = require('../dist/common/security/password');

let app, db, redis, base;
const origin = 'http://127.0.0.1:3102';
const password = process.env.TEST_ACCOUNT_PASSWORD;
before(async () => {
  assert.ok(password, 'TEST_ACCOUNT_PASSWORD is required.');
  process.env.NODE_ENV = 'development';
  process.env.AUTH_PASSWORD_ONLY = 'true';
  process.env.CORS_ALLOWED_ORIGINS = origin;
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app, readEnvironment());
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  db = app.get(PrismaService);
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', () => {});
  await redis.connect();
});
after(async () => { if (redis?.isOpen) await redis.close(); if (app) await app.close(); });
const request = (path, options = {}) => fetch(`${base}/${path}`, options);
const login = (username, pass = password, extra = {}) => request('auth/login/password', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: pass, ...extra }) });
const cookie = (response) => response.headers.get('set-cookie').split(';')[0];
const headers = (sid) => ({ Cookie: sid });
const write = (sid, path, body, method = 'POST') => request(path, { method, headers: { ...headers(sid), Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('Argon2id uses independent salts and fails closed on wrong/malformed hashes', async () => {
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.match(first, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
});

test('system seed is idempotent, removes only old fixtures and preserves passwords/IDs', async () => {
  const snapshot = async () => ({ users: await db.nguoi_dung.findMany({ orderBy: { id_nguoi_dung: 'asc' } }), roles: await db.vai_tro.findMany({ orderBy: { id_vai_tro: 'asc' } }), posts: await db.bai_dang.findMany({ orderBy: { id_bai_dang: 'asc' } }) });
  const before = await snapshot();
  process.env.SEED_ACCOUNT_PASSWORD = password;
  try { await seedSystem(db); await seedSystem(db); } finally { delete process.env.SEED_ACCOUNT_PASSWORD; }
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(before.roles.map((r) => r.ten_vai_tro).sort(), ['admin', 'staff', 'user']);
  assert.equal(await db.nguoi_dung.count({ where: { ten_dang_nhap: { startsWith: 'cm_preview_' } } }), 0);
  assert.equal(await db.hoat_dong.count({ where: { ten_hoat_dong: { startsWith: '[Mẫu]' } } }), 0);
  assert.equal(new Set(before.users.map((u) => u.mat_khau)).size, before.users.length);
});

test('all three credentials issue HttpOnly sessions; backend alone determines roles and scopes accounts', async () => {
  for (const [username, role] of [['sinhvien1', 'user'], ['canbo1', 'staff'], ['admin1', 'admin']]) {
    const response = await login(username);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).role, role);
    assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
    const sid = cookie(response);
    const session = await request('auth/session', { headers: headers(sid) });
    assert.equal((await session.json()).username, username);
    const workspace = await request('system/workspace', { headers: headers(sid) });
    assert.equal(workspace.status, 200);
    const body = await workspace.json();
    assert.equal(body.user.role, role);
    assert.equal(body.accounts.length, role === 'admin' ? 3 : 0);
    assert.equal(JSON.stringify(body).includes('mat_khau'), false);
    assert.equal((await request('auth/logout', { method: 'POST', headers: { ...headers(sid), Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 201);
    assert.equal((await request('auth/session', { headers: headers(sid) })).status, 401);
  }
});

test('anonymous, forged cookies, cross-origin and injected roles cannot access sessions', async () => {
  assert.equal((await request('system/workspace')).status, 401);
  assert.equal((await request('auth/session', { headers: headers(`cm_sid=${'a'.repeat(64)}`) })).status, 401);
  assert.equal((await request('auth/login/password', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'sinhvien1', password }) })).status, 403);
  const invalid = await login('sinhvien1', password, { role: 'admin' });
  assert.equal(invalid.status, 400);
  const body = await invalid.json();
  assert.equal(body.code, 'VALIDATION_FAILED');
  assert.ok(body.requestId);
});

test('unknown credentials never create a session and are locked after five failures', async () => {
  const username = `test_${randomUUID()}`;
  const key = `cm:login:${createHash('sha256').update(username).digest('hex')}`;
  try {
    for (let i = 0; i < 5; i++) {
      const response = await login(username, 'invalid');
      assert.equal(response.status, 401); assert.equal(response.headers.get('set-cookie'), null);
    }
    assert.equal((await login(username, 'invalid')).status, 429);
  } finally { await redis.del([key, `${key}:blocked`]); }
});

test('network rate limit blocks requests before password hashing', async () => {
  const address = randomUUID();
  const key = `cm:login-ip:${createHash('sha256').update(address).digest('hex')}`;
  try {
    await redis.set(key, '100', { EX: 60 });
    await assert.rejects(app.get(AuthService).login('sinhvien1', password, address), (error) => error.getStatus() === 429);
  } finally { await redis.del(key); }
});

test('polling does not refresh idle TTL; workspace navigation refreshes it; account changes invalidate sessions', async () => {
  const sid = cookie(await login('sinhvien1'));
  const key = `cm:session:${createHash('sha256').update(sid.slice(7)).digest('hex')}`;
  await redis.expire(key, 60);
  assert.equal((await request('auth/session', { headers: headers(sid) })).status, 200);
  assert.ok(await redis.ttl(key) <= 60);
  assert.equal((await request('system/workspace', { headers: { ...headers(sid), 'X-User-Activity': '1' } })).status, 200);
  assert.ok(await redis.ttl(key) > 1700);
  const user = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'sinhvien1' } });
  try {
    await db.nguoi_dung.update({ where: { id_nguoi_dung: user.id_nguoi_dung }, data: { trang_thai: 'locked' } });
    assert.equal((await request('auth/session', { headers: headers(sid) })).status, 401);
    assert.equal(await redis.exists(key), 0);
  } finally { await db.nguoi_dung.update({ where: { id_nguoi_dung: user.id_nguoi_dung }, data: { trang_thai: user.trang_thai } }); }
});

test('Redis outage and production password-only gate fail closed', async () => {
  const oldUrl = process.env.REDIS_URL;
  let service;
  try {
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';
    service = new AuthService(db);
    await assert.rejects(service.login('sinhvien1', password, 'test-outage'), (error) => error.getStatus() === 503);
  } finally { process.env.REDIS_URL = oldUrl; await service?.onModuleDestroy(); }
  const sid = cookie(await login('sinhvien1'));
  try {
    process.env.NODE_ENV = 'production';
    assert.equal((await login('sinhvien1')).status, 503);
    assert.equal((await request('auth/session', { headers: headers(sid) })).status, 401);
  }
  finally { process.env.NODE_ENV = 'development'; }
});

test('public feed reads database, sanitizes HTML, hides drafts and validates cursor', async () => {
  const author = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
  const title = `test-${randomUUID()}`;
  let post;
  try {
    post = await db.bai_dang.create({ data: { id_nguoi_dang: author.id_nguoi_dung, tieu_de: title, trang_thai: 'published', thoi_gian_dang: new Date(), noi_dung: JSON.stringify({ v: 1, html: '<p onclick="alert(1)">Safe</p><script>alert(1)</script>', lastEditedAt: null }) } });
    const response = await request(`posts/public?search=${title}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items.length, 1); assert.equal(body.items[0].html, '<p>Safe</p>');
    await db.bai_dang.update({ where: { id_bai_dang: post.id_bai_dang }, data: { trang_thai: 'draft' } });
    assert.equal((await (await request(`posts/public?search=${title}`)).json()).items.length, 0);
  } finally { if (post) await db.bai_dang.delete({ where: { id_bai_dang: post.id_bai_dang } }); }
  assert.equal((await request('posts/public?cursor=invalid')).status, 400);
});

test('feed cursor is stable across equal timestamps and returns ten posts per page', async () => {
  const author = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
  const title = `cursor-${randomUUID()}`;
  try {
    await db.bai_dang.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ id_nguoi_dang: author.id_nguoi_dung, tieu_de: `${title}-${i}`, trang_thai: 'published', thoi_gian_dang: new Date('2026-01-01T00:00:00Z'), noi_dung: JSON.stringify({ v: 1, html: '<p>Cursor</p>', lastEditedAt: null }) })) });
    const first = await (await request(`posts/public?search=${title}`)).json();
    assert.equal(first.items.length, 10); assert.ok(first.nextCursor);
    const second = await (await request(`posts/public?search=${title}&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
    assert.equal(second.items.length, 2); assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.items, ...second.items].map((post) => post.id)).size, 12);
    assert.equal((await request(`posts/public?cursor=${encodeURIComponent(first.nextCursor + '_invalid')}`)).status, 400);
  } finally { await db.bai_dang.deleteMany({ where: { id_nguoi_dang: author.id_nguoi_dung, tieu_de: { startsWith: title } } }); }
});

test('activity projection includes real publication state and never exposes manager drafts to end users', async () => {
  const manager = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
  const prefix = `projection-${randomUUID()}`;
  try {
    await db.hoat_dong.createMany({ data: ['draft', 'published'].map((state) => ({ ten_hoat_dong: `${prefix}-${state}`, id_nguoi_tao: manager.id_nguoi_dung, trang_thai: state })) });
    for (const username of ['canbo1', 'sinhvien1']) {
      const sid = cookie(await login(username));
      const response = await request('system/workspace', { headers: headers(sid) });
      const body = await response.json();
      const activities = body.activities.filter((activity) => activity.name.startsWith(prefix));
      assert.deepEqual(activities.map((activity) => activity.status).sort(), username === 'canbo1' ? ['draft', 'published'] : ['published']);
      await request('auth/logout', { method: 'POST', headers: { ...headers(sid), Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
    }
  } finally { await db.hoat_dong.deleteMany({ where: { id_nguoi_tao: manager.id_nguoi_dung, ten_hoat_dong: { startsWith: prefix } } }); }
});

test('draft API validates role, owner, dates, revision and every non-draft state under a transaction', async () => {
  const staff = cookie(await login('canbo1'));
  const student = cookie(await login('sinhvien1'));
  const admin = cookie(await login('admin1'));
  let id;
  try {
    assert.equal((await write(student, 'activities', { name: 'Forbidden' })).status, 403);
    assert.equal((await write(admin, 'activities', { name: 'Forbidden' })).status, 403);
    assert.equal((await write(staff, 'activities', { name: ' ', role: 'staff' })).status, 400);
    const response = await write(staff, 'activities', { name: `draft-${randomUUID()}` });
    assert.equal(response.status, 201); id = (await response.json()).id;
    assert.equal(await db.chi_tiet_hoat_dong.count({ where: { id_hoat_dong: id } }), 0);
    let editor = await (await request(`activities/${id}/editor`, { headers: headers(staff) })).json();
    const body = { name: 'Updated draft', points: 5, requiresCheckout: false, revision: editor.revision, startAt: '2027-02-01T01:00:00Z', endAt: '2027-02-01T04:00:00Z', latitude: 0, longitude: 0, location: 'Campus' };
    assert.equal((await write(staff, `activities/${id}`, { ...body, endAt: body.startAt }, 'PATCH')).status, 400);
    assert.equal((await write(staff, `activities/${id}`, { ...body, assignments: [] }, 'PATCH')).status, 400);
    assert.equal((await write(staff, `activities/${id}`, body, 'PATCH')).status, 200);
    const detail = await db.chi_tiet_hoat_dong.findUnique({ where: { id_hoat_dong: id } });
    assert.equal(detail.thoi_gian_bat_dau.toISOString(), body.startAt.replace('Z', '.000Z'));
    assert.equal(Number(detail.vi_do), 0);
    assert.equal(await db.phan_cong_nhiem_vu.count({ where: { id_chi_tiet_hoat_dong: detail.id_chi_tiet_hoat_dong } }), 0);
    assert.equal((await write(staff, `activities/${id}`, body, 'PATCH')).status, 409);
    editor = await (await request(`activities/${id}/editor`, { headers: headers(staff) })).json();
    const races = await Promise.all(['First', 'Second'].map((name) => write(staff, `activities/${id}`, { ...body, name, revision: editor.revision }, 'PATCH')));
    assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
    editor = await (await request(`activities/${id}/editor`, { headers: headers(staff) })).json();
    assert.equal((await write(staff, `activities/${id}`, { name: 'Only rename', revision: editor.revision }, 'PATCH')).status, 200);
    const preserved = await db.chi_tiet_hoat_dong.findUnique({ where: { id_hoat_dong: id } });
    assert.deepEqual(preserved, detail);
    for (const state of ['published', 'pending', 'progress', 'pending_issues', 'pending_completed', 'completed', 'issues', 'cancelled']) {
      await db.hoat_dong.update({ where: { id_hoat_dong: id }, data: { trang_thai: state } });
      editor = await (await request(`activities/${id}/editor`, { headers: headers(staff) })).json();
      assert.equal(editor.editable, false);
      assert.equal((await write(staff, `activities/${id}`, { ...body, revision: editor.revision }, 'PATCH')).status, 409);
    }
    const owner = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'admin1' } });
    await db.hoat_dong.update({ where: { id_hoat_dong: id }, data: { trang_thai: 'draft', id_nguoi_tao: owner.id_nguoi_dung } });
    assert.equal((await request(`activities/${id}/editor`, { headers: headers(staff) })).status, 404);
    assert.equal((await write(staff, `activities/${id}`, body, 'PATCH')).status, 404);
    assert.equal((await request('activities/assignees', { headers: headers(student) })).status, 403);
    const people = await (await request('activities/assignees?search=sinhvien1', { headers: headers(staff) })).json();
    assert.equal(people.length, 1); assert.deepEqual(Object.keys(people[0]).sort(), ['ho_ten', 'id_nguoi_dung', 'ten_dang_nhap']);
  } finally { if (id) await db.hoat_dong.delete({ where: { id_hoat_dong: id } }); }
});

test('credential changes between session guard and SQL write fail closed without creating a draft', async () => {
  const { ActivitiesService } = require('../dist/modules/activities/activities.service');
  const sid = cookie(await login('canbo1'));
  const principal = await app.get(AuthService).current({ headers: { cookie: sid } });
  assert.equal(JSON.stringify(principal).includes('sessionProof'), false);
  const user = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
  const before = await db.hoat_dong.count();
  try {
    await db.nguoi_dung.update({ where: { id_nguoi_dung: user.id_nguoi_dung }, data: { mat_khau: await hashPassword('changed-password') } });
    await assert.rejects(app.get(ActivitiesService).save(principal, { name: 'Must not exist', points: 0, requiresCheckout: false }), (error) => error.getStatus() === 401);
    assert.equal(await db.hoat_dong.count(), before);
  } finally { await db.nguoi_dung.update({ where: { id_nguoi_dung: user.id_nguoi_dung }, data: { mat_khau: user.mat_khau } }); }
});

test('draft seed is repeatable and does not create assignments or publish activities', async () => {
  const manager = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
  const snapshot = () => db.hoat_dong.findMany({ where: { id_nguoi_tao: manager.id_nguoi_dung }, orderBy: { id_hoat_dong: 'asc' }, include: { chi_tiet_hoat_dong: { include: { phan_cong_nhiem_vu: true } } } });
  const before = await snapshot();
  process.env.SEED_ACCOUNT_PASSWORD = password;
  try { await seedSystem(db); await seedSystem(db); } finally { delete process.env.SEED_ACCOUNT_PASSWORD; }
  assert.deepEqual(await snapshot(), before);
  assert.ok(before.length >= 3); assert.ok(before.every((row) => row.trang_thai === 'draft'));
  assert.ok(before.every((row) => !row.chi_tiet_hoat_dong?.phan_cong_nhiem_vu.length));
});

test('notification endpoint requires a session and returns only the current recipient', async () => {
  assert.equal((await request('notifications')).status, 401);
  const user = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'sinhvien1' } });
  const manager = await db.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
  const ids = [];
  try {
    for (const recipient of [user, manager]) {
      const row = await db.thong_bao.create({ data: { loai_thong_bao: 'NOTI-03', tieu_de: `notification-${randomUUID()}`, noi_dung: 'Owned notification', nguoi_nhan_thong_bao: { create: { id_nguoi_dung: recipient.id_nguoi_dung } } } });
      ids.push(row.id_thong_bao);
    }
    const sid = cookie(await login('sinhvien1'));
    const data = await (await request('notifications', { headers: headers(sid) })).json();
    assert.ok(data.items.some((row) => row.id === ids[0])); assert.ok(!data.items.some((row) => row.id === ids[1]));
    const recipient = await db.nguoi_nhan_thong_bao.findFirst({ where: { id_nguoi_dung: user.id_nguoi_dung, id_thong_bao: ids[0] } });
    assert.equal(recipient.da_doc, false);
  } finally { await db.thong_bao.deleteMany({ where: { id_thong_bao: { in: ids } } }); }
});
