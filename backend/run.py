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
