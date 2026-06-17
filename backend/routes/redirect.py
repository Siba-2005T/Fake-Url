"""
routes/redirect.py - Dynamic Redirect Engine (TRÁI TIM của hệ thống)
=====================================================================

ĐÂY LÀ ENDPOINT QUAN TRỌNG NHẤT - Giải thích luồng hoạt động:

LUỒNG 1: Bot crawl (Facebook/Zalo/Telegram scrape link để lấy preview)
---------------------------------------------------------------------------
1. Facebook/Zalo phát hiện link VD: https://your-domain.com/hoat-hinh-2026
2. Bot crawler gửi GET request đến endpoint này với User-Agent dạng:
   "facebookexternalhit/1.1", "Facebot", "TelegramBot", v.v.
3. Endpoint phát hiện đây là bot (dựa vào User-Agent)
4. Trả về trang HTML chứa OG tags đầy đủ:
   - og:title   -> Tiêu đề tùy chỉnh từ database
   - og:image   -> Ảnh thumbnail đã upload (QUAN TRỌNG: ghi đè ảnh gốc!)
   - og:url     -> URL cloak (URL ngắn)
   - og:description -> Mô tả từ database
5. Bot đọc các OG tags này và tạo preview đẹp trên mạng xã hội

LUỒNG 2: Người dùng thực tế click link
---------------------------------------------------------------------------
1. Người dùng click link VD: https://your-domain.com/hoat-hinh-2026
2. Browser gửi GET request đến endpoint này với User-Agent thông thường
3. Endpoint trả về HTML có:
   - OG tags (để đảm bảo)
   - Script JavaScript: window.location.href = "https://shopee.vn/..."
4. Browser thực thi JavaScript -> tự động chuyển hướng sang URL gốc
5. Người dùng thấy trang Shopee, KHÔNG biết link gốc là gì!

KẾT QUẢ: Link chia sẻ trên Facebook hiển thị ảnh/tiêu đề tùy chỉnh,
người dùng click được redirect sang trang thật.
"""
import re
from flask import Blueprint, request, render_template_string, abort, current_app

from extensions import db
from models import CloakLink
from utils import build_image_url

# Blueprint cho redirect engine (không có prefix để xử lý ở root)
redirect_bp = Blueprint("redirect", __name__)

# ============================================================
# DANH SÁCH User-Agent của các Bot crawler mạng xã hội
# ============================================================
# Dùng để phân biệt bot (cần OG tags) vs người dùng thật (cần redirect)
BOT_USER_AGENTS = [
    "facebookexternalhit",   # Facebook scraper
    "facebot",               # Facebook bot
    "twitterbot",            # Twitter/X card validator
    "telegrambot",           # Telegram link preview
    "linkedinbot",           # LinkedIn post scraper
    "whatsapp",              # WhatsApp link preview
    "slackbot",              # Slack unfurling
    "discordbot",            # Discord embed
    "zalo",                  # Zalo link preview
    "googlebot",             # Google crawler
    "bingbot",               # Bing crawler
    "applebot",              # Apple crawler
    "pinterest",             # Pinterest bot
    "developers.google.com", # Google Rich Results Test
]

# ============================================================
# TEMPLATE HTML - Trang OG + Redirect
# ============================================================
# Template này sẽ được render với dữ liệu từ database.
# Chứa cả OG meta tags lẫn script redirect cho người dùng thật.
OG_REDIRECT_TEMPLATE = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!--
    ================================================================
    OG META TAGS - Đây là phần quan trọng để tùy chỉnh preview
    khi link được chia sẻ trên Facebook, Zalo, Telegram, v.v.
    ================================================================
    -->

    <!-- Tiêu đề hiển thị khi share lên mạng xã hội -->
    <meta property="og:title" content="{{ og_title }}" />

    <!-- Mô tả ngắn hiển thị dưới tiêu đề -->
    <meta property="og:description" content="{{ og_description }}" />

    <!--
    ẢNH THUMBNAIL - Đây là ảnh GHI ĐÈ lên ảnh mặc định của link gốc!
    Facebook yêu cầu ảnh ít nhất 1200x630px để hiển thị đẹp nhất.
    -->
    <meta property="og:image" content="{{ og_image }}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- URL của trang cloak (không phải URL gốc) -->
    <meta property="og:url" content="{{ og_url }}" />

    <!-- Loại nội dung -->
    <meta property="og:type" content="website" />

    <!-- Twitter Card (dùng cho Twitter/X) -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ og_title }}" />
    <meta name="twitter:description" content="{{ og_description }}" />
    <meta name="twitter:image" content="{{ og_image }}" />

    <title>{{ og_title }}</title>

    <style>
        /* Ẩn nội dung trang - người dùng sẽ bị redirect ngay lập tức */
        body {
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: sans-serif;
            color: #fff;
        }
        .loader {
            text-align: center;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.1);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <!-- Nội dung trang (chỉ hiển thị trong tích tắc) -->
    <div class="loader">
        <div class="spinner"></div>
        <p>Đang chuyển hướng...</p>
    </div>

    <!--
    ================================================================
    REDIRECT SCRIPT - Tự động chuyển hướng người dùng thật
    ================================================================
    Đây là cơ chế "cloak":
    1. Bot chỉ đọc HTML (không thực thi JS) -> thấy OG tags đẹp
    2. Browser người dùng chạy JS -> redirect sang URL gốc ngay lập tức
    ================================================================
    -->
    <script>
        // Chuyển hướng ngay lập tức sang URL gốc
        // Dùng replace() thay vì href để không lưu vào history
        // (người dùng bấm Back sẽ không quay lại trang cloak)
        window.location.replace("{{ original_url }}");
    </script>

    <!-- Fallback: Nếu JS bị tắt, dùng meta refresh -->
    <noscript>
        <meta http-equiv="refresh" content="0; url={{ original_url }}" />
    </noscript>
