/**
 * LoginPage.jsx - Trang đăng nhập
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        navigate('/', { replace: true });
      } else {
        setError(res.error || 'Đăng nhập thất bại.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="sidebar-logo-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
            <Zap size={24} />
          </div>
          <h1 className="login-title">CloakLink</h1>
          <p className="login-subtitle">Đăng nhập vào Admin Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Tên đăng nhập</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading
              ? <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</>
              : <><LogIn size={18} /> Đăng nhập</>
            }
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
