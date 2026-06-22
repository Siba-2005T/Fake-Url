"""
app.py - Điểm khởi động chính của Flask Backend
================================================
Khởi tạo Flask app, đăng ký extensions, blueprints,
cấu hình CORS, và thiết lập Cloudinary.
"""
import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS

from datetime import timedelta

from config import config_map
from extensions import db, jwt
from routes import links_bp, redirect_bp, media_bp, auth_bp
from utils import configure_cloudinary

# Thiết lập logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)


def create_app(env: str = None) -> Flask:
    """
    Application Factory Pattern.

    Tạo và cấu hình Flask application instance.
    Pattern này cho phép:
    - Test dễ hơn (tạo nhiều app instance)
    - Cấu hình linh hoạt theo môi trường
    - Tránh circular imports

    Args:
        env: Tên môi trường ('development', 'production')
             Mặc định lấy từ biến môi trường FLASK_ENV

    Returns:
        Flask application instance đã được cấu hình đầy đủ
    """
    # Tạo Flask app
    app = Flask(
        __name__,
        static_folder="static",
        static_url_path="/static"
    )

    # --- Nạp cấu hình theo môi trường ---
    env = env or os.environ.get("FLASK_ENV", "development")
    config_class = config_map.get(env, config_map["default"])
    app.config.from_object(config_class)

    # --- Tạo thư mục uploads (chỉ cần cho local dev) ---
    os.makedirs(app.config.get("UPLOAD_FOLDER", "static/uploads"), exist_ok=True)

    # --- Cấu hình Cloudinary ---
    # QUAN TRỌNG: Phải gọi sau khi load config
    configure_cloudinary(app)

    # --- Khởi tạo SQLAlchemy với app ---
    db.init_app(app)

    # --- Cấu hình JWT ---
    app.config["JWT_SECRET_KEY"] = app.config.get("SECRET_KEY", "jwt-secret-fallback")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"
    jwt.init_app(app)

    # --- Cấu hình CORS ---
    # Lấy danh sách origins được phép từ config
    frontend_url = app.config.get("FRONTEND_URL", "http://localhost:5173")

    # Danh sách tất cả origins được phép
    allowed_origins = [
        frontend_url,
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Create React App
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Loại bỏ duplicate và None
    allowed_origins = list(set(filter(None, allowed_origins)))

    CORS(app, resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept"],
            "expose_headers": ["Content-Type"],
            "supports_credentials": False,
        }
    })

    # --- Đăng ký Blueprints ---
    app.register_blueprint(auth_bp)       # /api/login, /api/me, /api/users
    app.register_blueprint(links_bp)      # /api/links/*
    app.register_blueprint(redirect_bp)   # /<slug> (root level)
    app.register_blueprint(media_bp)      # /api/telegram-videos, /api/direct-videos, /api/affiliate-links

    # --- Tạo bảng database nếu chưa tồn tại ---
    with app.app_context():
        db.create_all()
        app.logger.info("[✓] Database tables đã sẵn sàng.")

    # --- Error Handlers ---
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"success": False, "error": "Bad Request."}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"success": False, "error": "Không tìm thấy tài nguyên yêu cầu."}), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({"success": False, "error": "Phương thức HTTP không được hỗ trợ."}), 405

    @app.errorhandler(409)
    def conflict(error):
        return jsonify({"success": False, "error": "Xung đột dữ liệu."}), 409

    @app.errorhandler(413)
    def file_too_large(error):
        return jsonify({
            "success": False,
            "error": f"File upload vượt quá giới hạn cho phép ({app.config['MAX_CONTENT_LENGTH'] // 1024 // 1024}MB)."
        }), 413

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({"success": False, "error": "Lỗi máy chủ nội bộ. Vui lòng thử lại sau."}), 500

    # --- Health Check Endpoint ---
    @app.route("/api/health", methods=["GET"])
    def health_check():
        """Kiểm tra trạng thái server và các services."""
        use_cloudinary = app.config.get("USE_CLOUDINARY", False)
        return jsonify({
            "success": True,
            "status": "OK",
            "message": "Cloak Link Backend đang hoạt động!",
            "version": "2.0.0",
            "services": {
                "database": "connected",
                "image_storage": "cloudinary" if use_cloudinary else "local (dev only)",
                "cloudinary_configured": use_cloudinary,
            }
        }), 200

    app.logger.info(f"[✓] Flask app khởi động ở môi trường: {env.upper()}")
    use_cloudinary = app.config.get("USE_CLOUDINARY", False)
    app.logger.info(f"[✓] Image storage: {'Cloudinary ☁️' if use_cloudinary else 'Local 💻 (dev only)'}")

    return app


# ============================================================
# Điểm chạy trực tiếp
# ============================================================
if __name__ == "__main__":
    app = create_app()
    print("\n" + "=" * 55)
    print("  🚀 Cloak Link Backend v2.0 đang chạy!")
    print("  📡 Health:  http://localhost:5000/api/health")
    print("  📋 API:     http://localhost:5000/api/links/")
    print("  🔗 Redirect: http://localhost:5000/<slug>")
    print("=" * 55 + "\n")

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=True,
        use_reloader=True
    )
