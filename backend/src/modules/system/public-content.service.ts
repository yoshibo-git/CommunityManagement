import { BadRequestException, Injectable } from '@nestjs/common';
import { activityImageUrl } from '../activities/activity-image';
import sanitize from 'sanitize-html';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PublicContentService {
  constructor(private readonly prisma: PrismaService) {}
  async feed(search?: string, cursor?: string) {
    let before: { at: Date; id: number } | undefined;
    if (cursor) {
      const [at, rawId, extra] = cursor.split('_');
      const id = Number(rawId);
      if (extra !== undefined || !at || !/^\d+$/.test(rawId ?? '') || !Number.isSafeInteger(id) || id < 1 || id > 4294967295 || Number.isNaN(Date.parse(at))) throw new BadRequestException();
      before = { at: new Date(at), id };
    }
    const records = await this.prisma.bai_dang.findMany({
      where: { trang_thai: 'published', thoi_gian_dang: { not: null }, ...(search ? { tieu_de: { contains: search } } : {}),
        ...(before ? { OR: [{ thoi_gian_dang: { lt: before.at } }, { thoi_gian_dang: before.at, id_bai_dang: { lt: before.id } }] } : {}),
      },
      orderBy: [{ thoi_gian_dang: 'desc' }, { id_bai_dang: 'desc' }], take: 11,
      select: { id_bai_dang: true, tieu_de: true, noi_dung: true, thoi_gian_dang: true, nguoi_dung: { select: { ho_ten: true } } },
    });
    const items = records.slice(0, 10).map((row) => {
      const body = JSON.parse(row.noi_dung) as { v: unknown; html: unknown; lastEditedAt: unknown };
      if (body.v !== 1 || typeof body.html !== 'string' || (body.lastEditedAt !== null && (typeof body.lastEditedAt !== 'string' || Number.isNaN(Date.parse(body.lastEditedAt))))) throw new Error('Invalid post content.');
      return { id: row.id_bai_dang, title: row.tieu_de, html: sanitize(body.html), author: row.nguoi_dung.ho_ten, publishedAt: row.thoi_gian_dang!.toISOString(), editedAt: body.lastEditedAt };
    });
    const last = items.at(-1);
    return { items, nextCursor: records.length > 10 && last ? `${last.publishedAt}_${last.id}` : null };
  }
  async activities() {
    const records = await this.prisma.hoat_dong.findMany({ where: { trang_thai: { in: ['published', 'pending', 'progress'] } }, orderBy: { id_hoat_dong: 'desc' }, take: 10,
      select: { id_hoat_dong: true, ten_hoat_dong: true, trang_thai: true, hinh_anh: true, chi_tiet_hoat_dong: { select: { dia_diem: true, thoi_gian_bat_dau: true } } },
    });
    return { items: records.map((row) => ({ id: row.id_hoat_dong, name: row.ten_hoat_dong, status: row.trang_thai, imageUrl: activityImageUrl(row.id_hoat_dong, row.hinh_anh), location: row.chi_tiet_hoat_dong?.dia_diem ?? null, startAt: row.chi_tiet_hoat_dong?.thoi_gian_bat_dau.toISOString() ?? null })) };
  }
}
