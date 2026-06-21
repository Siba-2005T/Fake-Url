"""
routes/links.py - API Routes cho Cloak Links (CRUD)
=====================================================
Xử lý các thao tác tạo, đọc, cập nhật, xóa link.

Thay đổi quan trọng so với phiên bản cũ:
  - Tích hợp Cloudinary: upload ảnh lên cloud, lưu URL vào DB
  - Fallback local storage khi không cấu hình Cloudinary
  - Lưu image_public_id để xóa ảnh trên cloud khi cần
"""
import re
from flask import Blueprint, request, jsonify, current_app

from extensions import db
from models import CloakLink
from utils import (
    upload_image_to_cloudinary,
    delete_image_from_cloudinary,
    save_uploaded_image_local,
    delete_image_local,
    allowed_file,
)

# Tạo Blueprint để nhóm các routes liên quan đến links
links_bp = Blueprint("links", __name__, url_prefix="/api/links")


def _handle_image_upload(file) -> tuple[str | None, str | None, str | None]:
    """
    Xử lý upload ảnh - tự động chọn Cloudinary hoặc local.

    Returns:
        Tuple (image_path, image_public_id, error_message)
        - Nếu thành công: (url_or_path, public_id_or_none, None)
        - Nếu lỗi:        (None, None, error_message)
    """
    if not file or not file.filename:
        return None, None, None  # Không có file -> không phải lỗi

    if not allowed_file(file.filename):
        return None, None, "File ảnh không hợp lệ. Chỉ chấp nhận: PNG, JPG, JPEG, GIF, WEBP."

    use_cloudinary = current_app.config.get("USE_CLOUDINARY", False)

    if use_cloudinary:
        # --- Upload lên Cloudinary (Production) ---
        folder = current_app.config.get("CLOUDINARY_FOLDER", "cloak_link_og_images")
        image_url, public_id, error_msg = upload_image_to_cloudinary(file, folder=folder)

        if not image_url:
            return None, None, error_msg or "Upload ảnh lên Cloudinary thất bại. Vui lòng thử lại."

        # Lưu URL đầy đủ của Cloudinary vào image_path
        return image_url, public_id, None

    else:
        # --- Fallback: Lưu local (chỉ local dev) ---
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "static/uploads")
        image_path = save_uploaded_image_local(file, upload_folder)

        if not image_path:
            return None, None, "Lưu file ảnh thất bại."

        return image_path, None, None  # Local không có public_id


def _handle_image_delete(image_path: str | None, image_public_id: str | None):
    """
    Xóa ảnh cũ - tự động chọn Cloudinary hoặc local.
    """
    if not image_path:
        return

    use_cloudinary = current_app.config.get("USE_CLOUDINARY", False)

    if use_cloudinary and image_public_id:
        delete_image_from_cloudinary(image_public_id)
    elif not use_cloudinary and image_path and not image_path.startswith("http"):
        # Chỉ xóa local nếu là path tương đối (không phải URL cloud)
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "static/uploads")
        delete_image_local(upload_folder, image_path)


