import { cookies } from 'next/headers';

export function backendUrl(path: string) {
  const base = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';
  return new URL(`/api/v1/${path}`, base);
}

export async function sessionHeaders() {
  const sid = (await cookies()).get('cm_sid')?.value;
  return sid && /^[a-f0-9]{64}$/.test(sid) ? { Cookie: `cm_sid=${sid}` } : {};
}
