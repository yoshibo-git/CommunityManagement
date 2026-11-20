import { PrismaService } from './prisma.service';

export async function seedRoles(prisma: PrismaService) {
  await prisma.runInTransaction(async (tx) => {
    for (const [code, previous, label] of [['user', 'Người dùng cuối', 'Người dùng'], ['staff', 'Quản lý', 'Quản lý'], ['admin', 'Admin', 'Admin']]) {
      const matches = await tx.vai_tro.findMany({ where: { ten_vai_tro: { in: [code, previous] } } });
      if (matches.length > 1) throw new Error('Conflicting role records require review.');
      if (matches[0]) {
        if (matches[0].ten_vai_tro !== code || matches[0].mo_ta !== label) {
          await tx.vai_tro.update({ where: { id_vai_tro: matches[0].id_vai_tro }, data: { ten_vai_tro: code, mo_ta: label } });
        }
      } else await tx.vai_tro.create({ data: { ten_vai_tro: code, mo_ta: label } });
    }
  });
}

if (require.main === module) {
  const prisma = new PrismaService();
  (async () => {
    try {
      await prisma.onModuleInit();
      await seedRoles(prisma);
      console.log('Đã bảo đảm ba vai trò hệ thống tồn tại.');
    } finally {
      await prisma.$disconnect();
    }
  })().catch(() => {
    console.error('Không thể khởi tạo vai trò. Kiểm tra cấu hình và kết nối database.');
    process.exitCode = 1;
  });
}
