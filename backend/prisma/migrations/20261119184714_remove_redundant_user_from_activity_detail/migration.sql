/*
  Warnings:

  - You are about to drop the column `id_nguoi_dung` on the `chi_tiet_hoat_dong` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `chi_tiet_hoat_dong` DROP FOREIGN KEY `fk_chi_tiet_hoat_dong_nguoi_dung`;

-- DropIndex
DROP INDEX `idx_chi_tiet_nguoi_dung` ON `chi_tiet_hoat_dong`;

-- AlterTable
ALTER TABLE `chi_tiet_hoat_dong` DROP COLUMN `id_nguoi_dung`;
