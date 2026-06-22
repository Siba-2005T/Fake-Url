/**
 * CreateLinkForm.jsx - Form tạo Cloak Link mới
 * =============================================
 * Form chính chứa:
 * - Input URL gốc (Long URL)
 * - Input Custom Slug (đuôi URL tùy chỉnh)
 * - Input Custom Domain (tên miền riêng)
 * - Input OG Title & Description
 * - Component ImageUpload (thumbnail)
 * - Preview URL cloak sẽ được tạo
 */
import { useState, useEffect, useCallback } from 'react';
import { Link2, Fingerprint, Globe, Type, FileText, Loader2, Zap, Video, AlignLeft } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { createLink, checkSlugAvailability, fetchTelegramVideos } from '../api/api';

// Hàm tự động tạo slug từ text (chuyển tiếng Việt có dấu sang không dấu)
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // Bỏ dấu tiếng Việt
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')      // Chỉ giữ chữ số, chữ cái, khoảng trắng, gạch ngang
    .replace(/\s+/g, '-')              // Thay khoảng trắng bằng gạch ngang
    .replace(/-+/g, '-')               // Bỏ gạch ngang liên tiếp
    .slice(0, 80);                      // Giới hạn 80 ký tự
};

const INITIAL_FORM = {
  original_url: '',
  custom_slug: '',
  custom_domain: '',
  og_title: '',
  og_description: '',
  video_source: 'direct',
  telegram_file_id: '',
  direct_video_url: '',
  content_description: '',
  second_affiliate_url: '',  // Link phụ (TikTok) — bẫy click tầng 2
  image: null,
};

