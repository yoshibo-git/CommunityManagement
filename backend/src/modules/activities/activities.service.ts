import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, Principal } from '../auth/auth.service';
import type { DraftDto } from './activities.controller';

const revision = (row: unknown) => createHash('sha256').update(JSON.stringify(row)).digest('hex');

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  async assignees(user: Principal, search = '') {
    if (user.role !== 'staff') throw new ForbiddenException();
    return this.prisma.nguoi_dung.findMany({ where: { trang_thai: 'active', vai_tro: { ten_vai_tro: { in: ['user', 'staff'] } }, OR: [{ ten_dang_nhap: { contains: search } }, { ho_ten: { contains: search } }] }, take: 20, orderBy: { ten_dang_nhap: 'asc' }, select: { id_nguoi_dung: true, ten_dang_nhap: true, ho_ten: true } });
  }
  async read(user: Principal, id: number) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new BadRequestException();
    if (user.role !== 'staff') throw new ForbiddenException();
    const row = await this.prisma.hoat_dong.findFirst({ where: { id_hoat_dong: id, id_nguoi_tao: user.id }, include: { chi_tiet_hoat_dong: true } });
    if (!row) throw new NotFoundException();
    const detail = row.chi_tiet_hoat_dong;
    return { id, status: row.trang_thai, editable: row.trang_thai === 'draft', revision: revision(row),
      name: row.ten_hoat_dong, description: row.mo_ta, capacity: row.gioi_han_dang_ky, points: row.diem_hoat_dong,
      startAt: detail?.thoi_gian_bat_dau.toISOString() ?? null, endAt: detail?.thoi_gian_ket_thuc.toISOString() ?? null,
      location: detail?.dia_diem ?? null, latitude: detail?.vi_do ? Number(detail.vi_do) : null, longitude: detail?.kinh_do ? Number(detail.kinh_do) : null, requiresCheckout: detail?.yeu_cau_check_out ?? false,
    };
  }
  async save(user: Principal, body: DraftDto, id?: number, expectedRevision?: string) {
    if (id !== undefined && (!Number.isSafeInteger(id) || id < 1 || id > 4294967295)) throw new BadRequestException();
    if (user.role !== 'staff') throw new ForbiddenException();
    return this.prisma.runInTransaction(async (tx) => {
      await this.auth.lockForWrite(tx, user, 'staff');
      if (id !== undefined) {
        await tx.$queryRaw`SELECT id_hoat_dong FROM hoat_dong WHERE id_hoat_dong = ${id} FOR UPDATE`;
        const current = await tx.hoat_dong.findFirst({ where: { id_hoat_dong: id, id_nguoi_tao: user.id }, include: { chi_tiet_hoat_dong: true } });
        if (!current) throw new NotFoundException();
        if (current.trang_thai !== 'draft' || revision(current) !== expectedRevision) throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Hoạt động đã thay đổi hoặc không còn là bản nháp. Vui lòng tải lại.' });
        if (current.chi_tiet_hoat_dong && (await tx.phan_cong_nhiem_vu.count({ where: { id_chi_tiet_hoat_dong: current.chi_tiet_hoat_dong.id_chi_tiet_hoat_dong } }) || await tx.phien_diem_danh.count({ where: { id_chi_tiet_hoat_dong: current.chi_tiet_hoat_dong.id_chi_tiet_hoat_dong } }))) throw new ConflictException();
        const detail = current.chi_tiet_hoat_dong;
        body = { ...body,
          description: body.description === undefined ? current.mo_ta : body.description,
          capacity: body.capacity === undefined ? current.gioi_han_dang_ky : body.capacity,
          points: body.points ?? current.diem_hoat_dong,
          startAt: body.startAt === undefined ? detail?.thoi_gian_bat_dau.toISOString() ?? null : body.startAt,
          endAt: body.endAt === undefined ? detail?.thoi_gian_ket_thuc.toISOString() ?? null : body.endAt,
          location: body.location === undefined ? detail?.dia_diem ?? null : body.location,
          latitude: body.latitude === undefined ? detail?.vi_do == null ? null : Number(detail.vi_do) : body.latitude,
          longitude: body.longitude === undefined ? detail?.kinh_do == null ? null : Number(detail.kinh_do) : body.longitude,
          requiresCheckout: body.requiresCheckout ?? detail?.yeu_cau_check_out ?? false,
        };
      }
      const hasDates = !!body.startAt && !!body.endAt;
      if (hasDates && [body.startAt!, body.endAt!].some((value) => { const year = new Date(value).getUTCFullYear(); return year < 1000 || year > 9999; })) throw new BadRequestException();
      if (!!body.startAt !== !!body.endAt || (hasDates && (new Date(body.endAt!).getTime() <= new Date(body.startAt!).getTime() || !/(Z|[+-]\d\d:\d\d)$/.test(body.startAt!) || !/(Z|[+-]\d\d:\d\d)$/.test(body.endAt!)))) {
        throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Nhập đủ thời gian bắt đầu/kết thúc có múi giờ; thời gian kết thúc phải sau bắt đầu.' });
      }
      const data = { ten_hoat_dong: body.name, mo_ta: body.description ?? null, gioi_han_dang_ky: body.capacity ?? null, diem_hoat_dong: body.points ?? 0 };
      const row = id === undefined ? await tx.hoat_dong.create({ data: { ...data, id_nguoi_tao: user.id, trang_thai: 'draft' } }) : await tx.hoat_dong.update({ where: { id_hoat_dong: id }, data });
      if (hasDates) {
        const detail = { thoi_gian_bat_dau: new Date(body.startAt!), thoi_gian_ket_thuc: new Date(body.endAt!), dia_diem: body.location ?? null, vi_do: body.latitude ?? null, kinh_do: body.longitude ?? null, yeu_cau_check_out: body.requiresCheckout ?? false };
        await tx.chi_tiet_hoat_dong.upsert({ where: { id_hoat_dong: row.id_hoat_dong }, create: { ...detail, id_hoat_dong: row.id_hoat_dong }, update: detail });
      } else {
        if (body.location || body.latitude != null || body.longitude != null || body.requiresCheckout) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Nhập đủ lịch trước khi lưu địa điểm, tọa độ hoặc yêu cầu Checkout.' });
        await tx.chi_tiet_hoat_dong.deleteMany({ where: { id_hoat_dong: row.id_hoat_dong } });
      }
      return { id: row.id_hoat_dong, status: 'draft' };
    });
  }
}
