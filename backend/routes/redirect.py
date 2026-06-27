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
import os
import requests
from flask import Blueprint, request, render_template, abort, current_app, redirect

from extensions import db
from models import CloakLink, TelegramVideo, User, AffiliateLink
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

# Đã chuyển template sang file backend/templates/landing.html


def is_bot_request(user_agent: str) -> bool:
    """
    Kiểm tra xem request đến có phải từ bot crawler không.
    Lưu ý: Facebook crawler (facebookexternalhit) được xử lý riêng
    trong is_facebook_crawler() để trả về bot_og.html sạch.
    """
    ua_lower = user_agent.lower()
    return any(bot in ua_lower for bot in BOT_USER_AGENTS)


def is_facebook_crawler(user_agent: str) -> bool:
    """
    Phân biệt Facebook CRAWLER (scrape OG tags) với Facebook IAB.

    Facebook crawler có User-Agent cố định:
      facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)
      Facebot

    Crawler  → trả về bot_og.html (OG tags sạch, không JS)
    IAB user → Force Breakout (Android Intent / iOS Guide)
    """
    ua_lower = user_agent.lower()
    return (
        'facebookexternalhit' in ua_lower or
        'facebot'             in ua_lower
    )


def detect_facebook_browser(user_agent: str) -> dict:
    """
    Phân tích User-Agent để nhận diện Facebook In-App Browser (IAB).

    Facebook IAB có 2 dạng User-Agent:
      Android: ... FBAN/... FBAV/...  (ví dụ: Facebook app Android)
      iOS:     ... FBAN/... FBAV/...  (ví dụ: Facebook app iPhone)

    Returns:
        dict with keys:
          is_facebook  : True nếu đang dùng Facebook IAB
          is_android   : True nếu là Android
          is_ios       : True nếu là iOS/iPhone
    """
    ua = user_agent  # giữ nguyên case để kiểm tra chính xác
    ua_lower = ua.lower()

    # Nhận diện Facebook IAB qua các chuỗi đặc trưng
    is_facebook = (
        'FBAN/'  in ua or  # Facebook App Name
        'FBAV/'  in ua or  # Facebook App Version
        'FBIOS'  in ua or  # Facebook iOS
        'FB_IAB' in ua or  # Facebook In-App Browser flag
        'FBDV/'  in ua     # Facebook Device
    )

    is_android = 'android' in ua_lower
    is_ios     = 'iphone' in ua_lower or 'ipad' in ua_lower or 'ipod' in ua_lower

    return {
        'is_facebook': is_facebook,
        'is_android':  is_android,
        'is_ios':      is_ios,
    }


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

    # Không tìm thấy slug → render trang 404 thân thiện
    if not link:
        try:
            html_404 = render_template("404.html", slug=slug)
        except Exception:
            html_404 = "<h1>404 - Trang không tồn tại</h1>"
        response = current_app.make_response(html_404)
        response.status_code = 404
        response.headers["Content-Type"] = "text/html; charset=utf-8"
        return response

    # Lấy các thông tin từ request
    user_agent = request.headers.get("User-Agent", "")
    current_url = request.url

    base_url = current_app.config.get("BASE_URL", "")
    og_title       = link.og_title or "Xem ngay!"
    og_description = link.og_description or "Nhấn để xem nội dung."

    # Ưu tiên: og_image_url (URL dán trực tiếp có nút play) → image_path → placeholder
    og_image_resolved = (
        link.og_image_url
        or build_image_url(base_url, link.image_path)
        or f"{base_url}/static/default_og.png"
    )

    # --------------------------------------------------------
    # BƯỚC 1: Facebook Crawler → Trả về bot_og.html ngay lập tức
    # Không tracking, không redirect, không logic khác.
    # --------------------------------------------------------
    if is_facebook_crawler(user_agent):
        bot_html = render_template(
            "bot_og.html",
            og_title       = og_title,
            og_description = og_description,
            og_image       = og_image_resolved,
            og_url         = current_url,
        )
        bot_resp = current_app.make_response(bot_html)
        bot_resp.headers["Content-Type"] = "text/html; charset=utf-8"
        bot_resp.headers["Cache-Control"] = "public, max-age=300"
        return bot_resp

    # --------------------------------------------------------
    # BƯỚC 2: Các bot khác (Googlebot, Zalo...) → bot_og.html
    # --------------------------------------------------------
    if is_bot_request(user_agent):
        bot_html = render_template(
            "bot_og.html",
            og_title       = og_title,
            og_description = og_description,
            og_image       = og_image_resolved,
            og_url         = current_url,
        )
        bot_resp = current_app.make_response(bot_html)
        bot_resp.headers["Content-Type"] = "text/html; charset=utf-8"
        bot_resp.headers["Cache-Control"] = "public, max-age=300"
        return bot_resp

    # --------------------------------------------------------
    # BƯỚC 3: Người dùng thật → Tăng click_count
    # --------------------------------------------------------
    cookie_key = f"viewed_{slug}"
    has_viewed = request.cookies.get(cookie_key)

    if not has_viewed:
        try:
            link.click_count += 1
            db.session.commit()
        except Exception:
            db.session.rollback()

    # --------------------------------------------------------
    # Xử lý video URL dựa vào video_source
    # --------------------------------------------------------
    video_url = None
    if link.video_source == 'telegram':
        if link.telegram_file_id:
            bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
            if bot_token:
                try:
                    # Gọi Telegram API getFile
                    tg_api_url = f"https://api.telegram.org/bot{bot_token}/getFile?file_id={link.telegram_file_id}"
                    resp = requests.get(tg_api_url, timeout=5)
                    data = resp.json()
                    if data.get("ok") and "result" in data:
                        file_path = data["result"].get("file_path")
                        if file_path:
                            # Construct link trực tiếp
                            video_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
                except Exception as e:
                    current_app.logger.error(f"Lỗi lấy video Telegram: {e}")
    else:
        # direct source
        video_url = link.direct_video_url

    # --------------------------------------------------------
    # FORCE BREAKOUT: Phân tích Facebook IAB và xử lý riêng
    # --------------------------------------------------------
    fb_info = detect_facebook_browser(user_agent)
    is_facebook_ios = False  # mặc định: không phải Facebook iOS

    if fb_info['is_facebook'] and not is_bot_request(user_agent):
        if fb_info['is_android']:
            # ── ANDROID: Redirect sang Intent Chrome ──
            # Intent URI bướộc thiết bị mở trang bằng Chrome ứng dụng,
            # bỏ qua hoàn toàn webview của Facebook.
            # package=com.android.chrome → AOSP Chrome
            # Nếu không có Chrome, fallback browser của AOSP.
            intent_url = (
                f"intent://{request.host}/{slug}"
                f"#Intent;scheme=https;package=com.android.chrome;"
                f"S.browser_fallback_url=https://{request.host}/{slug};end"
            )
            current_app.logger.info(
                f"[Breakout] Android Facebook IAB → Intent redirect: {intent_url[:80]}"
            )
            return redirect(intent_url, 302)

        elif fb_info['is_ios']:
            # ── IOS: Truyền cờ vào template, hiện màn hướng dẫn thủ công ──
            # iOS không hỗ trợ Intent URI, không có cách tự động breakout.
            # Giải pháp duy nhất: Hướng dẫn người dùng thủ công mở Safari.
            is_facebook_ios = True
            current_app.logger.info(
                f"[Breakout] iOS Facebook IAB → Hiện màn hướng dẫn"
            )

    # --------------------------------------------------------
    # Resolve URL & ID cho Bẫy Click 2 tầng (dùng FK v2 ưu tiên)
    # --------------------------------------------------------
    if link.link1_id and link.link1:
        link1_url = link.link1.url
        link1_id  = link.link1_id
    else:
        link1_url = link.original_url
        aff1 = AffiliateLink.query.filter_by(url=link.original_url).first() if link.original_url else None
        link1_id  = aff1.id if aff1 else ""

    if link.link2_id and link.link2:
        link2_url = link.link2.url
        link2_id  = link.link2_id
    else:
        link2_url = link.second_affiliate_url
        aff2 = AffiliateLink.query.filter_by(url=link.second_affiliate_url).first() if link.second_affiliate_url else None
        link2_id  = aff2.id if aff2 else ""

    # --------------------------------------------------------
    # Render và trả về HTML
    # --------------------------------------------------------
    html_content = render_template(
        "landing.html",
        og_title=og_title,
        og_description=og_description,
        og_image=og_image_resolved,
        og_url=current_url,
        link1_url=link1_url,
        link1_id=link1_id,
        link2_url=link2_url,
        link2_id=link2_id,
        slug_id=link.custom_slug,
        is_facebook_ios=is_facebook_ios,
        original_url=link1_url,
        second_affiliate_url=link2_url,
        final_video_url=video_url,
        content_description=link.content_description
    )

    # Trả về HTML với status 200
    # Content-Type: text/html để browser render đúng
    response = current_app.make_response(html_content)
    response.headers["Content-Type"] = "text/html; charset=utf-8"

    # Ngăn cache để OG tags luôn được cập nhật mới nhất
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Nếu chưa xem, set cookie 24h
    if not is_bot_request(user_agent) and not has_viewed:
        response.set_cookie(cookie_key, '1', max_age=86400)

    return response


