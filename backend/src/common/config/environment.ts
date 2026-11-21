import 'dotenv/config';

export function readDatabaseConfig(environment = process.env) {
  try {
    const url = new URL(environment.DATABASE_URL ?? '');
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1));
    const port = url.port ? Number(url.port) : 3306;
    // shortcut: URL query options are rejected, add validated driver options when TLS or sockets are needed.
    if (url.protocol !== 'mysql:' || !url.hostname || !user || !password ||
        !database || database.includes('/') || url.search || url.hash ||
        !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error();
    }
    const host = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
    return { host, port, user, password, database };
  } catch {
    throw new Error('DATABASE_URL must contain a valid mysql://user:password@host:port/database URL without query parameters.');
  }
}

export function readEnvironment(environment = process.env) {
  readDatabaseConfig(environment);
  if (environment.FACE_ENROLLMENT_DEMO === 'true') {
    if (environment.NODE_ENV !== 'development' || environment.AUTH_PASSWORD_ONLY !== 'true') {
      throw new Error('Face enrollment demo requires local password authentication.');
    }
    const service = new URL(environment.FACE_EMBEDDING_URL ?? '');
    if (service.origin !== 'http://127.0.0.1:8000' || service.pathname !== '/internal/v1/face/embedding' ||
      service.username || service.password || service.search || service.hash) throw new Error('Invalid local embedding URL.');
    if (!/^[a-f0-9]{64}$/.test(environment.FACE_TEMPLATE_KEY ?? '') ||
      !/^[a-f0-9]{64}$/.test(environment.FACE_EMBEDDING_TOKEN ?? '') ||
      !environment.FACE_TEMPLATE_KID) throw new Error('Face enrollment secrets are required.');
  }
  if (environment.AUTH_PASSWORD_ONLY !== undefined && !['true', 'false'].includes(environment.AUTH_PASSWORD_ONLY)) throw new Error('AUTH_PASSWORD_ONLY must be true or false.');
  if (environment.AUTH_PASSWORD_ONLY === 'true') {
    if (environment.NODE_ENV === 'production') throw new Error('Password-only authentication is disabled in production.');
    if (!environment.SESSION_SECRET || environment.SESSION_SECRET.length < 64) throw new Error('SESSION_SECRET must contain at least 64 characters.');
    try { if (!['redis:', 'rediss:'].includes(new URL(environment.REDIS_URL ?? '').protocol)) throw new Error(); }
    catch { throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.'); }
    if (!environment.CORS_ALLOWED_ORIGINS) throw new Error('CORS_ALLOWED_ORIGINS is required for authentication.');
  }
  const port = environment.PORT ?? '3000';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const allowedOrigins = (environment.CORS_ALLOWED_ORIGINS ?? '')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.hostname.includes('*')) {
        throw new Error();
      }
    } catch {
      throw new Error('CORS_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins without paths or wildcards.');
    }
  }
  return { port: Number(port), allowedOrigins };
}
