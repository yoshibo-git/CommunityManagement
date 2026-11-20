import { readDatabaseConfig } from '../common/config/environment';
import { hashPassword } from '../common/security/password';
import { PrismaService } from './prisma.service';
import { seedRoles } from './seed';

export async function seedSystem(prisma: PrismaService) {
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(readDatabaseConfig().host)) {
    throw new Error('Initial accounts may only be seeded into a local non-production database.');
  }
  const password = process.env.SEED_ACCOUNT_PASSWORD;
  if (!password) throw new Error('SEED_ACCOUNT_PASSWORD is required.');
  const removed = await prisma.runInTransaction(async (tx) => {
    const fixtures = await tx.nguoi_dung.findMany({ where: {
      ten_dang_nhap: { in: ['cm_preview_student', 'cm_preview_staff', 'cm_preview_manager'] },
      email: { endsWith: '@cm-preview.invalid' }, id_khoa: 'CM_PREVIEW',
    }, select: { id_nguoi_dung: true } });
    const ids = fixtures.map((user) => user.id_nguoi_dung);
    const activities = await tx.hoat_dong.findMany({ where: { id_nguoi_tao: { in: ids } }, select: { id_hoat_dong: true, ten_hoat_dong: true } });
    if (activities.some((activity) => !['[Mẫu] Ngày xanh cộng đồng', '[Mẫu] Tiếp sức đến trường', '[Mẫu] Sách cho em'].includes(activity.ten_hoat_dong))) {
      throw new Error('Fixture accounts own non-fixture activities; cleanup requires review.');
    }
    await tx.thong_bao.deleteMany({ where: { id_hoat_dong: { in: activities.map((activity) => activity.id_hoat_dong) } } });
    await tx.hoat_dong.deleteMany({ where: { id_hoat_dong: { in: activities.map((activity) => activity.id_hoat_dong) } } });
    await tx.nguoi_dung.deleteMany({ where: { id_nguoi_dung: { in: ids } } });
    await tx.khoa.deleteMany({ where: { id_khoa: 'CM_PREVIEW', ten_khoa: 'Khoa kiểm thử CM UTE', nguoi_dung: { none: {} } } });
    return { users: ids.length, activities: activities.length };
  });
  await seedRoles(prisma);
  await prisma.runInTransaction(async (tx) => {
    for (const [username, roleCode, name, type] of [
      ['sinhvien1', 'user', 'Sinh viên 1', 'student'],
      ['canbo1', 'staff', 'Cán bộ 1', 'staff'],
      ['admin1', 'admin', 'Quản trị viên', 'staff'],
    ]) {
      const email = `${username}@community.example`;
      const role = await tx.vai_tro.findUniqueOrThrow({ where: { ten_vai_tro: roleCode } });
      const existing = await tx.nguoi_dung.findUnique({ where: { ten_dang_nhap: username } });
      if (existing && (existing.email !== email || existing.id_vai_tro !== role.id_vai_tro)) throw new Error('Initial account conflicts with existing data.');
      if (!existing) await tx.nguoi_dung.create({ data: { ten_dang_nhap: username, email, ho_ten: name, loai_nguoi_dung: type, id_vai_tro: role.id_vai_tro, mat_khau: await hashPassword(password), trang_thai: 'active' } });
    }
    const manager = await tx.nguoi_dung.findUniqueOrThrow({ where: { ten_dang_nhap: 'canbo1' } });
    for (const [index, name] of ['Ngày xanh khuôn viên', 'Sách cho cộng đồng', 'Kỹ năng số cho cộng đồng'].entries()) {
      if (!await tx.hoat_dong.findFirst({ where: { id_nguoi_tao: manager.id_nguoi_dung, ten_hoat_dong: name } })) {
        const start = new Date(Date.now() + (7 + index * 7) * 86400000);
        start.setUTCHours(1, 0, 0, 0);
        await tx.hoat_dong.create({ data: { ten_hoat_dong: name, mo_ta: 'Hoạt động kết nối sinh viên và nhà trường vì cộng đồng.', id_nguoi_tao: manager.id_nguoi_dung, trang_thai: 'draft', gioi_han_dang_ky: 100, diem_hoat_dong: 5,
          chi_tiet_hoat_dong: { create: { thoi_gian_bat_dau: start, thoi_gian_ket_thuc: new Date(start.getTime() + 3 * 3600000), dia_diem: 'Trường Đại học Sư phạm Kỹ thuật, Đà Nẵng' } },
        } });
      }
    }
    for (const [title, text] of [
      ['Chào mừng đến với CM UTE', 'CM UTE là hệ thống thông tin hoạt động cộng đồng của Trường Đại học Sư phạm Kỹ thuật.'],
      ['Theo dõi hoạt động cộng đồng', 'Thông tin về lịch tổ chức, địa điểm và điều kiện tham gia được công bố trong từng hoạt động.'],
      ['Tài khoản tham gia hệ thống', 'Sinh viên sử dụng tài khoản được nhà trường cấp để theo dõi hoạt động và hồ sơ tham gia của mình.'],
    ]) {
      if (!await tx.bai_dang.findFirst({ where: { id_nguoi_dang: manager.id_nguoi_dung, tieu_de: title } })) {
        await tx.bai_dang.create({ data: { id_nguoi_dang: manager.id_nguoi_dung, tieu_de: title, noi_dung: JSON.stringify({ v: 1, html: `<p>${text}</p>`, lastEditedAt: null }), trang_thai: 'published', thoi_gian_dang: new Date() } });
      }
    }
  });
  return { removed, accounts: ['sinhvien1', 'canbo1', 'admin1'] };
}

if (require.main === module) {
  const prisma = new PrismaService();
  (async () => {
    try { console.log(await seedSystem(prisma)); } finally { await prisma.$disconnect(); }
  })().catch(() => { console.error('Không thể khởi tạo dữ liệu hệ thống. Kiểm tra môi trường và xung đột dữ liệu.'); process.exitCode = 1; });
}
