-- ============================================================
-- DATABASE: community_management
-- He thong quan ly cac hoat dong cong dong
-- Quy uoc: ten bang/cot dung snake_case; InnoDB; utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS community_management
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE community_management;

-- ------------------------------------------------------------
-- 1. Danh muc khoa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS khoa (
    id_khoa VARCHAR(20) NOT NULL,
    ten_khoa VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_khoa)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. Vai tro va nguoi dung
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vai_tro (
    id_vai_tro INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ten_vai_tro VARCHAR(100) NOT NULL,
    mo_ta TEXT NULL,
    PRIMARY KEY (id_vai_tro),
    UNIQUE KEY uq_vai_tro_ten (ten_vai_tro)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nguoi_dung (
    id_nguoi_dung INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_vai_tro INT UNSIGNED NOT NULL,
    id_khoa VARCHAR(20) NULL,
    loai_nguoi_dung VARCHAR(30) NULL,
    ten_dang_nhap VARCHAR(100) NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    ho_ten VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    so_dien_thoai VARCHAR(20) NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'active',
    PRIMARY KEY (id_nguoi_dung),
    UNIQUE KEY uq_nguoi_dung_ten_dang_nhap (ten_dang_nhap),
    UNIQUE KEY uq_nguoi_dung_email (email),
    KEY idx_nguoi_dung_vai_tro (id_vai_tro),
    KEY idx_nguoi_dung_khoa (id_khoa),
    CONSTRAINT fk_nguoi_dung_vai_tro
        FOREIGN KEY (id_vai_tro) REFERENCES vai_tro (id_vai_tro)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_nguoi_dung_khoa
        FOREIGN KEY (id_khoa) REFERENCES khoa (id_khoa)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. Thong tin sinh trac (ma dinh danh FaceIO)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_tin_sinh_trac (
    id_sinh_trac INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    id_khuon_mat VARCHAR(255) NOT NULL,
    ngay_cap_nhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_sinh_trac),
    UNIQUE KEY uq_sinh_trac_nguoi_dung (id_nguoi_dung),
    UNIQUE KEY uq_sinh_trac_khuon_mat (id_khuon_mat),
    CONSTRAINT fk_sinh_trac_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. Bai dang
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bai_dang (
    id_bai_dang INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_dang INT UNSIGNED NOT NULL,
    tieu_de VARCHAR(255) NOT NULL,
    thoi_gian_dang DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    noi_dung TEXT NOT NULL,
    hinh_anh VARCHAR(500) NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'draft',
    PRIMARY KEY (id_bai_dang),
    KEY idx_bai_dang_nguoi_dang (id_nguoi_dang),
    CONSTRAINT fk_bai_dang_nguoi_dang
        FOREIGN KEY (id_nguoi_dang) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. Don vi ben ngoai va de xuat hoat dong
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS don_vi_ben_ngoai (
    id_don_vi INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ten_don_vi VARCHAR(200) NOT NULL,
    loai_don_vi VARCHAR(100) NULL,
    PRIMARY KEY (id_don_vi)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS de_xuat_hoat_dong (
    id_de_xuat INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_don_vi INT UNSIGNED NOT NULL,
    ben_lien_he VARCHAR(150) NULL,
    email_lien_he VARCHAR(150) NULL,
    so_dien_thoai VARCHAR(20) NULL,
    ten_hoat_dong VARCHAR(255) NOT NULL,
    mo_ta TEXT NULL,
    dia_diem TEXT NULL,
    thoi_gian_du_kien DATETIME NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'pending',
    id_nguoi_duyet INT UNSIGNED NULL,
    ly_do_tu_choi TEXT NULL,
    PRIMARY KEY (id_de_xuat),
    KEY idx_de_xuat_don_vi (id_don_vi),
    KEY idx_de_xuat_nguoi_duyet (id_nguoi_duyet),
    CONSTRAINT fk_de_xuat_don_vi
        FOREIGN KEY (id_don_vi) REFERENCES don_vi_ben_ngoai (id_don_vi)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_de_xuat_nguoi_duyet
        FOREIGN KEY (id_nguoi_duyet) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. Hoat dong va chi tiet hoat dong
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hoat_dong (
    id_hoat_dong INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_don_vi INT UNSIGNED NULL,
    id_de_xuat INT UNSIGNED NULL,
    id_nguoi_tao INT UNSIGNED NOT NULL,
    ten_hoat_dong VARCHAR(255) NOT NULL,
    mo_ta TEXT NULL,
    gioi_han_dang_ky INT UNSIGNED NULL,
    diem_hoat_dong INT NOT NULL DEFAULT 0,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'draft',
    ke_hoach_hoat_dong VARCHAR(500) NULL,
    PRIMARY KEY (id_hoat_dong),
    UNIQUE KEY uq_hoat_dong_de_xuat (id_de_xuat),
    KEY idx_hoat_dong_don_vi (id_don_vi),
    KEY idx_hoat_dong_nguoi_tao (id_nguoi_tao),
    CONSTRAINT fk_hoat_dong_don_vi
        FOREIGN KEY (id_don_vi) REFERENCES don_vi_ben_ngoai (id_don_vi)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_hoat_dong_de_xuat
        FOREIGN KEY (id_de_xuat) REFERENCES de_xuat_hoat_dong (id_de_xuat)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_hoat_dong_nguoi_tao
        FOREIGN KEY (id_nguoi_tao) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chi_tiet_hoat_dong (
    id_chi_tiet_hoat_dong INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_hoat_dong INT UNSIGNED NOT NULL,
    id_nguoi_dung INT UNSIGNED NULL,
    thoi_gian_bat_dau DATETIME NOT NULL,
    thoi_gian_ket_thuc DATETIME NOT NULL,
    dia_diem TEXT NULL,
    vi_do DECIMAL(10,7) NULL,
    kinh_do DECIMAL(10,7) NULL,
    yeu_cau_check_out BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id_chi_tiet_hoat_dong),
    UNIQUE KEY uq_chi_tiet_hoat_dong (id_hoat_dong),
    KEY idx_chi_tiet_nguoi_dung (id_nguoi_dung),
    CONSTRAINT fk_chi_tiet_hoat_dong_hoat_dong
        FOREIGN KEY (id_hoat_dong) REFERENCES hoat_dong (id_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_chi_tiet_hoat_dong_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. Dang ky hoat dong
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dang_ky_hoat_dong (
    id_dang_ky INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    id_hoat_dong INT UNSIGNED NOT NULL,
    thoi_gian_dang_ky DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'registered',
    PRIMARY KEY (id_dang_ky),
    UNIQUE KEY uq_dang_ky_nguoi_dung_hoat_dong
        (id_nguoi_dung, id_hoat_dong),
    KEY idx_dang_ky_hoat_dong (id_hoat_dong),
    CONSTRAINT fk_dang_ky_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_dang_ky_hoat_dong
        FOREIGN KEY (id_hoat_dong) REFERENCES hoat_dong (id_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. Phan cong nhiem vu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phan_cong_nhiem_vu (
    id_phan_cong INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_chi_tiet_hoat_dong INT UNSIGNED NOT NULL,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    ten_nhiem_vu VARCHAR(255) NOT NULL,
    mo_ta_nhiem_vu TEXT NULL,
    loai_nhiem_vu VARCHAR(100) NULL,
    thoi_gian_bat_dau DATETIME NULL,
    thoi_gian_ket_thuc DATETIME NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'assigned',
    PRIMARY KEY (id_phan_cong),
    KEY idx_phan_cong_chi_tiet (id_chi_tiet_hoat_dong),
    KEY idx_phan_cong_nguoi_dung (id_nguoi_dung),
    CONSTRAINT fk_phan_cong_chi_tiet
        FOREIGN KEY (id_chi_tiet_hoat_dong)
        REFERENCES chi_tiet_hoat_dong (id_chi_tiet_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_phan_cong_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. Phien diem danh va ket qua diem danh
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phien_diem_danh (
    id_phien_diem_danh INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_chi_tiet_hoat_dong INT UNSIGNED NOT NULL,
    loai_diem_danh VARCHAR(30) NOT NULL,
    thoi_gian_bat_dau DATETIME NOT NULL,
    thoi_gian_ket_thuc DATETIME NOT NULL,
    yeu_cau_gps BOOLEAN NOT NULL DEFAULT FALSE,
    vi_do DECIMAL(10,7) NULL,
    kinh_do DECIMAL(10,7) NULL,
    ban_kinh_cho_phep INT UNSIGNED NULL COMMENT 'Don vi: met',
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    PRIMARY KEY (id_phien_diem_danh),
    KEY idx_phien_diem_danh_chi_tiet (id_chi_tiet_hoat_dong),
    CONSTRAINT fk_phien_diem_danh_chi_tiet
        FOREIGN KEY (id_chi_tiet_hoat_dong)
        REFERENCES chi_tiet_hoat_dong (id_chi_tiet_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ket_qua_diem_danh (
    id_ket_qua INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_phien_diem_danh INT UNSIGNED NOT NULL,
    id_dang_ky INT UNSIGNED NOT NULL,
    thoi_gian_diem_danh DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vi_do DECIMAL(10,7) NULL,
    kinh_do DECIMAL(10,7) NULL,
    PRIMARY KEY (id_ket_qua),
    UNIQUE KEY uq_ket_qua_phien_dang_ky
        (id_phien_diem_danh, id_dang_ky),
    KEY idx_ket_qua_dang_ky (id_dang_ky),
    CONSTRAINT fk_ket_qua_phien_diem_danh
        FOREIGN KEY (id_phien_diem_danh)
        REFERENCES phien_diem_danh (id_phien_diem_danh)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ket_qua_dang_ky
        FOREIGN KEY (id_dang_ky) REFERENCES dang_ky_hoat_dong (id_dang_ky)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10. Minh chung hoat dong va diem minh chung
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS minh_chung_hoat_dong (
    id_minh_chung INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_nop INT UNSIGNED NOT NULL,
    ten_hoat_dong VARCHAR(255) NOT NULL,
    mo_ta TEXT NULL,
    don_vi_to_chuc VARCHAR(200) NULL,
    ngay_tham_gia DATE NULL,
    tep_minh_chung VARCHAR(500) NOT NULL,
    ngay_nop DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'pending',
    id_nguoi_duyet INT UNSIGNED NULL,
    ly_do_tu_choi TEXT NULL,
    PRIMARY KEY (id_minh_chung),
    KEY idx_minh_chung_nguoi_nop (id_nguoi_nop),
    KEY idx_minh_chung_nguoi_duyet (id_nguoi_duyet),
    CONSTRAINT fk_minh_chung_nguoi_nop
        FOREIGN KEY (id_nguoi_nop) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_minh_chung_nguoi_duyet
        FOREIGN KEY (id_nguoi_duyet) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS diem_minh_chung (
    id_diem_minh_chung INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_minh_chung INT UNSIGNED NOT NULL,
    so_diem INT NOT NULL,
    ngay_cong_diem DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_diem_minh_chung),
    UNIQUE KEY uq_diem_minh_chung (id_minh_chung),
    CONSTRAINT fk_diem_minh_chung_minh_chung
        FOREIGN KEY (id_minh_chung)
        REFERENCES minh_chung_hoat_dong (id_minh_chung)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11. Thong bao va nguoi nhan thong bao
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_bao (
    id_thong_bao INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_hoat_dong INT UNSIGNED NULL,
    loai_thong_bao VARCHAR(50) NOT NULL,
    tieu_de VARCHAR(255) NOT NULL,
    noi_dung TEXT NOT NULL,
    thoi_gian_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_thong_bao),
    KEY idx_thong_bao_hoat_dong (id_hoat_dong),
    CONSTRAINT fk_thong_bao_hoat_dong
        FOREIGN KEY (id_hoat_dong) REFERENCES hoat_dong (id_hoat_dong)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nguoi_nhan_thong_bao (
    id_thong_bao INT UNSIGNED NOT NULL,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    da_doc BOOLEAN NOT NULL DEFAULT FALSE,
    thoi_gian_doc DATETIME NULL,
    PRIMARY KEY (id_thong_bao, id_nguoi_dung),
    KEY idx_nguoi_nhan_thong_bao_nguoi_dung (id_nguoi_dung),
    CONSTRAINT fk_nguoi_nhan_thong_bao_thong_bao
        FOREIGN KEY (id_thong_bao) REFERENCES thong_bao (id_thong_bao)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_nguoi_nhan_thong_bao_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- GHI CHU:
-- 1. Cac cot trang_thai/loai_* dang dung VARCHAR de linh hoat;
--    co the chuan hoa gia tri ENUM sau khi thong nhat danh muc.
-- 2. CHECK nguoi_duyet khac nguoi_nop duoc MySQL 8.0.16+ ap dung.
-- 3. Quy tac khong cho tu duyet nen duoc kiem tra them o backend.
-- ============================================================