# ============================================================
# ENDPOINT: POST /webhook/telegram
# Nhận video từ Telegram bot để lưu trữ file_id
# Hỗ trợ: message.video (nén) VÀ message.document (file gốc)
# ============================================================

# Lưu payload cuối cùng để debug
_last_webhook_payload = {}
_last_webhook_error = ""

@redirect_bp.route("/api/telegram/debug", methods=["GET"])
def telegram_debug():
    """Endpoint debug để xem payload cuối cùng Telegram gửi tới."""
    from models import TelegramVideo, User
    
    # Lấy 5 video mới nhất bất kể của ai
    recent_videos = TelegramVideo.query.order_by(TelegramVideo.id.desc()).limit(5).all()
    users = User.query.all()
    
    return jsonify({
        "last_payload": _last_webhook_payload,
        "last_error": _last_webhook_error,
        "users_in_db": [{"id": u.id, "username": u.username, "telegram_chat_id": u.telegram_chat_id} for u in users],
        "recent_videos": [{"id": v.id, "user_id": v.user_id, "file_id": v.file_id, "caption": v.caption} for v in recent_videos]
    }), 200

@redirect_bp.route("/webhook/telegram", methods=["POST"])
def telegram_webhook():
    """
    Nhận JSON từ Telegram Bot webhook.

    Telegram gửi video theo 2 dạng:
    - message.video   : Video được Telegram nén (gửi dưới dạng video)
    - message.document: File gốc không nén (gửi dưới dạng file/tài liệu)
                        mime_type sẽ là 'video/mp4' hoặc 'video/*'
    """
    global _last_webhook_payload, _last_webhook_error
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"success": True, "message": "No JSON data"}), 200

        # Lưu lại để debug
        _last_webhook_payload = data
        current_app.logger.info(f"[Telegram Webhook] Received update: {str(data)[:500]}")

        # Hỗ trợ cả message lẫn channel_post
        message = data.get("message") or data.get("channel_post")
        if not message:
            return jsonify({"success": True, "message": "Not a message update"}), 200

        # ── Multi-tenancy: Tìm user theo telegram_chat_id ──
        sender = message.get("from") or {}
        sender_id = str(sender.get("id", ""))

        matched_user = None
        if sender_id:
            matched_user = User.query.filter_by(telegram_chat_id=sender_id).first()

        if not matched_user:
            _last_webhook_error = f"Bỏ qua: sender_id={sender_id} không khớp user nào trong DB."
            current_app.logger.info(f"[Telegram Webhook] {_last_webhook_error}")
            return jsonify({"success": True, "message": "Sender not linked to any user"}), 200

        # ── Ưu tiên 1: message.video (video nén chuẩn) ──
        media = message.get("video")
        media_type = "video"

        # ── Ưu tiên 2: message.document có mime video/* ──
        if not media:
            doc = message.get("document")
            if doc:
                mime = doc.get("mime_type", "")
                if mime.startswith("video/"):
                    media = doc
                    media_type = "document"

        if not media:
            current_app.logger.info(
                f"[Telegram Webhook] Message có keys: {list(message.keys())} — không phải video"
            )
            return jsonify({"success": True, "message": "No video or video document found"}), 200

        file_id = media.get("file_id")
        if not file_id:
            return jsonify({"success": True, "message": "No file_id"}), 200

        # Lấy caption
        caption = (
            message.get("caption")
            or media.get("file_name")
            or f"Video [{media_type}] {file_id[:10]}"
        )

        current_app.logger.info(
            f"[Telegram Webhook] Saving {media_type} for user={matched_user.username}: file_id={file_id[:20]}..."
        )

        # Lưu vào DB gắn user_id
        existing = TelegramVideo.query.filter_by(file_id=file_id).first()
        if not existing:
            new_video = TelegramVideo(user_id=matched_user.id, file_id=file_id, caption=caption)
            db.session.add(new_video)
            db.session.commit()
            return jsonify({"success": True, "message": f"Saved for {matched_user.username}: {caption}"}), 200
        else:
            _last_webhook_error = "Video đã tồn tại trong DB."
            return jsonify({"success": True, "message": "Already exists"}), 200

    except Exception as e:
        _last_webhook_error = f"Lỗi exception: {str(e)}"
        db.session.rollback()
        current_app.logger.error(f"[Telegram Webhook] Error: {e}", exc_info=True)
        # Trả 200 để Telegram không retry liên tục
        return jsonify({"ok": True}), 200


