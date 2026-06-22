"""
routes/auth.py - API Authentication & User Management
=======================================================
  - POST /api/login         : Đăng nhập, trả JWT token
  - GET  /api/me            : Thông tin user hiện tại
  - GET  /api/users          : Danh sách users (admin only)
  - POST /api/users          : Tạo user mới (admin only)
  - DELETE /api/users/<id>   : Xóa user (admin only)
"""
from functools import wraps
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from extensions import db
from models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api")


# ============================================================
# DECORATOR: Yêu cầu quyền Admin
# ============================================================
def admin_required(fn):
    """Decorator kiểm tra user hiện tại có role 'admin' không."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or user.role != "admin":
            return jsonify({"success": False, "error": "Bạn không có quyền truy cập."}), 403
        return fn(*args, **kwargs)
    return wrapper


# ============================================================
# POST /api/login - Đăng nhập
# ============================================================
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Nhận username/password, kiểm tra hash, trả JWT token.
    Request body: { "username": "...", "password": "..." }
    """
    try:
        body = request.get_json()
        if not body:
            return jsonify({"success": False, "error": "Thiếu dữ liệu."}), 400

        username = (body.get("username") or "").strip()
        password = (body.get("password") or "").strip()

        if not username or not password:
            return jsonify({"success": False, "error": "Username và password là bắt buộc."}), 400

        user = User.query.filter_by(username=username).first()

        if not user or not user.check_password(password):
            return jsonify({"success": False, "error": "Sai tên đăng nhập hoặc mật khẩu."}), 401

        # Tạo JWT token (identity = user.id dạng string)
        access_token = create_access_token(identity=str(user.id))

        return jsonify({
            "success": True,
            "message": "Đăng nhập thành công!",
            "token": access_token,
            "user": user.to_dict(),
        }), 200

    except Exception as e:
        current_app.logger.error(f"login error: {e}")
        return jsonify({"success": False, "error": "Lỗi server."}), 500


# ============================================================
# GET /api/me - Thông tin user hiện tại
# ============================================================
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Trả về thông tin user đang đăng nhập."""
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({"success": False, "error": "User không tồn tại."}), 404
    return jsonify({"success": True, "user": user.to_dict()}), 200


# ============================================================
# GET /api/users - Danh sách users (Admin only)
# ============================================================
@auth_bp.route("/users", methods=["GET"])
@admin_required
def get_users():
    """Lấy danh sách tất cả users."""
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        return jsonify({"success": True, "data": [u.to_dict() for u in users]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# POST /api/users - Tạo user mới (Admin only)
# ============================================================
@auth_bp.route("/users", methods=["POST"])
@admin_required
def create_user():
    """
    Tạo user mới.
    Body: { username, password, role, telegram_chat_id }
    """
    try:
        body = request.get_json()
        username = (body.get("username") or "").strip()
        password = (body.get("password") or "").strip()
        role = (body.get("role") or "user").strip().lower()
        telegram_chat_id = (body.get("telegram_chat_id") or "").strip() or None

        if not username or not password:
            return jsonify({"success": False, "error": "username và password là bắt buộc."}), 400
        if len(password) < 6:
            return jsonify({"success": False, "error": "Password phải có ít nhất 6 ký tự."}), 400
        if role not in ("admin", "user"):
            return jsonify({"success": False, "error": "role phải là 'admin' hoặc 'user'."}), 400

        # Kiểm tra trùng username
        if User.query.filter_by(username=username).first():
            return jsonify({"success": False, "error": f"Username '{username}' đã tồn tại."}), 409

        # Kiểm tra trùng telegram_chat_id
        if telegram_chat_id:
            existing_tg = User.query.filter_by(telegram_chat_id=telegram_chat_id).first()
            if existing_tg:
                return jsonify({
                    "success": False,
                    "error": f"Telegram Chat ID '{telegram_chat_id}' đã được gán cho user '{existing_tg.username}'."
                }), 409

        new_user = User(username=username, role=role, telegram_chat_id=telegram_chat_id)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Tạo user '{username}' thành công!",
            "data": new_user.to_dict(),
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# DELETE /api/users/<id> - Xóa user (Admin only)
# ============================================================
@auth_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id: int):
    """Xóa user theo ID. Không cho phép tự xóa chính mình."""
    try:
        current_user_id = int(get_jwt_identity())
        if current_user_id == user_id:
            return jsonify({"success": False, "error": "Không thể tự xóa chính mình!"}), 400

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"success": False, "error": "User không tồn tại."}), 404

        username = user.username
        db.session.delete(user)
        db.session.commit()
        return jsonify({"success": True, "message": f"Đã xóa user '{username}'."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
