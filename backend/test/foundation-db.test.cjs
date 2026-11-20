const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { seedRoles } = require('../dist/prisma/seed');
const { configureApp } = require('../dist/app/configure-app');
const { readEnvironment } = require('../dist/common/config/environment');

let app;
let db;
before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app, readEnvironment());
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
});
after(async () => { if (app) await app.close(); });

test('real AppModule serves /api/v1 after database initialization', async () => {
  const response = await fetch(`${await app.getUrl()}/api/v1`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'success');
  assert.ok(response.headers.get('x-request-id'));
});

test('all five pooled connections use UTC, transactions use READ COMMITTED and reuse their client', { timeout: 15000 }, async () => {
  const [initial] = await db.$queryRaw`SELECT @@global.transaction_isolation AS globalIsolation, @@session.transaction_isolation AS sessionIsolation`;
  for (let wave = 0; wave < 2; wave++) {
    const barrier = Promise.withResolvers();
    let ready = 0;
    const states = await Promise.all(Array.from({ length: 5 }, () => db.runInTransaction(async (tx) => {
      const [state] = await tx.$queryRaw`SELECT CONNECTION_ID() AS connectionId, @@session.time_zone AS timeZone, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS offsetSeconds`;
      const [transaction] = await tx.$queryRaw`
        SELECT e.ISOLATION_LEVEL AS isolationLevel
        FROM performance_schema.events_transactions_current e
        JOIN performance_schema.threads t ON t.THREAD_ID = e.THREAD_ID
        WHERE t.PROCESSLIST_ID = CONNECTION_ID()`;
      assert.equal(transaction?.isolationLevel, 'READ COMMITTED');
      await db.runInTransaction(async (inner) => {
        assert.equal(inner, tx);
        const [nested] = await inner.$queryRaw`SELECT CONNECTION_ID() AS connectionId`;
        assert.equal(nested.connectionId, state.connectionId);
      }, tx);
      if (++ready === 5) barrier.resolve();
      await barrier.promise;
      return state;
    })));
    assert.equal(new Set(states.map((state) => state.connectionId)).size, 5);
    for (const state of states) {
      assert.equal(state.timeZone, '+00:00');
      assert.equal(Number(state.offsetSeconds), 0);
    }
  }
  const [final] = await db.$queryRaw`SELECT @@global.transaction_isolation AS globalIsolation, @@session.transaction_isolation AS sessionIsolation`;
  assert.deepEqual(final, initial);
});

test('transaction errors propagate and the pool remains usable', async () => {
  const failure = new Error('intentional-transaction-failure');
  await assert.rejects(db.runInTransaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS value`;
    throw failure;
  }), (error) => error === failure);
  assert.equal((await db.$queryRaw`SELECT 1 AS value`)[0].value, 1n);
});

test('role seed is repeatable and concurrent-safe without changing existing roles or accounts', async () => {
  const accountDigest = async () => createHash('sha256').update(JSON.stringify(
    await db.nguoi_dung.findMany({ orderBy: { id_nguoi_dung: 'asc' } }),
  )).digest('hex');
  const usersBefore = await accountDigest();
  const beforeRoles = await db.vai_tro.findMany({ orderBy: { id_vai_tro: 'asc' } });
  await seedRoles(db);
  const firstRoles = await db.vai_tro.findMany({ orderBy: { id_vai_tro: 'asc' } });
  await seedRoles(db);
  await Promise.all([seedRoles(db), seedRoles(db)]);
  const afterRoles = await db.vai_tro.findMany({ orderBy: { id_vai_tro: 'asc' } });
  assert.deepEqual(afterRoles, firstRoles);
  for (const role of beforeRoles) assert.deepEqual(afterRoles.find((row) => row.id_vai_tro === role.id_vai_tro), role);
  const expected = ['admin', 'staff', 'user'];
  assert.deepEqual(afterRoles.map((row) => row.ten_vai_tro).sort(), expected);
  assert.equal(await accountDigest(), usersBefore);
});
