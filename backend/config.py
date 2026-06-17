"""
config.py - Cấu hình ứng dụng Flask
=====================================
Load biến môi trường từ file .env và cung cấp
các class config cho từng môi trường (Development/Production).

Hỗ trợ cả MySQL (local dev) và PostgreSQL (Render production).
Tích hợp Cloudinary cho lưu trữ ảnh bền vững trên cloud.
"""
import os
from dotenv import load_dotenv

# Load file .env vào environment
load_dotenv()


class Config:
    """Cấu hình cơ sở - dùng chung cho mọi môi trường."""

    # Khóa bí mật cho session Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-please-change-in-production")

    # =========================================================
    # DATABASE - Ưu tiên DATABASE_URL (Render/Heroku cung cấp)
    # Nếu không có, build từ các biến DB_* riêng lẻ
    # =========================================================
    _database_url = os.environ.get("DATABASE_URL", "")

    # Render cung cấp postgres:// nhưng SQLAlchemy cần postgresql://
    if _database_url.startswith("postgres://"):
        _database_url = _database_url.replace("postgres://", "postgresql://", 1)

    if _database_url:
        SQLALCHEMY_DATABASE_URI = _database_url
    else:
        # Fallback: build URI từ biến env riêng lẻ
        DB_TYPE = os.environ.get("DB_TYPE", "mysql")  # "mysql" hoặc "postgresql"
        DB_HOST = os.environ.get("DB_HOST", "localhost")
        DB_PORT = os.environ.get("DB_PORT", "3306")
        DB_USER = os.environ.get("DB_USER", "root")
        DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
        DB_NAME = os.environ.get("DB_NAME", "cloak_link_db")

        if DB_TYPE == "postgresql":
            SQLALCHEMY_DATABASE_URI = (
                f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
                f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
            )
        else:
            # MySQL (local dev mặc định)
            SQLALCHEMY_DATABASE_URI = (
                f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
                f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
            )

    # Tắt tracking thay đổi (tiết kiệm bộ nhớ)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Connection pooling cho production
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,      # Tự kiểm tra connection trước khi dùng
        "pool_recycle": 300,        # Recycle connection sau 5 phút
        "pool_timeout": 20,         # Timeout khi lấy connection từ pool
        "max_overflow": 0,          # Không tạo thêm connection vượt pool_size
    }

    # =========================================================
    # CLOUDINARY - Lưu trữ ảnh bền vững trên cloud
    # QUAN TRỌNG: Không lưu file local trên Render (ổ đĩa ephemeral)
    # =========================================================
    CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")

    # Có Cloudinary hay không (dựa vào biến env)
    USE_CLOUDINARY = bool(
        os.environ.get("CLOUDINARY_CLOUD_NAME")
        and os.environ.get("CLOUDINARY_API_KEY")
        and os.environ.get("CLOUDINARY_API_SECRET")
    )

    # =========================================================
    # FILE UPLOAD (fallback khi không có Cloudinary - chỉ local dev)
    # =========================================================
    UPLOAD_FOLDER = os.path.join(
        os.path.dirname(__file__),
        os.environ.get("UPLOAD_FOLDER", "static/uploads")
    )
    # Dung lượng tối đa: 10MB
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
    # Các định dạng file ảnh được phép upload
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

    # =========================================================
    # CORS & URL
    # =========================================================
    # URL của Frontend Vercel (dùng cho CORS whitelist)
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # URL gốc của Backend server (dùng để build URL ảnh local fallback)
    BASE_URL = os.environ.get("BASE_URL", "http://localhost:5000")

    # Cloudinary folder để tổ chức ảnh
    CLOUDINARY_FOLDER = os.environ.get("CLOUDINARY_FOLDER", "cloak_link_og_images")


class DevelopmentConfig(Config):
    """Cấu hình cho môi trường phát triển."""
    DEBUG = True
    SQLALCHEMY_ECHO = False  # Đặt True để xem câu SQL được thực thi


class ProductionConfig(Config):
    """Cấu hình cho môi trường production (Render)."""
    DEBUG = False
    SQLALCHEMY_ECHO = False


# Map tên môi trường -> class config
config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