const CreateLinkForm = ({ onSuccess }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [slugCheckTimeout, setSlugCheckTimeout] = useState(null);
  const [telegramVideos, setTelegramVideos] = useState([]);

  // Tải danh sách video từ Telegram Bot Webhook
  useEffect(() => {
    if (form.video_source === 'telegram') {
      const loadTelegramVideos = async () => {
        try {
          const res = await fetchTelegramVideos();
          if (res.success) {
            setTelegramVideos(res.data || []);
          }
        } catch (err) {
          console.error('Không thể lấy danh sách video Telegram:', err);
        }
      };
      loadTelegramVideos();
    }
  }, [form.video_source]);

  // --------------------------------------------------------
  // Xử lý thay đổi input text
  // --------------------------------------------------------
  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));

    // Xóa lỗi khi người dùng bắt đầu gõ
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    // Kiểm tra slug availability theo thời gian thực
    if (field === 'custom_slug' && value.trim()) {
      triggerSlugCheck(value.trim());
    } else if (field === 'custom_slug') {
      setSlugStatus(null);
    }
  };

  // --------------------------------------------------------
  // Tự động tạo slug từ OG Title (debounced)
  // --------------------------------------------------------
  const handleTitleChange = (e) => {
    const title = e.target.value;
    setForm((prev) => {
      // Chỉ tự điền slug nếu slug chưa được sửa tay
      const shouldAutoSlug = !prev.custom_slug || prev.custom_slug === generateSlug(prev.og_title);
      return {
        ...prev,
        og_title: title,
        custom_slug: shouldAutoSlug ? generateSlug(title) : prev.custom_slug,
      };
    });
    if (errors.og_title) setErrors((prev) => ({ ...prev, og_title: '' }));
  };

  // --------------------------------------------------------
  // Kiểm tra slug availability với debounce 600ms
  // --------------------------------------------------------
  const triggerSlugCheck = useCallback((slug) => {
    setSlugStatus('checking');
    if (slugCheckTimeout) clearTimeout(slugCheckTimeout);

    const timeout = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(slug);
        setSlugStatus(result.available ? 'available' : 'taken');
        if (!result.available) {
          setErrors((prev) => ({
            ...prev,
            custom_slug: `Slug "${slug}" đã được sử dụng.`,
          }));
        } else {
          setErrors((prev) => ({ ...prev, custom_slug: '' }));
        }
      } catch {
        setSlugStatus(null);
      }
    }, 600);

    setSlugCheckTimeout(timeout);
  }, [slugCheckTimeout]);

  // Cleanup timeout khi unmount
  useEffect(() => {
    return () => { if (slugCheckTimeout) clearTimeout(slugCheckTimeout); };
  }, [slugCheckTimeout]);

  // --------------------------------------------------------
  // Validation form trước khi submit
  // --------------------------------------------------------
  const validate = () => {
    const newErrors = {};

    if (!form.original_url.trim()) {
      newErrors.original_url = 'URL gốc là bắt buộc.';
    } else if (!form.original_url.startsWith('http://') && !form.original_url.startsWith('https://')) {
      newErrors.original_url = 'URL phải bắt đầu bằng http:// hoặc https://';
    }

    if (!form.custom_slug.trim()) {
      newErrors.custom_slug = 'Slug là bắt buộc.';
    } else if (!/^[a-zA-Z0-9\-_]+$/.test(form.custom_slug)) {
      newErrors.custom_slug = 'Slug chỉ được chứa chữ cái, số, gạch ngang và gạch dưới.';
    }

    if (slugStatus === 'taken') {
      newErrors.custom_slug = 'Slug này đã được sử dụng. Hãy chọn slug khác.';
    }

    if (form.video_source === 'telegram' && !form.telegram_file_id) {
      newErrors.telegram_file_id = 'Vui lòng chọn một video Telegram.';
    }

    if (form.video_source === 'direct' && !form.direct_video_url.trim()) {
      newErrors.direct_video_url = 'Vui lòng nhập link video trực tiếp.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --------------------------------------------------------
  // Xử lý submit form
  // --------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await createLink(form);
      // Reset form sau khi tạo thành công
      setForm(INITIAL_FORM);
      setSlugStatus(null);
      setErrors({});
      // Thông báo cho component cha
      onSuccess?.(result.data);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính toán preview URL cloak
  // Dùng VITE_API_URL từ file .env (thay bằng domain thật khi deploy)
  const serverBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const previewUrl = form.custom_domain
    ? `https://${form.custom_domain}/${form.custom_slug || '<slug>'}`
    : `${serverBaseUrl}/${form.custom_slug || '<slug>'}`;
  const isUsingServerUrl = !form.custom_domain;

  return (
    <form className="create-link-form" onSubmit={handleSubmit} noValidate>
      {/* ---- Tiêu đề section ---- */}
      <div className="form-section-header">
        <div className="form-section-icon">
          <Zap size={20} />
        </div>
        <div>
          <h2 className="form-section-title">Tạo Cloak Link Mới</h2>
          <p className="form-section-desc">Che giấu URL gốc và tùy chỉnh giao diện chia sẻ mạng xã hội</p>
        </div>
      </div>

      <div className="form-grid">
        {/* ---- CỘT TRÁI: Thông tin cơ bản ---- */}
        <div className="form-column">
          <h3 className="form-col-title">🔗 Thông tin Link</h3>

          {/* Input: URL gốc */}
          <div className="form-group">
            <label className="form-label" htmlFor="original_url">
              <Link2 size={14} />
              URL Gốc <span className="required">*</span>
            </label>
            <input
              id="original_url"
              type="url"
              className={`form-input ${errors.original_url ? 'error' : ''}`}
              placeholder="https://shopee.vn/product/12345678/very-long-url..."
              value={form.original_url}
              onChange={handleChange('original_url')}
              autoComplete="off"
            />
            {errors.original_url && (
              <p className="form-error">{errors.original_url}</p>
            )}
            <p className="form-hint">Dán link Shopee, Lazada, TikTok... bất kỳ URL nào bạn muốn che giấu</p>
          </div>

          {/* Input: Custom Slug */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom_slug">
              <Fingerprint size={14} />
              Slug Tùy Chỉnh <span className="required">*</span>
            </label>
            <div className="slug-input-wrapper">
              <input
                id="custom_slug"
                type="text"
                className={`form-input ${errors.custom_slug ? 'error' : ''} ${
                  slugStatus === 'available' ? 'success' : ''
                }`}
                placeholder="hoat-hinh-2026"
                value={form.custom_slug}
                onChange={handleChange('custom_slug')}
                autoComplete="off"
              />
              {/* Indicator kiểm tra slug */}
              <div className="slug-status">
                {slugStatus === 'checking' && (
                  <span className="slug-checking">
                    <Loader2 size={14} className="animate-spin" />
                  </span>
                )}
                {slugStatus === 'available' && (
                  <span className="slug-available">✓</span>
                )}
                {slugStatus === 'taken' && (
                  <span className="slug-taken">✗</span>
                )}
              </div>
            </div>
            {errors.custom_slug && (
              <p className="form-error">{errors.custom_slug}</p>
            )}
            {slugStatus === 'available' && (
              <p className="form-hint success-hint">✓ Slug này chưa được sử dụng!</p>
            )}
            <p className="form-hint">Chỉ dùng: chữ cái, số, gạch ngang <code>-</code>, gạch dưới <code>_</code></p>
          </div>

          {/* Input: Custom Domain */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom_domain">
              <Globe size={14} />
              Tên Miền Riêng
              <span className="form-optional">(tuỳ chọn)</span>
            </label>
            <input
              id="custom_domain"
              type="text"
              className="form-input"
              placeholder="ten-cua-toi.com"
              value={form.custom_domain}
              onChange={handleChange('custom_domain')}
              autoComplete="off"
            />
            <p className="form-hint">
              Nhập domain không cần <code>https://</code> (VD: <code>shop.example.com</code>)
            </p>
          </div>

          {/* Preview URL */}
          <div className="url-preview-box">
            <p className="url-preview-label">🌐 Preview URL Cloak:</p>
            <code className="url-preview-value">{previewUrl}</code>
            {isUsingServerUrl && (
              <p className="url-preview-note">
                ⚠️ Đang dùng URL server. Nhập <strong>Tên Miền Riêng</strong> ở trên để có link như
                {' '}<em>ten-cua-toi.com/{form.custom_slug || '<slug>'}</em>
              </p>
            )}
          </div>
        </div>

        {/* ---- CỘT PHẢI: OG Meta & Thumbnail ---- */}
        <div className="form-column">
          <h3 className="form-col-title">📱 Open Graph (Preview Mạng Xã Hội)</h3>

          {/* Input: OG Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="og_title">
              <Type size={14} />
              Tiêu Đề OG
            </label>
            <input
              id="og_title"
              type="text"
              className="form-input"
              placeholder="Sản phẩm HOT - Giảm 50% hôm nay!"
              value={form.og_title}
              onChange={handleTitleChange}
              maxLength={200}
            />
            <p className="form-hint">
              Tiêu đề hiển thị khi chia sẻ lên Facebook/Zalo
              {form.og_title && ` (${form.og_title.length}/200)`}
            </p>
          </div>

          {/* Input: OG Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="og_description">
              <FileText size={14} />
              Mô Tả OG
            </label>
            <textarea
              id="og_description"
              className="form-textarea"
              placeholder="Mô tả ngắn gọn về nội dung link. Hiển thị dưới tiêu đề khi chia sẻ..."
              value={form.og_description}
              onChange={handleChange('og_description')}
              rows={3}
              maxLength={500}
            />
            <p className="form-hint">
              Mô tả xuất hiện dưới tiêu đề trên Facebook
              {form.og_description && ` (${form.og_description.length}/500)`}
            </p>
          </div>

          {/* Nguồn Video */}
          <div className="form-group">
            <label className="form-label">
              <Video size={14} />
              Nguồn Video <span className="required">*</span>
            </label>
            <div className="video-source-options" style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="video_source"
                  value="telegram"
                  checked={form.video_source === 'telegram'}
                  onChange={() => setForm(prev => ({ ...prev, video_source: 'telegram' }))}
                />
                <span>Telegram Auto</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="video_source"
                  value="direct"
                  checked={form.video_source === 'direct'}
                  onChange={() => setForm(prev => ({ ...prev, video_source: 'direct' }))}
                />
                <span>Link Catbox/MP4 Trực tiếp</span>
              </label>
            </div>
          </div>

          {/* Hiển thị input tương ứng với nguồn video */}
          {form.video_source === 'telegram' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="telegram_file_id">
                Chọn Video Telegram <span className="required">*</span>
              </label>
              <select
                id="telegram_file_id"
                className={`form-input ${errors.telegram_file_id ? 'error' : ''}`}
                value={form.telegram_file_id}
                onChange={handleChange('telegram_file_id')}
              >
                <option value="">-- Chọn video Telegram đã nhận --</option>
                {telegramVideos.map((video) => (
                  <option key={video.id} value={video.file_id}>
                    {video.caption || `Video (${video.file_id.slice(0, 15)}...)`}
                  </option>
                ))}
              </select>
              {errors.telegram_file_id && (
                <p className="form-error">{errors.telegram_file_id}</p>
              )}
              <p className="form-hint">
                Video được nhận tự động qua Telegram bot. Hãy gửi video cho bot trước.
              </p>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="direct_video_url">
                URL Video Trực Tiếp (MP4/Catbox) <span className="required">*</span>
              </label>
              <input
                id="direct_video_url"
                type="text"
                className={`form-input ${errors.direct_video_url ? 'error' : ''}`}
                placeholder="https://files.catbox.moe/abcxyz.mp4"
                value={form.direct_video_url}
                onChange={handleChange('direct_video_url')}
              />
              {errors.direct_video_url && (
                <p className="form-error">{errors.direct_video_url}</p>
              )}
              <p className="form-hint">
                Nhập link trực tiếp đến file video (.mp4).
              </p>
            </div>
          )}

          {/* Input: Nội dung mô tả video */}
          <div className="form-group">
            <label className="form-label" htmlFor="content_description">
              <AlignLeft size={14} />
              Mô Tả Video (hiển thị dưới video)
            </label>
            <textarea
              id="content_description"
              className="form-textarea"
              placeholder="Nhập mô tả dài, chi tiết cho video để thuyết phục người dùng..."
              value={form.content_description}
              onChange={handleChange('content_description')}
              rows={4}
            />
          </div>

          {/* Input: Second Affiliate URL (Bẫy click tầng 2) */}
          <div className="form-group">
            <label className="form-label" htmlFor="second_affiliate_url">
              <Link2 size={14} />
              Link Phụ (Bẫy Tầng 2 — TikTok, Lazada...)
              <span className="form-optional">(tuỳ chọn)</span>
            </label>
            <input
              id="second_affiliate_url"
              type="url"
              className="form-input"
              placeholder="https://www.tiktok.com/@shop/product/123..."
              value={form.second_affiliate_url}
              onChange={handleChange('second_affiliate_url')}
            />
            <p className="form-hint">
              ⚡ Click lần 2 sẽ mở link này (user tưởng đang bấm Play video). Để trống nếu không cần tầng 2.
            </p>
          </div>

          {/* Upload Thumbnail */}
          <div className="form-group">
            <label className="form-label">
              <span>🖼️</span>
              Ảnh Thumbnail (Ghi đè ảnh mặc định)
            </label>
            <ImageUpload
              value={form.image}
              onChange={(file) => setForm((prev) => ({ ...prev, image: file }))}
            />
          </div>
        </div>
      </div>

      {/* ---- Thông báo lỗi submit ---- */}
      {errors.submit && (
        <div className="submit-error">
          <span>⚠️</span>
          <p>{errors.submit}</p>
        </div>
      )}

      {/* ---- Nút Submit ---- */}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => { setForm(INITIAL_FORM); setErrors({}); setSlugStatus(null); }}
          disabled={isSubmitting}
        >
          Đặt lại
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={isSubmitting || slugStatus === 'taken' || slugStatus === 'checking'}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Đang tạo...
            </>
          ) : (
            <>
              <Zap size={18} />
              Tạo Cloak Link
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default CreateLinkForm;
