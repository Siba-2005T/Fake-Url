"""
routes/links.py - API Routes cho Cloak Links (CRUD + JWT Multi-tenancy)
=========================================================================
Tất cả API đều yêu cầu JWT token.
Dữ liệu được cách ly theo user_id lấy từ token.
"""
import re
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from extensions import db
from models import CloakLink, AffiliateLink
from utils import (
    upload_image_to_cloudinary,
    delete_image_from_cloudinary,
    save_uploaded_image_local,
    delete_image_local,
    allowed_file,
)

links_bp = Blueprint("links", __name__, url_prefix="/api/links")


def _get_user_id():
    """Lấy user_id từ JWT token."""
    return int(get_jwt_identity())


def _resolve_link_value(value, platform, uid):
    """
    Xử lý auto-create Affiliate Link nếu value là URL.
    - Nếu value là ID (số): kiểm tra và trả về ID.
    - Nếu value là URL: tạo AffiliateLink mới và trả về ID.
    """
    if not value:
        return None
        
    value = str(value).strip()
    
    # Nếu là ID số hợp lệ
    if value.isdigit():
        link_obj = AffiliateLink.query.filter_by(id=int(value), user_id=uid).first()
        return link_obj.id if link_obj else None
        
    # Nếu là URL
    if value.startswith(("http://", "https://")):
        # Kiểm tra xem URL đã tồn tại chưa
        existing = AffiliateLink.query.filter_by(url=value, user_id=uid).first()
        if existing:
            return existing.id
            
        # Tạo mới
        new_aff_link = AffiliateLink(
            user_id=uid,
            platform=platform or "shopee",
            name=f"Link dán nhanh - {datetime.now().strftime('%H:%M %d/%m')}",
            url=value
        )
        db.session.add(new_aff_link)
        db.session.commit()
        return new_aff_link.id
        
    return None


def _handle_image_upload(file) -> tuple[str | None, str | None, str | None]:
    """Xử lý upload ảnh - tự động chọn Cloudinary hoặc local."""
    if not file or not file.filename:
        return None, None, None

    if not allowed_file(file.filename):
        return None, None, "File ảnh không hợp lệ. Chỉ chấp nhận: PNG, JPG, JPEG, GIF, WEBP."

    use_cloudinary = current_app.config.get("USE_CLOUDINARY", False)

    if use_cloudinary:
        folder = current_app.config.get("CLOUDINARY_FOLDER", "cloak_link_og_images")
        image_url, public_id, error_msg = upload_image_to_cloudinary(file, folder=folder)
        if not image_url:
            return None, None, error_msg or "Upload ảnh lên Cloudinary thất bại."
        return image_url, public_id, None
    else:
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "static/uploads")
        image_path = save_uploaded_image_local(file, upload_folder)
        if not image_path:
            return None, None, "Lưu file ảnh thất bại."
        return image_path, None, None


def _handle_image_delete(image_path: str | None, image_public_id: str | None):
    """Xóa ảnh cũ - tự động chọn Cloudinary hoặc local."""
    if not image_path:
        return
    use_cloudinary = current_app.config.get("USE_CLOUDINARY", False)
    if use_cloudinary and image_public_id:
        delete_image_from_cloudinary(image_public_id)
    elif not use_cloudinary and image_path and not image_path.startswith("http"):
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "static/uploads")
        delete_image_local(upload_folder, image_path)


