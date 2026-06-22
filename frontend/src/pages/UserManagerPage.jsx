/**
 * UserManagerPage.jsx - Quản lý người dùng (Admin only)
 */
import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, X, Check, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchUsers, createUser, deleteUser } from '../api/api';

/* ── Modal thêm user ── */
const AddUserModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({
    username: '', password: '', role: 'user', telegram_chat_id: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      toast.error('Username và Password là bắt buộc!');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password phải có ít nhất 6 ký tự!');
      return;
    }
    setSaving(true);
    try {
      await createUser({
        ...form,
        telegram_chat_id: form.telegram_chat_id.trim() || undefined,
      });
      toast.success(`Tạo user "${form.username}" thành công!`);
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
          <h3><UserPlus size={18} /> Thêm Người Dùng</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input className="form-input" value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="nguoidung01" autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Tối thiểu 6 ký tự" autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <div style={{ display: 'flex', gap: 16 }}>
              {['user', 'admin'].map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="role" value={r}
                    checked={form.role === r}
                    onChange={() => setForm(p => ({ ...p, role: r }))} />
                  {r === 'admin' ? '👑 Admin' : '👤 User'}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Telegram Chat ID</label>
            <input className="form-input" value={form.telegram_chat_id}
              onChange={e => setForm(p => ({ ...p, telegram_chat_id: e.target.value }))}
              placeholder="123456789 (lấy từ @userinfobot)" />
            <p className="form-hint">Dùng để bot Telegram tự gắn video cho đúng user.</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Tạo User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Role badge ── */
const ROLE_STYLE = {
  admin: { label: '👑 Admin', bg: '#f9731622', color: '#f97316', border: '#f9731655' },
  user:  { label: '👤 User',  bg: '#3b82f622', color: '#3b82f6', border: '#3b82f655' },
};

/* ── Page chính ── */
const UserManagerPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
      setUsers(res.data || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Xóa user "${username}"? Tất cả dữ liệu của user này sẽ không có chủ nữa.`)) return;
    try {
      await deleteUser(id);
      toast.success(`Đã xóa user "${username}".`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">👥 Quản lý Người Dùng</h2>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={16} /> Thêm User
        </button>
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        {loading
          ? <div className="table-loading"><Loader2 className="animate-spin" /> Đang tải...</div>
          : users.length === 0
            ? <div className="table-empty">Chưa có user nào.</div>
            : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Telegram Chat ID</th>
                    <th>Ngày tạo</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const rs = ROLE_STYLE[u.role] || ROLE_STYLE.user;
                    return (
                      <tr key={u.id}>
                        <td className="td-num">{i + 1}</td>
                        <td><strong>{u.username}</strong></td>
                        <td>
                          <span className="platform-badge" style={{ background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}>
                            {rs.label}
                          </span>
                        </td>
                        <td>
                          {u.telegram_chat_id
                            ? <code className="code-cell">{u.telegram_chat_id}</code>
                            : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Chưa liên kết</span>
                          }
                        </td>
                        <td className="td-date">{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <button className="btn btn-danger btn-sm btn-icon"
                            onClick={() => handleDelete(u.id, u.username)} title="Xóa user">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
      </div>

      {modal && (
        <AddUserModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load(); }}
        />
      )}
    </div>
  );
};

export default UserManagerPage;