# ============================================================
# ENDPOINT: GET /api/telegram/last-payload
# Xem payload cuối cùng Telegram đã gửi về (debug)
# ============================================================
@redirect_bp.route("/api/telegram/last-payload", methods=["GET"])
def telegram_last_payload():
    """Trả về payload cuối cùng Telegram gửi về webhook — dùng để debug cấu trúc JSON."""
    return jsonify({
        "last_payload": _last_webhook_payload,
        "hint": "Gửi một video cho bot, sau đó gọi lại endpoint này để xem cấu trúc JSON Telegram gửi về"
    }), 200


# ============================================================
# ENDPOINT: GET /api/telegram/pull-updates
# Chủ động kéo video từ Telegram qua getUpdates API
# Dùng khi webhook chưa hoạt động hoặc để sync thủ công
# ============================================================
@redirect_bp.route("/api/telegram/pull-updates", methods=["GET"])
def pull_telegram_updates():
    """
    Chủ động gọi Telegram getUpdates để lấy tất cả video bot đã nhận.

    Telegram lưu update tối đa 24h nếu chưa được xử lý.
    Sau khi gọi endpoint này, tất cả video sẽ được lưu vào DB.

    ⚠️ Lưu ý: Nếu webhook đang bật, getUpdates sẽ bị từ chối.
       Cần tắt webhook trước: /api/telegram/disable-webhook
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        return jsonify({"success": False, "error": "TELEGRAM_BOT_TOKEN chưa cấu hình"}), 400

    try:
        saved = []
        skipped = []
        errors = []

        # Gọi getUpdates với limit 100
        updates_url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
        resp = requests.get(updates_url, params={"limit": 100, "timeout": 5}, timeout=10)
        data = resp.json()

        if not data.get("ok"):
            return jsonify({
                "success": False,
                "error": "Telegram từ chối getUpdates — có thể webhook đang bật",
                "telegram_response": data,
                "fix": "Gọi /api/telegram/disable-webhook trước, rồi thử lại"
            }), 400

        updates = data.get("result", [])

        for update in updates:
            message = update.get("message") or update.get("channel_post")
            if not message:
                continue

            # Hỗ trợ cả video lẫn document
            media = message.get("video")
            media_type = "video"

            if not media:
                doc = message.get("document")
                if doc and doc.get("mime_type", "").startswith("video/"):
                    media = doc
                    media_type = "document"

            if not media:
                continue

            file_id = media.get("file_id")
            if not file_id:
                continue

            caption = (
                message.get("caption")
                or media.get("file_name")
                or f"Video [{media_type}] {file_id[:10]}"
            )

            try:
                existing = TelegramVideo.query.filter_by(file_id=file_id).first()
                if not existing:
                    new_video = TelegramVideo(file_id=file_id, caption=caption)
                    db.session.add(new_video)
                    db.session.commit()
                    saved.append({"file_id": file_id[:20], "caption": caption})
                else:
                    skipped.append({"file_id": file_id[:20], "caption": caption})
            except Exception as e:
                db.session.rollback()
                errors.append(str(e))

        return jsonify({
            "success": True,
            "total_updates": len(updates),
            "saved": len(saved),
            "skipped_existing": len(skipped),
            "errors": errors,
            "saved_videos": saved,
        }), 200

    except Exception as e:
        current_app.logger.error(f"pull_telegram_updates error: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# ENDPOINT: GET /api/telegram/disable-webhook
# Tắt webhook để dùng getUpdates (polling)
# ============================================================
@redirect_bp.route("/api/telegram/disable-webhook", methods=["GET"])
def disable_telegram_webhook():
    """Tắt webhook Telegram để có thể dùng getUpdates."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        return jsonify({"success": False, "error": "TELEGRAM_BOT_TOKEN chưa cấu hình"}), 400

    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{bot_token}/deleteWebhook",
            json={"drop_pending_updates": False},
            timeout=10
        )
        result = resp.json()
        return jsonify({
            "success": result.get("ok", False),
            "message": "Webhook đã tắt. Bây giờ có thể gọi /api/telegram/pull-updates",
            "telegram_response": result
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500




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


# Import jsonify ở đây để tránh lỗi (nếu chưa được import)
from flask import jsonify


# ============================================================
# ENDPOINT: GET /api/telegram/setup-webhook
# Đăng ký webhook URL với Telegram (gọi 1 lần khi deploy)
# ============================================================
@redirect_bp.route("/api/telegram/setup-webhook", methods=["GET"])
def setup_telegram_webhook():
    """
    Đăng ký URL webhook với Telegram Bot API.
    Gọi endpoint này 1 lần sau khi deploy để Telegram
    biết gửi update về đâu.

    Yêu cầu:
    - TELEGRAM_BOT_TOKEN đã được cấu hình trong .env
    - BASE_URL phải là HTTPS (Telegram bắt buộc HTTPS cho webhook)
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        return jsonify({
            "success": False,
            "error": "TELEGRAM_BOT_TOKEN chưa được cấu hình trong .env!"
        }), 400

    base_url = current_app.config.get("BASE_URL", "").rstrip("/")
    webhook_url = f"{base_url}/webhook/telegram"

    try:
        # Gọi API setWebhook của Telegram
        set_url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
        resp = requests.post(set_url, json={
            "url": webhook_url,
            "allowed_updates": ["message", "channel_post"],
            "drop_pending_updates": True
        }, timeout=10)
        result = resp.json()

        if result.get("ok"):
            return jsonify({
                "success": True,
                "message": f"✅ Webhook đã đăng ký thành công!",
                "webhook_url": webhook_url,
                "telegram_response": result
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Telegram từ chối đăng ký webhook",
                "telegram_response": result,
                "hint": "Đảm bảo BASE_URL là HTTPS và token đúng"
            }), 400

    except Exception as e:
        current_app.logger.error(f"setup_telegram_webhook error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# ENDPOINT: GET /api/telegram/status
# Kiểm tra trạng thái webhook + danh sách video đã nhận
# ============================================================
@redirect_bp.route("/api/telegram/status", methods=["GET"])
def telegram_status():
    """
    Endpoint debug:
    - Kiểm tra webhook hiện tại được Telegram đăng ký là URL nào
    - Xem danh sách video đã lưu trong database
    - Kiểm tra token đã cấu hình chưa
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    token_ok = bool(bot_token)

    webhook_info = None
    if token_ok:
        try:
            info_url = f"https://api.telegram.org/bot{bot_token}/getWebhookInfo"
            resp = requests.get(info_url, timeout=5)
            webhook_info = resp.json().get("result", {})
        except Exception as e:
            webhook_info = {"error": str(e)}

    # Lấy danh sách video trong DB
    try:
        videos = TelegramVideo.query.order_by(TelegramVideo.created_at.desc()).all()
        video_list = [v.to_dict() for v in videos]
    except Exception as e:
        video_list = []

    base_url = current_app.config.get("BASE_URL", "")

    return jsonify({
        "token_configured": token_ok,
        "expected_webhook_url": f"{base_url}/webhook/telegram",
        "current_webhook_info": webhook_info,
        "videos_in_db": len(video_list),
        "videos": video_list,
        "setup_guide": {
            "step1": "Điền TELEGRAM_BOT_TOKEN vào file .env",
            "step2": f"Truy cập GET {base_url}/api/telegram/setup-webhook để đăng ký",
            "step3": "Gửi video lên bot Telegram — video sẽ tự động lưu vào DB",
            "step4": "Kiểm tra lại endpoint này để xác nhận"
        }
    }), 200
