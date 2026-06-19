"""
run.py - Script khởi động cho Production (Gunicorn)
====================================================
Gunicorn sẽ import module này và gọi `create_app()`.
Render.com sử dụng lệnh: gunicorn run:app
"""
import os
from app import create_app

# Tạo app instance (Gunicorn sẽ import biến `app` này)
app = create_app(env=os.environ.get("FLASK_ENV", "production"))

if __name__ == "__main__":
    # Dùng khi chạy bằng lệnh: python run.py
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
