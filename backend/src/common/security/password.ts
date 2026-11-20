import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => argon2('argon2id', {
    message: password, nonce: salt, parallelism: 1, memory: 19456, passes: 2, tagLength: 32,
  }, (error, hash) => error ? reject(error) : resolve(hash)));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  const encode = (value: Buffer) => value.toString('base64').replace(/=+$/, '');
  return `$argon2id$v=19$m=19456,t=2,p=1$${encode(salt)}$${encode(hash)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(encoded);
  if (!match) return false;
  const actual = await derive(password, Buffer.from(match[1], 'base64'));
  return timingSafeEqual(actual, Buffer.from(match[2], 'base64'));
}