# ============================================================
# GET /api/links/ - Lấy danh sách links CỦA USER HIỆN TẠI
# ============================================================
@links_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_links():
    """Trả về danh sách Cloak Links của user hiện tại."""
    try:
        uid = _get_user_id()
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        paginated = (
            CloakLink.query
            .filter_by(user_id=uid)
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
# POST /api/links/ - Tạo Cloak Link mới (gắn user_id)
# ============================================================
@links_bp.route("/", methods=["POST"])
@jwt_required()
def create_link():
    """Tạo một Cloak Link mới, gắn với user hiện tại.
    
    Hỗ trợ 2 chế độ:
    - V2 (mới): Nhận link1_id và link2_id (FK → affiliate_links)
    - V1 (cũ): Nhận original_url và second_affiliate_url (backward-compat)
    """
    try:
        uid = _get_user_id()

        custom_slug = request.form.get("custom_slug", "").strip()
        custom_domain = request.form.get("custom_domain", "").strip() or None
        og_title = request.form.get("og_title", "").strip() or None
        og_description = request.form.get("og_description", "").strip() or None
        video_source = request.form.get("video_source", "direct").strip()
        telegram_file_id = request.form.get("telegram_file_id", "").strip() or None
        direct_video_url = request.form.get("direct_video_url", "").strip() or None
        content_description = request.form.get("content_description", "").strip() or None
        og_image_url_input  = request.form.get("og_image_url", "").strip() or None

        # ── V2.1: Nhận value (ID hoặc URL) và platform ──
        link1_value = request.form.get("link1_value", "").strip()
        link1_platform = request.form.get("link1_platform", "shopee").strip()
        link2_value = request.form.get("link2_value", "").strip()
        link2_platform = request.form.get("link2_platform", "tiktok").strip()

        link1_id = _resolve_link_value(link1_value, link1_platform, uid)
        link2_id = _resolve_link_value(link2_value, link2_platform, uid)

        # Resolve URL từ affiliate_links nếu có link1_id
        link1_obj = AffiliateLink.query.filter_by(id=link1_id, user_id=uid).first() if link1_id else None
        link2_obj = AffiliateLink.query.filter_by(id=link2_id, user_id=uid).first() if link2_id else None

        # Fallback v1: đọc original_url / second_affiliate_url trực tiếp
        original_url = (link1_obj.url if link1_obj else None) \
                        or request.form.get("original_url", "").strip() or None
        second_affiliate_url = (link2_obj.url if link2_obj else None) \
                                or request.form.get("second_affiliate_url", "").strip() or None

        # Validation cơ bản
        if not custom_slug:
            return jsonify({"success": False, "error": "custom_slug là bắt buộc."}), 400
        if not re.match(r"^[a-zA-Z0-9\-_]+$", custom_slug):
            return jsonify({"success": False, "error": "custom_slug chỉ được chứa chữ, số, - và _"}), 400
        if not link1_id and not original_url:
            return jsonify({"success": False, "error": "Phải chọn ít nhất Bẫy Click Lần 1."}), 400
        if original_url and not original_url.startswith(("http://", "https://")):
            return jsonify({"success": False, "error": "URL phải bắt đầu bằng http:// hoặc https://"}), 400

        if CloakLink.query.filter_by(custom_slug=custom_slug).first():
            return jsonify({"success": False, "error": f"Slug '{custom_slug}' đã được sử dụng."}), 409

        # Upload ảnh
        image_path, image_public_id = None, None
        if "image" in request.files:
            file = request.files["image"]
            image_path, image_public_id, upload_error = _handle_image_upload(file)
            if upload_error:
                return jsonify({"success": False, "error": upload_error}), 400

        new_link = CloakLink(
            user_id=uid,
            original_url=original_url,
            custom_slug=custom_slug,
            custom_domain=custom_domain,
            og_title=og_title,
            og_description=og_description,
            og_image_url=og_image_url_input,
            video_source=video_source,
            telegram_file_id=telegram_file_id,
            direct_video_url=direct_video_url,
            content_description=content_description,
            second_affiliate_url=second_affiliate_url,
            link1_id=link1_id,
            link2_id=link2_id,
            image_path=image_path,
            image_public_id=image_public_id,
        )

        db.session.add(new_link)
        db.session.commit()

        base_url = current_app.config.get("BASE_URL", "")
        return jsonify({
            "success": True,
            "message": "Tạo Cloak Link thành công!",
            "data": new_link.to_dict(base_url=base_url)
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"create_link lỗi: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# GET /api/links/<id>
# ============================================================
@links_bp.route("/<int:link_id>", methods=["GET"])
@jwt_required()
def get_link(link_id: int):
    """Lấy chi tiết link (chỉ của user hiện tại)."""
    uid = _get_user_id()
    link = CloakLink.query.filter_by(id=link_id, user_id=uid).first_or_404()
    base_url = current_app.config.get("BASE_URL", "")
    return jsonify({"success": True, "data": link.to_dict(base_url=base_url)}), 200


# ============================================================
# PUT /api/links/<id> - Cập nhật link (chỉ của user hiện tại)
# ============================================================
@links_bp.route("/<int:link_id>", methods=["PUT"])
@jwt_required()
def update_link(link_id: int):
    """Cập nhật Cloak Link (chỉ cho phép sửa link của mình)."""
    try:
        uid = _get_user_id()
        link = CloakLink.query.filter_by(id=link_id, user_id=uid).first_or_404()

        if "original_url" in request.form:
            original_url = request.form.get("original_url", "").strip()
            if not original_url.startswith(("http://", "https://")):
                return jsonify({"success": False, "error": "original_url phải bắt đầu bằng http://"}), 400
            link.original_url = original_url

        if "custom_domain" in request.form:
            link.custom_domain = request.form.get("custom_domain", "").strip() or None
        if "og_title" in request.form:
            link.og_title = request.form.get("og_title", "").strip() or None
        if "og_description" in request.form:
            link.og_description = request.form.get("og_description", "").strip() or None
        if "video_source" in request.form:
            link.video_source = request.form.get("video_source", "direct").strip()
        if "telegram_file_id" in request.form:
            link.telegram_file_id = request.form.get("telegram_file_id", "").strip() or None
        if "direct_video_url" in request.form:
            link.direct_video_url = request.form.get("direct_video_url", "").strip() or None
        if "content_description" in request.form:
            link.content_description = request.form.get("content_description", "").strip() or None
        if "og_image_url" in request.form:
            link.og_image_url = request.form.get("og_image_url", "").strip() or None
        if "second_affiliate_url" in request.form:
            link.second_affiliate_url = request.form.get("second_affiliate_url", "").strip() or None
        # V2.1: cập nhật FK hỗ trợ auto-create
        if "link1_value" in request.form:
            link.link1_id = _resolve_link_value(request.form.get("link1_value", ""), request.form.get("link1_platform", ""), uid)
        if "link2_value" in request.form:
            link.link2_id = _resolve_link_value(request.form.get("link2_value", ""), request.form.get("link2_platform", ""), uid)
        if "is_active" in request.form:
            link.is_active = request.form.get("is_active", "true").lower() == "true"

        if "image" in request.files:
            file = request.files["image"]
            if file and file.filename:
                new_image_path, new_public_id, upload_error = _handle_image_upload(file)
                if upload_error:
                    return jsonify({"success": False, "error": upload_error}), 400
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
# DELETE /api/links/<id> - Xóa link (chỉ của user hiện tại)
# ============================================================
@links_bp.route("/<int:link_id>", methods=["DELETE"])
@jwt_required()
def delete_link(link_id: int):
    """Xóa Cloak Link (chỉ cho phép xóa link của mình)."""
    try:
        uid = _get_user_id()
        link = CloakLink.query.filter_by(id=link_id, user_id=uid).first_or_404()

        _handle_image_delete(link.image_path, link.image_public_id)
        slug = link.custom_slug
        db.session.delete(link)
        db.session.commit()

        return jsonify({"success": True, "message": f"Đã xóa link '{slug}'."}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"delete_link lỗi: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
