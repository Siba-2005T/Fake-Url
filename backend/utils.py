"""
utils.py - Các hàm tiện ích cho Backend
=========================================
Bao gồm:
  - Upload ảnh lên Cloudinary (cloud storage, bền vững)
  - Fallback: lưu local nếu không cấu hình Cloudinary
  - Xóa ảnh trên Cloudinary và local
  - Build URL ảnh đầy đủ
"""
import os
import uuid
import logging
from typing import Optional, Tuple

import cloudinary
import cloudinary.uploader
from werkzeug.datastructures import FileStorage

logger = logging.getLogger(__name__)

# Các phần mở rộng file ảnh được phép upload
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def configure_cloudinary(app):
    """
    Cấu hình Cloudinary từ Flask app config.
    Được gọi một lần khi khởi động app.

    Args:
        app: Flask application instance
    """
    if app.config.get("USE_CLOUDINARY"):
        cloudinary.config(
            cloud_name=app.config["CLOUDINARY_CLOUD_NAME"],
            api_key=app.config["CLOUDINARY_API_KEY"],
            api_secret=app.config["CLOUDINARY_API_SECRET"],
            secure=True  # Luôn dùng HTTPS
        )
        logger.info("[✓] Cloudinary đã được cấu hình.")
    else:
        logger.warning(
            "[!] Cloudinary CHƯA được cấu hình. "
            "Ảnh sẽ được lưu local (KHÔNG phù hợp cho Production/Render)."
        )


def allowed_file(filename: str) -> bool:
    """
    Kiểm tra xem tên file có phần mở rộng hợp lệ không.

    Args:
        filename: Tên file cần kiểm tra
    Returns:
        True nếu hợp lệ, False nếu không
    """
    return (
        bool(filename)
        and "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def upload_image_to_cloudinary(
    file: FileStorage,
    folder: str = "cloak_link_og_images"
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload ảnh lên Cloudinary và trả về URL + public_id.

    Quy trình:
    1. Kiểm tra file hợp lệ
    2. Tạo public_id ngẫu nhiên bằng UUID (tránh trùng tên)
    3. Upload stream lên Cloudinary (không lưu disk)
    4. Trả về URL HTTPS bền vững và public_id để xóa sau này

    Args:
        file: FileStorage object từ request.files
        folder: Thư mục trên Cloudinary để tổ chức ảnh

    Returns:
        Tuple (image_url, public_id) hoặc (None, None) nếu lỗi
    """
    if not file or not file.filename:
        return None, None

    if not allowed_file(file.filename):
        return None, None

    try:
        # Tạo public_id duy nhất để tránh trùng lặp
        file_ext = file.filename.rsplit(".", 1)[1].lower()
        public_id = f"{folder}/{uuid.uuid4().hex}"

        # Upload trực tiếp từ file stream lên Cloudinary
        # Không cần lưu file xuống disk
        result = cloudinary.uploader.upload(
            file.stream,              # Stream dữ liệu file
            public_id=public_id,      # ID công khai trên Cloudinary
            overwrite=True,           # Ghi đè nếu trùng ID
            resource_type="image",    # Loại tài nguyên
            format=file_ext,          # Giữ nguyên định dạng gốc
            # Tối ưu cho OG image (Facebook khuyến nghị 1200x630)
            transformation=[
                {
                    "width": 1200,
                    "height": 630,
                    "crop": "limit",          # Không phóng to, chỉ thu nhỏ nếu lớn hơn
                    "quality": "auto:good",   # Tự động tối ưu chất lượng
                    "fetch_format": "auto",   # Tự động chọn format tốt nhất (WebP, AVIF...)
                }
            ],
            eager_async=False,        # Xử lý transform ngay (không async)
        )

        image_url = result.get("secure_url")    # URL HTTPS của ảnh
        returned_public_id = result.get("public_id")  # ID để xóa sau này

        logger.info(f"[✓] Upload Cloudinary thành công: {image_url}")
        return image_url, returned_public_id

    except cloudinary.exceptions.Error as e:
        logger.error(f"[✗] Cloudinary upload lỗi: {e}")
        return None, None
    except Exception as e:
        logger.error(f"[✗] Upload lỗi không xác định: {e}")
        return None, None


def delete_image_from_cloudinary(public_id: str) -> bool:
    """
    Xóa ảnh khỏi Cloudinary theo public_id.

    Args:
        public_id: Public ID của ảnh trên Cloudinary
    Returns:
        True nếu xóa thành công, False nếu không
    """
    if not public_id:
        return False

    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="image")
        success = result.get("result") == "ok"
        if success:
            logger.info(f"[✓] Đã xóa ảnh Cloudinary: {public_id}")
        else:
            logger.warning(f"[!] Không xóa được ảnh Cloudinary: {public_id} - {result}")
        return success
    except Exception as e:
        logger.error(f"[✗] Lỗi khi xóa ảnh Cloudinary: {e}")
        return False


# ============================================================
# FALLBACK: Lưu local (chỉ dùng cho local dev khi chưa có Cloudinary)
# CẢNH BÁO: KHÔNG dùng trong Production/Render vì ổ đĩa ephemeral!
# ============================================================

def save_uploaded_image_local(
    file: FileStorage,
    upload_folder: str
) -> Optional[str]:
    """
    [FALLBACK] Lưu file ảnh upload lên local disk.
    CHỈ dùng khi không có Cloudinary (local development).

    Args:
        file: FileStorage object từ request.files
        upload_folder: Đường dẫn tuyệt đối đến thư mục lưu trữ

    Returns:
        Đường dẫn tương đối (VD: "uploads/uuid.jpg") hoặc None nếu lỗi
    """
    if not file or not file.filename:
        return None

    if not allowed_file(file.filename):
        return None

    extension = file.filename.rsplit(".", 1)[1].lower()
    new_filename = f"{uuid.uuid4().hex}.{extension}"

    os.makedirs(upload_folder, exist_ok=True)
    save_path = os.path.join(upload_folder, new_filename)

    file.save(save_path)
    logger.warning(
        f"[!] Ảnh lưu local: uploads/{new_filename}. "
        "Dùng Cloudinary cho Production!"
    )
    return f"uploads/{new_filename}"


def delete_image_local(upload_folder: str, image_path: str) -> bool:
    """
    [FALLBACK] Xóa file ảnh khỏi local disk.

    Args:
        upload_folder: Thư mục gốc chứa uploads
        image_path: Đường dẫn tương đối (VD: "uploads/abc.jpg")
    Returns:
        True nếu xóa thành công
    """
    if not image_path:
        return False

    filename = os.path.basename(image_path)
    full_path = os.path.join(upload_folder, filename)

    if os.path.exists(full_path):
        os.remove(full_path)
        return True

    return False


def build_image_url(base_url: str, image_path: Optional[str]) -> Optional[str]:
    """
    Xây dựng URL đầy đủ của ảnh LOCAL để trả về cho frontend.
    Hàm này CHỈ dùng cho ảnh lưu local (fallback mode).

    Với Cloudinary: image_url được lưu thẳng vào DB, không cần build.

    Args:
        base_url: URL gốc của server (VD: http://localhost:5000)
        image_path: Đường dẫn tương đối (VD: uploads/abc.jpg)
    Returns:
        URL đầy đủ hoặc None
    """
    if not image_path:
        return None
    # Nếu là URL đầy đủ (từ Cloudinary), trả về thẳng
    if image_path.startswith("http://") or image_path.startswith("https://"):
        return image_path
    # Nếu là đường dẫn local tương đối
    return f"{base_url}/static/{image_path}"
