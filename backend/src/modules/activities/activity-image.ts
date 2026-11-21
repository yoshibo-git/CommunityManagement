import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const mimeTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const directory = () => resolve(process.env.ACTIVITY_IMAGE_DIR || 'storage/private/activities');
const imageKey = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const planKey = /^[a-f0-9-]{36}\.(pdf|xls|xlsx)$/;
export const activityImageLimit = 10 * 1024 * 1024;
export const activityPlanLimit = 5 * 1024 * 1024;
export type ActivityImageUpload = { originalname: string; mimetype: string; buffer: Buffer };
export const activityImageUrl = (id: number, key: string | null) => {
  const file = key?.split('|')[0];
  return file && imageKey.test(file) ? `/api/backend/activities/${id}/image?v=${file}` : null;
};
export const activityImageName = (key: string | null) => {
  if (!key) return null;
  const [file, name] = key.split('|');
  return imageKey.test(file) ? name || `Ảnh minh họa${extname(file)}` : null;
};
export const activityPlanUrl = (id: number, key: string | null) => key && planKey.test(key.split('|')[0]) ? `/api/backend/activities/${id}/plan` : null;
export const activityPlanName = (key: string | null) => {
  if (!key) return null;
  const [file, name] = key.split('|');
  return planKey.test(file) ? name || `Kế hoạch hoạt động${extname(file)}` : null;
};

export async function storeActivityImage({ originalname, mimetype, buffer }: ActivityImageUpload) {
  const ext = extname(originalname).toLowerCase().slice(1).replace(/^jpeg$/, 'jpg') as keyof typeof mimeTypes;
  const signature = ext === 'jpg' ? buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) :
    ext === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
      ext === 'webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!signature || mimeTypes[ext] !== mimetype || buffer.length > activityImageLimit) {
    throw new BadRequestException({ code: 'INVALID_ACTIVITY_IMAGE', message: 'Chọn ảnh JPG, PNG hoặc WebP hợp lệ, tối đa 10 MB.' });
  }
  return writeNamedActivityFile(buffer, ext, originalname);
}

export async function storeActivityPlan({ originalname, mimetype, buffer }: ActivityImageUpload) {
  const ext = extname(originalname).toLowerCase().slice(1);
  const valid = ext === 'pdf' ? mimetype === 'application/pdf' && buffer.toString('ascii', 0, 5) === '%PDF-' :
    ext === 'xls' ? mimetype === 'application/vnd.ms-excel' && buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) :
      ext === 'xlsx' && mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) && buffer.includes(Buffer.from('xl/workbook.xml'));
  if (!valid || buffer.length > activityPlanLimit) throw new BadRequestException({
    code: 'INVALID_ACTIVITY_PLAN', message: 'Chọn tệp PDF, XLS hoặc XLSX hợp lệ, tối đa 5 MB.',
  });
  return writeNamedActivityFile(buffer, ext, originalname);
}

async function writeNamedActivityFile(buffer: Buffer, ext: string, originalname: string) {
  let name = originalname;
  try { name = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(originalname, 'latin1')); } catch { /* Keep the original name. */ }
  const safeName = [...name].filter((character) => character.charCodeAt(0) >= 32 && !'|/\\'.includes(character)).slice(0, 180).join('');
  return `${await writeActivityFile(buffer, ext)}|${safeName}`;
}

async function writeActivityFile(buffer: Buffer, ext: string) {
  const key = `${randomUUID()}.${ext}`;
  let created = false;
  try {
    await mkdir(directory(), { recursive: true, mode: 0o700 });
    const file = await open(join(directory(), key), 'wx', 0o600);
    created = true;
    try { await file.writeFile(buffer); }
    finally { await file.close(); }
    return key;
  } catch {
    if (created) await discardActivityImage(key);
    throw new ServiceUnavailableException();
  }
}

export async function discardActivityImage(key: string | null | undefined) {
  const file = key?.split('|')[0];
  if (file && (imageKey.test(file) || planKey.test(file))) await unlink(join(directory(), file)).catch(() => undefined);
}

export async function readActivityPlan(key: string | null) {
  const file = key?.split('|')[0];
  if (!file || !planKey.test(file)) throw new NotFoundException();
  return { data: await readActivityFile(file), extension: extname(file), name: activityPlanName(key) };
}

export async function readActivityImage(key: string | null) {
  const file = key?.split('|')[0];
  if (!file || !imageKey.test(file)) throw new NotFoundException();
  return { data: await readActivityFile(file), mime: mimeTypes[extname(file).slice(1) as keyof typeof mimeTypes] };
}

async function readActivityFile(key: string) {
  try {
    return await readFile(join(directory(), key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException();
    throw new ServiceUnavailableException();
  }
}
