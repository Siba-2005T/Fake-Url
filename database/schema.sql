-- ============================================================
-- schema.sql - Database Schema cho CloakLink
-- ============================================================
-- Hỗ trợ cả MySQL và PostgreSQL
-- SQLAlchemy sẽ tự tạo bảng qua db.create_all()
-- File này dùng để tham khảo hoặc setup thủ công
--
-- MySQL:      CREATE DATABASE cloak_link_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- PostgreSQL: CREATE DATABASE cloak_link_db;
-- ============================================================

-- ============================================================
-- Bảng chính: cloak_links
-- ============================================================
CREATE TABLE IF NOT EXISTS cloak_links (
    -- Khóa chính tự tăng
    id               INTEGER      NOT NULL AUTO_INCREMENT,

    -- URL gốc cần che giấu (TEXT để không giới hạn độ dài)
    original_url     TEXT         NOT NULL,

    -- Slug tùy chỉnh - phần đuôi URL (phải unique)
    -- VD: "hoat-hinh-2026" -> domain.com/hoat-hinh-2026
    custom_slug      VARCHAR(255) NOT NULL UNIQUE,

    -- Tên miền riêng của người dùng (tuỳ chọn)
    -- VD: "ten-cua-toi.com"
    custom_domain    VARCHAR(255) NULL,

    -- Tiêu đề hiển thị khi chia sẻ lên Facebook/Zalo
    og_title         VARCHAR(500) NULL,

    -- Mô tả hiển thị khi chia sẻ lên Facebook/Zalo
    og_description   TEXT         NULL,

    -- -------------------------------------------------------
    -- LƯU TRỮ ẢNH - 2 chế độ:
    --
    -- CLOUDINARY (Production):
    --   image_path      = URL đầy đủ của Cloudinary
    --                     VD: https://res.cloudinary.com/demo/image/upload/v1/cloak_link_og_images/abc.jpg
    --   image_public_id = Cloudinary public_id để xóa ảnh sau này
    --                     VD: cloak_link_og_images/abc123def456
    --
    -- LOCAL (Development - fallback):
    --   image_path      = Đường dẫn tương đối
    --                     VD: uploads/abc123.jpg
    --   image_public_id = NULL
    -- -------------------------------------------------------
    image_path       TEXT         NULL,
    image_public_id  VARCHAR(500) NULL,

    -- Số lần link được click/redirect (thống kê)
    click_count      INTEGER      NOT NULL DEFAULT 0,

    -- Trạng thái hoạt động: 1=active, 0=disabled
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,

    -- Thời điểm tạo bản ghi
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Thời điểm cập nhật lần cuối
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Định nghĩa Primary Key
    PRIMARY KEY (id),

    -- Index trên custom_slug để tối ưu tốc độ lookup khi redirect
    -- (đây là query quan trọng nhất: WHERE custom_slug = ? AND is_active = TRUE)
    INDEX idx_custom_slug (custom_slug),

    -- Index trên is_active để filter nhanh
    INDEX idx_is_active (is_active),

    -- Index kết hợp cho query redirect chính
    INDEX idx_slug_active (custom_slug, is_active)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Script tương thích PostgreSQL (dùng khi deploy lên Render)
-- Uncomment nếu dùng PostgreSQL:
-- ============================================================
/*
CREATE TABLE IF NOT EXISTS cloak_links (
    id               SERIAL       NOT NULL,
    original_url     TEXT         NOT NULL,
    custom_slug      VARCHAR(255) NOT NULL UNIQUE,
    custom_domain    VARCHAR(255),
    og_title         VARCHAR(500),
    og_description   TEXT,
    image_path       TEXT,
    image_public_id  VARCHAR(500),
    click_count      INTEGER      NOT NULL DEFAULT 0,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_slug ON cloak_links (custom_slug);
CREATE INDEX IF NOT EXISTS idx_slug_active ON cloak_links (custom_slug, is_active);

-- Trigger tự cập nhật updated_at khi có UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cloak_links_updated_at
    BEFORE UPDATE ON cloak_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
*/
