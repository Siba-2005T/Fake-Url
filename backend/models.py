"""
models.py - Định nghĩa Model SQLAlchemy
========================================
Ánh xạ bảng `cloak_links` trong Database
thành class Python để thao tác dễ dàng.

Thay đổi so với phiên bản cũ:
  - image_path: Lưu URL Cloudinary đầy đủ (hoặc path local fallback)
  - image_public_id: Lưu Cloudinary public_id để có thể xóa ảnh sau này
  - image_url property: Luôn trả về URL hiển thị đúng dù là cloud hay local
"""
from datetime import datetime, timezone
from extensions import db


def _utcnow():
    """Trả về thời gian UTC hiện tại (timezone-aware)."""
    return datetime.now(timezone.utc)


class CloakLink(db.Model):
    """
    Model đại diện cho một Cloak Link.

    Mỗi bản ghi = một link được rút gọn/che giấu với
    OG metadata tùy chỉnh cho mạng xã hội.
    """

    __tablename__ = "cloak_links"

    # --- Các cột trong bảng ---

    # Khóa chính tự tăng
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # URL gốc cần che giấu (không giới hạn độ dài)
    original_url = db.Column(db.Text, nullable=False)

    # Slug tùy chỉnh - phần đuôi URL
    # Ví dụ: "hoat-hinh-2026" -> domain.com/hoat-hinh-2026
    custom_slug = db.Column(db.String(255), unique=True, nullable=False, index=True)

    # Tên miền riêng của người dùng (tuỳ chọn)
    custom_domain = db.Column(db.String(255), nullable=True)

    # Tiêu đề hiển thị khi chia sẻ lên Facebook/Zalo
    og_title = db.Column(db.String(500), nullable=True)

    # Mô tả hiển thị khi chia sẻ lên Facebook/Zalo (OG description)
    og_description = db.Column(db.Text, nullable=True)

    # Telegram File ID của video để stream trực tiếp
    telegram_file_id = db.Column(db.String(500), nullable=True)

    # Nguồn video: 'telegram' hoặc 'direct'
    video_source = db.Column(db.String(50), default='direct', nullable=True)

    # URL video trực tiếp (ví dụ link mp4 từ Catbox hoặc host khác)
    direct_video_url = db.Column(db.String(2083), nullable=True)

    # Đoạn văn bản mô tả hiển thị bên dưới video
    content_description = db.Column(db.Text, nullable=True)

    # URL Affiliate phụ (Tầng 2 của bẫy click - VD: TikTok, Lazada...)
    # Được mở ở tab mới khi người dùng click LẦN THỨ 2 (tưởng bấm Play video)
    second_affiliate_url = db.Column(db.String(2000), nullable=True)

    # -------------------------------------------------------------------------
    # LƯU TRỮ ẢNH - 2 trường hợp:
    #
    # CLOUDINARY mode (Production - Render):
    #   image_path     = URL Cloudinary đầy đủ
    #                    VD: "https://res.cloudinary.com/demo/image/upload/abc.jpg"
    #   image_public_id = Cloudinary public_id để xóa ảnh
    #                    VD: "cloak_link_og_images/abc123def456"
    #
    # LOCAL mode (Development - fallback khi chưa cấu hình Cloudinary):
    #   image_path     = Đường dẫn tương đối local
    #                    VD: "uploads/abc123.jpg"
    #   image_public_id = None (không dùng)
    # -------------------------------------------------------------------------
    image_path = db.Column(db.Text, nullable=True)
    image_public_id = db.Column(db.String(500), nullable=True)

    # Số lần link được click/redirect
    click_count = db.Column(db.Integer, default=0, nullable=False)

    # Trạng thái hoạt động: True = active, False = disabled
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Thời điểm tạo
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    # Thời điểm cập nhật lần cuối
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False
    )

    def get_image_url(self, base_url: str = "") -> str | None:
        """
        Trả về URL ảnh hiển thị đúng, bất kể là Cloudinary hay local.

        - Nếu image_path là URL đầy đủ (Cloudinary) -> trả về thẳng
        - Nếu là path local -> build URL đầy đủ từ base_url
        - Nếu không có ảnh -> trả về None
        """
        if not self.image_path:
            return None
        if self.image_path.startswith(("http://", "https://")):
            return self.image_path  # Cloudinary URL
        return f"{base_url}/static/{self.image_path}"  # Local URL

    def to_dict(self, base_url: str = "") -> dict:
        """
        Chuyển đổi model thành dict để trả về qua JSON API.

        Args:
            base_url: URL gốc của server (chỉ cần khi lưu local)
        Returns:
            dict chứa tất cả thông tin của CloakLink
        """
        return {
            "id": self.id,
            "original_url": self.original_url,
            "custom_slug": self.custom_slug,
            "custom_domain": self.custom_domain,
            "og_title": self.og_title,
            "og_description": self.og_description,
            "video_source": self.video_source,
            "telegram_file_id": self.telegram_file_id,
            "direct_video_url": self.direct_video_url,
            "content_description": self.content_description,
            "second_affiliate_url": self.second_affiliate_url,
            # image_path: giữ nguyên giá trị trong DB (có thể là URL cloud hoặc path local)
            "image_path": self.image_path,
            # image_url: URL hiển thị đầy đủ (đã được resolve)
            "image_url": self.get_image_url(base_url),
            "click_count": self.click_count,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<CloakLink id={self.id} slug='{self.custom_slug}'>"


class TelegramVideo(db.Model):
    """
    Model đại diện cho video nhận được từ Telegram bot webhook.
    """

    __tablename__ = "telegram_videos"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id = db.Column(db.String(500), unique=True, nullable=False, index=True)
    caption = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "file_id": self.file_id,
            "caption": self.caption,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<TelegramVideo id={self.id} file_id='{self.file_id[:15]}...'>"

