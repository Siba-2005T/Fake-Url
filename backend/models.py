"""
models.py - Định nghĩa Model SQLAlchemy (Multi-tenancy)
========================================================
Tất cả bảng dữ liệu liên kết với user_id để cách ly dữ liệu.
"""
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


def _utcnow():
    """Trả về thời gian UTC hiện tại (timezone-aware)."""
    return datetime.now(timezone.utc)


# ============================================================
# USER MODEL
# ============================================================
class User(db.Model):
    """Tài khoản người dùng hệ thống."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")  # 'admin' | 'user'
    telegram_chat_id = db.Column(db.String(100), unique=True, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    # Relationships
    cloak_links = db.relationship("CloakLink", backref="owner", lazy="dynamic")
    telegram_videos = db.relationship("TelegramVideo", backref="owner", lazy="dynamic")
    direct_videos = db.relationship("DirectVideo", backref="owner", lazy="dynamic")
    affiliate_links = db.relationship("AffiliateLink", backref="owner", lazy="dynamic")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "telegram_chat_id": self.telegram_chat_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User id={self.id} username='{self.username}' role='{self.role}'>"


# ============================================================
# CLOAK LINK MODEL
# ============================================================
class CloakLink(db.Model):
    """
    Model đại diện cho một Cloak Link.
    Mỗi bản ghi = một link được rút gọn/che giấu với
    OG metadata tùy chỉnh cho mạng xã hội.
    """

    __tablename__ = "cloak_links"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    original_url = db.Column(db.Text, nullable=False)
    custom_slug = db.Column(db.String(255), unique=True, nullable=False, index=True)
    custom_domain = db.Column(db.String(255), nullable=True)
    og_title = db.Column(db.String(500), nullable=True)
    og_description = db.Column(db.Text, nullable=True)
    telegram_file_id = db.Column(db.String(500), nullable=True)
    video_source = db.Column(db.String(50), default='direct', nullable=True)
    direct_video_url = db.Column(db.String(2083), nullable=True)
    content_description = db.Column(db.Text, nullable=True)
    second_affiliate_url = db.Column(db.String(2000), nullable=True)
    image_path = db.Column(db.Text, nullable=True)
    image_public_id = db.Column(db.String(500), nullable=True)
    click_count = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def get_image_url(self, base_url: str = "") -> str | None:
        if not self.image_path:
            return None
        if self.image_path.startswith(("http://", "https://")):
            return self.image_path
        return f"{base_url}/static/{self.image_path}"

    def to_dict(self, base_url: str = "") -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
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
            "image_path": self.image_path,
            "image_url": self.get_image_url(base_url),
            "click_count": self.click_count,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<CloakLink id={self.id} slug='{self.custom_slug}'>"


# ============================================================
# TELEGRAM VIDEO MODEL
# ============================================================
class TelegramVideo(db.Model):
    """Video nhận được từ Telegram bot webhook."""

    __tablename__ = "telegram_videos"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    file_id = db.Column(db.String(500), unique=True, nullable=False, index=True)
    caption = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "file_id": self.file_id,
            "caption": self.caption,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<TelegramVideo id={self.id} file_id='{self.file_id[:15]}...'>"


# ============================================================
# DIRECT VIDEO MODEL
# ============================================================
class DirectVideo(db.Model):
    """Video trực tiếp (link Catbox/MP4) do admin nhập tay."""

    __tablename__ = "direct_videos"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    url = db.Column(db.String(2083), nullable=False)
    caption = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "url": self.url,
            "caption": self.caption,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<DirectVideo id={self.id} caption='{self.caption}'>"


# ============================================================
# AFFILIATE LINK MODEL
# ============================================================
class AffiliateLink(db.Model):
    """Link tiếp thị (Shopee/TikTok) do admin quản lý."""

    __tablename__ = "affiliate_links"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    platform = db.Column(db.String(50), nullable=False)   # 'shopee' | 'tiktok'
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(2083), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "platform": self.platform,
            "name": self.name,
            "url": self.url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<AffiliateLink id={self.id} platform='{self.platform}' name='{self.name}'>"
