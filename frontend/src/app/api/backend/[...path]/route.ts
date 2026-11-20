import { NextRequest } from 'next/server';
import { backendUrl } from '@/lib/backend';

const routes = new Map([
  ['GET:auth/session', 'auth/session'], ['POST:auth/login/password', 'auth/login/password'],
  ['POST:auth/logout', 'auth/logout'], ['GET:posts/public', 'posts/public'], ['GET:activities', 'activities'],
  ['GET:notifications', 'notifications'], ['POST:activities', 'activities'],
  ['GET:activities/assignees', 'activities/assignees'],
]);

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
    const upstream = await fetch(url, { method: request.method, headers, body: ['POST', 'PATCH'].includes(request.method) ? await request.text() : undefined, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000) });
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
