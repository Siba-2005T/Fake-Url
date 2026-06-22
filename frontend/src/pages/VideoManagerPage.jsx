/**
 * VideoManagerPage.jsx - Quản lý Video (Telegram + Direct)
 */
import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Pencil, X, Check, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  fetchTelegramVideos, deleteTelegramVideo,
  fetchDirectVideos, createDirectVideo, updateDirectVideo, deleteDirectVideo,
} from '../api/api';

/* ── Modal nhỏ thêm/sửa Direct Video ── */
const DirectVideoModal = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState({ caption: item?.caption || '', url: item?.url || '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.caption.trim() || !form.url.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin!');
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await updateDirectVideo(item.id, form);
        toast.success('Cập nhật thành công!');
      } else {
        await createDirectVideo(form);
        toast.success('Thêm video thành công!');
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
          <h3>{item ? 'Sửa Video' : 'Thêm Video Trực Tiếp'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Tên hiển thị (Caption) *</label>
            <input className="form-input" value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))} placeholder="Phim ABC - Tập 1" />
          </div>
          <div className="form-group">
            <label className="form-label">Link MP4 (Catbox...) *</label>
            <input className="form-input" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://files.catbox.moe/abc.mp4" />
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

/* ── Tab: Telegram Videos ── */
const TelegramTab = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTelegramVideos();
      setVideos(res.data || []);
    } catch { toast.error('Không tải được danh sách.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, caption) => {
    if (!window.confirm(`Xóa "${caption}"?`)) return;
    try {
      await deleteTelegramVideo(id);
      toast.success('Đã xóa!');
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="table-loading"><Loader2 className="animate-spin" /> Đang tải...</div>;

  return (
    <div>
      <div className="table-toolbar">
        <span className="table-count">{videos.length} video</span>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Làm mới</button>
      </div>
      {videos.length === 0
        ? <div className="table-empty">Chưa có video nào. Gửi video cho bot Telegram để bắt đầu.</div>
        : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Caption</th><th>File ID</th><th>Ngày nhận</th><th>Hành động</th></tr></thead>
            <tbody>
              {videos.map((v, i) => (
                <tr key={v.id}>
                  <td className="td-num">{i + 1}</td>
                  <td><strong>{v.caption}</strong></td>
                  <td><code className="code-cell">{v.file_id.slice(0, 20)}...</code></td>
                  <td className="td-date">{new Date(v.created_at).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(v.id, v.caption)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
};

/* ── Tab: Direct Videos ── */
const DirectTab = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | item object

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDirectVideos();
      setVideos(res.data || []);
    } catch { toast.error('Không tải được danh sách.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, caption) => {
    if (!window.confirm(`Xóa "${caption}"?`)) return;
    try {
      await deleteDirectVideo(id);
      toast.success('Đã xóa!');
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="table-loading"><Loader2 className="animate-spin" /> Đang tải...</div>;

  return (
    <div>
      <div className="table-toolbar">
        <span className="table-count">{videos.length} video</span>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>
          <Plus size={14} /> Thêm mới
        </button>
      </div>
      {videos.length === 0
        ? <div className="table-empty">Chưa có video nào.</div>
        : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Caption</th><th>URL</th><th>Ngày tạo</th><th>Hành động</th></tr></thead>
            <tbody>
              {videos.map((v, i) => (
                <tr key={v.id}>
                  <td className="td-num">{i + 1}</td>
                  <td><strong>{v.caption}</strong></td>
                  <td><a href={v.url} target="_blank" rel="noopener noreferrer" className="link-cell">{v.url.slice(0, 40)}...</a></td>
                  <td className="td-date">{new Date(v.created_at).toLocaleDateString('vi-VN')}</td>
                  <td className="td-actions">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(v)}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(v.id, v.caption)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {modal && (
        <DirectVideoModal
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
};

/* ── Page chính ── */
const VideoManagerPage = () => {
  const [tab, setTab] = useState('telegram');

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">🎬 Quản lý Video</h2>
      </div>

      <div className="tabs-nav" style={{ marginBottom: 24 }}>
        <button className={`tab-btn ${tab === 'telegram' ? 'tab-btn--active' : ''}`} onClick={() => setTab('telegram')}>
          📩 Video Telegram
        </button>
        <button className={`tab-btn ${tab === 'direct' ? 'tab-btn--active' : ''}`} onClick={() => setTab('direct')}>
          🔗 Video Trực Tiếp (Catbox)
        </button>
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        {tab === 'telegram' ? <TelegramTab /> : <DirectTab />}
      </div>
    </div>
  );
};

export default VideoManagerPage;
