"""
extensions.py - Khởi tạo các extension Flask
=============================================
Tách riêng việc khởi tạo extension để tránh
circular import giữa app.py và models.py.
"""
from flask_sqlalchemy import SQLAlchemy

# Khởi tạo SQLAlchemy (chưa gắn với app)
# Sẽ được gắn với app trong app.py qua db.init_app(app)
db = SQLAlchemy()
