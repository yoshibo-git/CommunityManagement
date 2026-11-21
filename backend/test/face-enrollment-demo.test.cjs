const assert = require('node:assert/strict');
const { createDecipheriv, createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createClient } = require('redis');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { hashPassword } = require('../dist/common/security/password');

test('student enrollment through Next.js, NestJS, Redis, MySQL and OpenBiometrics', async () => {
  assert.equal(process.env.NODE_ENV, 'development');
  assert.equal(process.env.FACE_ENROLLMENT_DEMO, 'true');
  const database = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
  assert.equal(database.pathname, '/community_management');
  const password = `face-test-${randomUUID()}`;
  const fixtureDir = process.env.FACE_DEMO_FIXTURES;
  assert.ok(fixtureDir);
  const image = fs.readFileSync(path.join(fixtureDir, 'synthetic-frontal.jpg'));
  const otherFace = fs.readFileSync(path.join(fixtureDir, 'synthetic-b.jpg'));
  const noFace = fs.readFileSync(path.join(fixtureDir, 'no-face.png'));
  const origin = 'http://localhost:3001';
  const db = new PrismaService();
  const redis = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 3000, reconnectStrategy: false } });
  redis.on('error', () => {});
  const keys = [];
  const created = [];

  const request = (route, options = {}) => fetch(`${origin}/api/backend/${route}`, {
    ...options, headers: { Origin: origin, ...options.headers }, signal: AbortSignal.timeout(10_000),
  });
  const login = (username, secret = password) => request('auth/login/password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: secret }),
  });
  const key = (namespace, secret) => `cm:${namespace}:${createHash('sha256').update(secret).digest('hex')}`;
  const uploadFace = (route, ticket, bytes) => {
    const form = new FormData();
    form.set('image', new Blob([bytes]), 'synthetic.jpg');
    return request(route, { method: 'POST', headers: { Authorization: `Bearer ${ticket}` }, body: form });
  };
  const enroll = (ticket, bytes) => uploadFace('auth/face/enroll', ticket, bytes);
  const verify = (ticket, bytes) => uploadFace('auth/login/face', ticket, bytes);
  const readCookie = (response) => {
    const cookie = response.headers.get('set-cookie') ?? '';
    const sid = /^cm_sid=([a-f0-9]{64});/.exec(cookie)?.[1];
    assert.ok(sid && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax'));
    keys.push(key('session', sid));
    return `cm_sid=${sid}`;
  };
  async function getTicket(username, step = 'face_enrollment_required', secret = password) {
    const response = await login(username, secret);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('set-cookie'), null);
    const body = await response.json();
    assert.equal(body.step, step);
    assert.equal(body.expiresIn, 300);
    assert.match(body.ticket, /^[a-f0-9]{64}$/);
    const ticketKey = key('face-ticket', body.ticket);
    keys.push(ticketKey);
    const ttl = await redis.ttl(ticketKey);
    assert.ok(ttl > 0 && ttl <= 300);
    return body.ticket;
  }

  try {
    await redis.connect();
    const seed = await db.nguoi_dung.findUniqueOrThrow({
      where: { ten_dang_nhap: 'sinhvien1' }, include: { vai_tro: true, thong_tin_sinh_trac: { select: { id_khuon_mat: true } } },
    });
    assert.equal(seed.vai_tro.ten_vai_tro, 'user');
    assert.equal(seed.loai_nguoi_dung, 'student');
    const passwordHash = await hashPassword(password);
    async function createFixture(role, type) {
      const username = `face-test-${randomUUID()}`;
      const account = await db.nguoi_dung.create({ data: {
        ten_dang_nhap: username, email: `${username}@example.invalid`, ho_ten: 'Tài khoản kiểm thử',
        mat_khau: passwordHash, trang_thai: 'active', loai_nguoi_dung: type,
        vai_tro: { connect: { ten_vai_tro: role } },
      } });
      created.push(account.id_nguoi_dung);
      return account;
    }
    for (const role of ['staff', 'admin']) {
      const user = await createFixture(role, 'staff');
      const response = await login(user.ten_dang_nhap);
      assert.equal(response.status, 201);
      assert.equal((await response.json()).role, role);
      assert.equal((await request('auth/session', { headers: { Cookie: readCookie(response) } })).status, 200);
    }
    const fixture = await createFixture('user', 'student');
    const username = fixture.ten_dang_nhap;
    const wrong = await login(username, 'wrong-password');
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get('set-cookie'), null);
    const expired = await getTicket(username);
    await redis.pExpire(key('face-ticket', expired), 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await enroll(expired, image)).status, 401);
    const exhausted = await getTicket(username);
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await enroll(exhausted, noFace)).status, 400);
    assert.equal((await enroll(exhausted, image)).status, 429);

    const ticket = await getTicket(username);
    assert.equal((await request('auth/session', { headers: { Cookie: `cm_sid=${ticket}` } })).status, 401);
    assert.equal((await request('notifications', { headers: { Authorization: `Bearer ${ticket}` } })).status, 401);
    assert.equal((await request('internal/v1/face/embedding', { method: 'POST' })).status, 404);
    assert.equal((await enroll(ticket, Buffer.alloc(2 * 1024 * 1024 + 1))).status, 413);
    const rejected = await enroll(ticket, noFace);
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).code, 'FACE_NOT_FOUND');
    assert.equal(rejected.headers.get('set-cookie'), null);
    assert.equal(await db.thong_tin_sinh_trac.count({ where: { id_nguoi_dung: fixture.id_nguoi_dung } }), 0);

    const responses = await Promise.all([enroll(ticket, image), enroll(ticket, image)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 401]);
    const accepted = responses.find((response) => response.status === 201);
    assert.equal(accepted.headers.get('set-cookie'), null);
    assert.deepEqual(await accepted.json(), { registered: true });
    assert.equal((await enroll(ticket, image)).status, 401);

    const expiredVerification = await getTicket(username, 'face_verification_required');
    await redis.pExpire(key('face-ticket', expiredVerification), 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await verify(expiredVerification, image)).status, 401);
    const limitedVerification = await getTicket(username, 'face_verification_required');
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await verify(limitedVerification, noFace)).status, 400);
    assert.equal((await verify(limitedVerification, image)).status, 429);
    const verification = await getTicket(username, 'face_verification_required');
    assert.equal((await enroll(verification, image)).status, 401);
    const mismatch = await verify(verification, otherFace);
    assert.equal(mismatch.status, 400);
    assert.equal((await mismatch.json()).code, 'FACE_NOT_MATCHED');
    assert.equal(mismatch.headers.get('set-cookie'), null);
    const verificationResponses = await Promise.all([verify(verification, image), verify(verification, image)]);
    assert.deepEqual(verificationResponses.map((response) => response.status).sort(), [201, 401]);
    const cookie = readCookie(verificationResponses.find((response) => response.status === 201));
    assert.equal((await request('auth/session', { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await verify(verification, image)).status, 401);

    const updateProfile = (data, session) => request('users/me', {
      method: 'PATCH', headers: { Cookie: session, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    assert.equal((await updateProfile({ phone: '0900000001' }, '')).status, 401);
    for (const field of ['role', 'type', 'loai_nguoi_dung', 'id_khoa', 'userId']) {
      assert.equal((await updateProfile({ phone: '0900000001', [field]: 'invalid' }, cookie)).status, 400);
    }
    assert.equal((await updateProfile({}, cookie)).status, 400);
    assert.equal((await updateProfile({ phone: 'invalid' }, cookie)).status, 400);
    const updated = await updateProfile({ phone: '0900000001' }, cookie);
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), { phone: '0900000001' });
    const profile = await db.nguoi_dung.findUniqueOrThrow({ where: { id_nguoi_dung: fixture.id_nguoi_dung } });
    assert.equal(profile.so_dien_thoai, '0900000001');
    assert.equal(profile.id_vai_tro, fixture.id_vai_tro);
    assert.equal(profile.loai_nguoi_dung, fixture.loai_nguoi_dung);
    assert.equal(profile.id_khoa, fixture.id_khoa);

    const saved = await db.thong_tin_sinh_trac.findUniqueOrThrow({ where: { id_nguoi_dung: fixture.id_nguoi_dung } });
    const envelope = saved.mau_khuon_mat;
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.FACE_TEMPLATE_KEY, 'hex'), Buffer.from(envelope.nonce, 'base64'));
    decipher.setAAD(Buffer.from(JSON.stringify([fixture.id_nguoi_dung, saved.id_khuon_mat, envelope.version, envelope.kid])));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const decoded = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
    assert.equal(decoded.length, 512);
    const vector = Array.from({ length: 128 }, (_, index) => decoded.readFloatLE(index * 4));
    assert.ok(vector.every(Number.isFinite) && Math.abs(Math.hypot(...vector) - 1) < 1e-4);
    decoded.fill(0);
    assert.ok(saved.ngay_dang_ky);
    const second = await verify(await getTicket(username, 'face_verification_required'), image);
    assert.equal(second.status, 201);
    const secondCookie = readCookie(second);
    const staleTicket = await getTicket(username, 'face_verification_required');
    const newPassword = `demo-${randomUUID()}`;
    const change = (currentPassword, next, confirmPassword) => request('auth/password/change', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword: next, confirmPassword }),
    });
    for (const [current, next, confirmation, code] of [
      ['wrong', newPassword, newPassword, 'CURRENT_PASSWORD_INVALID'],
      [password, newPassword, 'different', 'PASSWORD_MISMATCH'],
      [password, 'short', 'short', 'PASSWORD_POLICY'],
    ]) {
      const result = await change(current, next, confirmation);
      assert.equal(result.status, 400);
      assert.equal((await result.json()).code, code);
    }
    const changed = await change(password, newPassword, newPassword);
    assert.equal(changed.status, 201);
    assert.deepEqual(await changed.json(), { changed: true });
    assert.match(changed.headers.get('set-cookie'), /cm_sid=;.*Max-Age=0/);
    for (const previous of [cookie, secondCookie]) {
      assert.equal((await request('auth/session', { headers: { Cookie: previous } })).status, 401);
    }
    assert.equal((await verify(staleTicket, image)).status, 401);
    assert.equal((await login(username)).status, 401);
    const relogged = await verify(await getTicket(username, 'face_verification_required', newPassword), image);
    assert.equal(relogged.status, 201);
    readCookie(relogged);
    assert.equal((await db.thong_tin_sinh_trac.findUniqueOrThrow({ where: { id_nguoi_dung: fixture.id_nguoi_dung } })).id_khuon_mat, saved.id_khuon_mat);
    const seedReference = await db.thong_tin_sinh_trac.findUnique({ where: { id_nguoi_dung: seed.id_nguoi_dung }, select: { id_khuon_mat: true } });
    assert.deepEqual(seedReference, seed.thong_tin_sinh_trac);
  } finally {
    try {
      if (created.length) await db.nguoi_dung.deleteMany({ where: { id_nguoi_dung: { in: created } } });
      if (redis.isReady && keys.length) await redis.del(keys);
    } finally {
      if (redis.isOpen) redis.destroy();
      await db.$disconnect();
    }
  }
});
