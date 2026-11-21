import { Injectable } from '@nestjs/common';
import { activityImageUrl } from '../activities/activity-image';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, Principal } from '../auth/auth.service';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  async updatePhone(user: Principal, phone: string | null) {
    return this.prisma.runInTransaction(async (tx) => {
      await this.auth.lockForWrite(tx, user, user.role);
      const updated = await tx.nguoi_dung.update({
        where: { id_nguoi_dung: user.id }, data: { so_dien_thoai: phone }, select: { so_dien_thoai: true },
      });
      return { phone: updated.so_dien_thoai };
    });
  }

  async notifications(userId: number) {
    const rows = await this.prisma.nguoi_nhan_thong_bao.findMany({ where: { id_nguoi_dung: userId }, orderBy: { id_thong_bao: 'desc' }, take: 10,
      select: { da_doc: true, thong_bao: { select: { id_thong_bao: true, tieu_de: true, noi_dung: true, thoi_gian_tao: true } } },
    });
    return rows.map((row) => ({ id: row.thong_bao.id_thong_bao, title: row.thong_bao.tieu_de, content: row.thong_bao.noi_dung, createdAt: row.thong_bao.thoi_gian_tao.toISOString(), read: row.da_doc }));
  }

  async read(user: Principal, includeAccounts = true) {
    const records = await this.prisma.hoat_dong.findMany({
      where: { OR: [{ trang_thai: { in: ['published', 'pending', 'progress', 'pending_completed', 'pending_issues', 'completed', 'cancelled', 'issues'] } }, ...(user.role === 'staff' ? [{ id_nguoi_tao: user.id }] : [])] },
      orderBy: { id_hoat_dong: 'asc' },
      select: {
        id_hoat_dong: true, id_nguoi_tao: true, ten_hoat_dong: true, mo_ta: true, trang_thai: true, gioi_han_dang_ky: true, diem_hoat_dong: true, hinh_anh: true,
        _count: { select: { dang_ky_hoat_dong: true } },
        dang_ky_hoat_dong: { where: { id_nguoi_dung: user.id }, select: { trang_thai: true } },
        chi_tiet_hoat_dong: { select: {
          thoi_gian_bat_dau: true, thoi_gian_ket_thuc: true, dia_diem: true, ghi_chu_dia_diem: true, yeu_cau_check_out: true,
          phien_diem_danh: { select: { loai_diem_danh: true, trang_thai: true, thoi_gian_bat_dau: true, thoi_gian_ket_thuc: true } },
          phan_cong_nhiem_vu: { where: { OR: [{ id_nguoi_dung: user.id }, ...(user.role === 'staff' ? [{ chi_tiet_hoat_dong: { hoat_dong: { id_nguoi_tao: user.id } } }] : [])] }, select: {
            id_phan_cong: true, id_nguoi_dung: true, ten_nhiem_vu: true, loai_nhiem_vu: true, trang_thai: true,
            thoi_gian_bat_dau: true, thoi_gian_ket_thuc: true, nguoi_dung: { select: { ho_ten: true } },
          } },
        } },
      },
    });
    const notifications = await this.prisma.nguoi_nhan_thong_bao.findMany({
      where: { id_nguoi_dung: user.id },
      orderBy: { id_thong_bao: 'desc' },
      select: { da_doc: true, thong_bao: { select: { id_thong_bao: true, tieu_de: true, noi_dung: true, thoi_gian_tao: true } } },
    });
    const evidence = await this.prisma.minh_chung_hoat_dong.findMany({
      where: { id_nguoi_nop: user.id }, orderBy: { id_minh_chung: 'desc' },
      select: { id_minh_chung: true, ten_hoat_dong: true, don_vi_to_chuc: true, ngay_tham_gia: true, trang_thai: true, ly_do_tu_choi: true, diem_minh_chung: { select: { so_diem: true } } },
    });
    return {
      serverTime: new Date().toISOString(),
      user,
      accounts: includeAccounts && user.role === 'admin' ? await this.prisma.nguoi_dung.findMany({ select: { id_nguoi_dung: true, ten_dang_nhap: true, ho_ten: true, email: true, trang_thai: true, vai_tro: { select: { ten_vai_tro: true } } }, orderBy: { id_nguoi_dung: 'asc' } }) : [],
      activities: records.map((row) => ({
        imageUrl: activityImageUrl(row.id_hoat_dong, row.hinh_anh),
        id: row.id_hoat_dong, name: row.ten_hoat_dong, status: row.trang_thai, ownerId: user.role === 'staff' ? row.id_nguoi_tao : undefined, description: row.mo_ta,
        startAt: row.chi_tiet_hoat_dong?.thoi_gian_bat_dau.toISOString() ?? null,
        endAt: row.chi_tiet_hoat_dong?.thoi_gian_ket_thuc.toISOString() ?? null,
        location: row.chi_tiet_hoat_dong?.dia_diem, locationNote: row.chi_tiet_hoat_dong?.ghi_chu_dia_diem, requiresCheckout: row.chi_tiet_hoat_dong?.yeu_cau_check_out ?? false,
        capacity: row.gioi_han_dang_ky, registrations: row._count.dang_ky_hoat_dong,
        points: row.diem_hoat_dong, registrationStatus: row.dang_ky_hoat_dong[0]?.trang_thai ?? null,
        awardedPoints: row.trang_thai === 'completed' && row.dang_ky_hoat_dong[0]?.trang_thai === 'completed' ? row.diem_hoat_dong : 0,
        sessions: row.chi_tiet_hoat_dong?.phien_diem_danh.map((session) => ({
          type: session.loai_diem_danh, status: session.trang_thai,
          startAt: session.thoi_gian_bat_dau.toISOString(), endAt: session.thoi_gian_ket_thuc.toISOString(),
        })) ?? [],
        assignments: row.chi_tiet_hoat_dong?.phan_cong_nhiem_vu.map((task) => ({
          id: task.id_phan_cong, name: task.ten_nhiem_vu, type: task.loai_nhiem_vu, assignee: task.nguoi_dung.ho_ten, status: task.trang_thai,
        })) ?? [],
        tasks: row.chi_tiet_hoat_dong?.phan_cong_nhiem_vu.filter((task) => task.id_nguoi_dung === user.id).map((task) => ({
          id: task.id_phan_cong, name: task.ten_nhiem_vu, status: task.trang_thai,
          startAt: task.thoi_gian_bat_dau?.toISOString() ?? null, endAt: task.thoi_gian_ket_thuc?.toISOString() ?? null,
        })) ?? [],
      })),
      notifications: notifications.map((row) => ({ id: row.thong_bao.id_thong_bao, title: row.thong_bao.tieu_de, content: row.thong_bao.noi_dung, createdAt: row.thong_bao.thoi_gian_tao.toISOString(), read: row.da_doc })),
      evidence: evidence.map((row) => ({ id: row.id_minh_chung, name: row.ten_hoat_dong, organization: row.don_vi_to_chuc, date: row.ngay_tham_gia?.toISOString().slice(0, 10) ?? null, status: row.trang_thai, reason: row.ly_do_tu_choi, points: row.trang_thai === 'approved' ? row.diem_minh_chung?.so_diem ?? 0 : 0 })),
    };
  }
}
