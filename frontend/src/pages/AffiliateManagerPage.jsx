/**
 * AffiliateManagerPage.jsx - Quản lý Link Tiếp Thị (Shopee/TikTok)
 */
import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Pencil, X, Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchAffiliateLinks, createAffiliateLink, updateAffiliateLink, deleteAffiliateLink } from '../api/api';

const PLATFORMS = [
  { value: '', label: 'Tất cả' },
  { value: 'shopee', label: '🛒 Shopee' },
  { value: 'tiktok', label: '🎵 TikTok' },
];

const PLATFORM_BADGE = {
  shopee: { label: 'Shopee', color: '#f97316' },
  tiktok: { label: 'TikTok', color: '#ec4899' },
};

/* ── Modal Thêm/Sửa Affiliate Link ── */
const AffiliateModal = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState({
    platform: item?.platform || 'shopee',
    name: item?.name || '',
    url: item?.url || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin!');
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await updateAffiliateLink(item.id, form);
        toast.success('Cập nhật thành công!');
      } else {
        await createAffiliateLink(form);
        toast.success('Thêm link thành công!');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item ? 'Sửa Link Tiếp Thị' : 'Thêm Link Tiếp Thị'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Nền tảng *</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {['shopee', 'tiktok'].map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="platform" value={p}
                    checked={form.platform === p}
                    onChange={() => setForm(prev => ({ ...prev, platform: p }))} />
                  {PLATFORM_BADGE[p].label}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tên gợi nhớ *</label>
            <input className="form-input" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Áo thun sale 31/5..." />
          </div>
          <div className="form-group">
            <label className="form-label">Đường link gốc *</label>
            <input className="form-input" value={form.url}
              onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="https://shopee.vn/..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {item ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Page chính ── */
const AffiliateManagerPage = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAffiliateLinks(filter);
      setLinks(res.data || []);
    } catch { toast.error('Không tải được danh sách.'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa "${name}"?`)) return;
    try {
      await deleteAffiliateLink(id);
      toast.success('Đã xóa!');
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">🔗 Quản lý Link Tiếp Thị</h2>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        {PLATFORMS.map(({ value, label }) => (
          <button key={value}
            className={`filter-btn ${filter === value ? 'filter-btn--active' : ''}`}
            onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        {loading
          ? <div className="table-loading"><Loader2 className="animate-spin" /> Đang tải...</div>
          : links.length === 0
            ? <div className="table-empty">Chưa có link nào.</div>
            : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nền tảng</th>
                    <th>Tên gợi nhớ</th>
                    <th>URL</th>
                    <th>Ngày tạo</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l, i) => {
                    const badge = PLATFORM_BADGE[l.platform] || {};
                    return (
                      <tr key={l.id}>
                        <td className="td-num">{i + 1}</td>
                        <td>
                          <span className="platform-badge" style={{ background: badge.color + '22', color: badge.color, border: `1px solid ${badge.color}55` }}>
                            {badge.label}
                          </span>
                        </td>
                        <td><strong>{l.name}</strong></td>
                        <td>
                          <a href={l.url} target="_blank" rel="noopener noreferrer" className="link-cell">
                            {l.url.length > 45 ? l.url.slice(0, 45) + '...' : l.url}
                          </a>
                        </td>
                        <td className="td-date">{new Date(l.created_at).toLocaleDateString('vi-VN')}</td>
                        <td className="td-actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(l)}><Pencil size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(l.id, l.name)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
      </div>

      {modal && (
        <AffiliateModal
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
};

export default AffiliateManagerPage;
