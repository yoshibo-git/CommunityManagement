import { NextRequest } from 'next/server';
import { backendUrl } from '@/lib/backend';

const routes = new Map([
  ['PATCH:users/me', 'users/me'],
  ['GET:auth/session', 'auth/session'], ['POST:auth/login/password', 'auth/login/password'],
  ['POST:auth/face/enroll', 'auth/face/enroll'],
  ['POST:auth/login/face', 'auth/login/face'], ['POST:auth/password/change', 'auth/password/change'],
  ['POST:auth/logout', 'auth/logout'], ['GET:posts/public', 'posts/public'], ['GET:activities', 'activities'],
  ['GET:notifications', 'notifications'], ['POST:activities', 'activities'],
  ['GET:activities/assignees', 'activities/assignees'],
]);

async function readEnrollmentBody(request: NextRequest) {
  const limit = 2 * 1024 * 1024 + 8192;
  const body = request.body?.getReader();
  if (!body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await body.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await body.cancel();
      return null;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/');
  const editor = request.method === 'GET' && /^activities\/[1-9]\d*\/editor$/.test(path);
  const update = request.method === 'PATCH' && /^activities\/[1-9]\d*$/.test(path);
  const target = routes.get(`${request.method}:${path}`) ?? ((editor || update) ? path : undefined);
  if (!target) return Response.json({ code: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy tài nguyên.' }, { status: 404 });
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get('host')}`;
  if (['POST', 'PATCH'].includes(request.method) && request.headers.get('origin') !== expectedOrigin) {
    return Response.json({ code: 'FORBIDDEN', message: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  }
  const headers = new Headers();
  for (const key of ['cookie', 'origin', 'content-type']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  try {
    const url = backendUrl(target);
    url.search = request.nextUrl.search;
    let body: BodyInit | undefined;
    if (target === 'auth/face/enroll' || target === 'auth/login/face') {
      const authorization = request.headers.get('authorization');
      if (authorization) headers.set('authorization', authorization);
      const upload = await readEnrollmentBody(request);
      if (!upload) return Response.json({ message: 'Ảnh vượt quá dung lượng cho phép.' }, { status: 413 });
      body = upload;
    } else if (['POST', 'PATCH'].includes(request.method)) {
      body = await request.text();
    }
    const upstream = await fetch(url, { method: request.method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const resultHeaders = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    for (const key of ['set-cookie', 'x-request-id']) {
      const value = upstream.headers.get(key);
      if (value) resultHeaders.set(key, value);
    }
    return new Response(await upstream.text(), { status: upstream.status, headers: resultHeaders });
  } catch {
    return Response.json({ code: 'DEPENDENCY_UNAVAILABLE', message: 'Dịch vụ tạm thời không khả dụng.' }, { status: 503 });
  }
}

export { forward as GET, forward as POST, forward as PATCH };
