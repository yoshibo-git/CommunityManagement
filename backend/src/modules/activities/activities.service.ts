import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AuthService, Principal } from '../auth/auth.service';
import type { DraftDto } from './activities.controller';
import { activityImageName, activityImageUrl, discardActivityImage, readActivityImage, storeActivityImage, type ActivityImageUpload } from './activity-image';
import { activityPlanName, activityPlanUrl, readActivityPlan, storeActivityPlan } from './activity-image';

const revision = (row: unknown) => createHash('sha256').update(JSON.stringify(row)).digest('hex');
const beforeRegistrationDeadline = (startAt: Date) => {
  const day = 86400000;
  const offset = 7 * 3600000;
  return Date.now() < (Math.floor((startAt.getTime() + offset) / day) - 1) * day - offset;
};

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  async assignees(user: Principal, search = '', role?: 'staff') {
    if (user.role !== 'staff') throw new ForbiddenException();
    return this.prisma.nguoi_dung.findMany({ where: { trang_thai: 'active', vai_tro: { ten_vai_tro: { in: role ? [role] : ['user', 'staff'] } }, OR: [{ ten_dang_nhap: { contains: search } }, { ho_ten: { contains: search } }] }, take: 20, orderBy: { ten_dang_nhap: 'asc' }, select: { id_nguoi_dung: true, ten_dang_nhap: true, ho_ten: true } });
  }
  async read(user: Principal, id: number) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new BadRequestException();
    if (user.role !== 'staff') throw new ForbiddenException();
    const row = await this.prisma.hoat_dong.findFirst({ where: { id_hoat_dong: id, id_nguoi_tao: user.id }, include: { chi_tiet_hoat_dong: true } });
    if (!row) throw new NotFoundException();
    const detail = row.chi_tiet_hoat_dong;
    return { id, status: row.trang_thai, editable: row.trang_thai === 'draft', revision: revision(row), imageUrl: activityImageUrl(id, row.hinh_anh), imageName: activityImageName(row.hinh_anh),
      planUrl: activityPlanUrl(id, row.ke_hoach_hoat_dong), planName: activityPlanName(row.ke_hoach_hoat_dong),
      locationNote: detail?.ghi_chu_dia_diem ?? null,
      name: row.ten_hoat_dong, description: row.mo_ta, capacity: row.gioi_han_dang_ky, points: row.diem_hoat_dong,
      startAt: detail?.thoi_gian_bat_dau.toISOString() ?? null, endAt: detail?.thoi_gian_ket_thuc.toISOString() ?? null,
      location: detail?.dia_diem ?? null, latitude: detail?.vi_do ? Number(detail.vi_do) : null, longitude: detail?.kinh_do ? Number(detail.kinh_do) : null, requiresCheckout: detail?.yeu_cau_check_out ?? false,
    };
  }
  async plan(user: Principal, id: number) {
    if (user.role !== 'staff') throw new ForbiddenException();
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new NotFoundException();
    const row = await this.prisma.hoat_dong.findFirst({ where: { id_hoat_dong: id, id_nguoi_tao: user.id }, select: { ke_hoach_hoat_dong: true } });
    return readActivityPlan(row?.ke_hoach_hoat_dong ?? null);
  }
  async image(request: IncomingMessage, id: number) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new NotFoundException();
    const row = await this.prisma.hoat_dong.findUnique({ where: { id_hoat_dong: id }, select: {
      hinh_anh: true, trang_thai: true, id_nguoi_tao: true,
    } });
    if (!row?.hinh_anh) throw new NotFoundException();
    if (!['published', 'pending', 'progress', 'pending_completed', 'completed', 'issues'].includes(row.trang_thai)) {
      let user: Principal;
      try { user = await this.auth.current(request); }
      catch (error) { if (error instanceof UnauthorizedException) throw new NotFoundException(); throw error; }
      if (!['cancelled', 'pending_issues'].includes(row.trang_thai) && !(user.role === 'staff' && row.id_nguoi_tao === user.id)) {
        throw new NotFoundException();
      }
    }
    return readActivityImage(row.hinh_anh);
  }
  async removeDraft(user: Principal, id: number) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new BadRequestException();
    if (user.role !== 'staff') throw new ForbiddenException();
    const image = await this.prisma.runInTransaction(async (tx) => {
      await this.auth.lockForWrite(tx, user, 'staff');
      await tx.$queryRaw`SELECT id_hoat_dong FROM hoat_dong WHERE id_hoat_dong = ${id} FOR UPDATE`;
      const where = { id_hoat_dong: id };
      const draft = await tx.hoat_dong.findFirst({
        where: { ...where, id_nguoi_tao: user.id },
        select: { trang_thai: true, id_de_xuat: true, ke_hoach_hoat_dong: true, hinh_anh: true, chi_tiet_hoat_dong: { select: { id_chi_tiet_hoat_dong: true } } },
      });
      if (!draft) throw new NotFoundException();
      if (draft.trang_thai !== 'draft') throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Chỉ có thể xóa bản nháp.' });
      if (draft.id_de_xuat !== null || draft.ke_hoach_hoat_dong !== null) throw new ConflictException({
        code: 'STATE_CONFLICT', message: draft.id_de_xuat !== null ? 'Bản nháp liên kết với đề xuất nên không thể xóa.' : 'Bản nháp có tệp kế hoạch đã lưu nên không thể xóa.',
      });
      const detailId = draft.chi_tiet_hoat_dong?.id_chi_tiet_hoat_dong;
      if (detailId !== undefined) {
        await tx.$queryRaw`SELECT id_chi_tiet_hoat_dong FROM chi_tiet_hoat_dong WHERE id_chi_tiet_hoat_dong = ${detailId} FOR UPDATE`;
      }
      const linked = await tx.hoat_dong.findUniqueOrThrow({ where, select: {
        _count: { select: { dang_ky_hoat_dong: true, thong_bao: true } },
        chi_tiet_hoat_dong: { select: { _count: { select: { phan_cong_nhiem_vu: true, phien_diem_danh: true } } } },
      } });
      if (linked._count.dang_ky_hoat_dong || linked._count.thong_bao ||
        linked.chi_tiet_hoat_dong?._count.phan_cong_nhiem_vu || linked.chi_tiet_hoat_dong?._count.phien_diem_danh) {
        throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Bản nháp đã có dữ liệu liên quan nên không thể xóa.' });
      }
      await tx.hoat_dong.delete({ where });
      return draft.hinh_anh;
    });
    await discardActivityImage(image);
    return { deleted: true };
  }

  async completeTask(user: Principal, id: number, taskId: number) {
    if (user.role !== 'staff') throw new ForbiddenException();
    if ([id, taskId].some((value) => !Number.isSafeInteger(value) || value < 1 || value > 4294967295)) throw new BadRequestException();
    return this.prisma.runInTransaction(async (tx) => {
      await this.auth.lockForWrite(tx, user, 'staff');
      await tx.$queryRaw`SELECT id_hoat_dong FROM hoat_dong WHERE id_hoat_dong = ${id} FOR UPDATE`;
      const row = await tx.hoat_dong.findFirst({ where: { id_hoat_dong: id, id_nguoi_tao: user.id }, include: { chi_tiet_hoat_dong: true } });
      if (!row?.chi_tiet_hoat_dong) throw new NotFoundException();
      if (['draft', 'cancelled', 'issues'].includes(row.trang_thai)) throw new ConflictException();
      const task = await tx.phan_cong_nhiem_vu.findFirst({
        where: { id_phan_cong: taskId, id_chi_tiet_hoat_dong: row.chi_tiet_hoat_dong.id_chi_tiet_hoat_dong, trang_thai: { in: ['assigned', 'in_progress', 'pending_review', 'completed'] } },
        select: { trang_thai: true },
      });
      if (!task) throw new NotFoundException();
      if (task.trang_thai !== 'completed') {
        await tx.phan_cong_nhiem_vu.update({ where: { id_phan_cong: taskId }, data: { trang_thai: 'completed' } });
      }
      return { id: taskId, status: 'completed' };
    });
  }

  async cancel(user: Principal, id: number, reason: string) {
    if (user.role !== 'staff') throw new ForbiddenException();
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new BadRequestException();
    return this.prisma.runInTransaction(async (tx) => {
      await this.auth.lockForWrite(tx, user, 'staff');
      await tx.$queryRaw`SELECT id_hoat_dong FROM hoat_dong WHERE id_hoat_dong = ${id} FOR UPDATE`;
      const where = { id_hoat_dong: id };
      const activity = await tx.hoat_dong.findFirst({ where: { ...where, id_nguoi_tao: user.id }, include: {
        dang_ky_hoat_dong: { where: { trang_thai: 'registered' }, select: { id_nguoi_dung: true } },
        chi_tiet_hoat_dong: { include: { phan_cong_nhiem_vu: { select: { id_nguoi_dung: true } } } },
      } });
      if (!activity) throw new NotFoundException();
      const detail = activity.chi_tiet_hoat_dong;
      if (activity.trang_thai !== 'published' || !detail || !beforeRegistrationDeadline(detail.thoi_gian_bat_dau)) {
        throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Chỉ có thể hủy hoạt động còn mở đăng ký.' });
      }
      await tx.hoat_dong.update({ where, data: { trang_thai: 'cancelled' } });
      const recipients = new Set([...activity.dang_ky_hoat_dong, ...(detail?.phan_cong_nhiem_vu ?? [])].map((row) => row.id_nguoi_dung));
      if (recipients.size) {
        await tx.thong_bao.create({ data: {
          id_hoat_dong: id, loai_thong_bao: 'NOTI-01', tieu_de: 'Hoạt động đã hủy bỏ',
          noi_dung: `${activity.ten_hoat_dong}. Lý do: ${reason}`,
          nguoi_nhan_thong_bao: { create: [...recipients].map((id_nguoi_dung) => ({ id_nguoi_dung })) },
        } });
      }
      return { id, status: 'cancelled' };
    });
  }

  async updatePublishedDetails(user: Principal, id: number, body: { name: string; description?: string | null; locationNote?: string | null; revision: string }) {
    if (user.role !== 'staff') throw new ForbiddenException();
    if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw new BadRequestException();
    return this.prisma.runInTransaction(async (tx) => {
      await this.auth.lockForWrite(tx, user, 'staff');
      await tx.$queryRaw`SELECT id_hoat_dong FROM hoat_dong WHERE id_hoat_dong = ${id} FOR UPDATE`;
      const where = { id_hoat_dong: id };
      const row = await tx.hoat_dong.findFirst({ where: { ...where, id_nguoi_tao: user.id }, include: { chi_tiet_hoat_dong: true } });
      if (!row) throw new NotFoundException();
      if (row.trang_thai !== 'published' || !row.chi_tiet_hoat_dong || !beforeRegistrationDeadline(row.chi_tiet_hoat_dong.thoi_gian_bat_dau) || revision(row) !== body.revision) {
        throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Hoạt động đã thay đổi hoặc đã ngừng đăng ký. Vui lòng tải lại.' });
      }
      const name = body.name.trim();
      await tx.hoat_dong.update({ where, data: { ten_hoat_dong: name, ...(body.description !== undefined && { mo_ta: body.description?.trim() || null }) } });
      if (body.locationNote !== undefined) await tx.chi_tiet_hoat_dong.update({
        where, data: { ghi_chu_dia_diem: body.locationNote?.trim() || null },
      });
      if (name !== row.ten_hoat_dong) {
        const recipients = await tx.dang_ky_hoat_dong.findMany({ where: { ...where, trang_thai: 'registered' }, select: { id_nguoi_dung: true } });
        if (recipients.length) await tx.thong_bao.create({ data: {
          id_hoat_dong: id, loai_thong_bao: 'NOTI-02', tieu_de: 'Tên hoạt động đã thay đổi', noi_dung: `Tên mới: ${name}`,
          nguoi_nhan_thong_bao: { create: recipients },
        } });
      }
      return { id, status: 'published' };
    });
  }

  async save(user: Principal, body: DraftDto, id?: number, expectedRevision?: string, image?: ActivityImageUpload, plan?: ActivityImageUpload) {
    if (id !== undefined && (!Number.isSafeInteger(id) || id < 1 || id > 4294967295)) throw new BadRequestException();
    if (user.role !== 'staff') throw new ForbiddenException();
    if (body.assignments?.some((row) => !row)) throw new BadRequestException();
    if ((body.assignments?.map(({ type }) => type) ?? body.assignmentTypes ?? []).filter((type) => type === 'leader').length > 1) {
      throw new BadRequestException({ code: 'DUPLICATE_LEADER', message: 'Mỗi hoạt động chỉ có thể có một nhiệm vụ Trưởng BTC.' });
    }
    if (body.publish && body.assignments?.filter(({ type }) => type === 'leader').length !== 1) {
      throw new BadRequestException({ code: 'LEADER_REQUIRED', message: 'Chọn đúng một nhiệm vụ Trưởng BTC trước khi công bố.' });
    }
    if ((image && body.removeImage) || (plan && body.removePlan)) throw new BadRequestException();
    let imageKey: string | null | undefined;
    let planKey: string | null | undefined;
    try {
      imageKey = image ? await storeActivityImage(image) : body.removeImage ? null : undefined;
      planKey = plan ? await storeActivityPlan(plan) : body.removePlan ? null : undefined;
      const result = await this.saveDraft(user, body, id, expectedRevision, imageKey, planKey);
      await Promise.all([discardActivityImage(result.previousImage), discardActivityImage(result.previousPlan)]);
      return { id: result.id, status: body.publish ? 'published' : 'draft' };
    } catch (error) {
      for (const key of [imageKey, planKey]) {
        if (!key) continue;
        const referenced = await this.prisma.hoat_dong.findFirst({ where: { OR: [{ hinh_anh: key }, { ke_hoach_hoat_dong: key }] }, select: { id_hoat_dong: true } }).catch(() => undefined);
        if (referenced === null) await discardActivityImage(key);
      }
      throw error;
    }
  }

  private saveDraft(user: Principal, body: DraftDto, id?: number, expectedRevision?: string, imageKey?: string | null, planKey?: string | null) {
    return this.prisma.runInTransaction(async (tx) => {
      let previousImage: string | null = null;
      let previousPlan: string | null = null;
      const ids = [...new Set(body.assignments?.map(({ userId }) => userId))];
      if (body.publish) {
        const lockIds = [...new Set([user.id, ...ids])].sort((a, b) => a - b);
        await tx.$queryRaw`SELECT id_nguoi_dung FROM nguoi_dung WHERE id_nguoi_dung IN (${Prisma.join(lockIds)}) ORDER BY id_nguoi_dung FOR UPDATE`;
      }
      await this.auth.lockForWrite(tx, user, 'staff');
      const people = ids.length ? await tx.nguoi_dung.findMany({ where: {
        id_nguoi_dung: { in: ids }, trang_thai: 'active', vai_tro: { ten_vai_tro: { in: ['user', 'staff'] } },
      }, select: { id_nguoi_dung: true, vai_tro: { select: { ten_vai_tro: true } } } }) : [];
      if (ids.length !== people.length) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Người phụ trách đã chọn không còn khả dụng.' });
      const leader = body.assignments?.find(({ type }) => type === 'leader');
      if (leader && !people.some((person) => person.id_nguoi_dung === leader.userId && person.vai_tro.ten_vai_tro === 'staff')) {
        throw new BadRequestException({ code: 'INVALID_LEADER_ROLE', message: 'Trưởng BTC phải là tài khoản Quản lý đang hoạt động.' });
      }
      let existingPlan: string | null = null;
      if (id !== undefined) {
        await tx.$queryRaw`SELECT id_hoat_dong FROM hoat_dong WHERE id_hoat_dong = ${id} FOR UPDATE`;
        const current = await tx.hoat_dong.findFirst({ where: { id_hoat_dong: id, id_nguoi_tao: user.id }, include: { chi_tiet_hoat_dong: true } });
        if (!current) throw new NotFoundException();
        if (current.trang_thai !== 'draft' || revision(current) !== expectedRevision) throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Hoạt động đã thay đổi hoặc không còn là bản nháp. Vui lòng tải lại.' });
        if (imageKey !== undefined) previousImage = current.hinh_anh;
        existingPlan = current.ke_hoach_hoat_dong;
        if (planKey !== undefined) previousPlan = existingPlan;
        if (current.chi_tiet_hoat_dong && (await tx.phan_cong_nhiem_vu.count({ where: { id_chi_tiet_hoat_dong: current.chi_tiet_hoat_dong.id_chi_tiet_hoat_dong } }) || await tx.phien_diem_danh.count({ where: { id_chi_tiet_hoat_dong: current.chi_tiet_hoat_dong.id_chi_tiet_hoat_dong } }))) throw new ConflictException();
        const detail = current.chi_tiet_hoat_dong;
        body = { ...body,
          description: body.description === undefined ? current.mo_ta : body.description,
          capacity: body.capacity === undefined ? current.gioi_han_dang_ky : body.capacity,
          points: body.points ?? current.diem_hoat_dong,
          startAt: body.startAt === undefined ? detail?.thoi_gian_bat_dau.toISOString() ?? null : body.startAt,
          endAt: body.endAt === undefined ? detail?.thoi_gian_ket_thuc.toISOString() ?? null : body.endAt,
          location: body.location === undefined ? detail?.dia_diem ?? null : body.location,
          locationNote: body.locationNote === undefined ? detail?.ghi_chu_dia_diem ?? null : body.locationNote,
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
      if (body.publish && (!hasDates || !body.location?.trim() || body.latitude == null || body.longitude == null ||
        !(planKey === undefined ? existingPlan : planKey) || !beforeRegistrationDeadline(new Date(body.startAt!)))) {
        throw new BadRequestException({ code: 'PUBLISH_INCOMPLETE', message: 'Nhập lịch còn hạn đăng ký, địa điểm, ghim tọa độ và tải tệp kế hoạch trước khi công bố.' });
      }
      if (body.publish && id !== undefined && await tx.dang_ky_hoat_dong.count({ where: { id_hoat_dong: id, id_nguoi_dung: { in: ids }, trang_thai: 'registered' } })) {
        throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Người phụ trách đã đăng ký tham gia hoạt động này.' });
      }
      if (body.publish) {
        const start = new Date(body.startAt!), end = new Date(body.endAt!);
        const clashes = await tx.phan_cong_nhiem_vu.count({ where: {
          id_nguoi_dung: { in: ids }, chi_tiet_hoat_dong: {
            thoi_gian_bat_dau: { lt: end }, thoi_gian_ket_thuc: { gt: start },
            hoat_dong: { trang_thai: { in: ['published', 'pending', 'progress', 'pending_issues', 'pending_completed'] } },
          },
        } });
        if (clashes) {
          throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Người phụ trách có lịch trùng với hoạt động khác.' });
        }
      }
      const data = { ten_hoat_dong: body.name, mo_ta: body.description?.trim() || null, gioi_han_dang_ky: body.capacity ?? null, diem_hoat_dong: body.points ?? 0, ...(imageKey !== undefined && { hinh_anh: imageKey }), ...(planKey !== undefined && { ke_hoach_hoat_dong: planKey }) };
      const row = id === undefined ? await tx.hoat_dong.create({ data: { ...data, id_nguoi_tao: user.id, trang_thai: 'draft' } }) : await tx.hoat_dong.update({ where: { id_hoat_dong: id }, data });
      if (hasDates) {
        const detail = { thoi_gian_bat_dau: new Date(body.startAt!), thoi_gian_ket_thuc: new Date(body.endAt!), dia_diem: body.location ?? null, ghi_chu_dia_diem: body.locationNote?.trim() || null, vi_do: body.latitude ?? null, kinh_do: body.longitude ?? null, yeu_cau_check_out: body.requiresCheckout ?? false };
        const savedDetail = await tx.chi_tiet_hoat_dong.upsert({ where: { id_hoat_dong: row.id_hoat_dong }, create: { ...detail, id_hoat_dong: row.id_hoat_dong }, update: detail });
        if (body.publish) {
          await tx.phan_cong_nhiem_vu.createMany({ data: body.assignments!.map((task) => ({
            id_chi_tiet_hoat_dong: savedDetail.id_chi_tiet_hoat_dong, id_nguoi_dung: task.userId,
            ten_nhiem_vu: task.name.trim(), mo_ta_nhiem_vu: task.description?.trim() || null, loai_nhiem_vu: task.type, trang_thai: 'assigned',
          })) });
          await tx.hoat_dong.update({ where: { id_hoat_dong: row.id_hoat_dong }, data: { trang_thai: 'published' } });
          await tx.thong_bao.create({ data: {
            id_hoat_dong: row.id_hoat_dong, loai_thong_bao: 'NOTI-03', tieu_de: 'Bạn được phân công nhiệm vụ',
            noi_dung: row.ten_hoat_dong, nguoi_nhan_thong_bao: { create: ids.map((id_nguoi_dung) => ({ id_nguoi_dung })) },
          } });
        }
      } else {
        if (body.location || body.locationNote || body.latitude != null || body.longitude != null || body.requiresCheckout) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Nhập đủ lịch trước khi lưu địa điểm, tọa độ hoặc yêu cầu Checkout.' });
        await tx.chi_tiet_hoat_dong.deleteMany({ where: { id_hoat_dong: row.id_hoat_dong } });
      }
      return { id: row.id_hoat_dong, previousImage, previousPlan };
    });
  }
}
