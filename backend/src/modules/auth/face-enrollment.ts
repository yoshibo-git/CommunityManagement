import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const maxFaceImageBytes = 2 * 1024 * 1024;
const embeddingVersion = 'sface-2021dec:yunet-opencv-aligncrop-rgb-v1';
export const demoFaceThreshold = 0.4;

async function readEmbedding(image: Buffer) {
  const url = process.env.FACE_EMBEDDING_URL;
  const token = process.env.FACE_EMBEDDING_TOKEN;
  if (!url || !token) throw new ServiceUnavailableException();

  const form = new FormData();
  form.set('image', new Blob([new Uint8Array(image)]), 'capture.jpg');
  const signal = AbortSignal.timeout(4000);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    redirect: 'error',
    signal,
  });
  if (response.status === 400) {
    // The embedding API uses one error for invalid images and incorrect face counts.
    const diagnostic = await fetch(new URL('/api/v1/detect', url), {
      method: 'POST', body: form, redirect: 'error', signal,
    });
    if (diagnostic.ok) {
      const { count } = await diagnostic.json() as { count?: unknown };
      if (count === 0) throw new BadRequestException({ code: 'FACE_NOT_FOUND', message: 'Không tìm thấy khuôn mặt. Hãy nhìn thẳng vào camera và chụp lại.' });
      if (typeof count === 'number' && count > 1) {
        throw new BadRequestException({ code: 'MULTIPLE_FACES', message: 'Phát hiện nhiều khuôn mặt. Hãy bảo đảm chỉ có bạn trong khung hình.' });
      }
    } else if (diagnostic.status !== 400) throw new ServiceUnavailableException();
    throw new BadRequestException({ code: 'FACE_IMAGE_INVALID', message: 'Ảnh không hợp lệ. Vui lòng chụp lại.' });
  }
  if (!response.ok) throw new ServiceUnavailableException();

  const { embedding, version } = await response.json() as { embedding?: unknown; version?: unknown };
  if (version !== embeddingVersion || !Array.isArray(embedding) || embedding.length !== 128 ||
    !embedding.every((value: unknown) => typeof value === 'number' && Number.isFinite(value)) ||
    Math.abs(Math.hypot(...embedding) - 1) > 1e-4) {
    throw new ServiceUnavailableException();
  }
  return embedding as number[];
}

function templateSecret() {
  const key = process.env.FACE_TEMPLATE_KEY;
  const kid = process.env.FACE_TEMPLATE_KID;
  if (!key || !/^[a-f0-9]{64}$/.test(key) || !kid) throw new ServiceUnavailableException();
  return { key: Buffer.from(key, 'hex'), kid };
}

export async function createEncryptedFaceTemplate(image: Buffer, userId: number, faceId: string) {
  const embedding = await readEmbedding(image);
  const { key, kid } = templateSecret();
  const version = embeddingVersion;
  const bytes = Buffer.alloc(128 * 4);
  embedding.forEach((value: number, index) => bytes.writeFloatLE(value, index * 4));
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify([userId, faceId, version, kid])));
  try {
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return { version, kid, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  } finally {
    bytes.fill(0);
  }
}

export async function matchesFaceTemplate(image: Buffer, userId: number, faceId: string, template: unknown) {
  const { key, kid } = templateSecret();
  if (!template || typeof template !== 'object') throw new ServiceUnavailableException();
  const { version, kid: storedKid, nonce, tag, ciphertext } = template as Record<string, unknown>;
  if (version !== embeddingVersion || storedKid !== kid ||
    typeof nonce !== 'string' || typeof tag !== 'string' || typeof ciphertext !== 'string') throw new ServiceUnavailableException();
  const iv = Buffer.from(nonce, 'base64');
  const authTag = Buffer.from(tag, 'base64');
  const encrypted = Buffer.from(ciphertext, 'base64');
  if (iv.length !== 12 || authTag.length !== 16 || encrypted.length !== 512) throw new ServiceUnavailableException();

  const embedding = await readEmbedding(image);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(JSON.stringify([userId, faceId, version, kid])));
  decipher.setAuthTag(authTag);
  const plaintext = decipher.update(encrypted);
  try {
    decipher.final();
    let dot = 0;
    let norm = 0;
    for (let index = 0; index < 128; index++) {
      const value = plaintext.readFloatLE(index * 4);
      dot += value * embedding[index];
      norm += value * value;
    }
    if (!Number.isFinite(norm) || Math.abs(Math.sqrt(norm) - 1) > 1e-4) throw new ServiceUnavailableException();
    return dot / (Math.sqrt(norm) * Math.hypot(...embedding)) >= demoFaceThreshold;
  } finally {
    plaintext.fill(0);
  }
}
