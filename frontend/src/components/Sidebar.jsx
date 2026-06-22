/**
 * Sidebar.jsx - Thanh điều hướng bên trái (Auth-aware)
 */
import { NavLink } from 'react-router-dom';
import { Zap, PlusCircle, Video, Link2, Users, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    { to: '/',           icon: PlusCircle, label: 'Tạo Fake Link' },
    { to: '/videos',     icon: Video,      label: 'Quản lý Video' },
    { to: '/affiliate',  icon: Link2,      label: 'Link Tiếp Thị' },
  ];

  // Menu admin-only
  if (isAdmin) {
    navItems.push({ to: '/users', icon: Users, label: 'Quản lý User' });
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Zap size={20} /></div>
        <span className="sidebar-logo-text">CloakLink</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user-info">
            <span className="sidebar-username">
              {user.role === 'admin' ? '👑' : '👤'} {user.username}
            </span>
            <button className="sidebar-logout-btn" onClick={logout} title="Đăng xuất">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
