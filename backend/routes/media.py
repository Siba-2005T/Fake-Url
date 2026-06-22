"""
routes/media.py - API quản lý Media & Affiliate Links (JWT + Multi-tenancy)
============================================================================
Tất cả API đều yêu cầu JWT. Dữ liệu cách ly theo user_id.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import TelegramVideo, DirectVideo, AffiliateLink

media_bp = Blueprint("media", __name__, url_prefix="/api")


def _get_user_id():
    """Lấy user_id từ JWT token."""
    return int(get_jwt_identity())


# ============================================================
# TELEGRAM VIDEOS
# ============================================================
@media_bp.route("/telegram-videos", methods=["GET"])
@jwt_required()
def get_telegram_videos():
    """Lấy danh sách Telegram Videos của user hiện tại."""
    try:
        uid = _get_user_id()
        videos = TelegramVideo.query.filter_by(user_id=uid).order_by(TelegramVideo.created_at.desc()).all()
        return jsonify({"success": True, "data": [v.to_dict() for v in videos]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/telegram-videos/<int:video_id>", methods=["DELETE"])
@jwt_required()
def delete_telegram_video(video_id: int):
    """Xóa Telegram Video (chỉ của user hiện tại)."""
    try:
        uid = _get_user_id()
        video = TelegramVideo.query.filter_by(id=video_id, user_id=uid).first_or_404()
        db.session.delete(video)
        db.session.commit()
        return jsonify({"success": True, "message": "Đã xóa video Telegram."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# DIRECT VIDEOS — CRUD
# ============================================================
@media_bp.route("/direct-videos", methods=["GET"])
@jwt_required()
def get_direct_videos():
    """Lấy danh sách Direct Videos của user hiện tại."""
    try:
        uid = _get_user_id()
        videos = DirectVideo.query.filter_by(user_id=uid).order_by(DirectVideo.created_at.desc()).all()
        return jsonify({"success": True, "data": [v.to_dict() for v in videos]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/direct-videos", methods=["POST"])
@jwt_required()
def create_direct_video():
    """Tạo Direct Video mới (gắn user_id)."""
    try:
        uid = _get_user_id()
        body = request.get_json()
        url = (body.get("url") or "").strip()
        caption = (body.get("caption") or "").strip()

        if not url or not url.startswith(("http://", "https://")):
            return jsonify({"success": False, "error": "URL hợp lệ là bắt buộc."}), 400
        if not caption:
            return jsonify({"success": False, "error": "Caption là bắt buộc."}), 400

        new_video = DirectVideo(user_id=uid, url=url, caption=caption)
        db.session.add(new_video)
        db.session.commit()
        return jsonify({"success": True, "message": "Tạo thành công!", "data": new_video.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/direct-videos/<int:video_id>", methods=["PUT"])
@jwt_required()
def update_direct_video(video_id: int):
    """Cập nhật Direct Video (chỉ của user hiện tại)."""
    try:
        uid = _get_user_id()
        video = DirectVideo.query.filter_by(id=video_id, user_id=uid).first_or_404()
        body = request.get_json()

        if "url" in body:
            url = body["url"].strip()
            if not url.startswith(("http://", "https://")):
                return jsonify({"success": False, "error": "URL phải bắt đầu bằng http://"}), 400
            video.url = url
        if "caption" in body:
            video.caption = body["caption"].strip()

        db.session.commit()
        return jsonify({"success": True, "message": "Cập nhật thành công!", "data": video.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/direct-videos/<int:video_id>", methods=["DELETE"])
@jwt_required()
def delete_direct_video(video_id: int):
    """Xóa Direct Video (chỉ của user hiện tại)."""
    try:
        uid = _get_user_id()
        video = DirectVideo.query.filter_by(id=video_id, user_id=uid).first_or_404()
        db.session.delete(video)
        db.session.commit()
        return jsonify({"success": True, "message": "Đã xóa video."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# AFFILIATE LINKS — CRUD
# ============================================================
@media_bp.route("/affiliate-links", methods=["GET"])
@jwt_required()
def get_affiliate_links():
    """Lấy danh sách Affiliate Links của user hiện tại (lọc theo platform)."""
    try:
        uid = _get_user_id()
        platform = request.args.get("platform", "").strip().lower()
        query = AffiliateLink.query.filter_by(user_id=uid).order_by(AffiliateLink.created_at.desc())
        if platform in ("shopee", "tiktok"):
            query = query.filter_by(platform=platform)
        links = query.all()
        return jsonify({"success": True, "data": [l.to_dict() for l in links]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/affiliate-links", methods=["POST"])
@jwt_required()
def create_affiliate_link():
    """Tạo Affiliate Link mới (gắn user_id)."""
    try:
        uid = _get_user_id()
        body = request.get_json()
        platform = (body.get("platform") or "").strip().lower()
        name = (body.get("name") or "").strip()
        url = (body.get("url") or "").strip()

        if platform not in ("shopee", "tiktok"):
            return jsonify({"success": False, "error": "platform phải là 'shopee' hoặc 'tiktok'."}), 400
        if not name:
            return jsonify({"success": False, "error": "name là bắt buộc."}), 400
        if not url or not url.startswith(("http://", "https://")):
            return jsonify({"success": False, "error": "URL hợp lệ là bắt buộc."}), 400

        new_link = AffiliateLink(user_id=uid, platform=platform, name=name, url=url)
        db.session.add(new_link)
        db.session.commit()
        return jsonify({"success": True, "message": "Tạo thành công!", "data": new_link.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/affiliate-links/<int:link_id>", methods=["PUT"])
@jwt_required()
def update_affiliate_link(link_id: int):
    """Cập nhật Affiliate Link (chỉ của user hiện tại)."""
    try:
        uid = _get_user_id()
        link = AffiliateLink.query.filter_by(id=link_id, user_id=uid).first_or_404()
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
                return jsonify({"success": False, "error": "URL phải bắt đầu bằng http://"}), 400
            link.url = url

        db.session.commit()
        return jsonify({"success": True, "message": "Cập nhật thành công!", "data": link.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@media_bp.route("/affiliate-links/<int:link_id>", methods=["DELETE"])
@jwt_required()
def delete_affiliate_link(link_id: int):
    """Xóa Affiliate Link (chỉ của user hiện tại)."""
    try:
        uid = _get_user_id()
        link = AffiliateLink.query.filter_by(id=link_id, user_id=uid).first_or_404()
        db.session.delete(link)
        db.session.commit()
        return jsonify({"success": True, "message": "Đã xóa affiliate link."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