</body>
</html>"""


def is_bot_request(user_agent: str) -> bool:
    """
    Kiểm tra xem request đến có phải từ bot crawler không.

    Dù cả bot và người dùng thật đều nhận cùng một HTML response
    (có đủ OG tags và redirect script), nhưng hàm này hữu ích
    nếu sau này muốn phân tách logic (VD: log analytics riêng).

    Args:
        user_agent: Chuỗi User-Agent từ HTTP header

    Returns:
        True nếu là bot, False nếu là người dùng thật
    """
    ua_lower = user_agent.lower()
    return any(bot in ua_lower for bot in BOT_USER_AGENTS)


# ============================================================
# ENDPOINT CHÍNH: GET /<slug>
# Xử lý redirect và render OG tags
# ============================================================
@redirect_bp.route("/<string:slug>", methods=["GET"])
def handle_redirect(slug: str):
    """
    Dynamic Redirect Engine - Endpoint xử lý cloak link.

    Khi request đến:
    1. Tìm slug trong database
    2. Render HTML với OG tags từ database + script redirect
    3. Trả về HTML (bot đọc OG tags, browser execute JS redirect)
    4. Tăng click_count
    """
    # Tìm link theo slug trong database (chỉ lấy link đang active)
    link = CloakLink.query.filter_by(
        custom_slug=slug,
        is_active=True
    ).first()

    # Không tìm thấy slug -> 404
    if not link:
        abort(404)

    # Lấy các thông tin từ request
    user_agent = request.headers.get("User-Agent", "")
    current_url = request.url  # URL hiện tại (cloak URL)

    # Xây dựng URL đầy đủ của ảnh OG
    base_url = current_app.config.get("BASE_URL", "")
    og_image_url = build_image_url(base_url, link.image_path)

    # Fallback: nếu không có ảnh tùy chỉnh, dùng ảnh placeholder
    if not og_image_url:
        og_image_url = f"{base_url}/static/default_og.png"

    # Fallback cho title và description
    og_title = link.og_title or "Xem ngay!"
    og_description = link.og_description or "Nhấn để xem nội dung."

    # --------------------------------------------------------
    # Tăng click_count (thống kê số lần click)
    # Chỉ tăng khi có người THỰC SỰ click (không phải bot)
    # --------------------------------------------------------
    if not is_bot_request(user_agent):
        try:
            link.click_count += 1
            db.session.commit()
        except Exception:
            db.session.rollback()

    # --------------------------------------------------------
    # Render và trả về HTML với OG tags + redirect script
    # --------------------------------------------------------
    html_content = render_template_string(
        OG_REDIRECT_TEMPLATE,
        og_title=og_title,
        og_description=og_description,
        og_image=og_image_url,
        og_url=current_url,
        original_url=link.original_url,
    )

    # Trả về HTML với status 200
    # Content-Type: text/html để browser render đúng
    response = current_app.make_response(html_content)
    response.headers["Content-Type"] = "text/html; charset=utf-8"

    # Ngăn cache để OG tags luôn được cập nhật mới nhất
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    return response


# ============================================================
# ENDPOINT: GET /api/check-slug/<slug>
# Kiểm tra slug đã tồn tại chưa (dùng cho frontend validation)
# ============================================================
@redirect_bp.route("/api/check-slug/<string:slug>", methods=["GET"])
def check_slug_availability(slug: str):
    """Kiểm tra slug có khả dụng (chưa được dùng) không."""
    existing = CloakLink.query.filter_by(custom_slug=slug).first()
    return jsonify({
        "slug": slug,
        "available": existing is None
    }), 200


# Import jsonify ở đây để tránh lỗi (đã dùng trong check_slug)
from flask import jsonify
