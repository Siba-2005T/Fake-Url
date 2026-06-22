/**
 * CreateLinkPage.jsx - Trang tạo Fake Link (Menu 1)
 */
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { Link2, Fingerprint, Globe, Type, FileText, Loader2, Zap, Video, AlignLeft, ChevronDown } from 'lucide-react';
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

/* ── Autocomplete Combobox ── */
const AffiliateCombobox = ({ label, placeholder, value, onChange, items, icon: Icon }) => {
  const [open, setOpen] = useState(false);
  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(value.toLowerCase()) || i.url.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="form-label">
        {Icon && <Icon size={14} />} {label}
      </label>
      <div className="combobox-wrapper">
        <input
          className="form-input"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        <ChevronDown size={16} className="combobox-arrow" />
      </div>
      {open && filtered.length > 0 && (
        <ul className="combobox-dropdown">
          {filtered.map(item => (
            <li key={item.id} className="combobox-item"
              onMouseDown={() => { onChange(item.url); setOpen(false); }}>
              <span className="combobox-item-name">{item.name}</span>
              <span className="combobox-item-url">{item.url.slice(0, 40)}...</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const INITIAL_FORM = {
  original_url: '', custom_slug: '', custom_domain: '',
  og_title: '', og_description: '',
  video_source: 'direct', telegram_file_id: '', direct_video_url: '',
  content_description: '', second_affiliate_url: '', image: null,
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
    if (!form.original_url.trim()) e.original_url = 'URL gốc là bắt buộc.';
    else if (!form.original_url.startsWith('http')) e.original_url = 'URL phải bắt đầu bằng http://';
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
      const result = await createLink(form);
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
              <h3 className="form-col-title">🔗 Thông tin Link</h3>

              {/* URL Shopee (Bẫy tầng 1) */}
              <AffiliateCombobox
                label="Link Shopee (Bẫy tầng 1) *"
                placeholder="https://shopee.vn/... hoặc chọn từ danh sách"
                value={form.original_url}
                onChange={val => { setForm(p => ({ ...p, original_url: val })); if (errors.original_url) setErrors(p => ({ ...p, original_url: '' })); }}
                items={shopeeLinks}
                icon={Link2}
              />
              {errors.original_url && <p className="form-error">{errors.original_url}</p>}

              {/* URL TikTok (Bẫy tầng 2) */}
              <AffiliateCombobox
                label="Link TikTok (Bẫy tầng 2)"
                placeholder="https://www.tiktok.com/... hoặc chọn từ danh sách"
                value={form.second_affiliate_url}
                onChange={val => setForm(p => ({ ...p, second_affiliate_url: val }))}
                items={tiktokLinks}
                icon={Link2}
              />
              <p className="form-hint">⚡ Click lần 2 mở link này. Để trống nếu không cần.</p>

              {/* Custom Slug */}
              <div className="form-group">
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
                  placeholder="Sản phẩm HOT - Giảm 50%!" value={form.og_title}
                  onChange={handleTitleChange} maxLength={200} />
              </div>

              {/* OG Description */}
              <div className="form-group">
                <label className="form-label" htmlFor="og_description"><FileText size={14} /> Mô Tả OG</label>
                <textarea id="og_description" className="form-textarea" rows={3} maxLength={500}
                  placeholder="Mô tả ngắn..." value={form.og_description}
                  onChange={handleChange('og_description')} />
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
    </div>
  );
};

export default CreateLinkPage;
