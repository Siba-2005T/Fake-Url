/**
 * CreateLinkPage.jsx - Trang tạo Fake Link (Menu 1)
 * Cập nhật v2: Bẫy Click Lần 1 & Lần 2 với selector nền tảng + combobox theo ID
 */
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import {
  Link2, Fingerprint, Globe, Type, FileText, Loader2,
  Zap, Video, AlignLeft, ChevronDown, ShoppingBag, Music2, Target,
} from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import {
  createLink, checkSlugAvailability,
  fetchTelegramVideos, fetchDirectVideos, fetchAffiliateLinks,
} from '../api/api';

/* ── Hàm tạo slug ── */
const generateSlug = (text) =>
  text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

/* ================================================================
   Combobox chọn affiliate link theo ID (không phải URL)
   - Hiển thị tên link, search theo tên hoặc URL
   - Trả về object { id, name, url } khi chọn
================================================================ */
const AffiliatePicker = ({ trapLabel, trapColor, value, onChange, shopeeLinks, tiktokLinks }) => {
  const [platform, setPlatform] = useState('shopee');
  const [searchText, setSearchText] = useState('');
  const [open, setOpen] = useState(false);

  const items = platform === 'shopee' ? shopeeLinks : tiktokLinks;
  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(searchText.toLowerCase()) ||
    i.url.toLowerCase().includes(searchText.toLowerCase())
  );

  // Khi platform đổi → reset selection
  const handlePlatformChange = (p) => {
    setPlatform(p);
    setSearchText('');
    onChange(null); // bỏ chọn link hiện tại
  };

  // Khi user chọn 1 item từ dropdown
  const handleSelect = (item) => {
    onChange(item);           // trả { id, name, url }
    setSearchText(item.name); // hiển thị tên trong input
    setOpen(false);
  };

  // Sync display khi value thay đổi từ bên ngoài (VD: reset form)
  useEffect(() => {
    if (!value) setSearchText('');
  }, [value]);

  const platformIcon = platform === 'shopee'
    ? <ShoppingBag size={13} style={{ color: '#ff6533' }} />
    : <Music2 size={13} style={{ color: '#69c9d0' }} />;

  return (
    <div className="trap-picker-card" style={{ borderColor: trapColor }}>
      <div className="trap-picker-header" style={{ borderBottomColor: trapColor + '33' }}>
        <span className="trap-label" style={{ color: trapColor }}>
          <Target size={14} /> {trapLabel}
        </span>

        {/* Radio chọn nền tảng */}
        <div className="platform-radios">
          {[
            { val: 'shopee', label: 'Shopee', icon: <ShoppingBag size={12} />, color: '#ff6533' },
            { val: 'tiktok', label: 'TikTok', icon: <Music2 size={12} />, color: '#69c9d0' },
          ].map(({ val, label, icon, color }) => (
            <label
              key={val}
              className={`platform-radio-btn ${platform === val ? 'active' : ''}`}
              style={platform === val ? { borderColor: color, color: color, background: color + '15' } : {}}
            >
              <input
                type="radio"
                name={`platform-${trapLabel}`}
                value={val}
                checked={platform === val}
                onChange={() => handlePlatformChange(val)}
                style={{ display: 'none' }}
              />
              {icon} {label}
            </label>
          ))}
        </div>
      </div>

      {/* Combobox */}
      <div style={{ position: 'relative', padding: '12px 16px' }}>
        <div className="combobox-wrapper">
          <span className="combobox-platform-icon">{platformIcon}</span>
          <input
            className="form-input combobox-with-icon"
            placeholder={`Chọn link ${platform === 'shopee' ? 'Shopee' : 'TikTok'}...`}
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          <ChevronDown size={15} className="combobox-arrow" />
        </div>

        {/* Selected badge */}
        {value && (
          <div className="selected-badge" style={{ borderColor: trapColor + '55', color: trapColor }}>
            ✓ <strong>{value.name}</strong>
            <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 6 }}>
              {value.url.slice(0, 45)}...
            </span>
          </div>
        )}

        {/* Dropdown list */}
        {open && (
          <ul className="combobox-dropdown">
            {filtered.length === 0 ? (
              <li className="combobox-empty">
                {items.length === 0
                  ? `Chưa có link ${platform}. Hãy thêm ở trang Affiliate Manager.`
                  : 'Không tìm thấy kết quả.'}
              </li>
            ) : filtered.map(item => (
              <li key={item.id} className="combobox-item" onMouseDown={() => handleSelect(item)}>
                <span className="combobox-item-name">{item.name}</span>
                <span className="combobox-item-url">{item.url.slice(0, 50)}...</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/* ── State khởi tạo ── */
const INITIAL_FORM = {
  link1: null,
  link2: null,
  custom_slug: '',
  custom_domain: '',
  og_title: '',
  og_description: '',
  og_image_url: '',      // URL thumbnail trực tiếp (có nút play)
  video_source: 'direct',
  telegram_file_id: '',
  direct_video_url: '',
  content_description: '',
  image: null,
};

const CreateLinkPage = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null);
  const [slugCheckTimeout, setSlugCheckTimeout] = useState(null);
  const [telegramVideos, setTelegramVideos] = useState([]);
  const [directVideos, setDirectVideos] = useState([]);
  const [shopeeLinks, setShopeeLinks] = useState([]);
  const [tiktokLinks, setTiktokLinks] = useState([]);

  /* Tải dữ liệu dropdown */
  useEffect(() => {
    fetchTelegramVideos().then(r => setTelegramVideos(r.data || [])).catch(() => {});
    fetchDirectVideos().then(r => setDirectVideos(r.data || [])).catch(() => {});
    fetchAffiliateLinks('shopee').then(r => setShopeeLinks(r.data || [])).catch(() => {});
    fetchAffiliateLinks('tiktok').then(r => setTiktokLinks(r.data || [])).catch(() => {});
  }, []);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (field === 'custom_slug' && value.trim()) triggerSlugCheck(value.trim());
    else if (field === 'custom_slug') setSlugStatus(null);
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setForm(prev => {
      const shouldAuto = !prev.custom_slug || prev.custom_slug === generateSlug(prev.og_title);
      return { ...prev, og_title: title, custom_slug: shouldAuto ? generateSlug(title) : prev.custom_slug };
    });
    if (errors.og_title) setErrors(prev => ({ ...prev, og_title: '' }));
  };

  const triggerSlugCheck = useCallback((slug) => {
    setSlugStatus('checking');
    if (slugCheckTimeout) clearTimeout(slugCheckTimeout);
    const t = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(slug);
        setSlugStatus(result.available ? 'available' : 'taken');
        if (!result.available) setErrors(prev => ({ ...prev, custom_slug: `Slug "${slug}" đã được dùng.` }));
        else setErrors(prev => ({ ...prev, custom_slug: '' }));
      } catch { setSlugStatus(null); }
    }, 600);
    setSlugCheckTimeout(t);
  }, [slugCheckTimeout]);

  useEffect(() => () => { if (slugCheckTimeout) clearTimeout(slugCheckTimeout); }, [slugCheckTimeout]);

  const validate = () => {
    const e = {};
    if (!form.link1) e.link1 = 'Bắt buộc chọn Bẫy Click Lần 1.';
    if (!form.custom_slug.trim()) e.custom_slug = 'Slug là bắt buộc.';
    else if (!/^[a-zA-Z0-9\-_]+$/.test(form.custom_slug)) e.custom_slug = 'Slug chỉ được chứa chữ, số, - và _';
    if (slugStatus === 'taken') e.custom_slug = 'Slug đã được dùng.';
    if (form.video_source === 'telegram' && !form.telegram_file_id) e.telegram_file_id = 'Vui lòng chọn video Telegram.';
    if (form.video_source === 'direct' && !form.direct_video_url.trim()) e.direct_video_url = 'Vui lòng nhập link video.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      // Payload v2: gửi link1_id và link2_id
      const payload = {
        ...form,
        link1_id: form.link1?.id,
        link2_id: form.link2?.id || undefined,
      };
      const result = await createLink(payload);
      setForm(INITIAL_FORM);
      setSlugStatus(null);
      setErrors({});
      toast.success(`✅ Tạo link thành công! /${result.data?.custom_slug}`, { duration: 5000 });
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const serverBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const previewUrl = form.custom_domain
    ? `https://${form.custom_domain}/${form.custom_slug || '<slug>'}`
    : `${serverBaseUrl}/${form.custom_slug || '<slug>'}`;

  return (
    <div className="page">
      <Toaster position="top-right" toastOptions={{ style: { background: '#313244', color: '#cdd6f4', border: '1px solid rgba(203,166,247,0.2)', borderRadius: '12px' } }} />
      <div className="page-header">
        <h2 className="page-title">⚡ Tạo Fake Link Mới</h2>
      </div>

      <div className="glass-card" style={{ padding: 32 }}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">

            {/* CỘT TRÁI */}
            <div className="form-column">
              <h3 className="form-col-title">🪝 Cấu Hình Bẫy Click</h3>

              {/* ── Bẫy Click Lần 1 ── */}
              <AffiliatePicker
                trapLabel="Bẫy Click Lần 1 *"
                trapColor="#e53935"
                value={form.link1}
                onChange={item => {
                  setForm(p => ({ ...p, link1: item }));
                  if (errors.link1) setErrors(p => ({ ...p, link1: '' }));
                }}
                shopeeLinks={shopeeLinks}
                tiktokLinks={tiktokLinks}
              />
              {errors.link1 && <p className="form-error" style={{ marginTop: 4 }}>{errors.link1}</p>}
              <p className="form-hint" style={{ marginTop: 4 }}>
                🖱️ Click <strong>lần 1</strong> sẽ mở link này (do thẻ &lt;a&gt; href).
              </p>

              {/* ── Bẫy Click Lần 2 ── */}
              <div style={{ marginTop: 16 }}>
                <AffiliatePicker
                  trapLabel="Bẫy Click Lần 2"
                  trapColor="#7c3aed"
                  value={form.link2}
                  onChange={item => setForm(p => ({ ...p, link2: item }))}
                  shopeeLinks={shopeeLinks}
                  tiktokLinks={tiktokLinks}
                />
                <p className="form-hint" style={{ marginTop: 4 }}>
                  🔄 Sau click 1, thẻ &lt;a&gt; đổi href sang link này. Để trống nếu không cần.
                </p>
              </div>

              {/* Custom Slug */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" htmlFor="custom_slug"><Fingerprint size={14} /> Slug *</label>
                <div className="slug-input-wrapper">
                  <input id="custom_slug" type="text"
                    className={`form-input ${errors.custom_slug ? 'error' : ''} ${slugStatus === 'available' ? 'success' : ''}`}
                    placeholder="phim-hot-2026"
                    value={form.custom_slug} onChange={handleChange('custom_slug')} autoComplete="off" />
                  <div className="slug-status">
                    {slugStatus === 'checking' && <span className="slug-checking"><Loader2 size={14} className="animate-spin" /></span>}
                    {slugStatus === 'available' && <span className="slug-available">✓</span>}
                    {slugStatus === 'taken' && <span className="slug-taken">✗</span>}
                  </div>
                </div>
                {errors.custom_slug && <p className="form-error">{errors.custom_slug}</p>}
              </div>

              {/* Custom Domain */}
              <div className="form-group">
                <label className="form-label" htmlFor="custom_domain"><Globe size={14} /> Tên Miền Riêng <span className="form-optional">(tuỳ chọn)</span></label>
                <input id="custom_domain" type="text" className="form-input" placeholder="ten-cua-toi.com"
                  value={form.custom_domain} onChange={handleChange('custom_domain')} />
              </div>

              {/* Preview */}
              <div className="url-preview-box">
                <p className="url-preview-label">🌐 Preview URL:</p>
                <code className="url-preview-value">{previewUrl}</code>
              </div>
            </div>

            {/* CỘT PHẢI */}
            <div className="form-column">
              <h3 className="form-col-title">📱 OG Meta & Video</h3>

              {/* OG Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="og_title"><Type size={14} /> Tiêu Đề OG</label>
                <input id="og_title" type="text" className="form-input"
                  placeholder="Video hot nhất hôm nay 🔥" value={form.og_title}
                  onChange={handleTitleChange} maxLength={200} />
              </div>

              {/* OG Description */}
              <div className="form-group">
                <label className="form-label" htmlFor="og_description"><FileText size={14} /> Mô Tả OG</label>
                <textarea id="og_description" className="form-textarea" rows={2} maxLength={300}
                  placeholder="Mô tả ngắn xuất hiện dưới tiêu đề..." value={form.og_description}
                  onChange={handleChange('og_description')} />
              </div>

              {/* OG Image URL — Thumbnail có nút Play */}
              <div className="form-group">
                <label className="form-label" htmlFor="og_image_url">
                  🖼️ URL Ảnh Thumbnail <span className="form-optional">(có nút play giả)</span>
                </label>
                <input
                  id="og_image_url"
                  type="url"
                  className="form-input"
                  placeholder="https://i.imgur.com/abc123.jpg"
                  value={form.og_image_url}
                  onChange={handleChange('og_image_url')}
                />
                <p className="form-hint">⚡ Dán link ảnh thumbnail đã chỉnh sửa có biểu tượng ▶ ở giữa để Facebook hiển thị như video thật.</p>
                {/* Preview thumbnail nhỏ nếu có URL */}
                {form.og_image_url && (
                  <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 240 }}>
                    <img
                      src={form.og_image_url}
                      alt="Thumbnail preview"
                      style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              {/* Nguồn Video */}
              <div className="form-group">
                <label className="form-label"><Video size={14} /> Nguồn Video *</label>
                <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                  {[['telegram', 'Telegram Auto'], ['direct', 'Link Catbox/MP4']].map(([val, lbl]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="video_source" value={val}
                        checked={form.video_source === val}
                        onChange={() => setForm(p => ({ ...p, video_source: val }))} />
                      {lbl}
                    </label>
                  ))}
                </div>

                {form.video_source === 'telegram' ? (
                  <>
                    <select className={`form-input ${errors.telegram_file_id ? 'error' : ''}`}
                      value={form.telegram_file_id} onChange={handleChange('telegram_file_id')}>
                      <option value="">-- Chọn video Telegram --</option>
                      {telegramVideos.map(v => <option key={v.id} value={v.file_id}>{v.caption}</option>)}
                    </select>
                    {errors.telegram_file_id && <p className="form-error">{errors.telegram_file_id}</p>}
                  </>
                ) : (
                  <>
                    <select className={`form-input ${errors.direct_video_url ? 'error' : ''}`}
                      value={form.direct_video_url} onChange={handleChange('direct_video_url')}>
                      <option value="">-- Chọn video hoặc nhập link --</option>
                      {directVideos.map(v => <option key={v.id} value={v.url}>{v.caption}</option>)}
                    </select>
                    <input className={`form-input ${errors.direct_video_url ? 'error' : ''}`}
                      style={{ marginTop: 8 }}
                      placeholder="Hoặc dán link MP4 trực tiếp..."
                      value={form.direct_video_url} onChange={handleChange('direct_video_url')} />
                    {errors.direct_video_url && <p className="form-error">{errors.direct_video_url}</p>}
                  </>
                )}
              </div>

              {/* Mô tả video */}
              <div className="form-group">
                <label className="form-label" htmlFor="content_description"><AlignLeft size={14} /> Mô Tả Video</label>
                <textarea id="content_description" className="form-textarea" rows={3}
                  placeholder="Nội dung hiển thị dưới video..."
                  value={form.content_description} onChange={handleChange('content_description')} />
              </div>

              {/* Thumbnail */}
              <div className="form-group">
                <label className="form-label">🖼️ Thumbnail</label>
                <ImageUpload value={form.image} onChange={(file) => setForm(p => ({ ...p, image: file }))} />
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="submit-error"><span>⚠️</span><p>{errors.submit}</p></div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost"
              onClick={() => { setForm(INITIAL_FORM); setErrors({}); setSlugStatus(null); }}
              disabled={isSubmitting}>Đặt lại</button>
            <button type="submit" className="btn btn-primary btn-lg"
              disabled={isSubmitting || slugStatus === 'taken' || slugStatus === 'checking'}>
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Đang tạo...</> : <><Zap size={18} /> Tạo Cloak Link</>}
            </button>
          </div>
        </form>
      </div>

      {/* CSS nội tuyến cho các component mới */}
      <style>{`
        /* ── Trap Picker Card ── */
        .trap-picker-card {
          border: 1.5px solid;
          border-radius: 12px;
          overflow: visible;
          background: rgba(255,255,255,0.03);
          transition: box-shadow 0.2s;
        }
        .trap-picker-card:focus-within {
          box-shadow: 0 0 0 3px rgba(229,57,53,0.12);
        }
        .trap-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-bottom: 1px solid;
          flex-wrap: wrap;
          gap: 8px;
        }
        .trap-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        /* ── Platform Radio Buttons ── */
        .platform-radios {
          display: flex;
          gap: 8px;
        }
        .platform-radio-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.15);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          color: rgba(255,255,255,0.55);
          transition: all 0.18s ease;
          user-select: none;
        }
        .platform-radio-btn:hover {
          border-color: rgba(255,255,255,0.3);
          color: rgba(255,255,255,0.85);
        }
        .platform-radio-btn.active {
          font-weight: 700;
        }

        /* ── Combobox with icon ── */
        .combobox-platform-icon {
          position: absolute;
          left: 30px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          z-index: 2;
        }
        .combobox-with-icon {
          padding-left: 36px !important;
        }

        /* ── Selected badge ── */
        .selected-badge {
          margin-top: 8px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
          background: rgba(255,255,255,0.04);
        }

        /* ── Combobox empty ── */
        .combobox-empty {
          padding: 10px 14px;
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          font-style: italic;
          list-style: none;
        }
      `}</style>
    </div>
  );
};

export default CreateLinkPage;
