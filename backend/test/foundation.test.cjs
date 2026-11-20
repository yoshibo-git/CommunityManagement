const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { Body, Controller, Get, HttpException, Module, Post } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { IsString } = require('class-validator');
const { AppController } = require('../dist/app/app.controller');
const { configureApp } = require('../dist/app/configure-app');
const { readDatabaseConfig, readEnvironment } = require('../dist/common/config/environment');

const databaseUrl = 'mysql://app:test%40password@127.0.0.1:3306/community_test';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('environment rejects unsafe or incomplete database settings without exposing credentials', () => {
  assert.equal(readDatabaseConfig({ DATABASE_URL: databaseUrl }).password, 'test@password');
  for (const url of ['', 'postgres://app:password@localhost/db', 'mysql://localhost/db',
    'mysql://app:password@localhost/', `${databaseUrl}?ssl=false`, `${databaseUrl}#fragment`,
    'mysql://app:%ZZ@localhost/db']) {
    assert.throws(() => readDatabaseConfig({ DATABASE_URL: url }), (error) =>
      error.message.startsWith('DATABASE_URL must') && !error.message.includes('test@password'));
  }
  assert.throws(() => readDatabaseConfig({ DB_HOST: 'localhost', DB_USER: 'app' }));
});

test('environment validates ports and exact origins; default CORS allowlist is empty', () => {
  const env = { DATABASE_URL: databaseUrl };
  assert.deepEqual(readEnvironment(env), { port: 3000, allowedOrigins: [] });
  assert.deepEqual(readEnvironment({ ...env, PORT: '3002', CORS_ALLOWED_ORIGINS: 'https://a.example, http://localhost:3001' }),
    { port: 3002, allowedOrigins: ['https://a.example', 'http://localhost:3001'] });
  for (const port of ['', '0', '-1', '65536', '3.5', '3000abc']) {
    assert.throws(() => readEnvironment({ ...env, PORT: port }), /PORT must/);
  }
  for (const origin of ['*', 'null', 'https://a.example/path', 'https://*.example', 'ftp://a.example', 'https://a.example/']) {
    assert.throws(() => readEnvironment({ ...env, CORS_ALLOWED_ORIGINS: origin }), /CORS_ALLOWED_ORIGINS must/);
  }
});

test('actual bootstrap exits before connecting when required configuration is invalid', () => {
  for (const invalid of [{ DATABASE_URL: '' }, { PORT: '0' }, { CORS_ALLOWED_ORIGINS: '*' }]) {
    const result = spawnSync(process.execPath, ['dist/main.js'], {
      env: { ...process.env, DATABASE_URL: databaseUrl, ...invalid },
      encoding: 'utf8', timeout: 3000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Backend startup failed/);
    assert.ok(!result.stderr.includes('test@password'));
  }
});

// These routes exercise the real HTTP pipeline and exist only in this test module.
class ProbeDto {}
IsString()(ProbeDto.prototype, 'name');
class ProbeController {
  validate(body) { return { transformed: body instanceof ProbeDto, name: body.name }; }
  fail() { throw new Error('private-password-and-database-details'); }
  conflict() {
    throw new HttpException({ code: 'STATE_CONFLICT', message: 'Dữ liệu đã thay đổi.', details: { field: 'name' } }, 409);
  }
}
Controller('__foundation')(ProbeController);
for (const [method, decorator] of [['validate', Post('validate')], ['fail', Get('fail')], ['conflict', Get('conflict')]]) {
  decorator(ProbeController.prototype, method, Object.getOwnPropertyDescriptor(ProbeController.prototype, method));
}
Body()(ProbeController.prototype, 'validate', 0);
Reflect.defineMetadata('design:paramtypes', [ProbeDto], ProbeController.prototype, 'validate');
class TestModule {}
Module({ controllers: [AppController, ProbeController] })(TestModule);
let app;
let baseUrl;
before(async () => {
  app = await NestFactory.create(TestModule, { logger: false });
  configureApp(app, readEnvironment({ DATABASE_URL: databaseUrl, CORS_ALLOWED_ORIGINS: 'https://frontend.example' }));
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => { if (app) await app.close(); });

test('prefix is /api/v1 and every request receives a server-generated request ID', async () => {
  const response = await fetch(`${baseUrl}/api/v1`, { headers: { 'X-Request-ID': 'untrusted-client-value' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-request-id'), uuid);
  assert.equal((await response.json()).status, 'success');
  const missing = await fetch(`${baseUrl}/api`);
  assert.equal(missing.status, 404);
  const body = await missing.json();
  assert.equal(body.code, 'RESOURCE_NOT_FOUND');
  assert.equal(body.requestId, missing.headers.get('x-request-id'));
  assert.notEqual(body.requestId, response.headers.get('x-request-id'));
});

test('real ValidationPipe transforms DTOs and rejects extra properties, invalid types and malformed JSON', async () => {
  const send = (body) => fetch(`${baseUrl}/api/v1/__foundation/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const valid = await send(JSON.stringify({ name: 'Hợp lệ' }));
  assert.equal(valid.status, 201);
  assert.deepEqual(await valid.json(), { transformed: true, name: 'Hợp lệ' });
  for (const payload of ['{}', '{"name":123}', '{"name":"Hợp lệ","secret":"private-value"}', '{invalid']) {
    const response = await send(payload);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      code: 'VALIDATION_FAILED', message: 'Dữ liệu không hợp lệ.', requestId: response.headers.get('x-request-id'),
    });
    assert.match(body.requestId, uuid);
  }
});

test('error filter preserves explicit public errors and hides unexpected internal errors', async () => {
  const response = await fetch(`${baseUrl}/api/v1/__foundation/conflict`);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    code: 'STATE_CONFLICT', message: 'Dữ liệu đã thay đổi.', details: { field: 'name' },
    requestId: response.headers.get('x-request-id'),
  });
  const failed = await fetch(`${baseUrl}/api/v1/__foundation/fail`);
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), {
    code: 'INTERNAL_SERVER_ERROR', message: 'Đã xảy ra lỗi hệ thống.', requestId: failed.headers.get('x-request-id'),
  });
});

test('credentialed CORS permits only the configured exact origin', async () => {
  const preflight = (origin) => fetch(`${baseUrl}/api/v1`, {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
  });
  const allowed = await preflight('https://frontend.example');
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://frontend.example');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  for (const origin of ['https://attacker.example', 'https://frontend.example.attacker.example', 'null']) {
    const denied = await preflight(origin);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
});
