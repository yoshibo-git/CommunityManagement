-- CreateTable
CREATE TABLE `bai_dang` (
    `id_bai_dang` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_nguoi_dang` INTEGER UNSIGNED NOT NULL,
    `tieu_de` VARCHAR(255) NOT NULL,
    `thoi_gian_dang` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `noi_dung` TEXT NOT NULL,
    `hinh_anh` VARCHAR(500) NULL,
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'draft',

    INDEX `idx_bai_dang_nguoi_dang`(`id_nguoi_dang`),
    PRIMARY KEY (`id_bai_dang`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_hoat_dong` (
    `id_chi_tiet_hoat_dong` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_hoat_dong` INTEGER UNSIGNED NOT NULL,
    `id_nguoi_dung` INTEGER UNSIGNED NULL,
    `thoi_gian_bat_dau` DATETIME(0) NOT NULL,
    `thoi_gian_ket_thuc` DATETIME(0) NOT NULL,
    `dia_diem` TEXT NULL,
    `vi_do` DECIMAL(10, 7) NULL,
    `kinh_do` DECIMAL(10, 7) NULL,
    `yeu_cau_check_out` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `uq_chi_tiet_hoat_dong`(`id_hoat_dong`),
    INDEX `idx_chi_tiet_nguoi_dung`(`id_nguoi_dung`),
    PRIMARY KEY (`id_chi_tiet_hoat_dong`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dang_ky_hoat_dong` (
    `id_dang_ky` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_nguoi_dung` INTEGER UNSIGNED NOT NULL,
    `id_hoat_dong` INTEGER UNSIGNED NOT NULL,
    `thoi_gian_dang_ky` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'registered',

    INDEX `idx_dang_ky_hoat_dong`(`id_hoat_dong`),
    UNIQUE INDEX `uq_dang_ky_nguoi_dung_hoat_dong`(`id_nguoi_dung`, `id_hoat_dong`),
    PRIMARY KEY (`id_dang_ky`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `de_xuat_hoat_dong` (
    `id_de_xuat` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_don_vi` INTEGER UNSIGNED NOT NULL,
    `ben_lien_he` VARCHAR(150) NULL,
    `email_lien_he` VARCHAR(150) NULL,
    `so_dien_thoai` VARCHAR(20) NULL,
    `ten_hoat_dong` VARCHAR(255) NOT NULL,
    `mo_ta` TEXT NULL,
    `dia_diem` TEXT NULL,
    `thoi_gian_du_kien` DATETIME(0) NULL,
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `id_nguoi_duyet` INTEGER UNSIGNED NULL,
    `ly_do_tu_choi` TEXT NULL,

    INDEX `idx_de_xuat_don_vi`(`id_don_vi`),
    INDEX `idx_de_xuat_nguoi_duyet`(`id_nguoi_duyet`),
    PRIMARY KEY (`id_de_xuat`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `diem_minh_chung` (
    `id_diem_minh_chung` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_minh_chung` INTEGER UNSIGNED NOT NULL,
    `so_diem` INTEGER NOT NULL,
    `ngay_cong_diem` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_diem_minh_chung`(`id_minh_chung`),
    PRIMARY KEY (`id_diem_minh_chung`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `don_vi_ben_ngoai` (
    `id_don_vi` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `ten_don_vi` VARCHAR(200) NOT NULL,
    `loai_don_vi` VARCHAR(100) NULL,

    PRIMARY KEY (`id_don_vi`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hoat_dong` (
    `id_hoat_dong` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_don_vi` INTEGER UNSIGNED NULL,
    `id_de_xuat` INTEGER UNSIGNED NULL,
    `id_nguoi_tao` INTEGER UNSIGNED NOT NULL,
    `ten_hoat_dong` VARCHAR(255) NOT NULL,
    `mo_ta` TEXT NULL,
    `gioi_han_dang_ky` INTEGER UNSIGNED NULL,
    `diem_hoat_dong` INTEGER NOT NULL DEFAULT 0,
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'draft',
    `ke_hoach_hoat_dong` VARCHAR(500) NULL,

    UNIQUE INDEX `uq_hoat_dong_de_xuat`(`id_de_xuat`),
    INDEX `idx_hoat_dong_don_vi`(`id_don_vi`),
    INDEX `idx_hoat_dong_nguoi_tao`(`id_nguoi_tao`),
    PRIMARY KEY (`id_hoat_dong`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ket_qua_diem_danh` (
    `id_ket_qua` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_phien_diem_danh` INTEGER UNSIGNED NOT NULL,
    `id_dang_ky` INTEGER UNSIGNED NOT NULL,
    `thoi_gian_diem_danh` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `vi_do` DECIMAL(10, 7) NULL,
    `kinh_do` DECIMAL(10, 7) NULL,

    INDEX `idx_ket_qua_dang_ky`(`id_dang_ky`),
    UNIQUE INDEX `uq_ket_qua_phien_dang_ky`(`id_phien_diem_danh`, `id_dang_ky`),
    PRIMARY KEY (`id_ket_qua`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khoa` (
    `id_khoa` VARCHAR(20) NOT NULL,
    `ten_khoa` VARCHAR(150) NOT NULL,

    PRIMARY KEY (`id_khoa`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `minh_chung_hoat_dong` (
    `id_minh_chung` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_nguoi_nop` INTEGER UNSIGNED NOT NULL,
    `ten_hoat_dong` VARCHAR(255) NOT NULL,
    `mo_ta` TEXT NULL,
    `don_vi_to_chuc` VARCHAR(200) NULL,
    `ngay_tham_gia` DATE NULL,
    `tep_minh_chung` VARCHAR(500) NOT NULL,
    `ngay_nop` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `id_nguoi_duyet` INTEGER UNSIGNED NULL,
    `ly_do_tu_choi` TEXT NULL,

    INDEX `idx_minh_chung_nguoi_duyet`(`id_nguoi_duyet`),
    INDEX `idx_minh_chung_nguoi_nop`(`id_nguoi_nop`),
    PRIMARY KEY (`id_minh_chung`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nguoi_dung` (
    `id_nguoi_dung` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_vai_tro` INTEGER UNSIGNED NOT NULL,
    `id_khoa` VARCHAR(20) NULL,
    `loai_nguoi_dung` VARCHAR(30) NULL,
    `ten_dang_nhap` VARCHAR(100) NOT NULL,
    `mat_khau` VARCHAR(255) NOT NULL,
    `ho_ten` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `so_dien_thoai` VARCHAR(20) NULL,
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'active',

    UNIQUE INDEX `uq_nguoi_dung_ten_dang_nhap`(`ten_dang_nhap`),
    UNIQUE INDEX `uq_nguoi_dung_email`(`email`),
    INDEX `idx_nguoi_dung_khoa`(`id_khoa`),
    INDEX `idx_nguoi_dung_vai_tro`(`id_vai_tro`),
    PRIMARY KEY (`id_nguoi_dung`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nguoi_nhan_thong_bao` (
    `id_thong_bao` INTEGER UNSIGNED NOT NULL,
    `id_nguoi_dung` INTEGER UNSIGNED NOT NULL,
    `da_doc` BOOLEAN NOT NULL DEFAULT false,
    `thoi_gian_doc` DATETIME(0) NULL,

    INDEX `idx_nguoi_nhan_thong_bao_nguoi_dung`(`id_nguoi_dung`),
    PRIMARY KEY (`id_thong_bao`, `id_nguoi_dung`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phan_cong_nhiem_vu` (
    `id_phan_cong` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_chi_tiet_hoat_dong` INTEGER UNSIGNED NOT NULL,
    `id_nguoi_dung` INTEGER UNSIGNED NOT NULL,
    `ten_nhiem_vu` VARCHAR(255) NOT NULL,
    `mo_ta_nhiem_vu` TEXT NULL,
    `loai_nhiem_vu` VARCHAR(100) NULL,
    `thoi_gian_bat_dau` DATETIME(0) NULL,
    `thoi_gian_ket_thuc` DATETIME(0) NULL,
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'assigned',

    INDEX `idx_phan_cong_chi_tiet`(`id_chi_tiet_hoat_dong`),
    INDEX `idx_phan_cong_nguoi_dung`(`id_nguoi_dung`),
    PRIMARY KEY (`id_phan_cong`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phien_diem_danh` (
    `id_phien_diem_danh` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_chi_tiet_hoat_dong` INTEGER UNSIGNED NOT NULL,
    `loai_diem_danh` VARCHAR(30) NOT NULL,
    `thoi_gian_bat_dau` DATETIME(0) NOT NULL,
    `thoi_gian_ket_thuc` DATETIME(0) NOT NULL,
    `yeu_cau_gps` BOOLEAN NOT NULL DEFAULT false,
    `vi_do` DECIMAL(10, 7) NULL,
    `kinh_do` DECIMAL(10, 7) NULL,
    `ban_kinh_cho_phep` INTEGER UNSIGNED NULL COMMENT 'Don vi: met',
    `trang_thai` VARCHAR(30) NOT NULL DEFAULT 'scheduled',

    INDEX `idx_phien_diem_danh_chi_tiet`(`id_chi_tiet_hoat_dong`),
    PRIMARY KEY (`id_phien_diem_danh`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thong_bao` (
    `id_thong_bao` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_hoat_dong` INTEGER UNSIGNED NULL,
    `loai_thong_bao` VARCHAR(50) NOT NULL,
    `tieu_de` VARCHAR(255) NOT NULL,
    `noi_dung` TEXT NOT NULL,
    `thoi_gian_tao` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_thong_bao_hoat_dong`(`id_hoat_dong`),
    PRIMARY KEY (`id_thong_bao`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thong_tin_sinh_trac` (
    `id_sinh_trac` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_nguoi_dung` INTEGER UNSIGNED NOT NULL,
    `id_khuon_mat` VARCHAR(255) NOT NULL,
    `ngay_cap_nhat` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX `uq_sinh_trac_nguoi_dung`(`id_nguoi_dung`),
    UNIQUE INDEX `uq_sinh_trac_khuon_mat`(`id_khuon_mat`),
    PRIMARY KEY (`id_sinh_trac`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vai_tro` (
    `id_vai_tro` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `ten_vai_tro` VARCHAR(100) NOT NULL,
    `mo_ta` TEXT NULL,

    UNIQUE INDEX `uq_vai_tro_ten`(`ten_vai_tro`),
    PRIMARY KEY (`id_vai_tro`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bai_dang` ADD CONSTRAINT `fk_bai_dang_nguoi_dang` FOREIGN KEY (`id_nguoi_dang`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_hoat_dong` ADD CONSTRAINT `fk_chi_tiet_hoat_dong_hoat_dong` FOREIGN KEY (`id_hoat_dong`) REFERENCES `hoat_dong`(`id_hoat_dong`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_hoat_dong` ADD CONSTRAINT `fk_chi_tiet_hoat_dong_nguoi_dung` FOREIGN KEY (`id_nguoi_dung`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dang_ky_hoat_dong` ADD CONSTRAINT `fk_dang_ky_hoat_dong` FOREIGN KEY (`id_hoat_dong`) REFERENCES `hoat_dong`(`id_hoat_dong`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dang_ky_hoat_dong` ADD CONSTRAINT `fk_dang_ky_nguoi_dung` FOREIGN KEY (`id_nguoi_dung`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `de_xuat_hoat_dong` ADD CONSTRAINT `fk_de_xuat_don_vi` FOREIGN KEY (`id_don_vi`) REFERENCES `don_vi_ben_ngoai`(`id_don_vi`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `de_xuat_hoat_dong` ADD CONSTRAINT `fk_de_xuat_nguoi_duyet` FOREIGN KEY (`id_nguoi_duyet`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diem_minh_chung` ADD CONSTRAINT `fk_diem_minh_chung_minh_chung` FOREIGN KEY (`id_minh_chung`) REFERENCES `minh_chung_hoat_dong`(`id_minh_chung`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hoat_dong` ADD CONSTRAINT `fk_hoat_dong_de_xuat` FOREIGN KEY (`id_de_xuat`) REFERENCES `de_xuat_hoat_dong`(`id_de_xuat`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hoat_dong` ADD CONSTRAINT `fk_hoat_dong_don_vi` FOREIGN KEY (`id_don_vi`) REFERENCES `don_vi_ben_ngoai`(`id_don_vi`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hoat_dong` ADD CONSTRAINT `fk_hoat_dong_nguoi_tao` FOREIGN KEY (`id_nguoi_tao`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ket_qua_diem_danh` ADD CONSTRAINT `fk_ket_qua_dang_ky` FOREIGN KEY (`id_dang_ky`) REFERENCES `dang_ky_hoat_dong`(`id_dang_ky`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ket_qua_diem_danh` ADD CONSTRAINT `fk_ket_qua_phien_diem_danh` FOREIGN KEY (`id_phien_diem_danh`) REFERENCES `phien_diem_danh`(`id_phien_diem_danh`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minh_chung_hoat_dong` ADD CONSTRAINT `fk_minh_chung_nguoi_duyet` FOREIGN KEY (`id_nguoi_duyet`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minh_chung_hoat_dong` ADD CONSTRAINT `fk_minh_chung_nguoi_nop` FOREIGN KEY (`id_nguoi_nop`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nguoi_dung` ADD CONSTRAINT `fk_nguoi_dung_khoa` FOREIGN KEY (`id_khoa`) REFERENCES `khoa`(`id_khoa`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nguoi_dung` ADD CONSTRAINT `fk_nguoi_dung_vai_tro` FOREIGN KEY (`id_vai_tro`) REFERENCES `vai_tro`(`id_vai_tro`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nguoi_nhan_thong_bao` ADD CONSTRAINT `fk_nguoi_nhan_thong_bao_nguoi_dung` FOREIGN KEY (`id_nguoi_dung`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nguoi_nhan_thong_bao` ADD CONSTRAINT `fk_nguoi_nhan_thong_bao_thong_bao` FOREIGN KEY (`id_thong_bao`) REFERENCES `thong_bao`(`id_thong_bao`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phan_cong_nhiem_vu` ADD CONSTRAINT `fk_phan_cong_chi_tiet` FOREIGN KEY (`id_chi_tiet_hoat_dong`) REFERENCES `chi_tiet_hoat_dong`(`id_chi_tiet_hoat_dong`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phan_cong_nhiem_vu` ADD CONSTRAINT `fk_phan_cong_nguoi_dung` FOREIGN KEY (`id_nguoi_dung`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phien_diem_danh` ADD CONSTRAINT `fk_phien_diem_danh_chi_tiet` FOREIGN KEY (`id_chi_tiet_hoat_dong`) REFERENCES `chi_tiet_hoat_dong`(`id_chi_tiet_hoat_dong`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thong_bao` ADD CONSTRAINT `fk_thong_bao_hoat_dong` FOREIGN KEY (`id_hoat_dong`) REFERENCES `hoat_dong`(`id_hoat_dong`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thong_tin_sinh_trac` ADD CONSTRAINT `fk_sinh_trac_nguoi_dung` FOREIGN KEY (`id_nguoi_dung`) REFERENCES `nguoi_dung`(`id_nguoi_dung`) ON DELETE CASCADE ON UPDATE CASCADE;
