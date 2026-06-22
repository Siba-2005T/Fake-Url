"""
create_admin.py - Script tạo tài khoản admin mặc định
=======================================================
Chạy 1 lần duy nhất: python create_admin.py
"""
from app import create_app
from extensions import db
from models import User

app = create_app()

with app.app_context():
    # Kiểm tra xem admin đã tồn tại chưa
    existing = User.query.filter_by(username="admin").first()
    if existing:
        print(f"⚠️  Tài khoản 'admin' đã tồn tại (id={existing.id}).")
    else:
        admin = User(username="admin", role="admin")
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()
        print(f"✅ Tạo tài khoản admin thành công!")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   Role:     admin")
        print(f"\n⚠️  Hãy đổi mật khẩu ngay sau khi đăng nhập lần đầu!")
