"""
routes/media.py - API quản lý Media & Affiliate Links
=======================================================
  - DELETE /api/telegram-videos/<id>
  - GET/POST/PUT/DELETE /api/direct-videos
  - GET/POST/PUT/DELETE /api/affiliate-links
"""
from flask import Blueprint, request, jsonify, current_app
from extensions import db
from models import TelegramVideo, DirectVideo, AffiliateLink

media_bp = Blueprint("media", __name__, url_prefix="/api")


# ============================================================
# TELEGRAM VIDEOS — chỉ có DELETE (bot tự thêm qua webhook)
# ============================================================
@media_bp.route("/telegram-videos/<int:video_id>", methods=["DELETE"])
def delete_telegram_video(video_id: int):
    """Xóa một Telegram Video khỏi DB theo id."""
    try:
        video = db.get_or_404(TelegramVideo, video_id)
        db.session.delete(video)
        db.session.commit()
        return jsonify({"success": True, "message": "Đã xóa video Telegram."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"delete_telegram_video error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# DIRECT VIDEOS — CRUD đầy đủ
# ============================================================
@media_bp.route("/direct-videos", methods=["GET"])
def get_direct_videos():
    """Lấy danh sách tất cả Direct Videos."""
    try:
        videos = DirectVideo.query.order_by(DirectVideo.created_at.desc()).all()
        return jsonify({"success": True, "data": [v.to_dict() for v in videos]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/direct-videos", methods=["POST"])
def create_direct_video():
    """Tạo Direct Video mới."""
    try:
        body = request.get_json()
        url = (body.get("url") or "").strip()
        caption = (body.get("caption") or "").strip()

        if not url:
            return jsonify({"success": False, "error": "url là bắt buộc."}), 400
        if not url.startswith(("http://", "https://")):
            return jsonify({"success": False, "error": "url phải bắt đầu bằng http:// hoặc https://"}), 400
        if not caption:
            return jsonify({"success": False, "error": "caption là bắt buộc."}), 400

        new_video = DirectVideo(url=url, caption=caption)
        db.session.add(new_video)
        db.session.commit()
        return jsonify({"success": True, "message": "Tạo thành công!", "data": new_video.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/direct-videos/<int:video_id>", methods=["PUT"])
def update_direct_video(video_id: int):
    """Cập nhật Direct Video."""
    try:
        video = db.get_or_404(DirectVideo, video_id)
        body = request.get_json()

        if "url" in body:
            url = body["url"].strip()
            if not url.startswith(("http://", "https://")):
                return jsonify({"success": False, "error": "url phải bắt đầu bằng http:// hoặc https://"}), 400
            video.url = url
        if "caption" in body:
            video.caption = body["caption"].strip()

        db.session.commit()
        return jsonify({"success": True, "message": "Cập nhật thành công!", "data": video.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/direct-videos/<int:video_id>", methods=["DELETE"])
def delete_direct_video(video_id: int):
    """Xóa Direct Video."""
    try:
        video = db.get_or_404(DirectVideo, video_id)
        db.session.delete(video)
        db.session.commit()
        return jsonify({"success": True, "message": "Đã xóa video."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# AFFILIATE LINKS — CRUD đầy đủ
# ============================================================
@media_bp.route("/affiliate-links", methods=["GET"])
def get_affiliate_links():
    """Lấy danh sách Affiliate Links, có thể lọc theo platform."""
    try:
        platform = request.args.get("platform", "").strip().lower()
        query = AffiliateLink.query.order_by(AffiliateLink.created_at.desc())
        if platform in ("shopee", "tiktok"):
            query = query.filter_by(platform=platform)
        links = query.all()
        return jsonify({"success": True, "data": [l.to_dict() for l in links]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/affiliate-links", methods=["POST"])
def create_affiliate_link():
    """Tạo Affiliate Link mới."""
    try:
        body = request.get_json()
        platform = (body.get("platform") or "").strip().lower()
        name = (body.get("name") or "").strip()
        url = (body.get("url") or "").strip()

        if platform not in ("shopee", "tiktok"):
            return jsonify({"success": False, "error": "platform phải là 'shopee' hoặc 'tiktok'."}), 400
        if not name:
            return jsonify({"success": False, "error": "name là bắt buộc."}), 400
        if not url or not url.startswith(("http://", "https://")):
            return jsonify({"success": False, "error": "url hợp lệ là bắt buộc."}), 400

        new_link = AffiliateLink(platform=platform, name=name, url=url)
        db.session.add(new_link)
        db.session.commit()
        return jsonify({"success": True, "message": "Tạo thành công!", "data": new_link.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/affiliate-links/<int:link_id>", methods=["PUT"])
def update_affiliate_link(link_id: int):
    """Cập nhật Affiliate Link."""
    try:
        link = db.get_or_404(AffiliateLink, link_id)
        body = request.get_json()

        if "platform" in body:
            platform = body["platform"].strip().lower()
            if platform not in ("shopee", "tiktok"):
                return jsonify({"success": False, "error": "platform phải là 'shopee' hoặc 'tiktok'."}), 400
            link.platform = platform
        if "name" in body:
            link.name = body["name"].strip()
        if "url" in body:
            url = body["url"].strip()
            if not url.startswith(("http://", "https://")):
                return jsonify({"success": False, "error": "url phải bắt đầu bằng http:// hoặc https://"}), 400
            link.url = url

        db.session.commit()
        return jsonify({"success": True, "message": "Cập nhật thành công!", "data": link.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/affiliate-links/<int:link_id>", methods=["DELETE"])
def delete_affiliate_link(link_id: int):
    """Xóa Affiliate Link."""
    try:
        link = db.get_or_404(AffiliateLink, link_id)
        db.session.delete(link)
        db.session.commit()
        return jsonify({"success": True, "message": "Đã xóa affiliate link."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