# ============================================================
# GET /api/links/ - Lấy danh sách tất cả links (có phân trang)
# ============================================================
@links_bp.route("/", methods=["GET"])
def get_all_links():
    """Trả về danh sách tất cả Cloak Links, sắp xếp mới nhất trước."""
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        # Query với phân trang, sắp xếp theo ngày tạo mới nhất
        paginated = (
            CloakLink.query
            .order_by(CloakLink.created_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        base_url = current_app.config.get("BASE_URL", "")
        links = [link.to_dict(base_url=base_url) for link in paginated.items]

        return jsonify({
            "success": True,
            "data": links,
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages,
                "has_next": paginated.has_next,
                "has_prev": paginated.has_prev,
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"get_all_links lỗi: {e}")
        return jsonify({"success": False, "error": "Không thể tải danh sách link."}), 500


# ============================================================
# POST /api/links/ - Tạo Cloak Link mới (với Cloudinary upload)
# ============================================================
@links_bp.route("/", methods=["POST"])
def create_link():
    """
    Tạo một Cloak Link mới.

    Nhận dữ liệu dạng multipart/form-data (vì có upload ảnh):
    - original_url   (required): URL gốc cần che giấu
    - custom_slug    (required): Slug tùy chỉnh (VD: hoat-hinh-2026)
    - custom_domain  (optional): Tên miền riêng
    - og_title       (optional): Tiêu đề OG
    - og_description (optional): Mô tả OG
    - image          (optional): File ảnh thumbnail -> upload lên Cloudinary
    """
    try:
        # --- Lấy dữ liệu text từ form ---
        original_url = request.form.get("original_url", "").strip()
        custom_slug = request.form.get("custom_slug", "").strip()
        custom_domain = request.form.get("custom_domain", "").strip() or None
        og_title = request.form.get("og_title", "").strip() or None
        og_description = request.form.get("og_description", "").strip() or None
        telegram_file_id = request.form.get("telegram_file_id", "").strip() or None
        content_description = request.form.get("content_description", "").strip() or None
        second_affiliate_url = request.form.get("second_affiliate_url", "").strip() or None

        # --- Validation bắt buộc ---
        if not original_url:
            return jsonify({"success": False, "error": "original_url là bắt buộc."}), 400

        if not custom_slug:
            return jsonify({"success": False, "error": "custom_slug là bắt buộc."}), 400

        if not original_url.startswith(("http://", "https://")):
            return jsonify({
                "success": False,
                "error": "original_url phải bắt đầu bằng http:// hoặc https://"
            }), 400

        if not re.match(r"^[a-zA-Z0-9\-_]+$", custom_slug):
            return jsonify({
                "success": False,
                "error": "custom_slug chỉ được chứa chữ cái, số, gạch ngang (-) và gạch dưới (_)."
            }), 400

        # Kiểm tra slug đã tồn tại chưa (báo 409 Conflict)
        if CloakLink.query.filter_by(custom_slug=custom_slug).first():
            return jsonify({
                "success": False,
                "error": f"Slug '{custom_slug}' đã được sử dụng. Vui lòng chọn slug khác."
            }), 409  # 409 Conflict

        # --- Xử lý upload ảnh (Cloudinary hoặc local fallback) ---
        image_path = None
        image_public_id = None

        if "image" in request.files:
            file = request.files["image"]
            image_path, image_public_id, upload_error = _handle_image_upload(file)
            if upload_error:
                return jsonify({"success": False, "error": upload_error}), 400

        # --- Tạo bản ghi mới trong database ---
        new_link = CloakLink(
            original_url=original_url,
            custom_slug=custom_slug,
            custom_domain=custom_domain,
            og_title=og_title,
            og_description=og_description,
            telegram_file_id=telegram_file_id,
            content_description=content_description,
            second_affiliate_url=second_affiliate_url,  # Link phụ (TikTok) - bẫy tầng 2
            image_path=image_path,           # URL Cloudinary hoặc path local
            image_public_id=image_public_id, # Cloudinary public_id (để xóa sau)
        )

        db.session.add(new_link)
        db.session.commit()

        base_url = current_app.config.get("BASE_URL", "")
        return jsonify({
            "success": True,
            "message": "Tạo Cloak Link thành công!",
            "data": new_link.to_dict(base_url=base_url)
        }), 201  # 201 Created

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"create_link lỗi: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# GET /api/links/<id> - Lấy chi tiết một link theo ID
# ============================================================
@links_bp.route("/<int:link_id>", methods=["GET"])
def get_link(link_id: int):
    """Trả về chi tiết một Cloak Link theo ID."""
    link = db.get_or_404(CloakLink, link_id)
    base_url = current_app.config.get("BASE_URL", "")
    return jsonify({"success": True, "data": link.to_dict(base_url=base_url)}), 200


# ============================================================
# PUT /api/links/<id> - Cập nhật một link
# ============================================================
@links_bp.route("/<int:link_id>", methods=["PUT"])
def update_link(link_id: int):
    """
    Cập nhật thông tin Cloak Link.
    Nếu upload ảnh mới:
      - Xóa ảnh cũ khỏi Cloudinary (hoặc local)
      - Upload ảnh mới lên Cloudinary (hoặc local)
    """
    try:
        link = db.get_or_404(CloakLink, link_id)

        # Cập nhật các field text nếu được gửi lên
        if "original_url" in request.form:
            original_url = request.form.get("original_url", "").strip()
            if not original_url.startswith(("http://", "https://")):
                return jsonify({
                    "success": False,
                    "error": "original_url phải bắt đầu bằng http:// hoặc https://"
                }), 400
            link.original_url = original_url

        if "custom_domain" in request.form:
            link.custom_domain = request.form.get("custom_domain", "").strip() or None
        if "og_title" in request.form:
            link.og_title = request.form.get("og_title", "").strip() or None
        if "og_description" in request.form:
            link.og_description = request.form.get("og_description", "").strip() or None
        if "telegram_file_id" in request.form:
            link.telegram_file_id = request.form.get("telegram_file_id", "").strip() or None
        if "content_description" in request.form:
            link.content_description = request.form.get("content_description", "").strip() or None
        if "second_affiliate_url" in request.form:
            link.second_affiliate_url = request.form.get("second_affiliate_url", "").strip() or None
        if "is_active" in request.form:
            link.is_active = request.form.get("is_active", "true").lower() == "true"

        # Xử lý upload ảnh mới
        if "image" in request.files:
            file = request.files["image"]
            if file and file.filename:
                new_image_path, new_public_id, upload_error = _handle_image_upload(file)
                if upload_error:
                    return jsonify({"success": False, "error": upload_error}), 400

                # Xóa ảnh cũ (Cloudinary hoặc local)
                _handle_image_delete(link.image_path, link.image_public_id)

                link.image_path = new_image_path
                link.image_public_id = new_public_id

        db.session.commit()

        base_url = current_app.config.get("BASE_URL", "")
        return jsonify({
            "success": True,
            "message": "Cập nhật thành công!",
            "data": link.to_dict(base_url=base_url)
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"update_link lỗi: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# DELETE /api/links/<id> - Xóa một link
# ============================================================
@links_bp.route("/<int:link_id>", methods=["DELETE"])
def delete_link(link_id: int):
    """Xóa một Cloak Link và ảnh liên quan (Cloudinary hoặc local)."""
    try:
        link = db.get_or_404(CloakLink, link_id)

        # Xóa ảnh trước (Cloudinary hoặc local)
        _handle_image_delete(link.image_path, link.image_public_id)

        slug = link.custom_slug
        db.session.delete(link)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Đã xóa link có slug '{slug}'."
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"delete_link lỗi: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
